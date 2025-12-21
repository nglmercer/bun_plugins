
import {
    SemanticTokensBuilder
} from 'vscode-languageserver/node';
import type { SemanticTokensLegend } from 'vscode-languageserver/node';
import { parseDocument, isMap, isSeq, isScalar, LineCounter } from 'yaml';
import type { Node, Pair, Scalar } from 'yaml';

// Define the legend
export const semanticTokensLegend: SemanticTokensLegend = {
    tokenTypes: [
        'property', // 0
        'keyword',  // 1
        'function', // 2
        'string',   // 3
        'number',   // 4
        'operator', // 5
        'variable',  // 6
        'parameter', // 7
        'comment'   // 8
    ],
    tokenModifiers: [
        'declaration',
        'readonly'
    ]
};

const TOKEN_TYPES = {
    property: 0,
    keyword: 1,
    function: 2,
    string: 3,
    number: 4,
    operator: 5,
    variable: 6,
    parameter: 7,
    comment: 8
};

export function getSemanticTokens(text: string): number[] {
    const lineCounter = new LineCounter();
    const doc = parseDocument(text, { lineCounter });
    const builder = new SemanticTokensBuilder();

    if (doc.contents) {
        visit(doc.contents, builder, lineCounter);
    }

    // Process comments for directives
    processCommentsForDirectives(text, builder, lineCounter);

    return builder.build().data;
}

function visit(node: Node | null, builder: SemanticTokensBuilder, lineCounter: LineCounter) {
    if (!node) return;

    if (isMap(node)) {
        for (const pair of node.items) {
            visitPair(pair, builder, lineCounter);
        }
    } else if (isSeq(node)) {
        for (const item of node.items) {
            visit(item as Node, builder, lineCounter);
        }
    }
}

function visitPair(pair: Pair, builder: SemanticTokensBuilder, lineCounter: LineCounter) {
    const key = pair.key as Scalar;
    // Ensure key exists and has a range
    if (key && key.range) {
        const keyText = String(key.value);
        let type = TOKEN_TYPES.property;

        // Custom coloring logic 
        if (['if', 'when', 'conditions', 'match'].includes(keyText)) {
            type = TOKEN_TYPES.keyword; 
        } else if (['do', 'actions', 'then', 'execute'].includes(keyText)) {
            type = TOKEN_TYPES.function; 
        } else if (['id', 'rule', 'name'].includes(keyText)) {
            type = TOKEN_TYPES.variable; 
        } else if (['on', 'trigger', 'events'].includes(keyText)) {
            type = TOKEN_TYPES.parameter;
        } else if (['operator', 'op'].includes(keyText)) {
             type = TOKEN_TYPES.operator;
        }
        

        const startPos = lineCounter.linePos(key.range[0]);
        // linePos returns 1-based line and col
        builder.push(
            startPos.line - 1, 
            startPos.col - 1, 
            key.range[1] - key.range[0], 
            type, 
            0
        );
    }
    
    if (pair.value) {
        visit(pair.value as Node, builder, lineCounter);
    }
}
