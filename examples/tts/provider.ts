
export interface ITTSProvider {
    name: string;
    speak(text: string, voice?: string): Promise<void>;
}
