
import * as ts from 'typescript';
import { PluginInfo, PluginMethod, PluginProperty } from './types';

export function analyzeSourceFile(sourceFile: ts.SourceFile, filePath: string): PluginInfo | null {
    let pluginInfo: PluginInfo | null = null;

    function scanForEvents(node: ts.Node): string[] {
        const foundEvents: string[] = [];
        function visitMethodBody(n: ts.Node) {
            if (ts.isCallExpression(n)) {
                const expression = n.expression;
                // Check for *.emitters.on("eventName", ...)
                if (ts.isPropertyAccessExpression(expression) && expression.name.text === 'on') {
                     if (ts.isPropertyAccessExpression(expression.expression) && expression.expression.name.text === 'emitters') {
                         const args = n.arguments;
                         if (args.length > 0 && ts.isStringLiteral(args[0])) {
                             foundEvents.push(args[0].text);
                         }
                     }
                }
            }
            ts.forEachChild(n, visitMethodBody);
        }
        visitMethodBody(node);
        return foundEvents;
    }

    function visit(node: ts.Node) {
        // 1. Detectar interfaces de API primero (deben procesarse antes que las clases)
        if (ts.isInterfaceDeclaration(node)) {
            const interfaceName = node.name.getText(sourceFile);
            if (interfaceName.endsWith('PluginApi') || interfaceName.endsWith('Api')) {
                // Guardar esta interfaz para usarla después
                if (!pluginInfo) {
                    const sourceFileText = sourceFile.getFullText();
                    const apiInterfaces = analyzePluginAPIs(sourceFileText, filePath);
                    // No crear pluginInfo aquí, solo registrar que hay interfaces
                }
            }
        }

        // 2. Class-based plugins
        if (ts.isClassDeclaration(node) && node.heritageClauses) {
            const extendsClause = node.heritageClauses.find(h => h.token === ts.SyntaxKind.ExtendsKeyword);
            if (extendsClause) {
                const typeName = extendsClause.types[0].expression.getText(sourceFile);
                if (typeName === 'Plugin') {
                    const className = node.name?.getText(sourceFile) || 'AnonymousPlugin';
                    let pluginName = '';
                    const methods: PluginMethod[] = [];
                    const properties: PluginProperty[] = [];
                    const events: string[] = [];

                    node.members.forEach(member => {
                        // Name
                        if (ts.isPropertyDeclaration(member) && member.name.getText(sourceFile) === 'name') {
                            if (member.initializer && ts.isStringLiteral(member.initializer)) {
                                pluginName = member.initializer.text;
                            }
                        }

                        // Properties
                        if (ts.isPropertyDeclaration(member)) {
                            const propName = member.name.getText(sourceFile);
                            const isPrivate = member.modifiers?.some(m => m.kind === ts.SyntaxKind.PrivateKeyword || m.kind === ts.SyntaxKind.ProtectedKeyword);
                            
                            if (!isPrivate && propName !== 'name' && propName !== 'version') {
                                properties.push({
                                    name: propName,
                                    type: member.type ? member.type.getText(sourceFile) : 'any'
                                });
                            }
                        }

                        // Methods
                        if (ts.isMethodDeclaration(member)) {
                            const methodName = member.name.getText(sourceFile);
                            if (member.body) {
                                events.push(...scanForEvents(member.body));
                            }
                            
                            const isPrivate = member.modifiers?.some(m => m.kind === ts.SyntaxKind.PrivateKeyword || m.kind === ts.SyntaxKind.ProtectedKeyword);
                            if (!isPrivate && !['onLoad', 'onUnload', 'setup', 'onReload', 'onStarted'].includes(methodName)) {
                                const params = member.parameters.map(p => {
                                    const pName = p.name.getText(sourceFile);
                                    const pType = p.type ? p.type.getText(sourceFile) : 'any';
                                    return `${pName}: ${pType}`;
                                });
                                
                                const returnType = member.type ? member.type.getText(sourceFile) : 'void';
                                
                                methods.push({
                                    name: methodName,
                                    params,
                                    returnType
                                });
                            }
                        }
                    });

                    if (pluginName) {
                        // Buscar interfaces de API en el mismo archivo
                        const sourceFileText = sourceFile.getFullText();
                        const apiInterfaces = analyzePluginAPIs(sourceFileText, filePath);
                        
                        pluginInfo = {
                            name: pluginName,
                            className,
                            filePath,
                            methods,
                            properties,
                            events,
                            apiInterfaces
                        };
                    }
                }
            }
        }

        // 2. definePlugin({...})
        if (ts.isExportAssignment(node)) {
            const expr = node.expression;
            if (ts.isCallExpression(expr)) {
                 const calledName = expr.expression.getText(sourceFile);
                 // Match definePlugin or imported.definePlugin
                 if (calledName === 'definePlugin' || calledName.endsWith('.definePlugin')) {
                      if (expr.arguments.length > 0 && ts.isObjectLiteralExpression(expr.arguments[0])) {
                           const obj = expr.arguments[0] as ts.ObjectLiteralExpression;
                           let pluginName = '';
                           const methods: PluginMethod[] = [];
                           const properties: PluginProperty[] = [];
                           const events: string[] = [];
                           
                           obj.properties.forEach(prop => {
                               if (ts.isPropertyAssignment(prop)) {
                                   const name = prop.name.getText(sourceFile);
                                   if (name === 'name' && ts.isStringLiteral(prop.initializer)) {
                                       pluginName = prop.initializer.text;
                                   } else if (ts.isFunctionExpression(prop.initializer) || ts.isArrowFunction(prop.initializer)) {
                                       // It's a method
                                       const func = prop.initializer as ts.FunctionExpression | ts.ArrowFunction;
                                       if (func.body) events.push(...scanForEvents(func.body));
                                       
                                       if (!['onLoad', 'onUnload', 'setup', 'onReload', 'onStarted'].includes(name)) {
                                           const params = func.parameters.map(p => `${p.name.getText(sourceFile)}: ${p.type ? p.type.getText(sourceFile) : 'any'}`);
                                           methods.push({
                                               name,
                                               params,
                                               returnType: func.type ? func.type.getText(sourceFile) : 'void',
                                               doc: `Method ${name} of plugin ${pluginName}`
                                           });
                                       }
                                   } else {
                                       // It's a property
                                       if (name !== 'name' && name !== 'version') {
                                           properties.push({
                                               name,
                                               type: 'any',
                                               doc: `Property ${name} of plugin ${pluginName}`
                                           });
                                       }
                                   }
                               } else if (ts.isMethodDeclaration(prop)) {
                                   // Object literal method shorthand
                                   const name = prop.name.getText(sourceFile);
                                   if (prop.body) events.push(...scanForEvents(prop.body));

                                   if (!['onLoad', 'onUnload', 'setup', 'onReload', 'onStarted'].includes(name)) {
                                       const params = prop.parameters.map(p => `${p.name.getText(sourceFile)}: ${p.type ? p.type.getText(sourceFile) : 'any'}`);
                                       methods.push({
                                           name,
                                           params,
                                           returnType: prop.type ? prop.type.getText(sourceFile) : 'void',
                                           doc: `Method ${name} of plugin ${pluginName}`
                                       });
                                   }
                               }
                           });

                           if (pluginName) {
                               // Buscar interfaces de API en el mismo archivo
                               const sourceFileText = sourceFile.getFullText();
                               const apiInterfaces = analyzePluginAPIs(sourceFileText, filePath);
                               
                               pluginInfo = {
                                   name: pluginName,
                                   className: 'ObjectLiteral',
                                   filePath,
                                   methods,
                                   properties,
                                   events,
                                   apiInterfaces
                               };
                           }
                      }
                 }
            }
        }
        ts.forEachChild(node, visit);
    }

    visit(sourceFile);
    return pluginInfo;
}

export function analyzeText(text: string, filePath: string): PluginInfo | null {
    const sourceFile = ts.createSourceFile(
        filePath,
        text,
        ts.ScriptTarget.Latest,
        true
    );
    return analyzeSourceFile(sourceFile, filePath);
}

/**
 * Analiza interfaces de API de plugins (ej: MathPluginApi)
 */
export function analyzePluginAPIs(text: string, filePath: string): string[] {
  const sourceFile = ts.createSourceFile(
    filePath,
    text,
    ts.ScriptTarget.Latest,
    true
  );

  const apiInterfaces: string[] = [];

  function visit(node: ts.Node) {
    // Buscar interfaces que terminen en "PluginApi" o "Api"
    if (ts.isInterfaceDeclaration(node)) {
      const interfaceName = node.name.getText(sourceFile);
      if (interfaceName.endsWith('PluginApi') || interfaceName.endsWith('Api')) {
        apiInterfaces.push(interfaceName);
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return apiInterfaces;
}
