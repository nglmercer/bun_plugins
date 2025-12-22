
import { RuleBuilder, RuleEngine, ActionRegistry, ExpressionEngine } from 'trigger_system/node';
import { PluginManager } from '../src';
import { TTSService } from './tts';
import { EdgeTTSPlugin } from '../plugins/EdgeTTSPlugin';

// --- Workflow Principal ---

async function main() {
    console.log("=== 🚀 Starting TTS Chat Workflow Demo (Clean Lib Version) ===\n");

    // 1. Inicializar el sistema de plugins (usa process.cwd() por defecto)
    const pluginManager = new PluginManager();
    
    // Registramos proveedores mediante plugins
    // El TTSService está en el host (examples/tts)
    await pluginManager.register(new EdgeTTSPlugin());

    const tts = TTSService.getInstance();
    
    // Por defecto usaremos el de log, o el que el plugin registre
    tts.setProvider("EdgeTTS");

    // 2. Registro de Funcionalidades en el ActionRegistry del Motor
    ActionRegistry.getInstance().register("tts_speak", async (action, context) => {
        const textTemplate = (action.params?.text as string) || "";
        
        // USAMOS EL MOTOR DE EXPRESIONES INTERNO
        const resolvedText = ExpressionEngine.interpolate(String(textTemplate), context);
        const voice = action.params?.voice as string | undefined;
        
        // El servicio de TTS centralizado (HOST) decide qué proveedor usar
        await tts.speak(resolvedText, voice ?? undefined);
        
        return { spoken: resolvedText };
    });

    // 3. Definir Reglas
    const commandRule = new RuleBuilder()
        .withId("rule-commands")
        .withName("Read Commands")
        .on("CHAT_MESSAGE")
        .if("data.message", "MATCHES", "^!.*")
        .do("tts_speak", { 
            text: "Command received: ${data.message}", 
            voice: "en-US-AriaNeural" 
        })
        .build();

    const vipRule = new RuleBuilder()
        .withId("rule-vip")
        .withName("Read VIPs")
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
        globalSettings: { debugMode: false }
    });

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

    // --- ESCENARIO 1: Operación con Plugin (EdgeTTS) ---
    console.log("--- 1. Testing Rules with EdgeTTS Plugin ---");
    await processChat("user2", "!help");
    await processChat("vipUser", "I love this clean plugin system!", true);

    // --- ESCENARIO 2: Volver al Proveedor Base (LogTTS) ---
    console.log("\n--- 2. Switching back to Base Provider (LogTTS) ---");
    tts.setProvider("LogTTS");
    
    await processChat("vipUser", "Is this just logging now?", true);

    // --- ESCENARIO 3: Hot Swapping Rules ---
    console.log("\n--- 3. Hot Swapping Rules (Enable 'Read All') ---");
    
    const readAllRule = new RuleBuilder()
        .withId("rule-read-all")
        .on("CHAT_MESSAGE")
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
