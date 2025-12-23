// plugins/MyJSPlugin.js
export class MyJSPlugin {
  name = "my-js-plugin";
  version = "1.0.0";
  
  onLoad(context) {
    console.log("Plugin JS cargado!");
    context.log.info("Hola desde JavaScript");
  }
  
  onUnload() {
    console.log("Plugin JS descargado");
  }
}
