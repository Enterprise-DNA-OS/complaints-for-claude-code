#!/usr/bin/env node
// npm test: a temporary database, the migration, the seed twice, every CLI command, the rules and the import.
// Set TEST_DATABASE_URL to run the same checks against an empty disposable Postgres.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { getDb, REPO_ROOT } from './lib/db.mjs';
import { migrate } from './migrate.mjs';
import { run, COMMANDS, READS, TABLES, QUESTIONS, cents, isoDate, today } from './lib/complaints.mjs';
import { parseCsv } from './lib/csv.mjs';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'complaints-test-'));
process.env.DATA_DIR = path.join(dir, 'db');
process.env.OUTPUT_DIR = dir;
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || '';

const db = await getDb();
const covered = new Set();
let checks = 0;
const call = (c, a = [], o = {}) => { covered.add(c); return run(db, c, a, o); };
async function fails(c, a, o, re) { await assert.rejects(() => call(c, a, o), re); checks++; }
function child(script, args = [], status = 0) {
  const p = spawnSync(process.execPath, [path.join(REPO_ROOT, 'scripts', script), ...args], { cwd: REPO_ROOT, env: process.env, encoding: 'utf8' });
  assert.equal(p.status, status, p.stderr || p.stdout);
  checks++;
  return p.stdout;
}
const day = (n) => { const d = new Date(); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10); };
const A = { actor: 'Tester' };

