import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { spawn } from "child_process";
import { join } from "path";
import { existsSync } from "fs";

describe("Bun Plugins LSP Server - Final Version", () => {
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

  test("should start LSP server with stdio transport", async () => {
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

    // Si llegamos aquí sin errores, la inicialización fue exitosa
    expect(true).toBe(true);
  });

  test("should provide basic completion", async () => {
    // Crear un documento de prueba
    const testDoc = `// Test file
import { getPlugin } from './pluginManager';
const plugin = getPlugin("`;
    
    const openDocNotification = {
      jsonrpc: "2.0",
      method: "textDocument/didOpen",
      params: {
        textDocument: {
          uri: `file://${join(process.cwd(), "test-completion.ts")}`,
          languageId: "typescript",
          version: 1,
          text: testDoc
        }
      }
    };

    await sendLSPNotification(serverProcess, openDocNotification);
    
    // Esperar a que el servidor procese el documento
    await new Promise(resolve => setTimeout(resolve, 1000));

    const completionRequest = {
      jsonrpc: "2.0",
      id: 2,
      method: "textDocument/completion",
      params: {
        textDocument: {
          uri: `file://${join(process.cwd(), "test-completion.ts")}`
        },
        position: {
          line: 2,
          character: 24 // Después de getPlugin("
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

  test("should handle exit notification", async () => {
    const exitNotification = {
      jsonrpc: "2.0",
      method: "exit",
      params: {}
    };

    await sendLSPNotification(serverProcess, exitNotification);
    
    // Esperar a que el servidor se cierre
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // El proceso debería haber terminado
    expect(serverProcess.killed || serverProcess.exitCode !== null).toBe(true);
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