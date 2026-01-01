
import { Plugin, PluginContext } from "../src";

/**
 * A demo plugin showcasing the new "onStart" hook and configuration.
 * 
 * To disable the welcome message, configure:
 * {
 *   "showWelcome": false
 * }
 */
export class LifecycleDemoPlugin extends Plugin {
    name = "lifecycle-demo";
    version = "1.0.0";
    
    // Default config
    defaultConfig = {
        showWelcome: true,
        message: "Application Lifecycle Started!"
    };

    onLoad(context: PluginContext) {
        context.log.info("LifecycleDemo plugin loaded");
    }

    setup(build: import("../src").PluginBuilder) {
        // Access config passed to setup
        const config = build.config;

        // Register the NEW onStart hook
        build.onStart(() => {
            if (config.showWelcome !== false) {
                const message = config.message || this.defaultConfig.message;
                // Example: Perform post-startup initialization logic here
                // e.g., connect to DBs, start background jobs, etc.
            }
        });
    }
}
