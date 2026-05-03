import { detectLanguage, parseFile } from '../src/lib/parser';
import { extractSymbols } from '../src/lib/symbols';

const samples = [
  {
    name: 'sample.js',
    content: `
function hello(name) {
  return 'hi ' + name;
}

class Greeter {
  greet(name) {
    return hello(name);
  }
}

const VERSION = '1.0.0';
`,
  },
  {
    name: 'sample.ts',
    content: `
export function add(a: number, b: number): number {
  return a + b;
}

export class Counter {
  private value = 0;
  increment(): void {
    this.value += 1;
  }
}

export const PI = 3.14;
`,
  },
  {
    name: 'sample.tsx',
    content: `
import React from 'react';

export function Hello({ name }: { name: string }) {
  return <div>Hello {name}</div>;
}
`,
  },
  {
    name: 'sample.py',
    content: `
def hello(name):
    return f"hi {name}"

class Greeter:
    def greet(self, name):
        return hello(name)
`,
  },
];

console.log('\n\n=== Symbol Extraction ===');
for (const s of samples) {
  const lang = detectLanguage(s.name);
  if (!lang) continue;
  const tree = parseFile(s.content, lang);
  if (!tree) continue;

  const symbols = extractSymbols(tree, lang);
  console.log(`\n[${s.name}] ${symbols.length} symbols:`);
  for (const sym of symbols) {
    console.log(`  ${sym.kind.padEnd(8)} ${sym.id.padEnd(20)} L${sym.startLine}-${sym.endLine}  hash=${sym.bodyHash}`);
  }
}
