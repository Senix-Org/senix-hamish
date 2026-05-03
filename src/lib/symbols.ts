import Parser from 'tree-sitter';
   import { SupportedLanguage } from './parser';
   
   export type SymbolKind = 'function' | 'method' | 'class' | 'const' | 'unknown';
   
   export interface Symbol {
     /** Stable identifier within the file, e.g. "MyClass.greet" or "hello" */
     id: string;
     name: string;
     kind: SymbolKind;
     /** 1-based line numbers, inclusive */
     startLine: number;
     endLine: number;
     /** A normalized text representation of the symbol's body — used for change detection */
     bodyHash: string;
     /** Raw body text, useful for the LLM later */
     bodyText: string;
   }
   
   /**
    * Cheap content fingerprint. Strips whitespace and hashes. Two implementations
    * with identical logic but different formatting will produce the same hash.
    * We use this to detect "real" code changes vs. cosmetic ones.
    */
   function hashBody(text: string): string {
     // Strip whitespace, lowercase nothing (keep identifiers stable)
     const normalized = text.replace(/\s+/g, ' ').trim();
     // Simple FNV-1a hash, fine for our purposes
     let hash = 2166136261;
     for (let i = 0; i < normalized.length; i++) {
       hash ^= normalized.charCodeAt(i);
       hash = Math.imul(hash, 16777619);
     }
     return (hash >>> 0).toString(16);
   }
   
   /**
    * Extracts top-level and class-level symbols from a parsed file.
    * Implementation is per-language because each grammar names nodes differently.
    */
   export function extractSymbols(
     tree: Parser.Tree,
     language: SupportedLanguage
   ): Symbol[] {
     const symbols: Symbol[] = [];
     const root = tree.rootNode;
   
     if (language === 'python') {
       walkPython(root, symbols, '');
     } else {
       // JS, TS, TSX share enough grammar to use one walker
       walkJsTs(root, symbols, '');
     }
   
     return symbols;
   }
   
   function pushSymbol(
     symbols: Symbol[],
     node: Parser.SyntaxNode,
     name: string,
     kind: SymbolKind,
     prefix: string
   ) {
     const id = prefix ? `${prefix}.${name}` : name;
     const bodyText = node.text;
     symbols.push({
       id,
       name,
       kind,
       startLine: node.startPosition.row + 1,
       endLine: node.endPosition.row + 1,
       bodyHash: hashBody(bodyText),
       bodyText,
     });
   }
   
   function walkJsTs(node: Parser.SyntaxNode, symbols: Symbol[], prefix: string) {
     for (const child of node.namedChildren) {
       const type = child.type;
   
       if (type === 'function_declaration') {
         const name = child.childForFieldName('name')?.text ?? 'anonymous';
         pushSymbol(symbols, child, name, 'function', prefix);
       } else if (type === 'class_declaration') {
         const name = child.childForFieldName('name')?.text ?? 'AnonymousClass';
         pushSymbol(symbols, child, name, 'class', prefix);
         // Recurse into class body for methods
         const body = child.childForFieldName('body');
         if (body) walkJsTs(body, symbols, name);
       } else if (type === 'method_definition') {
         const name = child.childForFieldName('name')?.text ?? 'anonymous';
         pushSymbol(symbols, child, name, 'method', prefix);
       } else if (type === 'lexical_declaration' || type === 'variable_declaration') {
         // const foo = ... or let foo = ...
         for (const declarator of child.namedChildren) {
           if (declarator.type === 'variable_declarator') {
             const name = declarator.childForFieldName('name')?.text ?? '';
             if (name) pushSymbol(symbols, child, name, 'const', prefix);
           }
         }
       } else if (type === 'export_statement') {
         // Recurse into export wrappers
         walkJsTs(child, symbols, prefix);
       }
     }
   }
   
   function walkPython(node: Parser.SyntaxNode, symbols: Symbol[], prefix: string) {
     for (const child of node.namedChildren) {
       const type = child.type;
   
       if (type === 'function_definition') {
         const name = child.childForFieldName('name')?.text ?? 'anonymous';
         const kind: SymbolKind = prefix ? 'method' : 'function';
         pushSymbol(symbols, child, name, kind, prefix);
       } else if (type === 'class_definition') {
         const name = child.childForFieldName('name')?.text ?? 'AnonymousClass';
         pushSymbol(symbols, child, name, 'class', prefix);
         const body = child.childForFieldName('body');
         if (body) walkPython(body, symbols, name);
       } else if (type === 'decorated_definition') {
         walkPython(child, symbols, prefix);
       }
     }
   }