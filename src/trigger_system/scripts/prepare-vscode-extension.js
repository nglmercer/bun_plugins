#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('Preparing VSCode extension with LSP server...');

// Paths
const projectRoot = path.join(__dirname, '..');
const distDir = path.join(projectRoot, 'dist');
const vscodeDir = path.join(projectRoot, 'vscode-extension');
const serverDir = path.join(distDir, 'lsp');
const vscodeServerDir = path.join(vscodeDir, 'dist', 'lsp');

// Create vscode-extension/dist/lsp directory
if (!fs.existsSync(vscodeServerDir)) {
  fs.mkdirSync(vscodeServerDir, { recursive: true });
}

// Copy server files and dependencies
const serverFiles = ['server.js', 'server.js.map', 'server.d.ts'];
const dependencyFiles = ['domain', 'types.js', 'types.d.ts'];

serverFiles.forEach(file => {
  const srcPath = path.join(serverDir, file);
  const destPath = path.join(vscodeServerDir, file);
  
  if (fs.existsSync(srcPath)) {
    fs.copyFileSync(srcPath, destPath);
    console.log(`Copied ${file} to extension directory`);
  } else {
    console.warn(`Warning: ${file} not found in ${serverDir}`);
  }
});

// Copy domain and types dependencies
dependencyFiles.forEach(file => {
  const srcPath = path.join(distDir, file);
  const destPath = path.join(vscodeServerDir, file);
  
  if (fs.existsSync(srcPath)) {
    if (fs.statSync(srcPath).isDirectory()) {
      copyDirectory(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
    console.log(`Copied dependency ${file} to extension directory`);
  }
});

// Create a package.json for the server dependencies
const mainPackageJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
const serverPackageJson = {
  name: 'trigger-system-lsp-server',
  version: '0.0.1',
  description: 'LSP Server for Trigger System',
  main: 'server.js',
  dependencies: {
    'vscode-languageserver': mainPackageJson.dependencies['vscode-languageserver'],
    'vscode-languageserver-textdocument': mainPackageJson.dependencies['vscode-languageserver-textdocument'],
    'yaml': mainPackageJson.dependencies['yaml'],
    'arktype': mainPackageJson.dependencies['arktype']
  }
};

fs.writeFileSync(
  path.join(vscodeServerDir, 'package.json'),
  JSON.stringify(serverPackageJson, null, 2)
);

// Don't copy node_modules, the extension will use NODE_PATH to find them
console.log('Skipping node_modules copy - extension will use NODE_PATH');

console.log('VSCode extension preparation complete!');

function copyDirectory(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  
  const files = fs.readdirSync(src);
  files.forEach(file => {
    const srcFile = path.join(src, file);
    const destFile = path.join(dest, file);
    
    if (fs.statSync(srcFile).isDirectory()) {
      copyDirectory(srcFile, destFile);
    } else {
      fs.copyFileSync(srcFile, destFile);
    }
  });
}

console.log('VSCode extension preparation complete!');