#!/usr/bin/env node

import {
  createConnection,
  TextDocuments,
  ProposedFeatures,
  InitializeParams,
  DidChangeConfigurationNotification,
  CompletionItem,
  CompletionItemKind,
  TextDocumentPositionParams,
  TextDocumentSyncKind,
  InitializeResult,
  Connection
} from 'vscode-languageserver/node';

import {
  TextDocument
} from 'vscode-languageserver-textdocument';

import { PluginRegistry } from './utils/registry';
import { scanPlugins } from './utils/scanner';
import { analyzeText } from './utils/analyzer';
import { PluginTypeGenerator } from './utils/typeGenerator';
import { startAutoRegeneration, WatcherHandle } from './utils/fileWatcher';
import * as path from 'path';
import * as fs from 'fs';

// Detectar el modo de transporte desde los argumentos de línea de comandos
const args = process.argv.slice(2);
const transport = args.includes('--stdio') ? 'stdio' : 'ipc';

// Crear conexión con el transporte correcto
let connection: Connection;
if (transport === 'stdio') {
  // Para stdio, usar la forma simplificada sin logs para no interferir
  connection = createConnection(process.stdin, process.stdout);
} else {
  // Para ipc, usar la API estándar con todas las características
  connection = createConnection(ProposedFeatures.all);
}
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

let hasConfigurationCapability = false;
let hasWorkspaceFolderCapability = false;
let workspaceRoot: string | undefined;
let isInitialized = false;
let fileWatcher: WatcherHandle | null = null;
let shutdownRequested = false;

// Logging mejorado - solo usar LSP console para no interferir con stdio
function logInfo(message: string): void {
  if (!shutdownRequested) {
    connection.console.info(`[BunPluginsLSP] ${message}`);
  }
}

function logError(message: string, error?: any): void {
  if (!shutdownRequested) {
    const errorMessage = error ? `${message}: ${error.message || error}` : message;
    connection.console.error(`[BunPluginsLSP] ${errorMessage}`);
  }
}

// Create a logger that matches the interface expected by scanner and fileWatcher
const createLogger = () => ({
  info: (message: string) => logInfo(message),
  warn: (message: string) => {
    if (!shutdownRequested) {
      connection.console.warn(`[BunPluginsLSP] ${message}`);
    }
  },
  error: (message: string) => logError(message)
});

/**
 * Find the correct workspace root by looking for plugins directory
 */
function findCorrectWorkspaceRoot(initialRoot: string): string {
  // If initial root contains plugins directory, use it
  if (fs.existsSync(path.join(initialRoot, 'plugins'))) {
    return initialRoot;
  }
  
  // If we're in vscode-extension directory, go up one level
  if (path.basename(initialRoot) === 'vscode-extension') {
    const parentDir = path.dirname(initialRoot);
    if (fs.existsSync(path.join(parentDir, 'plugins'))) {
      logInfo(`Found plugins directory in parent: ${parentDir}`);
      return parentDir;
    }
  }
  
  // Look for plugins directory in parent directories
  let currentDir = initialRoot;
  for (let i = 0; i < 3; i++) { // Check up to 3 levels up
    const parentDir = path.dirname(currentDir);
    if (fs.existsSync(path.join(parentDir, 'plugins'))) {
      logInfo(`Found plugins directory in ancestor: ${parentDir}`);
      return parentDir;
    }
    currentDir = parentDir;
  }
  
  logInfo(`Using original workspace root: ${initialRoot}`);
  return initialRoot;
}

// Manejar inicialización
connection.onInitialize((params: InitializeParams) => {
  logInfo('Initializing LSP server...');
  
  const capabilities = params.capabilities;
  
  // Configurar workspace root
  if (params.workspaceFolders && params.workspaceFolders.length > 0) {
    workspaceRoot = params.workspaceFolders[0].uri.replace('file:///', '').replace('file://', '');
    if (process.platform === 'win32' && workspaceRoot.startsWith('/')) {
      workspaceRoot = workspaceRoot.substring(1);
    }
    workspaceRoot = decodeURIComponent(workspaceRoot);
  } else if (params.rootUri) {
    workspaceRoot = params.rootUri.replace('file:///', '').replace('file://', '');
    if (process.platform === 'win32' && workspaceRoot.startsWith('/')) {
      workspaceRoot = workspaceRoot.substring(1);
    }
    workspaceRoot = decodeURIComponent(workspaceRoot);
  }

  // Find correct workspace root
  if (workspaceRoot) {
    workspaceRoot = findCorrectWorkspaceRoot(workspaceRoot);
  }

  logInfo(`Workspace root: ${workspaceRoot}`);

  hasConfigurationCapability = !!(
    capabilities.workspace && !!capabilities.workspace.configuration
  );
  hasWorkspaceFolderCapability = !!(
    capabilities.workspace && !!capabilities.workspace.workspaceFolders
  );

  const result: InitializeResult = {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      completionProvider: {
        resolveProvider: true,
        triggerCharacters: ['.', '"', '\'', '(', '/']
      }
    }
  };

  if (hasWorkspaceFolderCapability) {
    result.capabilities.workspace = {
      workspaceFolders: {
        supported: true
      }
    };
  }

  logInfo('LSP server initialized successfully');
  return result;
});

