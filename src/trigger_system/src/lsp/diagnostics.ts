import {
  TextDocuments,
  Diagnostic,
  DiagnosticSeverity,
} from 'vscode-languageserver/node';
import {
  TextDocument
} from 'vscode-languageserver-textdocument';
import { parseDocument, isMap, isSeq, YAMLMap, YAMLSeq } from 'yaml';
import type { Node, Pair, Scalar } from 'yaml';
import { TriggerValidator } from '../domain/validator';

/**
 * Validates the text content of a document and returns diagnostics.
 * Extracted for easier testing without the full LSP connection mock.
 */
export async function getDiagnosticsForText(text: string): Promise<Diagnostic[]> {
  const diagnostics: Diagnostic[] = [];
  
  // Create a minimal TextDocument object for position calculation
  // We use the library one if accessible, but for simple calculation this is enough.
  const textDocument = TextDocument.create("file://test", "yaml", 1, text);

  // Parse YAML with CST (Concrete Syntax Tree) from 'yaml' package
  const doc = parseDocument(text);
  
  // 1. Syntax Errors
  if (doc.errors.length > 0) {
      for (const err of doc.errors) {
          diagnostics.push({
              severity: DiagnosticSeverity.Error,
              range: {
                  start: textDocument.positionAt(err.pos[0]),
                  end: textDocument.positionAt(err.pos[1])
              },
              message: err.message,
              source: 'yaml-parser'
          });
      }
  }

  // 2. Semantic Validation (ArkType)
  // We attempt validation even if there are syntax errors
  try {
      const json = doc.toJS();
      if (json && typeof json === 'object') {
          // Handle Wrapper Object (Headers), Array of Rules, or Single Rule
          let items: any[] = [];
          
          // Check if it's a wrapper object with "rules"
          const isWrapper = !Array.isArray(json) && json.rules && Array.isArray(json.rules);
          const isArray = Array.isArray(json);

          if (isWrapper) {
              items = json.rules;
          } else {
              items = isArray ? json : [json];
          }
          
          items.forEach((item, index) => {
               if (item && typeof item === 'object' && item.actions && !item.do) {
                   item.do = item.actions;
               }

               const result = TriggerValidator.validate(item);
               if (!result.valid) {
                   for (const issue of result.issues) {
                       let fullPathParts = issue.path.split('.');
                       
                       if (isWrapper) {
                           fullPathParts.unshift(String(index));
                           fullPathParts.unshift('rules');
                       } else if (isArray) {
                           fullPathParts.unshift(String(index));
                       }
                       
                       const range = findRangeForPath(doc.contents, fullPathParts, textDocument);
                       
                       diagnostics.push({
                           severity: DiagnosticSeverity.Error,
                           range: range,
                           message: issue.message + (issue.suggestion ? ` (Suggestion: ${issue.suggestion})` : ''),
                           source: 'trigger-validator'
                       });
                   }
               }
          });
      }
  } catch (e) {
      // verification failed, likely due to severe syntax errors, which are already reported.
  }
  return diagnostics;
}


function findRangeForPath(
    contents: Node | null, 
    pathParts: string[], 
    textDocument: TextDocument
): { start: { line: number, character: number }, end: { line: number, character: number } } {
    
    let current: Node | null = contents;
    for (const key of pathParts) {
        if (!current) break;
        
        if (isMap(current)) {
            // current is YAMLMap
            const pair = current.items.find((p: Pair) => {
                if (isScalar(p.key) && String(p.key.value) === key) return true;
                return false;
            });
            if (pair && pair.value) {
                current = pair.value as Node; 
            } else {
                current = null;
            }
        } else if (isSeq(current)) {
            // current is YAMLSeq
            const idx = parseInt(key);
            if (!isNaN(idx) && current.items[idx]) {
                current = current.items[idx] as Node;
            } else {
                current = null;
            }
        } else {
            current = null;
        }
    }

    if (current && current.range) {
        return {
            start: textDocument.positionAt(current.range[0]),
            end: textDocument.positionAt(current.range[1])
        };
    }

    return {
         start: textDocument.positionAt(0),
         end: textDocument.positionAt(0)
    };
}

function isScalar(node: any): node is Scalar {
    return node && node.type !== undefined && (node.type === 'SCALAR' || node.type === 'QUOTE_DOUBLE' || node.type === 'QUOTE_SINGLE' || typeof node.value !== 'undefined');
}
