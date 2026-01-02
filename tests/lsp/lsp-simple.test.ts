import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { spawn } from "child_process";
import { join } from "path";
import { existsSync } from "fs";

describe("Simple LSP Server Test", () => {
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

  test("should respond to initialize request", async () => {
    serverProcess = spawn("node", [serverPath], {
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, NODE_ENV: "test" }
    });

    let stderr = "";
    serverProcess.stderr.on("data", (data: Buffer) => {
      stderr += data.toString();
    });

    // Esperar un momento para que el servidor inicie
    await new Promise(resolve => setTimeout(resolve, 1000));

    const initializeRequest = {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        processId: process.pid,
        rootUri: `file://${process.cwd()}`,
        capabilities: {}
      }
    };

    const response = await sendLSPRequest(serverProcess, initializeRequest);
    
    console.log("Respuesta recibida:", JSON.stringify(response, null, 2));
    
    expect(response).toBeDefined();
    expect(response.jsonrpc).toBe("2.0");
    expect(response.id).toBe(1);
    expect(response.result).toBeDefined();
    expect(response.result.capabilities).toBeDefined();
  });
});

async function sendLSPRequest(process: any, request: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const message = JSON.stringify(request);
    const headers = `Content-Length: ${Buffer.byteLength(message)}\r\n\r\n`;
    
    console.log(`Enviando: ${headers}${message}`);
    
    let response = "";
    let contentLength = 0;
    let headersComplete = false;
    let totalData = "";

    const onData = (data: Buffer) => {
      const dataStr = data.toString();
      totalData += dataStr;
      console.log(`Datos recibidos: ${dataStr}`);
      
      if (!headersComplete) {
        const headerEnd = totalData.indexOf("\r\n\r\n");
        if (headerEnd !== -1) {
          const headerPart = totalData.substring(0, headerEnd);
          const contentLengthMatch = headerPart.match(/Content-Length: (\d+)/);
          if (contentLengthMatch) {
            contentLength = parseInt(contentLengthMatch[1]);
          }
          headersComplete = true;
          response = totalData.substring(headerEnd + 4);
        }
      } else {
        response += dataStr;
      }

      if (headersComplete && response.length >= contentLength) {
        try {
          const result = JSON.parse(response.substring(0, contentLength));
          console.log(`Respuesta parseada:`, result);
          process.stdout.off("data", onData);
          resolve(result);
        } catch (e) {
          console.error("Error parseando:", e);
          process.stdout.off("data", onData);
          reject(e);
        }
      }
    };

    process.stdout.on("data", onData);
    process.stdin.write(headers + message);

    setTimeout(() => {
      process.stdout.off("data", onData);
      console.error(`Timeout. Datos totales: "${totalData}"`);
      reject(new Error("LSP request timeout"));
    }, 5000);
  });
}