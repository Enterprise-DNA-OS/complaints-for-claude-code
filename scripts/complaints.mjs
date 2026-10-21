#!/usr/bin/env node
// The one CLI. Human tables by default, --json for machines. Every slash command runs this.
//   node scripts/complaints.mjs attention
//   node scripts/complaints.mjs complaint C-1001 --json
import { getDb } from './lib/db.mjs';
import { run, help, human } from './lib/complaints.mjs';

const argv = process.argv.slice(2);
const json = argv.includes('--json');
let db;
try {
  if (argv.length === 0 || argv.includes('--help')) console.log(help());
  else {
    const cmd = argv.shift();
    const args = [];
    const opts = {};
    for (const a of argv) {
      if (a === '--json') continue;
      if (a.startsWith('--')) {
        const at = a.indexOf('=');
        const k = a.slice(2, at < 0 ? undefined : at);
        if (k in opts) throw Error(`Duplicate flag --${k}`);
        opts[k] = at < 0 ? true : a.slice(at + 1);
      } else args.push(a);
    }
    db = await getDb();
    const result = await run(db, cmd, args, opts);
    console.log(json ? JSON.stringify(result, null, 2) : human(result));
  }
} catch (e) {
  if (json) console.log(JSON.stringify({ error: e.message }));
  else console.error(e.message);
  process.exitCode = 1;
} finally {
  if (db) await db.close();
}
