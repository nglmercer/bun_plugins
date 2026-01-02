import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { spawn } from "child_process";
import { join } from "path";
import { existsSync } from "fs";

describe("Bun Plugins LSP Server", () => {
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

    // El servidor ahora escribe logs en stderr, así que verificamos que esté vivo
    expect(serverProcess.killed).toBe(false);
    // Verificar que el servidor esté vivo y no haya errores críticos
    expect(serverProcess.killed).toBe(false);
    // El servidor en modo stdio no debe escribir logs en stderr/stdout
    expect(stderr).toBe("");
  });

  test("should handle initialize request", async () => {
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
          }
        }
      }
    };

    const response = await sendLSPRequest(serverProcess, initializeRequest);
    
    expect(response).toBeDefined();
    expect(response.result).toBeDefined();
    expect(response.result.capabilities).toBeDefined();
    expect(response.result.capabilities.textDocumentSync).toBeDefined();
    expect(response.result.capabilities.completionProvider).toBeDefined();
  });

  test("should scan plugins directory", async () => {
    const pluginsDir = join(process.cwd(), "plugins");
    if (!existsSync(pluginsDir)) {
      console.log("Plugins directory not found, skipping plugin scan test");
      return;
    }

    const initializedNotification = {
      jsonrpc: "2.0",
      method: "initialized",
      params: {}
    };

    await sendLSPNotification(serverProcess, initializedNotification);
    
    // Esperar a que el servidor escanee los plugins
    await new Promise(resolve => setTimeout(resolve, 2000));

    // El servidor debería haber escaneado los plugins y generado tipos
    const typesDir = join(process.cwd(), ".bun-plugins-types");
    expect(existsSync(typesDir)).toBe(true);
  });

  test("should provide completion for getPlugin", async () => {
    const completionRequest = {
      jsonrpc: "2.0",
      id: 2,
      method: "textDocument/completion",
      params: {
        textDocument: {
          uri: `file://${join(process.cwd(), "test.ts")}`
        },
        position: {
          line: 0,
          character: 12
        }
      }
    };

    const response = await sendLSPRequest(serverProcess, completionRequest);
    
    expect(response).toBeDefined();
    expect(response.result).toBeDefined();
  });
});

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
          // Acumular datos hasta encontrar el fin de headers
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
          console.error("Error parsing JSON response:", e);
          console.error("Response content:", response.substring(0, contentLength));
          process.stdout.off("data", onData);
          reject(new Error("Invalid JSON response"));
        }
      }
    };

    process.stdout.on("data", onData);
    process.stdin.write(headers + message);

    setTimeout(() => {
      process.stdout.off("data", onData);
      reject(new Error("LSP request timeout"));
    }, 5000);
  });
}

async function sendLSPNotification(process: any, notification: any): Promise<void> {
  const message = JSON.stringify(notification);
  const headers = `Content-Length: ${Buffer.byteLength(message)}\r\n\r\n`;
  process.stdin.write(headers + message);
}