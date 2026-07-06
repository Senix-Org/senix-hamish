import { detectLanguage, parseFile, SupportedLanguage } from './parser';
   import { extractSymbols, Symbol } from './symbols';
   
   export type ChangeKind = 'added' | 'removed' | 'modified' | 'unchanged';
   
   export interface SymbolChange {
     id: string;
     name: string;
     kind: Symbol['kind'];
     change: ChangeKind;
     /**
      * bodyText is present only for added/removed/modified symbols. Unchanged
      * symbols keep their location metadata but omit the body: it adds no
      * analysis signal and dominated the size of the structural diff stored
      * in analyses.risk_flags on large PRs.
      */
     before: { startLine: number; endLine: number; bodyText?: string } | null;
     after: { startLine: number; endLine: number; bodyText?: string } | null;
   }
   
   export interface FileStructuralDiff {
     filename: string;
     language: SupportedLanguage | null;
     supported: boolean;
     /** Empty if the file isn't supported */
     changes: SymbolChange[];
     /** Summary counts for quick reporting */
     summary: {
       added: number;
       removed: number;
       modified: number;
       unchanged: number;
     };
   }
   
   /**
    * Diff one file's before & after content into a list of symbol-level changes.
    * If beforeContent is null, the file is newly added. If afterContent is null, removed.
    */
   export function diffFile(
     filename: string,
     beforeContent: string | null,
     afterContent: string | null
   ): FileStructuralDiff {
     const language = detectLanguage(filename);
   
     // Unsupported file types: still report a diff, just with no symbol detail
     if (!language) {
       return {
         filename,
         language: null,
         supported: false,
         changes: [],
         summary: { added: 0, removed: 0, modified: 0, unchanged: 0 },
       };
     }
   
     const beforeSymbols = beforeContent ? parseAndExtract(beforeContent, language) : [];
     const afterSymbols = afterContent ? parseAndExtract(afterContent, language) : [];
   
     const beforeById = new Map(beforeSymbols.map((s) => [s.id, s]));
     const afterById = new Map(afterSymbols.map((s) => [s.id, s]));
   
     const changes: SymbolChange[] = [];
     const seen = new Set<string>();
   
     for (const [id, after] of afterById) {
       seen.add(id);
       const before = beforeById.get(id);
       if (!before) {
         changes.push({
           id, name: after.name, kind: after.kind, change: 'added',
           before: null,
           after: { startLine: after.startLine, endLine: after.endLine, bodyText: after.bodyText },
         });
       } else if (before.bodyHash !== after.bodyHash) {
         changes.push({
           id, name: after.name, kind: after.kind, change: 'modified',
           before: { startLine: before.startLine, endLine: before.endLine, bodyText: before.bodyText },
           after: { startLine: after.startLine, endLine: after.endLine, bodyText: after.bodyText },
         });
       } else {
         // Unchanged: keep structural metadata, drop the body text (see the
         // SymbolChange doc comment).
         changes.push({
           id, name: after.name, kind: after.kind, change: 'unchanged',
           before: { startLine: before.startLine, endLine: before.endLine },
           after: { startLine: after.startLine, endLine: after.endLine },
         });
       }
     }
   
     for (const [id, before] of beforeById) {
       if (seen.has(id)) continue;
       changes.push({
         id, name: before.name, kind: before.kind, change: 'removed',
         before: { startLine: before.startLine, endLine: before.endLine, bodyText: before.bodyText },
         after: null,
       });
     }
   
     const summary = {
       added: changes.filter((c) => c.change === 'added').length,
       removed: changes.filter((c) => c.change === 'removed').length,
       modified: changes.filter((c) => c.change === 'modified').length,
       unchanged: changes.filter((c) => c.change === 'unchanged').length,
     };
   
     return { filename, language, supported: true, changes, summary };
   }
   
   function parseAndExtract(content: string, language: SupportedLanguage): Symbol[] {
     const tree = parseFile(content, language);
     if (!tree) return [];
     return extractSymbols(tree, language);
   }