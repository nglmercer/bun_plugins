
import { 
    CompletionItemKind,
    InsertTextFormat
} from 'vscode-languageserver/node';
import type { 
    CompletionItem, 
    Position
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { parseDocument, isMap, isSeq, isPair, isScalar, type Node, Scalar, YAMLMap, Pair, YAMLSeq } from 'yaml';

// --- CONSTANTS & DEFINITIONS ---

const TOP_LEVEL_KEYS: CompletionItem[] = [
    { label: 'id', kind: CompletionItemKind.Field, detail: 'Unique identifier for the rule' },
    { label: 'name', kind: CompletionItemKind.Field, detail: 'Human readable name' },
    { label: 'description', kind: CompletionItemKind.Field, detail: 'What this rule does' },
    { label: 'on', kind: CompletionItemKind.Keyword, detail: 'The event that triggers this rule' },
    { label: 'if', kind: CompletionItemKind.Keyword, detail: 'Conditions that must be met' },
    { label: 'do', kind: CompletionItemKind.Keyword, detail: 'Actions to perform when triggered' },
    { label: 'priority', kind: CompletionItemKind.Property, detail: 'Rule execution priority (higher = first)' },
    { label: 'enabled', kind: CompletionItemKind.Property, detail: 'Whether this rule is active' },
    { label: 'cooldown', kind: CompletionItemKind.Property, detail: 'Wait time in ms between executions' },
    { label: 'tags', kind: CompletionItemKind.Property, detail: 'Categorization tags' },
    { label: 'comment', kind: CompletionItemKind.Text, detail: 'Internal developer note' }
];

const EVENTS: CompletionItem[] = [
    { label: 'minecraft:player_join', kind: CompletionItemKind.Event },
    { label: 'minecraft:player_quit', kind: CompletionItemKind.Event },
    { label: 'minecraft:chat', kind: CompletionItemKind.Event },
    { label: 'tiktok:chat', kind: CompletionItemKind.Event },
    { label: 'tiktok:gift', kind: CompletionItemKind.Event },
    { label: 'tiktok:like', kind: CompletionItemKind.Event },
    { label: 'twitch:chat', kind: CompletionItemKind.Event },
    { label: 'twitch:follow', kind: CompletionItemKind.Event },
    { label: 'bopl:webhook', kind: CompletionItemKind.Event },
    { label: 'ANY_EVENT', kind: CompletionItemKind.Event },
    { label: 'USER_LOGIN', kind: CompletionItemKind.Event },
    { label: 'GAME_OVER', kind: CompletionItemKind.Event },
    { label: 'COMMAND', kind: CompletionItemKind.Event },
    { label: 'ALERT', kind: CompletionItemKind.Event }
];

const OPERATORS: CompletionItem[] = [
    { label: 'EQ', kind: CompletionItemKind.Operator, detail: 'Equal (==)' },
    { label: 'NEQ', kind: CompletionItemKind.Operator, detail: 'Not Equal (!=)' },
    { label: 'GT', kind: CompletionItemKind.Operator, detail: 'Greater Than (>)' },
    { label: 'GTE', kind: CompletionItemKind.Operator, detail: 'Greater Than Equals (>=)' },
    { label: 'LT', kind: CompletionItemKind.Operator, detail: 'Less Than (<)' },
    { label: 'LTE', kind: CompletionItemKind.Operator, detail: 'Less Than Equals (<=)' },
    { label: 'IN', kind: CompletionItemKind.Operator, detail: 'Value exists in the provided list' },
    { label: 'NOT_IN', kind: CompletionItemKind.Operator, detail: 'Value does not exist in the list' },
    { label: 'CONTAINS', kind: CompletionItemKind.Operator, detail: 'String contains substring or List contains item' },
    { label: 'MATCHES', kind: CompletionItemKind.Operator, detail: 'Regex pattern match' },
    { label: 'RANGE', kind: CompletionItemKind.Operator, detail: 'Numeric value between [min, max]' },
    { label: 'SINCE', kind: CompletionItemKind.Operator, detail: 'Date is after or equal to value' },
    { label: 'AFTER', kind: CompletionItemKind.Operator, detail: 'Alias for SINCE' },
    { label: 'BEFORE', kind: CompletionItemKind.Operator, detail: 'Date is before value' },
    { label: 'UNTIL', kind: CompletionItemKind.Operator, detail: 'Alias for BEFORE' },
    { label: 'AND', kind: CompletionItemKind.Operator, detail: 'Logical AND (for groups)' },
    { label: 'OR', kind: CompletionItemKind.Operator, detail: 'Logical OR (for groups)' }
];

const ACTION_TYPES: CompletionItem[] = [
    { label: 'log', kind: CompletionItemKind.EnumMember, detail: 'Print message to console' },
    { label: 'execute', kind: CompletionItemKind.EnumMember, detail: 'Run local command' },
    { label: 'forward', kind: CompletionItemKind.EnumMember, detail: 'Forward event to URL' },
    { label: 'response', kind: CompletionItemKind.EnumMember, detail: 'Return HTTP response' },
    { label: 'STATE_SET', kind: CompletionItemKind.EnumMember, detail: 'Save value to global state' },
    { label: 'STATE_INCREMENT', kind: CompletionItemKind.EnumMember, detail: 'Increment numeric state key' },
    { label: 'EMIT_EVENT', kind: CompletionItemKind.EnumMember, detail: 'Trigger another event internally' },
];

const CONDITION_KEYS: CompletionItem[] = [
    { label: 'field', kind: CompletionItemKind.Field, detail: 'Path to context data (e.g. data.user)' },
    { label: 'operator', kind: CompletionItemKind.Field, detail: 'Comparison operator (EQ, GT, etc.)' },
    { label: 'value', kind: CompletionItemKind.Value, detail: 'The value to compare against' },
    { label: 'conditions', kind: CompletionItemKind.Field, detail: 'Sub-conditions for grouping' }
];

const ACTION_KEYS: CompletionItem[] = [
    { label: 'type', kind: CompletionItemKind.Field, detail: 'The type of action to perform' },
    { label: 'params', kind: CompletionItemKind.Variable, detail: 'Configuration for the action' },
    { label: 'delay', kind: CompletionItemKind.Property, detail: 'Delay in ms (integer)' },
    { label: 'probability', kind: CompletionItemKind.Property, detail: 'Execution chance (0-1)' },
    { label: 'mode', kind: CompletionItemKind.Property, detail: 'Grouping mode (ALL, SEQUENCE, EITHER)' },
    { label: 'actions', kind: CompletionItemKind.Property, detail: 'List of sub-actions' }
];

const PARAM_KEYS: Record<string, CompletionItem[]> = {
    'log': [
        { label: 'message', kind: CompletionItemKind.Property },
        { label: 'content', kind: CompletionItemKind.Property },
        { label: 'level', kind: CompletionItemKind.Property, detail: 'info, warn, error' },
    ],
    'execute': [
        { label: 'command', kind: CompletionItemKind.Property },
        { label: 'safe', kind: CompletionItemKind.Property, detail: 'boolean (default: false)' },
        { label: 'dir', kind: CompletionItemKind.Property, detail: 'working directory' },
    ],
    'forward': [
        { label: 'url', kind: CompletionItemKind.Property },
        { label: 'method', kind: CompletionItemKind.Property, detail: 'POST, GET, PUT...' },
        { label: 'headers', kind: CompletionItemKind.Property },
        { label: 'body', kind: CompletionItemKind.Property },
    ],
    'response': [
        { label: 'content', kind: CompletionItemKind.Property },
        { label: 'statusCode', kind: CompletionItemKind.Property, detail: '200, 404, etc.' },
        { label: 'contentType', kind: CompletionItemKind.Property, detail: 'application/json' },
    ],
    'STATE_SET': [
        { label: 'key', kind: CompletionItemKind.Property },
        { label: 'value', kind: CompletionItemKind.Property },
        { label: 'ttl', kind: CompletionItemKind.Property, detail: 'Time to live in ms' },
    ],
    'STATE_INCREMENT': [
        { label: 'key', kind: CompletionItemKind.Property },
        { label: 'amount', kind: CompletionItemKind.Property },
    ],
    'EMIT_EVENT': [
        { label: 'event', kind: CompletionItemKind.Property },
        { label: 'data', kind: CompletionItemKind.Property },
    ]
};

const DYNAMIC_VALUES: CompletionItem[] = [
    { label: '${data.}', kind: CompletionItemKind.Snippet, insertText: '${data.$1}', insertTextFormat: InsertTextFormat.Snippet, detail: 'Event data' },
    { label: '${state.}', kind: CompletionItemKind.Snippet, insertText: '${state.$1}', insertTextFormat: InsertTextFormat.Snippet, detail: 'Global state' },
    { label: '${globals.}', kind: CompletionItemKind.Snippet, insertText: '${globals.$1}', insertTextFormat: InsertTextFormat.Snippet, detail: 'Environment variables' },
    { label: '${timestamp}', kind: CompletionItemKind.Variable, detail: 'Current time ms' },
];

const SNIPPETS: CompletionItem[] = [
    { 
        label: 'trigger_rule', 
        kind: CompletionItemKind.Snippet, 
        insertText: '- id: ${1:rule-id}\n  on: ${2:EVENT}\n  if:\n    field: ${3:data.field}\n    operator: ${4:EQ}\n    value: ${5:target}\n  do:\n    type: ${6:log}\n    params:\n      message: ${7:Done}',
        insertTextFormat: InsertTextFormat.Snippet,
        detail: 'New rule template'
    },
    {
        label: 'log_action',
        kind: CompletionItemKind.Snippet,
        insertText: 'type: log\nparams:\n  message: ${1:message}',
        insertTextFormat: InsertTextFormat.Snippet,
        detail: 'Log action template'
    },
    {
        label: 'condition_nested',
        kind: CompletionItemKind.Snippet,
        insertText: 'operator: ${1|AND,OR|}\nconditions:\n  - field: ${2:data.x}\n    operator: ${3:EQ}\n    value: ${4:val}',
        insertTextFormat: InsertTextFormat.Snippet,
        detail: 'Nested condition group'
    }
];

// --- MAIN LOGIC ---

export function getCompletionItems(document: TextDocument, position: Position): CompletionItem[] {
    const text = document.getText();
    const doc = parseDocument(text);
    const lines = text.split('\n');
    const line = lines[position.line] || '';
    const offset = document.offsetAt(position);
    
    // 1. Check if we are in a VALUE position (after colon)
    const colonIndex = line.indexOf(':');
    if (colonIndex !== -1 && position.character > colonIndex) {
        const key = line.substring(0, colonIndex).trim().replace(/^- /, '');
        const path = findPathAtOffset(doc.contents, offset) || [];
        return getValueCompletionsByKey(key, path);
    }

    // 2. We are in a KEY position or start of line
    const path = findPathAtOffset(doc.contents, offset) || [];
    return getKeyCompletions(path, line);
}

function getValueCompletionsByKey(key: string, path: (Node | Pair)[]): CompletionItem[] {
    switch (key) {
        case 'on': return EVENTS;
        case 'operator': return OPERATORS;
        case 'type': return ACTION_TYPES;
        case 'mode':
            return [
                { label: 'ALL', kind: CompletionItemKind.EnumMember, detail: 'Execute all' },
                { label: 'SEQUENCE', kind: CompletionItemKind.EnumMember, detail: 'Wait for each' },
                { label: 'EITHER', kind: CompletionItemKind.EnumMember, detail: 'Random choice' }
            ];
        case 'enabled':
            return [
                { label: 'true', kind: CompletionItemKind.Value },
                { label: 'false', kind: CompletionItemKind.Value }
            ];
        case 'field':
            return DYNAMIC_VALUES.map(v => ({ ...v, label: v.label.replace('${', '').replace('}', '').replace('.', '') }));
        case 'value':
            return getValueSpecificToOperator(path);
    }
    return DYNAMIC_VALUES;
}

function getKeyCompletions(path: (Node | Pair)[], line: string): CompletionItem[] {
    // If line starts with '- ', we might be in a list
    if (line.trim().startsWith('-')) {
        const parentPair = findEffectiveParentPair(path);
        if (parentPair) {
            const pk = String((parentPair.key as Scalar).value);
            if (pk === 'do' || pk === 'actions') return ACTION_KEYS;
            if (pk === 'if' || pk === 'conditions') return CONDITION_KEYS;
        }
        return SNIPPETS.length > 0 ? [SNIPPETS[0] as CompletionItem] : [];
    }

    const contextPair = findEffectiveParentPair(path);
    if (!contextPair) return TOP_LEVEL_KEYS;

    const key = String((contextPair.key as Scalar).value);
    if (key === 'if' || key === 'conditions') return CONDITION_KEYS;
    if (key === 'do' || key === 'actions') return ACTION_KEYS;
    
    if (key === 'params') {
        const actionMap = findNearestActionMap(path);
        if (actionMap) {
            const typePair = actionMap.items.find(item => isPair(item) && String((item.key as Scalar).value) === 'type');
            if (typePair && isScalar(typePair.value)) {
                return PARAM_KEYS[String(typePair.value.value)] || [];
            }
        }
    }

    return TOP_LEVEL_KEYS;
}


// --- HELPERS ---

function isKeyOfParent(node: Scalar, path: (Node | Pair)[]): boolean {
    const parent = path[path.length - 2];
    if (isPair(parent)) return parent.key === node;
    return false;
}

function findEffectiveParentPair(path: (Node | Pair)[]): Pair | null {
    for (let i = path.length - 1; i >= 0; i--) {
        const item = path[i];
        if (isPair(item)) return item;
    }
    return null;
}

function findNearestActionMap(path: (Node | Pair)[]): YAMLMap | null {
    for (let i = path.length - 1; i >= 0; i--) {
        const item = path[i];
        if (isMap(item)) {
            const hasType = item.items.some(p => isPair(p) && String((p.key as Scalar).value) === 'type');
            if (hasType) return item;
        }
    }
    return null;
}

function getValueSpecificToOperator(path: (Node | Pair)[]): CompletionItem[] {
    // Look for a map in the path that contains an 'operator' key
    const map = path.slice().reverse().find(n => isMap(n)) as YAMLMap;
    if (!map) return DYNAMIC_VALUES;

    const opPair = map.items.find(item => isPair(item) && String((item.key as Scalar).value) === 'operator');
    if (!opPair || !isScalar(opPair.value)) return DYNAMIC_VALUES;

    const op = String(opPair.value.value);
    switch (op) {
        case 'RANGE':
            return [{ label: '[min, max]', kind: CompletionItemKind.Snippet, insertText: '[$1, $2]', insertTextFormat: InsertTextFormat.Snippet }];
        case 'IN':
        case 'NOT_IN':
            return [{ label: '[item1, item2]', kind: CompletionItemKind.Snippet, insertText: '[$1, $2]', insertTextFormat: InsertTextFormat.Snippet }];
        case 'MATCHES':
            return [{ label: '"regex"', kind: CompletionItemKind.Snippet, insertText: '"^$1$"', insertTextFormat: InsertTextFormat.Snippet }];
    }

    return DYNAMIC_VALUES;
}

export function findPathAtOffset(node: Node | Pair | null, offset: number, currentPath: (Node | Pair)[] = []): (Node | Pair)[] | null {
    if (!node) return null;
    
    // Check range
    const range = (node as any).range;
    if (range) {
        // [start, end, optional_something]
        // Parser range is [start, end]. 
        // We want to be inclusive and a bit more for completions at the end of a line.
        if (offset < range[0] || offset > range[1] + 1) {
             // If we are exactly 1 char past the end (like at the end of "mode: "), 
             // we still might want this node if it's the most specific one.
        }
    }

    const newPath = [...currentPath, node];

    if (isMap(node)) {
        for (const item of node.items) {
            if (isPair(item)) {
                const itemRange = (item as any).range;
                if (itemRange && offset >= itemRange[0] && offset <= itemRange[1] + 1) {
                    return findPathAtOffset(item, offset, newPath);
                }
            }
        }
        return newPath;
    }
    
    if (isSeq(node)) {
        for (const item of node.items) {
            const itemRange = (item as any).range;
            if (itemRange && offset >= itemRange[0] && offset <= itemRange[1] + 1) {
                return findPathAtOffset(item as Node, offset, newPath);
            }
        }
        return newPath;
    }
    
    if (isPair(node)) {
        // If we are in a pair, we could be in key or value
        const keyRange = (node.key as any)?.range;
        if (keyRange && offset >= keyRange[0] && offset <= keyRange[1] + 1) {
            return findPathAtOffset(node.key as Node, offset, newPath);
        }
        
        // If there's a value, check it
        if (node.value) {
            const valRange = (node.value as any)?.range;
            if (valRange && offset >= valRange[0] && offset <= valRange[1] + 1) {
                return findPathAtOffset(node.value as Node, offset, newPath);
            }
        }
        
        return newPath;
    }

    return newPath;
}



