import * as path from 'path';
import { workspace, ExtensionContext, window, OutputChannel, commands } from 'vscode';
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind,
  ErrorHandlerResult,
  CloseHandlerResult,
  RevealOutputChannelOn
} from 'vscode-languageclient/node';

let client: LanguageClient;
let outputChannel: OutputChannel;

export function activate(context: ExtensionContext) {
  // Crear canal de salida para debugging
  outputChannel = window.createOutputChannel('Bun Plugins LSP');
  outputChannel.appendLine('Activating Bun Plugins LSP...');

  // The server is implemented in node
  const serverModule = context.asAbsolutePath(
    path.join('dist', 'server.js')
  );

  // Server options with better error handling
  const serverOptions: ServerOptions = {
    run: {
      module: serverModule,
      transport: TransportKind.stdio,
      options: {
        env: {
          ...process.env,
          NODE_ENV: 'production'
        }
      }
    },
    debug: {
      module: serverModule,
      transport: TransportKind.stdio,
      options: {
        env: {
          ...process.env,
          NODE_ENV: 'development',
          DEBUG: 'bun-plugins-lsp:*'
        }
      }
    }
  };

  // Options to control the language client with better configuration
  const clientOptions: LanguageClientOptions = {
    documentSelector: [
      { scheme: 'file', language: 'typescript' }, 
      { scheme: 'file', language: 'javascript' }
    ],
    synchronize: {
      fileEvents: workspace.createFileSystemWatcher('**/.clientrc')
    },
    outputChannel: outputChannel,
    revealOutputChannelOn: RevealOutputChannelOn.Error,
    initializationOptions: {
      maxNumberOfProblems: workspace.getConfiguration('bunPlugins').get('maxNumberOfProblems', 100)
    },
    errorHandler: {
      error: (error: Error, message: any, count: number): ErrorHandlerResult => {
        outputChannel.appendLine(`LSP Error: ${error.message}`);
        return { action: count <= 3 ? 1 : 2 }; // 1 = Continue, 2 = Shutdown
      },
      closed: (): CloseHandlerResult => {
        outputChannel.appendLine('LSP connection closed');
        return { action: 1 }; // 1 = Restart
      }
    },
    middleware: {
      provideCompletionItem: async (document, position, context, token, next) => {
        try {
          return await next(document, position, context, token);
        } catch (error) {
          outputChannel.appendLine(`Completion error: ${error}`);
          return [];
        }
      }
    }
  };

  // Create the language client with better error handling
  client = new LanguageClient(
    'bunPluginsLsp',
    'Bun Plugins LSP',
    serverOptions,
    clientOptions
  );

  // Register event handlers
  client.onDidChangeState((event) => {
    outputChannel.appendLine(`LSP State changed: ${event.newState}`);
  });

  // Start the client with error handling
  try {
    client.start();
    context.subscriptions.push({
      dispose: () => client.stop()
    });
    outputChannel.appendLine('LSP Client started successfully');
  } catch (error) {
    outputChannel.appendLine(`Failed to start LSP Client: ${error}`);
    window.showErrorMessage(`Failed to start Bun Plugins LSP: ${error}`);
  }

  // Register commands
  const restartCommand = commands.registerCommand('bunPlugins.restart', async () => {
    outputChannel.appendLine('Restarting LSP...');
    await client.stop();
    client.start();
  });

  context.subscriptions.push(restartCommand);
}

export function deactivate(): Thenable<void> | undefined {
  if (!client) {
    return undefined;
  }
  outputChannel?.appendLine('Deactivating LSP Client...');
  return client.stop();
}