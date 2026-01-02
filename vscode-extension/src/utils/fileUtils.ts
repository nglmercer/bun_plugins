/**
 * File system utilities for type generation
 */

import * as fs from 'fs';
import * as path from 'path';

export interface FileStats {
  exists: boolean;
  isFile: boolean;
  isDirectory: boolean;
  size?: number;
  modifiedTime?: Date;
}

/**
 * Safely gets file statistics
 */
export function getStats(filePath: string): FileStats {
  try {
    const stats = fs.statSync(filePath);
    return {
      exists: true,
      isFile: stats.isFile(),
      isDirectory: stats.isDirectory(),
      size: stats.size,
      modifiedTime: stats.mtime
    };
  } catch (error) {
    return {
      exists: false,
      isFile: false,
      isDirectory: false
    };
  }
}

/**
 * Checks if a file exists
 */
export function fileExists(filePath: string): boolean {
  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}

/**
 * Reads a file safely
 */
export function readFile(filePath: string, encoding: BufferEncoding = 'utf-8'): string | null {
  try {
    return fs.readFileSync(filePath, encoding);
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error);
    return null;
  }
}

/**
 * Writes a file, creating parent directories if needed
 */
export function writeFile(filePath: string, content: string, encoding: BufferEncoding = 'utf-8'): boolean {
  try {
    // Ensure directory exists
    const dir = path.dirname(filePath);
    if (!fileExists(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(filePath, content, encoding);
    return true;
  } catch (error) {
    console.error(`Error writing file ${filePath}:`, error);
    return false;
  }
}

/**
 * Creates a directory recursively
 */
export function ensureDirectory(dirPath: string): boolean {
  try {
    if (!fileExists(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
    return true;
  } catch (error) {
    console.error(`Error creating directory ${dirPath}:`, error);
    return false;
  }
}

/**
 * Deletes a file or directory recursively
 */
export function deletePath(targetPath: string): boolean {
  try {
    if (!fileExists(targetPath)) {
      return true;
    }

    const stats = fs.statSync(targetPath);
    if (stats.isDirectory()) {
      fs.rmSync(targetPath, { recursive: true, force: true });
    } else {
      fs.unlinkSync(targetPath);
    }
    return true;
  } catch (error) {
    console.error(`Error deleting ${targetPath}:`, error);
    return false;
  }
}

/**
 * Recursively finds files matching a pattern
 */
export function findFiles(
  rootDir: string,
  pattern: RegExp,
  maxDepth: number = 10,
  currentDepth: number = 0
): string[] {
  const results: string[] = [];
  
  if (currentDepth >= maxDepth || !fileExists(rootDir)) {
    return results;
  }

  const stats = getStats(rootDir);
  
  if (stats.isFile && pattern.test(rootDir)) {
    results.push(rootDir);
  } else if (stats.isDirectory) {
    try {
      const entries = fs.readdirSync(rootDir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(rootDir, entry.name);
        
        if (entry.isDirectory()) {
          results.push(...findFiles(fullPath, pattern, maxDepth, currentDepth + 1));
        } else if (entry.isFile() && pattern.test(entry.name)) {
          results.push(fullPath);
        }
      }
    } catch (error) {
      console.error(`Error reading directory ${rootDir}:`, error);
    }
  }

  return results;
}

/**
 * Finds TypeScript and JavaScript plugin files recursively
 */
export function findPluginFiles(rootDir: string): string[] {
  const pattern = /\.(ts|js)$/;
  const allFiles = findFiles(rootDir, pattern);
  
  // Filter out declaration files and test files
  return allFiles.filter(file => {
    const fileName = path.basename(file);
    return !fileName.endsWith('.d.ts') && !fileName.endsWith('.test.ts') && !fileName.endsWith('.spec.ts');
  });
}

/**
 * Reads and parses JSON file
 */
export function readJsonFile<T = any>(filePath: string): T | null {
  try {
    const content = readFile(filePath);
    if (!content) return null;
    return JSON.parse(content);
  } catch (error) {
    console.error(`Error parsing JSON file ${filePath}:`, error);
    return null;
  }
}

/**
 * Writes JSON file with formatting
 */
export function writeJsonFile(filePath: string, data: any, indent: number = 2): boolean {
  try {
    const content = JSON.stringify(data, null, indent);
    return writeFile(filePath, content);
  } catch (error) {
    console.error(`Error writing JSON file ${filePath}:`, error);
    return false;
  }
}

/**
 * Watches a directory for changes
 */
export function watchDirectory(
  dirPath: string,
  onChange: (eventType: string, filename: string) => void,
  recursive: boolean = true
): fs.FSWatcher | null {
  try {
    const watcher = fs.watch(dirPath, { recursive }, (eventType, filename) => {
      if (filename) {
        onChange(eventType, filename);
      }
    });
    return watcher;
  } catch (error) {
    console.error(`Error watching directory ${dirPath}:`, error);
    return null;
  }
}

/**
 * Compares two files for equality
 */
export function filesAreEqual(file1: string, file2: string): boolean {
  const content1 = readFile(file1);
  const content2 = readFile(file2);
  
  if (!content1 || !content2) return false;
  return content1 === content2;
}

/**
 * Gets the relative path from one directory to another
 */
export function getRelativePath(from: string, to: string): string {
  return path.relative(from, to).replace(/\\/g, '/');
}
