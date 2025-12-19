
import { 
    CompletionItemKind
} from 'vscode-languageserver/node';
import type { 
    CompletionItem, 
    Position
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { parseDocument, isMap, isSeq, isPair, isScalar,type Node, Scalar, YAMLMap, Pair, YAMLSeq } from 'yaml';

// --- DEFINITIONS ---

const TOP_LEVEL_KEYS: CompletionItem[] = [
    { label: 'id', kind: CompletionItemKind.Field, detail: 'Unique identifier' },
    { label: 'name', kind: CompletionItemKind.Field },
    { label: 'description', kind: CompletionItemKind.Field },
    { label: 'on', kind: CompletionItemKind.Keyword, detail: 'Event trigger' },
    { label: 'if', kind: CompletionItemKind.Keyword, detail: 'Condition block' },
    { label: 'do', kind: CompletionItemKind.Keyword, detail: 'Action block' },
    { label: 'priority', kind: CompletionItemKind.Property },
    { label: 'enabled', kind: CompletionItemKind.Property },
    { label: 'cooldown', kind: CompletionItemKind.Property },
    { label: 'tags', kind: CompletionItemKind.Property },
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
    { label: 'EQ', kind: CompletionItemKind.Operator, detail: 'Equal' },
    { label: 'NEQ', kind: CompletionItemKind.Operator, detail: 'Not Equal' },
    { label: 'GT', kind: CompletionItemKind.Operator, detail: 'Greater Than' },
    { label: 'GTE', kind: CompletionItemKind.Operator, detail: 'Greater Than Equals' },
    { label: 'LT', kind: CompletionItemKind.Operator, detail: 'Less Than' },
    { label: 'LTE', kind: CompletionItemKind.Operator, detail: 'Less Than Equals' },
    { label: 'IN', kind: CompletionItemKind.Operator, detail: 'Value in List' },
    { label: 'NOT_IN', kind: CompletionItemKind.Operator, detail: 'Value not in List' },
    { label: 'CONTAINS', kind: CompletionItemKind.Operator, detail: 'String/List contains' },
    { label: 'MATCHES', kind: CompletionItemKind.Operator, detail: 'Regex match' },
    { label: 'RANGE', kind: CompletionItemKind.Operator, detail: '[min, max]' },
    { label: 'SINCE', kind: CompletionItemKind.Operator, detail: 'Time query' },
    { label: 'AFTER', kind: CompletionItemKind.Operator, detail: 'Time query' },
    { label: 'BEFORE', kind: CompletionItemKind.Operator, detail: 'Time query' },
    { label: 'UNTIL', kind: CompletionItemKind.Operator, detail: 'Time query' },
];

const ACTION_TYPES: CompletionItem[] = [
    { label: 'log', kind: CompletionItemKind.EnumMember, detail: 'Print to console' },
    { label: 'execute', kind: CompletionItemKind.EnumMember, detail: 'Run shell command' },
    { label: 'forward', kind: CompletionItemKind.EnumMember, detail: 'HTTP Request' },
    { label: 'response', kind: CompletionItemKind.EnumMember, detail: 'HTTP Response' },
    { label: 'STATE_SET', kind: CompletionItemKind.EnumMember, detail: 'Set global state' },
    { label: 'STATE_INCREMENT', kind: CompletionItemKind.EnumMember, detail: 'Increment global state' },
    { label: 'EMIT_EVENT', kind: CompletionItemKind.EnumMember, detail: 'Emit internal event' },
];

const CONDITION_KEYS: CompletionItem[] = [
    { label: 'field', kind: CompletionItemKind.Field },
    { label: 'operator', kind: CompletionItemKind.Field },
    { label: 'value', kind: CompletionItemKind.Value },
    { label: 'conditions', kind: CompletionItemKind.Field } // for groups
];

const ACTION_KEYS: CompletionItem[] = [
    { label: 'type', kind: CompletionItemKind.Field },
    { label: 'params', kind: CompletionItemKind.Variable },
    { label: 'delay', kind: CompletionItemKind.Property },
    { label: 'probability', kind: CompletionItemKind.Property },
    { label: 'mode', kind: CompletionItemKind.Property }, // for groups
    { label: 'actions', kind: CompletionItemKind.Property } // for groups
];

// Map Action Type -> Params Keys
const PARAM_KEYS: Record<string, CompletionItem[]> = {
    'log': [
        { label: 'message', kind: CompletionItemKind.Property },
        { label: 'content', kind: CompletionItemKind.Property },
    ],
    'execute': [
        { label: 'command', kind: CompletionItemKind.Property },
        { label: 'safe', kind: CompletionItemKind.Property, detail: 'boolean' },
    ],
    'forward': [
        { label: 'url', kind: CompletionItemKind.Property },
        { label: 'method', kind: CompletionItemKind.Property, detail: 'POST, GET...' },
        { label: 'headers', kind: CompletionItemKind.Property },
    ],
    'response': [
        { label: 'content', kind: CompletionItemKind.Property },
        { label: 'statusCode', kind: CompletionItemKind.Property },
        { label: 'headers', kind: CompletionItemKind.Property },
    ],
    'STATE_SET': [
        { label: 'key', kind: CompletionItemKind.Property },
        { label: 'value', kind: CompletionItemKind.Property },
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

// --- LOGIC ---

export function getCompletionItems(document: TextDocument, position: Position): CompletionItem[] {
    const text = document.getText();
    const doc = parseDocument(text);
    const offset = document.offsetAt(position);

    // If empty doc
    if (!text.trim()) {
        return TOP_LEVEL_KEYS;
    }

    // Find node at offset
    const path = findPathAtOffset(doc.contents, offset);

    if (!path || path.length === 0) {
        // Fallback for root or new lines that parser missed
        // Check indentation logic or default to root
        return TOP_LEVEL_KEYS; 
    }

    const lastNode = path[path.length - 1];
    
    // Determine if we are completing a KEY or a VALUE
    // In YAML AST, if we are in a Pair, we might be in key or value.
    if (isPair(lastNode)) {
        // Check if cursor is in key range or value range
        const pair = lastNode as Pair;
        
        // If cursor is in Value position (after colon)
        if (pair.value && offset >= (pair.key as Node).range![1]) {
            return getValueCompletions(pair, path);
        }
        
        // If cursor is in Key position (or completing key)
        // Usually tough to distinguish "modifying key" from "new key" perfectly without robust CST
        // But let's assume if it matches known keys, we are modifying key. 
        // If we are significantly past the key, we are in value.
        // Simplified:
        return getKeyCompletions(path);
    }
    
    // If we are in a Map, we are likely adding a new key
    if (isMap(lastNode)) {
        return getKeyCompletions(path);
    }

    // If we are in a Sequence, we might be starting a new item which is usually a map
    if (isSeq(lastNode)) {
         // Often items are objects
         const parent = path[path.length - 2];
         if (parent && isPair(parent)) {
             const key = (parent.key as Scalar).value as string;
             if (key === 'actions' || key === 'do') return ACTION_KEYS;
             if (key === 'if') return CONDITION_KEYS; // if 'if' is a list
         }
    }

    // If we are in a Scalar, it depends on parent.
    if (isScalar(lastNode)) {
        const parent = path[path.length - 2];
        if (isPair(parent)) {
            // We are likely in a value or key of this pair
            // Check range
            const p = parent as Pair;
            if (p.key === lastNode) {
                // We are editing key
                return getKeyCompletions(path.slice(0, -1));
            } else {
                // We are editing value
                return getValueCompletions(p, path.slice(0, -1));
            }
        }
        // If parent is Seq, we are item in list
    }

    return [];
}

function getKeyCompletions(path: (Node | Pair)[]): CompletionItem[] {
    // Traverse up to find context
    // path: [RootMap, Pair(do), Seq, Map] -> we are inside an action
    // path: [RootMap, Pair(if), Map] -> inside condition
    // path: [RootMap] -> root keys
    
    let current = path[path.length - 1];
    
    // Unwind until we find a Map context or root
    // logic: look at the parent Pair to see what property we are filling
    
    // If we are just in Root (YAMLMap at index 0) and not nested:
    if (path.length === 1 && isMap(current)) {
        return TOP_LEVEL_KEYS;
    }
    
    // Check immediate parent pair we are INSIDE of (if any)
    const parentPair = findParentPair(path);
    if (!parentPair) return TOP_LEVEL_KEYS;
    
    const key = (parentPair.key as Scalar).value as string;

    if (key === 'if' || key === 'conditions') {
        return CONDITION_KEYS;
    }
    
    if (key === 'do' || key === 'actions') {
        return ACTION_KEYS;
    }
    
    if (key === 'params') {
        // We need to know the 'type' of the action.
        // The 'type' is a sibling key in the same Map.
        const map = path.find(n => isMap(n)) as YAMLMap;
        if (map) {
            const typePair = map.items.find(item => isPair(item) && (item.key as Scalar).value === 'type');
            if (typePair) {
                 const typeValue = (typePair.value as Scalar).value as string;
                 return PARAM_KEYS[typeValue] || [];
            }
        }
        return [];
    }

    return [];
}

function getValueCompletions(pair: Pair, path: (Node | Pair)[]): CompletionItem[] {
    const key = (pair.key as Scalar).value as string;

    if (key === 'on') return EVENTS;
    if (key === 'operator') return OPERATORS;
    if (key === 'type') return ACTION_TYPES;
    if (key === 'mode') {
        return [
             { label: 'ALL', kind: CompletionItemKind.EnumMember },
             { label: 'SEQUENCE', kind: CompletionItemKind.EnumMember },
             { label: 'EITHER', kind: CompletionItemKind.EnumMember }
        ];
    }
    
    if (key === 'value') {
        // Find sibling 'operator'
        const map = path[path.length - 1];
        if (isMap(map)) {
             const opPair = map.items.find(item => isPair(item) && (item.key as Scalar).value === 'operator');
             if (opPair && opPair.value) {
                 const op = (opPair.value as Scalar).value as string;
                 return getValueSuggestionsForOperator(op);
             }
        }
        // General suggestions if no operator found or general context
        return [
            { label: 'true', kind: CompletionItemKind.Value },
            { label: 'false', kind: CompletionItemKind.Value },
            { label: '${data.}', kind: CompletionItemKind.Snippet, insertText: '${data.$1}' }
        ];
    }

    return [];
}

function getValueSuggestionsForOperator(operator: string): CompletionItem[] {
    switch (operator) {
        case 'RANGE':
            return [{ label: '[min, max]', kind: CompletionItemKind.Snippet, insertText: '[$1, $2]' }];
        case 'IN':
        case 'NOT_IN':
            return [{ label: '[item1, item2]', kind: CompletionItemKind.Snippet, insertText: '[$1, $2]' }];
        case 'EQ':
        case 'NEQ':
             return [
                 { label: '"text"', kind: CompletionItemKind.Value, insertText: '"$1"' },
                 { label: '123', kind: CompletionItemKind.Value },
                 { label: '${data.var}', kind: CompletionItemKind.Snippet, insertText: '${data.$1}' }
             ];
        case 'MATCHES':
             return [{ label: '"regex"', kind: CompletionItemKind.Value, insertText: '"^$1$"' }];
        default:
             return [];
    }
}


function findParentPair(path: (Node | Pair)[]): Pair | null {
    for (let i = path.length - 1; i >= 0; i--) {
        if (isPair(path[i])) return path[i] as Pair;
    }
    return null;
}

// Simple recursive finder
function findPathAtOffset(node: Node | Pair | null, offset: number, currentPath: (Node | Pair)[] = []): (Node | Pair)[] | null {
    if (!node) return null;
    
    // Check if offset is within node range
    if ((node as any).range) {
        const [start, end] = (node as any).range;
        if (offset < start || offset > end) return null;
    }

    const newPath = [...currentPath, node];

    if (isMap(node)) {
         for (const item of node.items) {
             // items in Map are Pairs
             const res = findPathAtOffset(item, offset, newPath);
             if (res) return res;
         }
         return newPath;
    }
    
    if (isSeq(node)) {
        for (const item of node.items) {
             const res = findPathAtOffset(item as Node, offset, newPath);
             if (res) return res;
        }
        return newPath;
    }
    
    if (isPair(node)) {
        const pair = node as Pair;
        // Check key
        if (pair.key) {
             const res = findPathAtOffset(pair.key as Node, offset, newPath);
             if (res) return res;
        }
        // Check value
        if (pair.value) {
            const res = findPathAtOffset(pair.value as Node, offset, newPath);
            if (res) return res;
        }
        return newPath;
    }

    return newPath;
}
