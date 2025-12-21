import {
  createConnection,
  TextDocuments,
  ProposedFeatures,
  DidChangeConfigurationNotification,
  TextDocumentSyncKind,
} from 'vscode-languageserver/node';
import type {
  CompletionItem,
  TextDocumentPositionParams,
  InitializeParams,
  InitializeResult
} from 'vscode-languageserver/node';
import {
  TextDocument
} from 'vscode-languageserver-textdocument';
import { getDiagnosticsForText } from './diagnostics';
import { getCompletionItems } from './completions';
import { semanticTokensLegend, getSemanticTokens } from './semantic_tokens';
import { getHover } from './hover';

// Create a connection for the server, using Node's IPC as a transport.
// Also include all preview / proposed LSP features.
const connection = createConnection(ProposedFeatures.all);

// Create a simple text document manager.
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

let hasConfigurationCapability = false;
let hasWorkspaceFolderCapability = false;

connection.onInitialize((params: InitializeParams) => {
  connection.console.log('Trigger System LSP Server initializing...');
  const capabilities = params.capabilities;

  hasConfigurationCapability = !!(
    capabilities.workspace && !!capabilities.workspace.configuration
  );
  hasWorkspaceFolderCapability = !!(
    capabilities.workspace && !!capabilities.workspace.workspaceFolders
  );

  connection.console.log(`Configuration capability: ${hasConfigurationCapability}`);
  connection.console.log(`Workspace folder capability: ${hasWorkspaceFolderCapability}`);

  const result: InitializeResult = {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      // Tell the client that this server supports code completion.
      completionProvider: {
        resolveProvider: true,
        triggerCharacters: [':', ' ', '-', '$', '{', '.', '[']
      },
      hoverProvider: true,
      semanticTokensProvider: {
        legend: semanticTokensLegend,
        full: true
      }
    }
  };
  
  connection.console.log(`Server capabilities registered: ${JSON.stringify(result.capabilities, null, 2)}`);
  
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
  const diagnostics = await getDiagnosticsForText(text);
  connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
}

connection.onDidChangeWatchedFiles(_change => {
  connection.console.log('We received an file change event');
});

// This handler provides the initial list of the completion items.
connection.onCompletion(
  (_textDocumentPosition: TextDocumentPositionParams): CompletionItem[] => {
    connection.console.log(`Completion requested for document: ${_textDocumentPosition.textDocument.uri}`);
    connection.console.log(`Position: line ${_textDocumentPosition.position.line}, character ${_textDocumentPosition.position.character}`);
    
    const document = documents.get(_textDocumentPosition.textDocument.uri);
    if (!document) {
        connection.console.log('Document not found');
        return [];
    }
    
    connection.console.log(`Document found, getting completions...`);
    const completions = getCompletionItems(document, _textDocumentPosition.position);
    connection.console.log(`Found ${completions.length} completion items`);
    
    return completions;
  }
);

// This handler resolves additional information for the item selected in
// the completion list.
connection.onCompletionResolve(
  (item: CompletionItem): CompletionItem => {
    /* 
    if (item.data === 1) {
      item.detail = 'TypeScript details';
      item.documentation = 'TypeScript documentation';
    }
    */
    return item;
  }
);

connection.languages.semanticTokens.on((params) => {
    const document = documents.get(params.textDocument.uri);
    if (!document) {
        return { data: [] };
    }
    const text = document.getText();
    const tokens = getSemanticTokens(text);
    return { data: tokens };
});

// Provide hover information
connection.onHover((params) => {
    const document = documents.get(params.textDocument.uri);
    if (!document) {
        return null;
    }
    return getHover(document, params.position);
});

documents.listen(connection);
connection.listen();
