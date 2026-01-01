
import { definePlugin } from "../src";
import { TTSService } from "../examples/tts/service";

class EdgeTTSProvider {
    name = "EdgeTTS";
    async speak(text: string, voice?: string) {
        console.log(`[🔊 EdgeTTS Plugin] Speaking (${voice || 'en-US-AriaNeural'}): "${text}"`);
    }
}

export default definePlugin({
    name: "edge-tts",
    version: "1.0.0",

    async onLoad(context) {
        // As tts is no longer in context, we use the singleton from the example lib
        TTSService.getInstance().registerProvider(new EdgeTTSProvider());
        context.log.info("EdgeTTS Provider registered via plugin");
    },
    
    onUnload() {}
});