// Manejar inicialización completada
connection.onInitialized(async () => {
  logInfo('LSP server onInitialized called');
  isInitialized = true;

  if (hasConfigurationCapability) {
    try {
      await connection.client.register(DidChangeConfigurationNotification.type, undefined);
      logInfo('Registered for configuration changes');
    } catch (error) {
      logError('Failed to register for configuration changes', error);
    }
  }

  // Realizar escaneo inicial de plugins
  if (workspaceRoot) {
    try {
      await performInitialPluginScan();
    } catch (error) {
      logError('Error during initial plugin scan', error);
    }
  }
});

async function performInitialPluginScan(): Promise<void> {
  if (!workspaceRoot) {
    logError('Workspace root not set, skipping initial plugin scan');
    return;
  }

  logInfo(`Performing initial plugin scan in ${workspaceRoot}...`);
  
  try {
    // Check if plugins directory exists
    const pluginsDir = path.join(workspaceRoot, 'plugins');
    if (!fs.existsSync(pluginsDir)) {
      logInfo(`Plugins directory not found at ${pluginsDir}, creating it...`);
      fs.mkdirSync(pluginsDir, { recursive: true });
    }

    const plugins = await scanPlugins(workspaceRoot, { logger: createLogger() });
    PluginRegistry.getInstance().update(plugins);
    logInfo(`Found ${plugins.length} plugins during initial scan`);

    // Generate types with enhanced validation
    const typeGenerator = PluginTypeGenerator.getInstance();
    const result = await typeGenerator.generateTypesWithValidation(plugins, {
      workspaceRoot,
      typesDir: '.bun-plugins-types',
      updateTsConfig: true,
      validatePlugins: true,
      generateDocs: true,
      forceRegenerate: true, // Force on initial scan
      verbose: false // Don't log to console in stdio mode
    });

    if (result.success) {
      logInfo(`✅ Generated types for ${result.pluginCount} plugins`);
      if (result.filesGenerated.length > 0) {
        logInfo(`Files generated: ${result.filesGenerated.join(', ')}`);
      }
      if (result.typesDirCreated) {
        logInfo(`Created types directory: .bun-plugins-types`);
      }
    } else {
      logError('Type generation completed with errors');
      result.errors.forEach(err => logError(err));
    }

    if (result.warnings.length > 0) {
      logInfo(`Warnings: ${result.warnings.length}`);
      result.warnings.forEach(warn => logInfo(warn));
    }

    // Start file watcher for automatic regeneration
    startFileWatcher();
  } catch (error) {
    logError('❌ Error during initial plugin scan', error);
  }
}

/**
 * Starts file watcher for automatic type regeneration
 */
function startFileWatcher(): void {
  if (!workspaceRoot) return;

  logInfo('Starting file watcher for automatic type regeneration...');

  const logger = createLogger();

  try {
    // Use a more robust file watching approach
    const pluginsDir = path.join(workspaceRoot, 'plugins');
    
    if (!fs.existsSync(pluginsDir)) {
      logInfo(`Plugins directory not found at ${pluginsDir}, skipping file watcher`);
      return;
    }

    fileWatcher = startAutoRegeneration(
      workspaceRoot,
      (root) => scanPlugins(root, { logger }),
      async (plugins) => {
        // Regenerate types when plugins change
        if (!workspaceRoot) return;
        
        try {
          const typeGenerator = PluginTypeGenerator.getInstance();
          const result = await typeGenerator.generateTypesWithValidation(plugins, {
            workspaceRoot,
            typesDir: '.bun-plugins-types',
            updateTsConfig: false, // Don't update tsconfig on every change
            validatePlugins: true,
            generateDocs: true,
            verbose: false
          });

          if (result.success) {
            PluginRegistry.getInstance().update(plugins);
            logInfo(`✅ Auto-regenerated types for ${result.pluginCount} plugins`);
          } else {
            logError('Auto-regeneration completed with errors');
            result.errors.forEach(err => logError(err));
          }
        } catch (error) {
          logError('Error during auto-regeneration', error);
        }
      },
      {
        debounceMs: 1000, // Increased debounce to avoid excessive regeneration
        onError: (error) => logError('File watcher error', error),
        logger
      }
    );

    logInfo('✅ File watcher started');
  } catch (error) {
    logError('Failed to start file watcher', error);
  }
}

