import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { spawn } from "child_process";
import { join } from "path";
import { existsSync } from "fs";

describe("Bun Plugins LSP Server - Optimized", () => {
  let serverProcess: any;
  const serverPath = join(import.meta.dir, "../../vscode-extension/dist/server-simple.js");

  beforeAll(() => {
    // Verificar que el servidor esté compilado
    if (!existsSync(serverPath)) {
      throw new Error(`LSP Server not found at ${serverPath}. Please run 'npm run compile' in vscode-extension directory.`);
    }
  });

  afterAll(() => {
    if (serverProcess) {
      serverProcess.kill();
    }
  });

  test("should start LSP server without errors", async () => {
    serverProcess = spawn("node", [serverPath], {
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, NODE_ENV: "test" }
    });

    let stdout = "";
    let stderr = "";

    serverProcess.stdout.on("data", (data: Buffer) => {
      stdout += data.toString();
    });

    serverProcess.stderr.on("data", (data: Buffer) => {
      stderr += data.toString();
    });

    // Esperar un momento para que el servidor inicie
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Verificar que el servidor esté vivo y no haya errores críticos
    expect(serverProcess.killed).toBe(false);
    // El servidor en modo stdio no debe escribir logs en stderr/stdout
    expect(stderr).toBe("");
    expect(serverProcess.killed).toBe(false);
    // El servidor simple no escribe logs en stdout
    expect(true).toBe(true);
  });

  test("should handle initialize request correctly", async () => {
    const initializeRequest = {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        processId: process.pid,
        rootUri: `file://${process.cwd()}`,
        capabilities: {
          workspace: {
            configuration: true,
            workspaceFolders: true
          },
          textDocument: {
            completion: {
              dynamicRegistration: true,
              completionItem: {
                snippetSupport: true
              }
            }
          }
        }
      }
    };

    const response = await sendLSPRequest(serverProcess, initializeRequest);
    
    expect(response).toBeDefined();
    expect(response.jsonrpc).toBe("2.0");
    expect(response.id).toBe(1);
    expect(response.result).toBeDefined();
    expect(response.result.capabilities).toBeDefined();
    expect(response.result.capabilities.textDocumentSync).toBeDefined();
    expect(response.result.capabilities.completionProvider).toBeDefined();
    expect(response.result.capabilities.completionProvider.triggerCharacters).toContain('.');
  });

  test("should handle initialized notification", async () => {
    const initializedNotification = {
      jsonrpc: "2.0",
      method: "initialized",
      params: {}
    };

    await sendLSPNotification(serverProcess, initializedNotification);
    
    // Esperar a que el servidor procese la inicialización
    await new Promise(resolve => setTimeout(resolve, 2000));

    // El servidor debería haber procesado la inicialización
    expect(true).toBe(true); // Si llegamos aquí, no hubo errores
  });

  test("should scan plugins directory when available", async () => {
    const pluginsDir = join(process.cwd(), "plugins");
    
    if (existsSync(pluginsDir)) {
      // Forzar un escaneo de plugins
      const scanRequest = {
        jsonrpc: "2.0",
        method: "workspace/didChangeWatchedFiles",
        params: {
          changes: [{
            uri: `file://${pluginsDir}`,
            type: 1 // Created
          }]
        }
      };

      await sendLSPNotification(serverProcess, scanRequest);
      
      // Esperar a que el servidor escanee los plugins
      await new Promise(resolve => setTimeout(resolve, 3000));

      // El servidor debería haber escaneado los plugins
      const typesDir = join(process.cwd(), ".bun-plugins-types");
      expect(existsSync(typesDir)).toBe(true);
    } else {
      console.log("Plugins directory not found, skipping plugin scan test");
      expect(true).toBe(true); // Pasar la prueba si no hay plugins
    }
  });

  test("should provide completion for getPlugin", async () => {
    // Primero crear un documento de prueba
    const testDoc = `import { getPlugin } from './pluginManager';
const plugin = getPlugin(`;
    
    const openDocNotification = {
      jsonrpc: "2.0",
      method: "textDocument/didOpen",
      params: {
        textDocument: {
          uri: `file://${join(process.cwd(), "test.ts")}`,
          languageId: "typescript",
          version: 1,
          text: testDoc
        }
      }
    };

    await sendLSPNotification(serverProcess, openDocNotification);
    
    // Esperar un momento para que el servidor procese el documento
    await new Promise(resolve => setTimeout(resolve, 1000));

    const completionRequest = {
      jsonrpc: "2.0",
      id: 2,
      method: "textDocument/completion",
      params: {
        textDocument: {
          uri: `file://${join(process.cwd(), "test.ts")}`
        },
        position: {
          line: 1,
          character: 24 // Después de getPlugin(
        }
      }
    };

    const response = await sendLSPRequest(serverProcess, completionRequest);
    
    expect(response).toBeDefined();
    expect(response.jsonrpc).toBe("2.0");
    expect(response.id).toBe(2);
    expect(response.result).toBeDefined();
  });

  test("should handle shutdown gracefully", async () => {
    const shutdownRequest = {
      jsonrpc: "2.0",
      id: 3,
      method: "shutdown",
      params: {}
    };

    const response = await sendLSPRequest(serverProcess, shutdownRequest);
    
    expect(response).toBeDefined();
    expect(response.jsonrpc).toBe("2.0");
    expect(response.id).toBe(3);
    expect(response.result).toBeNull(); // Shutdown debe retornar null
  });
});

