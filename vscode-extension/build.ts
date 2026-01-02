import { build } from 'bun';

// Build para el cliente LSP
async function buildClient() {
  console.log('Building LSP client...');
  
  const result = await build({
    entrypoints: ['./src/client.ts'],
    outdir: './dist',
    target: 'node',
    format: 'cjs',
    external: ['vscode'], // VS Code proporciona estas
    sourcemap: 'external',
    minify: true,
    naming: {
      entry: '[dir]/[name].bundle.js'
    }
  });

  if (result.success) {
    console.log('✅ Client build successful');
  } else {
    console.error('❌ Client build failed:', result.logs);
    throw new Error('Client build failed');
  }
}

// Build para el servidor LSP
async function buildServer() {
  console.log('Building LSP server...');
  
  const result = await build({
    entrypoints: ['./src/server.ts'],
    outdir: './dist',
    target: 'node',
    format: 'cjs',
    external: ['vscode'], // VS Code proporciona estas
    sourcemap: 'external',
    minify: true,
    naming: {
      entry: '[dir]/[name].bundle.js'
    }
  });

  if (result.success) {
    console.log('✅ Server build successful');
  } else {
    console.error('❌ Server build failed:', result.logs);
    throw new Error('Server build failed');
  }
}

// Ejecutar ambos builds
async function buildAll() {
  try {
    await buildClient();
    await buildServer();
    console.log('🎉 All builds completed successfully!');
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}

buildAll();


export { buildAll, buildClient, buildServer };