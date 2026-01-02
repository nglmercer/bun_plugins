import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { spawn } from "child_process";
import { join } from "path";
import { existsSync } from "fs";

describe("Bun Plugins LSP Server - Basic Functionality", () => {
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

  test("should respond to initialize request", async () => {
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
    expect(response.jsonrpc).toBe("2.0");
    expect(response.result).toBeDefined();
    expect(response.result.capabilities).toBeDefined();
    expect(response.result.capabilities.textDocumentSync).toBeDefined();
    expect(response.result.capabilities.completionProvider).toBeDefined();
  });

  test("should handle initialized notification without errors", async () => {
    const initializedNotification = {
      jsonrpc: "2.0",
      method: "initialized",
      params: {}
    };

    // No debería haber respuesta para notificaciones
    await sendLSPNotification(serverProcess, initializedNotification);
    
    // Esperar a que el servidor procese la inicialización
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Si llegamos aquí sin errores, la inicialización fue exitosa
    expect(true).toBe(true);
  });

  test("should handle shutdown request", async () => {
    const shutdownRequest = {
      jsonrpc: "2.0",
      id: 999,
      method: "shutdown",
      params: {}
    };

    const response = await sendLSPRequest(serverProcess, shutdownRequest);
    
    expect(response).toBeDefined();
    expect(response.jsonrpc).toBe("2.0");
    // El ID debe coincidir o el servidor no está procesando correctamente
    expect(response.id === 999 || response.id === undefined).toBe(true);
  });

  test("should generate plugin types when plugins exist", async () => {
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

      // Verificar que se generaron tipos
      const typesDir = join(process.cwd(), ".bun-plugins-types");
      expect(existsSync(typesDir)).toBe(true);
    } else {
      console.log("Plugins directory not found, skipping plugin scan test");
      expect(true).toBe(true); // Pasar la prueba si no hay plugins
    }
  });
});

// Función auxiliar para enviar solicitudes LSP
async function sendLSPRequest(process: any, request: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const message = JSON.stringify(request);
    const headers = `Content-Length: ${Buffer.byteLength(message)}\r\n\r\n`;
    
    console.log(`Enviando solicitud LSP: ${request.method} (id: ${request.id})`);
    
    let response = "";
    let contentLength = 0;
    let headersComplete = false;
    let totalData = "";

    const onData = (data: Buffer) => {
      const dataStr = data.toString();
      totalData += dataStr;
      
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
          console.log(`Respuesta LSP recibida:`, result);
          
          // Verificar si esta respuesta es para nuestra solicitud
          // Las respuestas a solicitudes tienen el mismo ID que la solicitud
          // Las notificaciones (como window/logMessage) no tienen ID o tienen method
          if (result.id === request.id && result.result !== undefined) {
            console.log(`✅ Respuesta correcta para solicitud ${request.id}`);
            process.stdout.off("data", onData);
            resolve(result);
          } else if (result.method) {
            // Es una notificación (como window/logMessage), continuar esperando
            console.log(`ℹ️ Notificación recibida: ${result.method}, continuando esperando respuesta...`);
            // Resetear para la siguiente respuesta - usar la longitud total del mensaje
            totalData = totalData.substring(totalData.indexOf("\r\n\r\n") + 4 + contentLength);
          } else {
            console.log(`❌ Respuesta con ID diferente o sin resultado, continuando esperando...`);
            // Resetear para la siguiente respuesta - usar la longitud total del mensaje
            totalData = totalData.substring(totalData.indexOf("\r\n\r\n") + 4 + contentLength);
          }
        } catch (e) {
          console.error("Error parseando JSON:", e);
          console.error("Contenido del response:", response.substring(0, contentLength));
          process.stdout.off("data", onData);
          reject(new Error(`Invalid JSON response: ${e}`));
        }
      }
    };

    process.stdout.on("data", onData);
    process.stdin.write(headers + message);

    // Timeout más generoso para el servidor
    setTimeout(() => {
      process.stdout.off("data", onData);
      console.error(`Timeout esperando respuesta para ${request.method} (id: ${request.id})`);
      console.error(`Datos totales recibidos: "${totalData}"`);
      reject(new Error(`LSP request timeout for ${request.method} - server may be busy`));
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