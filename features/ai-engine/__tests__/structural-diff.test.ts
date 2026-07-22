import { describe, it, expect } from 'vitest';
import { diffFile } from '@features/ai-engine/structural-diff';

/**
 * Proves: the structural diff identifies changed functions across all supported
 * languages (JS, TS, TSX, JSX, Python), and marks unsupported files as such.
 * Failure means: the LLM would receive a wrong or empty structural picture
 * and produce lower-quality reviews.
 *
 * Note: parseFile and diffFile are now synchronous (regex-based, no WASM), so
 * no await needed.
 */

function findChange(diff: ReturnType<typeof diffFile>, name: string) {
  return diff.changes.find((c) => c.name === name);
}

describe('diffFile structural analysis', () => {
  it('detects a modified function in a JavaScript file', () => {
    const before = `function total(a, b) { return a + b; }`;
    const after = `function total(a, b) { return a + b + 1; }`;
    const diff = diffFile('calc.js', before, after);
    expect(diff.language).toBe('javascript');
    expect(diff.supported).toBe(true);
    expect(findChange(diff, 'total')?.change).toBe('modified');
  });

  it('detects a modified function in a TypeScript file', () => {
    const before = `export function greet(name: string): string { return "hi " + name; }`;
    const after = `export function greet(name: string): string { return "hello " + name; }`;
    const diff = diffFile('greet.ts', before, after);
    expect(diff.language).toBe('typescript');
    expect(findChange(diff, 'greet')?.change).toBe('modified');
  });

  it('detects an added function in a TSX file', () => {
    const before = `export function A() { return null; }`;
    const after = `export function A() { return null; }\nexport function B() { return null; }`;
    const diff = diffFile('view.tsx', before, after);
    expect(diff.language).toBe('tsx');
    expect(findChange(diff, 'B')?.change).toBe('added');
  });

  it('detects a modified function in a JSX file (treated as javascript)', () => {
    const before = `function Button() { return 1; }`;
    const after = `function Button() { return 2; }`;
    const diff = diffFile('Button.jsx', before, after);
    expect(diff.language).toBe('javascript');
    expect(findChange(diff, 'Button')?.change).toBe('modified');
  });

  it('detects a modified function in a Python file', () => {
    const before = `def add(a, b):\n    return a + b\n`;
    const after = `def add(a, b):\n    return a - b\n`;
    const diff = diffFile('math.py', before, after);
    expect(diff.language).toBe('python');
    expect(findChange(diff, 'add')?.change).toBe('modified');
  });

  it('marks an unsupported file type as unsupported with no symbol detail', () => {
    const diff = diffFile('README.md', '# a', '# b');
    expect(diff.supported).toBe(false);
    expect(diff.language).toBeNull();
    expect(diff.changes).toHaveLength(0);
  });

  it('detects a class in JavaScript', () => {
    const diff = diffFile('app.js', 'class OldName {}', 'class NewName {}');
    expect(findChange(diff, 'NewName')?.change).toBe('added');
    expect(findChange(diff, 'OldName')?.change).toBe('removed');
  });

  it('detects arrow function assigned to const', () => {
    const before = `const handler = (x) => x + 1;`;
    const after = `const handler = (x) => x + 2;`;
    const diff = diffFile('utils.js', before, after);
    expect(findChange(diff, 'handler')?.change).toBe('modified');
  });

  it('returns empty structural diff for null content (new file / deletion)', () => {
    const addedDiff = diffFile('new-file.js', null, 'function hello() {}');
    expect(addedDiff.supported).toBe(true);
    expect(findChange(addedDiff, 'hello')?.change).toBe('added');

    const removedDiff = diffFile('old-file.js', 'function bye() {}', null);
    expect(removedDiff.supported).toBe(true);
    expect(findChange(removedDiff, 'bye')?.change).toBe('removed');
  });
});