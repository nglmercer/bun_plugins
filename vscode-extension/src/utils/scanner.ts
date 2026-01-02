/**
 * Enhanced Plugin Scanner with Recursive Discovery
 * Scans for plugin files in workspace directories
 */

import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';
import { analyzeSourceFile } from './analyzer';
import { PluginInfo } from './types';
import { findPluginFiles } from './fileUtils';

export interface ScanOptions {
  recursive?: boolean;
  maxDepth?: number;
  includeTestFiles?: boolean;
  excludePatterns?: RegExp[];
  logger?: {
    info: (message: string) => void;
    warn: (message: string) => void;
    error: (message: string) => void;
  };
}

export interface ScanResult {
  plugins: PluginInfo[];
  errors: string[];
  scannedFiles: number;
  skippedFiles: number;
}

/**
 * Default scan options
 */
const DEFAULT_SCAN_OPTIONS: ScanOptions = {
  recursive: true,
  maxDepth: 10,
  includeTestFiles: false,
  excludePatterns: [
    /node_modules/,
    /\.git/,
    /dist/,
    /build/,
    /\.vscode/,
    /coverage/
  ]
};

/**
 * Silent logger (no output to avoid stdio corruption)
 */
const silentLogger = {
  info: () => {},
  warn: () => {},
  error: () => {}
};

/**
 * Scans for plugins in a workspace directory
 */
export async function scanPlugins(
  workspaceRoot: string,
  options: ScanOptions = {}
): Promise<PluginInfo[]> {
  const logger = options.logger || silentLogger;
  const opts = { ...DEFAULT_SCAN_OPTIONS, ...options };
  const result = await scanPluginsWithOptions(workspaceRoot, opts, logger);
  
  if (result.errors.length > 0) {
    logger.warn(`[Scanner] Plugin scan completed with ${result.errors.length} errors:`);
    result.errors.forEach(err => logger.warn(`  - ${err}`));
  }
  
  logger.info(`[Scanner] ✅ Scanned ${result.scannedFiles} files, found ${result.plugins.length} plugins, skipped ${result.skippedFiles} files`);
  
  return result.plugins;
}

/**
 * Scans for plugins with detailed results
 */
export async function scanPluginsWithOptions(
  workspaceRoot: string,
  options: ScanOptions,
  logger: any = silentLogger
): Promise<ScanResult> {
  const result: ScanResult = {
    plugins: [],
    errors: [],
    scannedFiles: 0,
    skippedFiles: 0
  };

  // Find plugin files
  const pluginFiles = findPluginFiles(workspaceRoot);
  
  logger.info(`[Scanner] Found ${pluginFiles.length} potential plugin files in ${workspaceRoot}`);
  
  for (const filePath of pluginFiles) {
    result.scannedFiles++;
    
    // Check exclusion patterns
    const shouldExclude = options.excludePatterns?.some(pattern => 
      pattern.test(filePath) || pattern.test(path.basename(filePath))
    );
    
    if (shouldExclude) {
      result.skippedFiles++;
      logger.info(`[Scanner] Excluding file: ${filePath}`);
      continue;
    }
    
    // Check test files
    if (!options.includeTestFiles) {
      const fileName = path.basename(filePath);
      if (fileName.endsWith('.test.ts') || fileName.endsWith('.spec.ts') || fileName.endsWith('.test.js')) {
        result.skippedFiles++;
        logger.info(`[Scanner] Skipping test file: ${filePath}`);
        continue;
      }
    }
    
    try {
      // Read and analyze file
      const content = await fs.promises.readFile(filePath, 'utf-8');
      const sourceFile = ts.createSourceFile(
        filePath,
        content,
        ts.ScriptTarget.Latest,
        true
      );
      
      const info = analyzeSourceFile(sourceFile, filePath);
      if (info && info.name) {
        logger.info(`[Scanner] ✓ Found plugin: ${info.name} in ${filePath}`);
        result.plugins.push(info);
      } else {
        logger.info(`[Scanner] ✗ No plugin found in ${filePath}`);
      }
    } catch (error) {
      const errorMsg = `Error analyzing file ${filePath}: ${error instanceof Error ? error.message : String(error)}`;
      result.errors.push(errorMsg);
      logger.error(`[Scanner] ${errorMsg}`);
    }
  }
  
  logger.info(`[Scanner] Scan complete: ${result.plugins.length} valid plugins found`);
  return result;
}

/**
 * Scans plugins directory specifically (backward compatibility)
 */
