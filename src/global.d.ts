
// Global type definitions for the application
declare global {
    // Define global interfaces and types here
    interface Window {
        // Example: myGlobalVar: string;
    }

    // ProcessEnv interface extension
    namespace NodeJS {
        interface ProcessEnv {
            NODE_ENV: 'development' | 'production' | 'test';
            // Add other environment variables here
        }
    }
}

export {};
