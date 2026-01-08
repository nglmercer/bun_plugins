import { Plugin, PluginContext } from "../src";

// Tipo de la API que expone este plugin
export interface MathPluginApi {
  add(a: number, b: number): number;
  multiply(a: number, b: number): number;
}

export class MathPlugin extends Plugin {
  name = "math-plugin";
  version = "0.5.0";

  override onLoad(context: PluginContext) {
    context.log.info("Math capabilities ready");
  }

  // Custom method exposed by this plugin
  add(a: number, b: number): number {
    return a + b;
  }
  
  multiply(a: number, b: number): number {
    return a * b;
  }

  // Exponer la API compartida
  getApi(): MathPluginApi {
    return {
      add: this.add.bind(this),
      multiply: this.multiply.bind(this)
    };
  }

  // onUnload is optional in base class, removing empty cleanup 
}

// Exportar una instancia por defecto
export default new MathPlugin();