export async function scanPluginsDirectory(
  workspaceRoot: string,
  recursive: boolean = true,
  logger: any = silentLogger
): Promise<PluginInfo[]> {
  const pluginsDir = path.join(workspaceRoot, 'plugins');
  const results: PluginInfo[] = [];

  logger.info(`[Scanner] Scanning plugins directory: ${pluginsDir} (recursive: ${recursive})`);

  if (!fs.existsSync(pluginsDir)) {
    logger.info(`[Scanner] ⚠️  Plugins directory not found: ${pluginsDir}`);
    return results;
  }

  try {
    if (recursive) {
      // Use recursive file finding
      const pluginFiles = findPluginFiles(pluginsDir);
      logger.info(`[Scanner] Found ${pluginFiles.length} plugin files to analyze`);
      
      for (const filePath of pluginFiles) {
        try {
          const content = await fs.promises.readFile(filePath, 'utf-8');
          const sourceFile = ts.createSourceFile(
            filePath,
            content,
            ts.ScriptTarget.Latest,
            true
          );
          
          const info = analyzeSourceFile(sourceFile, filePath);
          if (info && info.name) {
            logger.info(`[Scanner] ✓ Found plugin: ${info.name}`);
            results.push(info);
          }
        } catch (error) {
          const errorMsg = `[Scanner] Error scanning ${filePath}: ${error instanceof Error ? error.message : String(error)}`;
          logger.error(errorMsg);
        }
      }
    } else {
      // Non-recursive scan (only top-level files)
      const files = await fs.promises.readdir(pluginsDir);
      
      for (const file of files) {
        if ((file.endsWith('.ts') || file.endsWith('.js')) && !file.endsWith('.d.ts')) {
          const fullPath = path.join(pluginsDir, file);
          const stat = await fs.promises.stat(fullPath);
          
          if (stat.isFile()) {
            try {
              const content = await fs.promises.readFile(fullPath, 'utf-8');
              const sourceFile = ts.createSourceFile(
                fullPath,
                content,
                ts.ScriptTarget.Latest,
                true
              );
              
              const info = analyzeSourceFile(sourceFile, fullPath);
              if (info && info.name) {
                logger.info(`[Scanner] ✓ Found plugin: ${info.name}`);
                results.push(info);
              }
            } catch (error) {
              logger.error(`[Scanner] Error scanning ${fullPath}:`, error);
            }
          }
        }
      }
    }
    
    logger.info(`[Scanner] Directory scan complete: ${results.length} plugins found`);
  } catch (err) {
    logger.error('[Scanner] Error scanning plugins directory:', err);
  }

  return results;
}

/**
 * Scans for plugins in multiple directories
 */
export async function scanMultipleDirectories(
  directories: string[],
  options: ScanOptions = {}
): Promise<PluginInfo[]> {
  const logger = options.logger || silentLogger;
  const allPlugins: PluginInfo[] = [];
  const seenNames = new Set<string>();

  for (const dir of directories) {
    try {
      const plugins = await scanPlugins(dir, options);
      
      // Handle duplicates - keep first occurrence
      for (const plugin of plugins) {
        const key = `${plugin.name}@${plugin.filePath}`;
        if (!seenNames.has(key)) {
          seenNames.add(key);
          allPlugins.push(plugin);
        } else {
          logger.warn(`Duplicate plugin "${plugin.name}" found in: ${plugin.filePath}`);
        }
      }
    } catch (error) {
      const errorMsg = `Error scanning directory ${dir}: ${error instanceof Error ? error.message : String(error)}`;
      logger.error(errorMsg);
    }
  }

  return allPlugins;
}

/**
 * Scans a single file and returns plugin info
 */
export async function scanSingleFile(filePath: string, logger: any = silentLogger): Promise<PluginInfo | null> {
  try {
    if (!fs.existsSync(filePath)) {
      logger.error(`File not found: ${filePath}`);
      return null;
    }

    const content = await fs.promises.readFile(filePath, 'utf-8');
    const sourceFile = ts.createSourceFile(
      filePath,
      content,
      ts.ScriptTarget.Latest,
      true
    );

    return analyzeSourceFile(sourceFile, filePath);
  } catch (error) {
    const errorMsg = `Error scanning file ${filePath}: ${error instanceof Error ? error.message : String(error)}`;
    logger.error(errorMsg);
    return null;
  }
}

/**
 * Validates if a file is a plugin file
 */
export function isPluginFile(filePath: string): boolean {
  const fileName = path.basename(filePath);
  return /\.(ts|js)$/.test(fileName) && 
         !fileName.endsWith('.d.ts') &&
         !fileName.endsWith('.test.ts') &&
         !fileName.endsWith('.spec.ts') &&
         !fileName.endsWith('.test.js');
}

/**
 * Gets the plugins directory path for a workspace
 */
export function getPluginsDirectory(workspaceRoot: string): string {
  return path.join(workspaceRoot, 'plugins');
}

/**
 * Checks if plugins directory exists
 */
export function pluginsDirectoryExists(workspaceRoot: string): boolean {
  const pluginsDir = getPluginsDirectory(workspaceRoot);
  return fs.existsSync(pluginsDir) && fs.statSync(pluginsDir).isDirectory();
}
