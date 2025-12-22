
import type { ITTSProvider } from "../provider";

export class LogTTSProvider implements ITTSProvider {
    name = "LogTTS";
    async speak(text: string, voice?: string) {
        console.log(`[🔊 LogTTS] Speaking (${voice || 'default'}): "${text}"`);
    }
}
