// plugins/MyJSPlugin.js
export class MyJSPlugin {
  name = "my-js-plugin";
  version = "1.0.0";
  
  onLoad(context) {
    context.log.info("JS plugin loaded");
  }
  
  onUnload() {
    // Cleanup is handled by the plugin manager
  }
}