try {
  // Migration runs once; the seed is idempotent.
  assert.equal((await migrate(db)).ran.length, 1);
  assert.equal((await migrate(db)).ran.length, 0);
  const seed = fs.readFileSync(path.join(REPO_ROOT, 'supabase', 'seed.sql'), 'utf8');
  await db.exec(seed);
  await db.exec(seed);
  assert.equal((await db.query('select * from complaints')).length, 15);
  assert.equal((await db.query('select * from contacts')).length, 8);

  // Every read returns rows in the shape the commands promise.
  for (const c of Object.keys(READS)) assert.ok(Array.isArray(await call(c)), c);
  assert.equal((await call('insights')).length, QUESTIONS.length);
  assert.equal(QUESTIONS.length, 10);
  const attention = await call('attention');
  for (const item of ['response overdue, no delay notice', 'not acknowledged', 'NZ extension notice needed', 'response due in 7 days', 'resolved, response not sent', 'systemic issue not reported'])
    assert.ok(attention.some((r) => r.item === item), `attention has ${item}`);
  const rules = new Set((await call('compliance')).map((r) => r.rule));
  for (const r of ['IDR-TIMEFRAME', 'ACKNOWLEDGE', 'FIVE-DAY-EXCEPTION', 'SCHEME-INFORMED', 'NZ-EXTENSION', 'IDR-DATA', 'SYSTEMIC']) assert.ok(rules.has(r), `compliance has ${r}`);
  assert.ok((await call('complaints', [], { status: 'open', brand: 'hhl' })).every((r) => r.status === 'open' && r.brand === 'HHL'));
  assert.ok((await call('due', [], { days: '7' })).some((r) => r.ref === 'C-1002'));
  await fails('due', [], { days: 'soon' }, /--days/);
  assert.ok((await call('delays')).some((r) => r.ref === 'C-1005'));
  assert.equal((await call('representatives')).length, 2);

  // Deadline arithmetic: calendar days in Australia, working days and holidays in New Zealand.
  const [{ d }] = await db.query("select add_business_days('2026-10-16'::date, 1) as d");
  assert.equal(String(d), '2026-10-19', 'Friday plus one business day is Monday');
  await call('add-holiday', [], { ...A, day: '2026-10-26', name: 'Labour Day (NZ)' });
  const [{ d2 }] = await db.query("select add_business_days('2026-10-23'::date, 1) as d2");
  assert.equal(String(d2), '2026-10-27', 'a recorded holiday is skipped');
  assert.equal(cents('1,850.50'), 185050);
  assert.throws(() => cents('12.345'), /dollar/);
  assert.equal(isoDate('03/02/2026'), '2026-02-03');
  assert.throws(() => isoDate('2026-02-30'), /Invalid/);

  // A full Australian complaint: log, acknowledge, contact, issue, resolve, respond, close.
  await fails('add-brand', [], { ...A, code: 'BAD', name: 'Bad', jurisdiction: 'AU', licence: 'x', scheme: 'FSCL', contact: 'x' }, /NZ scheme/);
  await fails('add-brand', [], { ...A, code: 'BAD', name: 'Bad', jurisdiction: 'AU', licence: 'x', scheme: 'NOPE', contact: 'x' }, /Unknown scheme/);
  await call('add-brand', [], { ...A, code: 'TST', name: 'Test Lending', jurisdiction: 'AU', licence: 'ACL 1 (test)', scheme: 'AFCA', member: '1', contact: 'c@test.example' });
  const p = await call('add-complainant', [], { ...A, name: 'Test Person', postcode: '2000', vulnerability: 'Hearing impaired' });
  assert.equal(p.code, 'P-13');
  await fails('log', [], { ...A, brand: 'TST', complainant: 'P-13', type: 'super death benefit', product: 'x', summary: 'x', owner: 'x' }, /No AU timeframe/);
  await fails('log', [], { ...A, brand: 'TST', complainant: 'P-13', received: '2999-01-01', product: 'x', summary: 'x', owner: 'x' }, /future/);
  await fails('log', [], { ...A, brand: 'TST', complainant: 'an', product: 'x', summary: 'x', owner: 'x' }, /Ambiguous complainant/);
  await fails('log', [], { ...A, brand: 'TST', complainant: 'P-13', product: 'x', summary: 'x', owner: 'x', channel: 'fax' }, /channel/);
  const logged = await call('log', [], { ...A, brand: 'TST', complainant: 'P-13', received: day(2), channel: 'email', product: 'Credit - Personal loans', summary: 'Late payment fee charged in error', owner: 'Tester', issues: 'Fees and charges' });
  assert.equal(logged.ref, 'C-1016');
  assert.equal(String(logged.respond_by), day(-28), 'standard AU complaint: 30 calendar days');
  await call('acknowledge', ['C-1016'], { ...A, on: day(2), by: 'Tester' });
  await fails('acknowledge', ['C-1016'], { ...A, by: 'Tester' }, /already acknowledged/);
  await fails('acknowledge', ['C-1004'], { ...A, on: day(30), by: 'x' }, /before/);
  await call('contact', ['1016'], { ...A, direction: 'out', method: 'phone', note: 'Fee reversed', by: 'Tester' });
  await call('issue', ['C-1016'], { ...A, add: 'Service quality' });
  await call('issue', ['C-1016'], { ...A, add: 'Incorrect information' });
  await fails('issue', ['C-1016'], { ...A, add: 'Fourth' }, /at most three/);
  await fails('resolve', ['C-1016'], { ...A, outcome: 'Monetary remedy' }, /--remedy/);
  await fails('respond', ['C-1016'], A, /Resolve it first/);
  const res = await call('resolve', ['C-1016'], { ...A, outcome: 'Monetary remedy', remedy: '35.00', satisfied: true });
  assert.match(res.next, /Five business day exception applies/);
  await fails('resolve', ['C-1016'], { ...A, outcome: 'x' }, /already resolved/);
  await fails('close', ['C-1009'], A, /needs a written response/);
  await call('close', ['C-1016'], A);
  await fails('contact', ['C-1016'], { ...A, direction: 'in', method: 'email', note: 'x', by: 'x', on: day(5) }, /before/);
  await fails('acknowledge', ['C-1016'], { ...A, by: 'x' }, /closed/);

  // Hardship always needs a written response; delay notices; the AFCA details are tracked.
  const h = await call('log', [], { ...A, brand: 'TST', complainant: 'P-13', received: day(1), type: 'hardship', product: 'Credit - Personal loans', summary: 'Hardship request ignored', owner: 'Tester' });
  assert.equal(String(h.respond_by), day(-20), 'hardship: 21 calendar days');
  await call('delay-notice', [h.ref], { ...A, reason: 'Waiting on lender records', 'scheme-informed': true });
  await fails('delay-notice', [h.ref], { ...A, reason: 'again' }, /already has a delay notice/);
  await fails('delay-notice', [h.ref], { ...A, reason: 'x', 'scheme-informed': 'yes' }, /takes no value/);
  await call('resolve', [h.ref], { ...A, outcome: 'Hardship arrangement', satisfied: true });
  await fails('close', [h.ref], A, /hardship complaints always get a written response/);
  const resp = await call('respond', [h.ref], { ...A, 'scheme-informed': true });
  assert.equal(resp.on_time, true);
  await call('close', [h.ref], A);

  // A response sent without the scheme's details is a finding.
  await call('respond', ['C-1009'], A);
  assert.ok((await call('compliance')).some((r) => r.rule === 'SCHEME-INFORMED' && r.ref === 'C-1009'));
  await call('escalate', ['C-1009'], { ...A, 'scheme-ref': 'AFCA 26-009999' });
  await fails('escalate', ['C-1009'], { ...A, 'scheme-ref': 'x' }, /already escalated/);

  // Systemic issues: raise, link, report, close.
  const si = await call('raise-systemic', [], { ...A, title: 'Late fee rule misconfigured', description: 'Fees charged inside the grace period', owner: 'Tester' });
  assert.equal(si.code, 'SI-03');
  assert.equal((await call('link-systemic', ['C-1016'], { ...A, issue: 'SI-03' })).complaints, 1);
  await fails('close-systemic', ['SI-03'], A, /Report it/);
  await call('report-systemic', ['SI-03'], { ...A, to: 'Board risk committee', 'root-cause': 'Grace period not set' });
  await call('close-systemic', ['SI-03'], A);
  assert.ok(!(await call('attention')).some((r) => r.ref === 'SI-03'));

  // ASIC reporting periods: open, check, report, lodge.
  await call('open-period', [], { ...A, code: '2025-H2', starts: '2025-07-01', ends: '2025-12-31' });
  assert.equal(String((await db.query("select due_on from reporting_periods where code = '2025-H2'"))[0].due_on), '2026-02-28');
  const periods = await call('periods');
  const current = periods[periods.length - 1].code;
  assert.ok((await call('idr-check', [current])).some((r) => r.ref === 'C-1012'));
  const rep = await call('idr-report', [current], { file: path.join(dir, 'idr.csv') });
  assert.ok(rep.complaints >= 10);
  const reportRows = parseCsv(fs.readFileSync(rep.file, 'utf8'));
  assert.ok(reportRows.some((r) => r['Unique identifier'] === 'C-1016' && r['Monetary remedy'] === '35.00'));
  await fails('idr-report', [current], { file: rep.file }, /EEXIST/);
  await fails('lodge', [current], { ...A, receipt: 'x', on: today() }, /Lodge after the period closes/);
  await call('lodge', ['2025-H2'], { ...A, on: '2026-02-20', receipt: 'ASIC-123' });
  await fails('lodge', ['2025-H2'], { ...A, receipt: 'x' }, /was lodged/);

  // Import: the IDR data file as CSV. Atomic, repeatable, refuses changed rows and unknown columns.
  const csv = path.join(REPO_ROOT, 'tests', 'fixtures', 'idr.csv');
  assert.equal((await call('import', ['idr', csv], { ...A, 'dry-run': true })).inserted, 3);
  assert.equal((await db.query("select * from complaints where ref like 'OLD-%'")).length, 0);
  assert.equal((await call('import', ['idr', csv], A)).inserted, 3);
  assert.equal((await call('import', ['idr', csv], A)).skipped, 3);
  assert.equal((await db.query("select * from complainants where name = 'Kate Mercer'")).length, 1, 'same name and postcode is one person');
  const old1 = await call('complaint', ['OLD-0001']);
  assert.equal(Number(old1.complaint.remedy_cents), 120000);
  assert.equal(old1.complaint.representative, null);
  assert.ok((await call('open')).some((r) => r.ref === 'OLD-0003'), 'an imported open complaint gets its clock');
  assert.ok(!(await call('compliance')).some((r) => r.ref === 'OLD-0001' && r.rule === 'FIVE-DAY-EXCEPTION'), 'imported history is not judged on letters we never saw');
  const text = fs.readFileSync(csv, 'utf8');
  const lines = text.trim().split('\n');
  const bad = path.join(dir, 'bad.csv');
  fs.writeFileSync(bad, [lines[0], lines[1].replace('OLD-0001', 'OLD-0009'), lines[2].replace('Claim excess explained', 'Changed')].join('\n'));
  await fails('import', ['idr', bad], A, /Changed import row/);
  assert.equal((await db.query("select * from complaints where ref = 'OLD-0009'")).length, 0, 'a failed file leaves nothing behind');
  fs.writeFileSync(bad, text.replace('Summary', 'Notes'));
  await fails('import', ['idr', bad], A, /Unknown column "Notes"/);
  const map = path.join(dir, 'map.json');
  fs.writeFileSync(map, JSON.stringify({ Summary: 'Notes' }));
  assert.equal((await call('import', ['idr', bad], { ...A, map, 'dry-run': true })).skipped, 3, 'a mapped heading reads the same rows');
  fs.writeFileSync(bad, [lines[0], lines[1], lines[1]].join('\n'));
  await fails('import', ['idr', bad], A, /duplicate Unique identifier/);
  fs.writeFileSync(bad, [lines[0], lines[1].replace('OLD-0001', 'OLD-0010').replace('Harbourline Home Loans', 'Nobody Pty')].join('\n'));
  await fails('import', ['idr', bad], A, /not set up/);
  await fails('import', ['xlsx', csv], A, /Supported import/);
  await fails('import', ['idr', csv], { ...A, dryrun: true }, /Unknown flag/);

  // Drafts never send; they land in drafts/ with the scheme's details.
  const letter = fs.readFileSync((await call('draft-response', ['C-1010'])).file, 'utf8');
  assert.ok(letter.includes('1800 931 678') && letter.includes('Nothing sends'));
  const nz = fs.readFileSync((await call('draft-response', ['C-1006'])).file, 'utf8');
  assert.ok(nz.includes('Financial Services Complaints Limited') && nz.includes('FSCL-1199'));
  assert.ok(fs.readFileSync((await call('draft-delay', ['C-1005'])).file, 'utf8').includes('notice of extension'));
  assert.ok(fs.readFileSync((await call('weekly-review')).file, 'utf8').includes('due --days=7'));
  assert.ok(fs.readFileSync((await call('board-report', [current])).file, 'utf8').includes('Systemic issues'));
  const detail = await call('complaint', ['C-1001']);
  assert.equal(detail.contacts.length, 3);
  await fails('complaint', ['C-10'], {}, /Ambiguous complaint/);
  await fails('complaint', ['nobody at all'], {}, /No matching complaint/);

  // Export is complete and never overwrites.
  const exp = await call('export', [], { file: path.join(dir, 'archive.json') });
  const archive = JSON.parse(fs.readFileSync(exp.file, 'utf8'));
  for (const t of TABLES) assert.equal(archive[t].length, (await db.query(`select * from ${t}`)).length, t);
  await fails('export', [], { file: exp.file }, /EEXIST/);
  await fails('nonsense', [], {}, /Unknown command/);
  await fails('open', ['extra'], {}, /takes 0 argument/);

  assert.deepEqual(COMMANDS.filter((c) => !covered.has(c)), [], 'every CLI command is exercised');
  assert.ok((await db.query("select relrowsecurity from pg_class where relname = 'complaints'"))[0].relrowsecurity);
  await db.query("update complainants set name = '<script>alert(1)</script>' where code = 'P-13'");
  await db.close();

  // The CLI, the views and the documents as a person runs them.
  child('complaints.mjs', ['--help']);
  child('complaints.mjs', ['unknown'], 1);
  assert.ok(child('complaints.mjs', ['attention']).includes('response overdue'));
  assert.ok(JSON.parse(child('complaints.mjs', ['brands', '--json'])).length === 4);
  assert.match(JSON.parse(child('complaints.mjs', ['complaint', 'C-10', '--json'], 1)).error, /Ambiguous/);
  child('view.mjs');
  child('docs.mjs');
  assert.equal(fs.readdirSync(path.join(dir, 'views')).length, 3);
  const files = fs.readdirSync(path.join(dir, 'docs-out', 'complaint-file'));
  assert.ok(files.length >= 20);
  const html = files.map((f) => fs.readFileSync(path.join(dir, 'docs-out', 'complaint-file', f), 'utf8')).join('\n');
  assert.ok(html.includes('&lt;script&gt;') && !html.includes('<script>alert(1)</script>'), 'names are escaped in documents');
  console.log(`PASS: ${covered.size} CLI commands; migration, idempotent seed, RG 271 and FSCL clocks, holidays, five day exception, scheme details, systemic issues, ASIC periods, atomic IDR import, drafts, export, RLS and escaped HTML (${checks} negative and subprocess checks).`);
} catch (e) {
  try { await db.close(); } catch {}
  throw e;
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
