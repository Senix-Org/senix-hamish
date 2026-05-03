import { diffFile } from '../src/lib/structural-diff';
   
   console.log('\n\n=== Structural Diff ===');
   
   const before = `
   function hello(name) {
     return 'Hello, ' + name;
   }
   const x = 42;
   class Greeter { greet() { return hello('world'); } }
   `;
   const after = `
   function hello(name) {
     return 'Hi there, ' + name;  // ← modified
   }
   const x = 42;
   const y = 100;                  // ← added
   class Greeter {
     greet() { return hello('world'); }
     wave() { return 'wave';  }    // ← added method
   }
   `;
   
   const diff = diffFile('sample.js', before, after);
   console.log(`File: ${diff.filename} (${diff.language})`);
   console.log(`Summary: +${diff.summary.added} -${diff.summary.removed} ~${diff.summary.modified} =${diff.summary.unchanged}`);
   for (const c of diff.changes) {
     console.log(`  ${c.change.padEnd(10)} ${c.kind.padEnd(8)} ${c.id}`);
   }