
import {
  createConnection,
  TextDocuments,
  Diagnostic,
  DiagnosticSeverity,
  ProposedFeatures,
  InitializeParams,
  DidChangeConfigurationNotification,
  TextDocumentSyncKind,
  InitializeResult
} from 'vscode-languageserver/node';
import {
  TextDocument
} from 'vscode-languageserver-textdocument';
import { parseDocument, isMap, isSeq } from 'yaml';
import { TriggerValidator } from '../domain/validator';

// Create a connection for the server, using Node's IPC as a transport.
// Also include all preview / proposed LSP features.
const connection = createConnection(ProposedFeatures.all);

// Create a simple text document manager.
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

let hasConfigurationCapability = false;
let hasWorkspaceFolderCapability = false;

connection.onInitialize((params: InitializeParams) => {
  const capabilities = params.capabilities;

  hasConfigurationCapability = !!(
    capabilities.workspace && !!capabilities.workspace.configuration
  );
  hasWorkspaceFolderCapability = !!(
    capabilities.workspace && !!capabilities.workspace.workspaceFolders
  );

  const result: InitializeResult = {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      // Tell the client that this server supports code completion.
      completionProvider: {
        resolveProvider: true
      }
    }
  };
  if (hasWorkspaceFolderCapability) {
    result.capabilities.workspace = {
      workspaceFolders: {
        supported: true
      }
    };
  }
  return result;
});

connection.onInitialized(() => {
  if (hasConfigurationCapability) {
    // Register for all configuration changes.
    connection.client.register(DidChangeConfigurationNotification.type, undefined);
  }
});

// The content of a text document has changed. This event is emitted
// when the text document first opened or when its content has changed.
documents.onDidChangeContent(change => {
  validateTextDocument(change.document);
});

async function validateTextDocument(textDocument: TextDocument): Promise<void> {
  const text = textDocument.getText();
  const diagnostics: Diagnostic[] = [];

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
          // Validator expects Single Rule. 
          // If array, we validate each.
          // But TriggerValidator.validate takes "data: any".
          // IF the file is a list of rules:
          const items = Array.isArray(json) ? json : [json];
          
          items.forEach((item, index) => {
               // Normalize 'do' alias if needed (mirrors Loader logic)
               if (item && typeof item === 'object' && item.actions && !item.do) {
                   item.do = item.actions;
               }

               const result = TriggerValidator.validate(item);
               if (!result.valid) {
                   for (const issue of result.issues) {
                       // Resolve path in CST
                       // If root is array, path starts with index: "0.field"
                       // If root is object, path is "field"
                       
                       let fullPathParts = issue.path.split('.');
                       if (Array.isArray(json)) {
                           fullPathParts.unshift(String(index));
                       }
                       
                       const range = findRangeForPath(doc.contents, fullPathParts, textDocument, text.length);
                       
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

  connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
}

function findRangeForPath(
    contents: any, 
    pathParts: string[], 
    textDocument: TextDocument, 
    maxLen: number
): { start: { line: number, character: number }, end: { line: number, character: number } } {
    
    let current = contents;
    for (const key of pathParts) {
        if (!current) break;
        
        if (isMap(current)) {
            const pair = current.items.find((p: any) => p.key && String(p.key.value) === key);
            if (pair) {
                // If this is the last key, we want the range of the VALUE probably?
                // Or the KEY? Usually the value is inaccurate if it's "missing string".
                // Let's target the pair.value.
                current = pair.value; 
                // Note: if value is null (e.g. "on: "), current might be null or scalar null
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

    // Fallback: Return range 0-0 or file start if not found
    return {
         start: textDocument.positionAt(0),
         end: textDocument.positionAt(0)
    };
}


connection.onDidChangeWatchedFiles(_change => {
  connection.console.log('We received an file change event');
});

documents.listen(connection);
connection.listen();
