import { getCompletionItems } from './completions';
import { TextDocument } from 'vscode-languageserver-textdocument';

// Test 1: mode should show ALL, SEQUENCE, EITHER
const testYaml = `- id: rule-1
  do:
    mode: `;
const doc = TextDocument.create('file:///test.yaml', 'yaml', 1, testYaml);
const pos = { line: 2, character: 10 }; 
const items = getCompletionItems(doc, pos);

console.log('--- Test 1 (mode) ---');
console.log('Completions:', items.map(i => i.label).join(', '));

// Test 2: operator should show EQ, NEQ, etc.
const testYaml2 = `- id: rule-1
  if:
    operator: `;
const doc2 = TextDocument.create('file:///test2.yaml', 'yaml', 1, testYaml2);
const pos2 = { line: 2, character: 14 }; 
const items2 = getCompletionItems(doc2, pos2);
console.log('\n--- Test 2 (operator) ---');
console.log('Completions:', items2.map(i => i.label).join(', '));

// Test 3: params inside log should show message, content, level
const testYaml3 = `- id: rule-1
  do:
    - type: log
      params:
        `;
const doc3 = TextDocument.create('file:///test3.yaml', 'yaml', 1, testYaml3);
const pos3 = { line: 4, character: 8 }; 
const items3 = getCompletionItems(doc3, pos3);
console.log('\n--- Test 3 (params) ---');
console.log('Completions:', items3.map(i => i.label).join(', '));
