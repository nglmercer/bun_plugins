import { RuleBuilder, RuleEngine, ActionRegistry,ExpressionEngine } from 'trigger_system/node';

// --- Mocks de Infraestructura (Simulando lo que haría bun_plugins/core) ---

// 1. Definición de proveedores de TTS
interface TTSProvider {
    name: string;
    speak(text: string, voice?: string): Promise<void>;
}

class MockEdgeTTS implements TTSProvider {
    name = "EdgeTTS";
    async speak(text: string, voice?: string) {
        console.log(`[🔊 EdgeTTS] Speaking (${voice || 'default'}): "${text}"`);
    }
}

class MockGoogleTTS implements TTSProvider {
    name = "GoogleTTS";
    async speak(text: string, voice?: string) {
        console.log(`[🔊 GoogleTTS] Speaking (${voice || 'default'}): "${text}"`);
    }
}

// 2. Registro de Funcionalidades (El "Loader/Exposer" que mencionaste)
class ServiceRegistry {
    private ttsProvider: TTSProvider;

    constructor(defaultProvider: TTSProvider) {
        this.ttsProvider = defaultProvider;
    }

    setTTSProvider(provider: TTSProvider) {
        console.log(`\n[🔄 System] Switching TTS Provider to: ${provider.name}`);
        this.ttsProvider = provider;
    }

    // Esta función se ejecutaría cuando el motor de reglas devuelve una acción 'tts_speak'
    async executeAction(actionType: string, params: any) {
        if (actionType === 'tts_speak') {
            await this.ttsProvider.speak(params.text, params.voice);
        } else {
            console.log(`[⚙️ System] Unknown action: ${actionType}`, params);
        }
    }
}

// --- Workflow Principal ---

async function main() {
    console.log("=== 🚀 Starting TTS Chat Workflow Demo ===\n");

    // Inicializar servicios
    const edgeTTS = new MockEdgeTTS();
    const googleTTS = new MockGoogleTTS();
    const services = new ServiceRegistry(edgeTTS); // Empezamos con Edge
    ActionRegistry.getInstance().register("tts_speak", async (action, context) => {
        const textTemplate = action.params?.text || "";
        
        // USAMOS EL MOTOR DE EXPRESIONES INTERNO
        // Esto resuelve automáticamente ${data.message}, ${data.user.name}, etc.
        const resolvedText = ExpressionEngine.interpolate(String(textTemplate), context);
        const voice = action.params?.voice;
        await services.executeAction("tts_speak", { text: resolvedText, voice });
        
        return { spoken: resolvedText }; // Lo que devuelve la acción
    });
    // 1. Definir Reglas Iniciales 
    // Regla: Leer solo mensajes que empiezan con "!" (Comandos)
    const commandRule = new RuleBuilder()
        .withId("rule-commands")
        .withName("Read Commands")
        .withDescription("Reads messages starting with !")
        .withPriority(10)
        .on("CHAT_MESSAGE")
        .if("data.message", "MATCHES", "^!.*") // Regex match
        .do("tts_speak", { 
            text: "Command received: ${data.message}", 
            voice: "en-US-AriaNeural" 
        })
        .build();

    // Regla: Leer mensajes de usuarios VIP
    const vipRule = new RuleBuilder()
        .withId("rule-vip")
        .withName("Read VIPs")
        .withPriority(5)
        .on("CHAT_MESSAGE")
        .if("data.user.isVip", "EQ", true)
        .do("tts_speak", { 
            text: "${data.user.name} says: ${data.message}",
            voice: "en-US-GuyNeural"
        })
        .build();

    // Inicializar Motor
    const engine = new RuleEngine({
        rules: [commandRule, vipRule],
        globalSettings: { debugMode: false } // Menos ruido para este demo
    });

/*     await engine.processEvent({
        event: "CHAT_MESSAGE",
        timestamp: Date.now(),
        data: {
            message: "¡Me encanta el stream!",
            user: { name: "Juan", isVip: true }
        }
    }); */
    async function processChat(user: string, message: string, isVip = false) {
        await engine.processEvent({
            event: "CHAT_MESSAGE",
            timestamp: Date.now(),
            data: {
                message,
                user: { name: user, isVip }
            }
        });
    }
    // --- ESCENARIO 1: Operación Normal (EdgeTTS) ---
    console.log("--- 1. Testing Initial Rules (EdgeTTS) ---");
    await processChat("user1", "Hello world"); // No pasa nada (no VIP, no comando)
    await processChat("user2", "!help");       // Match comando
    await processChat("vipUser", "I love this stream!", true); // Match VIP

    // --- ESCENARIO 2: Actualización de Proveedor ---
    console.log("\n--- 2. Updating Service Provider (Switch to GoogleTTS) ---");
    services.setTTSProvider(googleTTS);
    
    await processChat("vipUser", "Does this sound different?", true);

    // --- ESCENARIO 3: Actualización de Reglas en Caliente ---
    console.log("\n--- 3. Hot Swapping Rules (Enable 'Read All') ---");
    
    const readAllRule = new RuleBuilder()
        .withId("rule-read-all")
        .withName("Read Everything")
        .withPriority(1) // Baja prioridad
        .on("CHAT_MESSAGE")
        // Sin condiciones = siempre ejecuta si el evento coincide
        .do("tts_speak", { 
            text: "${data.user.name} said: ${data.message}" 
        })
        .build();

    console.log("[🔄 System] Updating Rule Engine...");
    engine.updateRules([commandRule, vipRule, readAllRule]);

    await processChat("randomUser", "Now I can be heard too!");

    console.log("\n=== Demo Complete ===");
}

main();
