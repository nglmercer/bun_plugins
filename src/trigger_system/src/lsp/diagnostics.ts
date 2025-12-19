
import {
  TextDocuments,
  Diagnostic,
  DiagnosticSeverity,
} from 'vscode-languageserver/node';
import {
  TextDocument
} from 'vscode-languageserver-textdocument';
import { parseDocument, isMap, isSeq } from 'yaml';
import { TriggerValidator } from '../domain/validator';

/**
 * Validates the text content of a document and returns diagnostics.
 * Extracted for easier testing without the full LSP connection mock.
 */
export async function getDiagnosticsForText(text: string): Promise<Diagnostic[]> {
  const diagnostics: Diagnostic[] = [];
  
  // Create a minimal TextDocument object for position calculation
  // We use the library one if accessible, but for simple calculation this is enough.
  // Actually we need `positionAt`. Since we import TextDocument, we can instantiate it.
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
  } else {
      // 2. Semantic Validation (ArkType)
      const json = doc.toJS();
      if (json && typeof json === 'object') {
          // Handle Array of Rules or Single Rule?
          const items = Array.isArray(json) ? json : [json];
          
          items.forEach((item, index) => {
               if (item && typeof item === 'object' && item.actions && !item.do) {
                   item.do = item.actions;
               }

               const result = TriggerValidator.validate(item);
               if (!result.valid) {
                   for (const issue of result.issues) {
                       let fullPathParts = issue.path.split('.');
                       if (Array.isArray(json)) {
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
  }
  return diagnostics;
}


function findRangeForPath(
    contents: any, 
    pathParts: string[], 
    textDocument: TextDocument
): { start: { line: number, character: number }, end: { line: number, character: number } } {
    
    let current = contents;
    for (const key of pathParts) {
        if (!current) break;
        
        if (isMap(current)) {
            const pair = current.items.find((p: any) => p.key && String(p.key.value) === key);
            if (pair) {
                current = pair.value; 
            } else {
                current = null;
            }
        } else if (isSeq(current)) {
            const idx = parseInt(key);
            if (!isNaN(idx) && current.items[idx]) {
                current = current.items[idx];
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
