
export interface PluginMethod {
    name: string;
    params: string[];
    returnType: string;
    doc?: string;
}

export interface PluginProperty {
    name: string;
    type: string;
    doc?: string;
}

export interface PluginInfo {
    name: string; // The value of the 'name' property
    className: string;
    filePath: string;
    methods: PluginMethod[];
    properties?: PluginProperty[]; // Exposed properties
    events: string[]; // Event names registered via context.emitters.on
    apiInterfaces?: string[]; // API interfaces found (e.g., MathPluginApi)
}