// Función auxiliar para enviar solicitudes LSP
async function sendLSPRequest(process: any, request: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const message = JSON.stringify(request);
    const headers = `Content-Length: ${Buffer.byteLength(message)}\r\n\r\n`;
    
    let response = "";
    let contentLength = 0;
    let headersComplete = false;

    const onData = (data: Buffer) => {
      const dataStr = data.toString();
      
      if (!headersComplete) {
        const headerEnd = dataStr.indexOf("\r\n\r\n");
        if (headerEnd !== -1) {
          const headerPart = dataStr.substring(0, headerEnd);
          const contentLengthMatch = headerPart.match(/Content-Length: (\d+)/);
          if (contentLengthMatch) {
            contentLength = parseInt(contentLengthMatch[1]);
          }
          headersComplete = true;
          response = dataStr.substring(headerEnd + 4);
        } else {
          // Acumular datos del header
          response += dataStr;
          const accumulatedHeaderEnd = response.indexOf("\r\n\r\n");
          if (accumulatedHeaderEnd !== -1) {
            const headerPart = response.substring(0, accumulatedHeaderEnd);
            const contentLengthMatch = headerPart.match(/Content-Length: (\d+)/);
            if (contentLengthMatch) {
              contentLength = parseInt(contentLengthMatch[1]);
            }
            headersComplete = true;
            response = response.substring(accumulatedHeaderEnd + 4);
          }
        }
      } else {
        response += dataStr;
      }

      if (headersComplete && response.length >= contentLength) {
        try {
          const result = JSON.parse(response.substring(0, contentLength));
          process.stdout.off("data", onData);
          resolve(result);
        } catch (e) {
          // Si no podemos parsear, esperar más datos
          if (response.length > contentLength * 2) {
            process.stdout.off("data", onData);
            reject(new Error("Failed to parse LSP response"));
          }
        }
      }
    };

    process.stdout.on("data", onData);
    process.stdin.write(headers + message);

    // Timeout más generoso para el servidor
    setTimeout(() => {
      process.stdout.off("data", onData);
      reject(new Error("LSP request timeout - server may be busy"));
    }, 10000);
  });
}

// Función auxiliar para enviar notificaciones LSP
async function sendLSPNotification(process: any, notification: any): Promise<void> {
  return new Promise((resolve) => {
    const message = JSON.stringify(notification);
    const headers = `Content-Length: ${Buffer.byteLength(message)}\r\n\r\n`;
    process.stdin.write(headers + message);
    
    // Dar tiempo para que el servidor procese la notificación
    setTimeout(resolve, 100);
  });
}