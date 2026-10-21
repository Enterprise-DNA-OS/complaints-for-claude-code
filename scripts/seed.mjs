#!/usr/bin/env node
// Loads the fictional demo firms and complaints. Safe to run twice. Never run it against your real register.
import fs from 'node:fs';
import path from 'node:path';
import { getDb, REPO_ROOT } from './lib/db.mjs';

const db = await getDb();
try {
  await db.exec('BEGIN');
  await db.exec(fs.readFileSync(path.join(REPO_ROOT, 'supabase', 'seed.sql'), 'utf8'));
  await db.exec('COMMIT');
  const [{ n }] = await db.query('select count(*)::int as n from complaints');
  console.log(`seed: demo complaints register loaded (${n} complaints across 3 brands)`);
} catch (e) {
  await db.exec('ROLLBACK');
  throw e;
} finally {
  await db.close();
}