// Manejar cambios en documentos
documents.onDidChangeContent(async (change) => {
  if (shutdownRequested) return;
  
  try {
    const text = change.document.getText();
    const filePath = change.document.uri.replace('file:///', '').replace('file://', '');
    const decodedPath = decodeURIComponent(filePath);
    
    logInfo(`Document changed: ${decodedPath}`);
    
    // Analizar el archivo actualizado
    const info = analyzeText(text, decodedPath);
    if (info) {
      PluginRegistry.getInstance().set(info);
      logInfo(`Updated registry for plugin: ${info.name}`);
    }
  } catch (error) {
    logError('Error analyzing changed document', error);
  }
});

// Manejar cambios en archivos observados
connection.onDidChangeWatchedFiles(async (change) => {
  if (shutdownRequested) return;
  
  logInfo('Watched files changed, triggering plugin rescan...');
  
  if (workspaceRoot) {
    try {
      // Scan plugins and regenerate types
      const plugins = await scanPlugins(workspaceRoot, { logger: createLogger() });
      PluginRegistry.getInstance().update(plugins);
      logInfo(`Scanned ${plugins.length} plugins after file change`);
      
      // Regenerate types with validation
      try {
        const typeGenerator = PluginTypeGenerator.getInstance();
        const result = await typeGenerator.generateTypesWithValidation(plugins, {
          workspaceRoot,
          typesDir: '.bun-plugins-types',
          updateTsConfig: false, // Don't update tsconfig on every change
          validatePlugins: true,
          generateDocs: true,
          forceRegenerate: true, // Force regeneration when explicitly requested
          verbose: false
        });

        if (result.success) {
          logInfo(`✅ Regenerated types for ${result.pluginCount} plugins (${result.filesGenerated.length} files)`);
        } else {
          logError('Type regeneration completed with errors');
          result.errors.forEach(err => logError(err));
        }
      } catch (error) {
        logError('❌ Error regenerating types', error);
      }
    } catch (error) {
      logError('Error rescanning plugins after file change', error);
    }
  }
});

// Manejar solicitudes de autocompletado
connection.onCompletion(
  (textDocumentPosition: TextDocumentPositionParams): CompletionItem[] => {
    if (shutdownRequested) return [];
    
    try {
      const doc = documents.get(textDocumentPosition.textDocument.uri);
      if (!doc) return [];

      const text = doc.getText();
      const offset = doc.offsetAt(textDocumentPosition.position);
      const textUntilCursor = text.substring(0, offset);
      
      logInfo(`Completion requested at position ${textDocumentPosition.position.line}:${textDocumentPosition.position.character}`);

      // 1. Check for getPlugin("...") - Plugin Names
      const getPluginMatch = /getPlugin\(\s*(['"]?)$/.exec(textUntilCursor);
      if (getPluginMatch) {
        const quote = getPluginMatch[1];
        const plugins = PluginRegistry.getInstance().getAll();
        logInfo(`Providing plugin name completions for ${plugins.length} plugins`);
        
        return plugins.map(p => ({
          label: p.name,
          kind: CompletionItemKind.Module,
          detail: `Plugin: ${p.name}`,
          documentation: `Class: ${p.className}\nFile: ${path.basename(p.filePath)}`,
          insertText: quote ? p.name : `'${p.name}'`
        }));
      }

      // 2. Check for emitters.on("...") or emit("...") - Event Names
      const eventMatch = /(?:emitters\.on|emit)\(\s*(['"]?)$/.exec(textUntilCursor);
      if (eventMatch) {
        const quote = eventMatch[1];
        const events = new Set<string>();
        PluginRegistry.getInstance().getAll().forEach(p => {
          p.events.forEach(e => events.add(e));
        });
        
        logInfo(`Providing event name completions for ${events.size} events`);
        
        return Array.from(events).map(e => ({
          label: e,
          kind: CompletionItemKind.Event,
          detail: 'Plugin Event',
          insertText: quote ? e : `'${e}'`
        }));
      }

      // 3. Check for getPlugin("name").METHOD
      const methodAccessMatch = /getPlugin\(\s*['"]([^"']+)['"]\s*\)\.$/.exec(textUntilCursor);
      if (methodAccessMatch) {
        const pluginName = methodAccessMatch[1];
        const plugin = PluginRegistry.getInstance().get(pluginName);
        
        if (plugin) {
          logInfo(`Providing method completions for plugin: ${pluginName}`);
          
          const items: CompletionItem[] = [];

          // Add Methods
          plugin.methods.forEach(m => {
            items.push({
              label: m.name,
              kind: CompletionItemKind.Method,
              detail: `(${m.params.join(', ')}) => ${m.returnType}`,
              documentation: m.doc || `Method ${m.name} of plugin ${pluginName}`
            });
          });

          // Add Properties
          if (plugin.properties) {
            plugin.properties.forEach(p => {
              items.push({
                label: p.name,
                kind: CompletionItemKind.Property,
                detail: p.type,
                documentation: p.doc || `Property ${p.name} of plugin ${pluginName}`
              });
            });
          }

          // Always add getSharedApi if not already present
          if (!plugin.methods.some(m => m.name === 'getSharedApi')) {
            items.push({
              label: 'getSharedApi',
              kind: CompletionItemKind.Method,
              detail: '() => PluginApi',
              documentation: `Get shared API for plugin ${pluginName}`
            });
          }

          return items;
        }
      }

      // 4. Check for variable assignments with getPlugin to provide type annotations
      const assignmentMatch = /const\s+(\w+)\s*=\s*context\.getPlugin\(\s*['"]([^"']+)['"]\s*\)/.exec(textUntilCursor);
      if (assignmentMatch) {
        const varName = assignmentMatch[1];
        const pluginName = assignmentMatch[2];
        const plugin = PluginRegistry.getInstance().get(pluginName);
        
        if (plugin) {
          logInfo(`Providing type annotation completion for variable: ${varName}`);
          
          const interfaceName = getInterfaceName(plugin.name);
          return [{
            label: `const ${varName}: ${interfaceName}`,
            kind: CompletionItemKind.Variable,
            detail: `Typed plugin variable`,
            documentation: `Add type annotation for ${varName} as ${interfaceName}`,
            insertText: `const ${varName}: ${interfaceName} = context.getPlugin('${pluginName}')`
          }];
        }
      }

      return [];
    } catch (error) {
      logError('Error providing completions', error);
      return [];
    }
  }
);

// Helper method to get interface name (moved from typeGenerator)
function getInterfaceName(pluginName: string): string {
  // Convertir nombre de plugin a nombre de interface (ej: "math-plugin" -> "MathPluginApi")
  return pluginName.split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join('') + 'Api';
}


connection.onCompletionResolve((item) => item);

// Manejar cierre de conexión - FIXED VERSION
connection.onShutdown(async () => {
  logInfo('LSP server shutting down...');
  shutdownRequested = true;
  isInitialized = false;
  
  // Stop file watcher
  if (fileWatcher) {
    try {
      fileWatcher.stop();
      fileWatcher = null;
      logInfo('File watcher stopped successfully');
    } catch (error) {
      logError('Error stopping file watcher', error);
    }
  }
  
  // Stop document listeners (TextDocuments doesn't have dispose method)
  try {
    logInfo('Document listeners will be stopped with connection');
  } catch (error) {
    logError('Error with document listeners', error);
  }
  
  logInfo('LSP server shutdown complete');
  
  // Force exit after a short delay to prevent hanging
  setTimeout(() => {
    logInfo('Forcing process exit');
    process.exit(0);
  }, 100);
});

// Configurar listeners
documents.listen(connection);
connection.listen();

// Log final solo si la conexión está establecida
if (connection) {
  logInfo('LSP server setup complete - fixed version');
}

// Handle process termination signals
process.on('SIGTERM', () => {
  logInfo('Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  logInfo('Received SIGINT, shutting down gracefully...');
  process.exit(0);
});