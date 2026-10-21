// The complaints desk: every read and write the CLI offers, in one place.
// scripts/complaints.mjs parses the command line; scripts/smoke.mjs drives this directly.
import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { REPO_ROOT } from './db.mjs';
import { parseCsv } from './csv.mjs';
import { table } from './format.mjs';

export const TABLES = ['edr_schemes', 'idr_timeframes', 'holidays', 'brands', 'complainants', 'systemic_issues', 'complaints',
  'complaint_issues', 'complaint_outcomes', 'contacts', 'reporting_periods', 'activity'];

// Reads with no arguments. Each is one query against the shared views.
export const READS = {
  brands: 'select b.code, b.name, b.jurisdiction, b.licence, b.scheme_code as scheme, b.complaints_contact from brands b order by code',
  complainants: `select p.code, p.name, p.complainant_type, p.postcode, p.vulnerability,
      (select count(*)::int from complaints c where c.complainant_id = p.id) as complaints from complainants p order by code`,
  open: 'select ref, brand, complainant, complaint_type, owner, received_on, respond_by, days_left, delay_notice_on from open_complaints order by respond_by, ref',
  'acknowledge-due': `select ref, brand, complainant, owner, received_on, acknowledge_by from complaint_deadlines
      where status = 'open' and acknowledged_on is null order by acknowledge_by, ref`,
  delays: `select ref, brand, complainant, owner, respond_by, checkpoint_on,
      case when jurisdiction = 'NZ' and checkpoint_on <= current_date + 3 then 'NZ: written reason to extend by ' || checkpoint_on
           else 'delay notice before ' || respond_by end as needed
      from complaint_deadlines where status = 'open' and delay_notice_on is null
        and (respond_by <= current_date + 5 or (jurisdiction = 'NZ' and checkpoint_on <= current_date + 3)) order by respond_by, ref`,
  attention: 'select item, ref, brand, owner, detail, due_on from attention_queue order by rank, due_on, ref',
  compliance: `select rule, severity, ref, brand, finding from compliance_findings
      order by case severity when 'breach' then 0 else 1 end, rule, ref`,
  systemic: 'select code, title, owner, status, raised_on, reported_to, reported_on, complaints, open_complaints, remedy_cents from systemic_register order by status, raised_on',
  periods: `select r.code, r.starts_on, r.ends_on, r.due_on, r.submitted_on, r.submission_ref,
      (select count(*)::int from idr_period_rows p where p.period = r.code) as complaints from reporting_periods r order by starts_on`,
  timeframes: 'select jurisdiction, complaint_type, days, basis, checkpoint_days, always_written, rule from idr_timeframes order by jurisdiction, days, complaint_type',
  remedies: `select product, currency, count(*)::int as complaints, count(remedy_cents)::int as with_remedy, coalesce(sum(remedy_cents), 0)::bigint as remedy_cents
      from complaint_register group by product, currency order by remedy_cents desc, product`,
  representatives: `select representative, brand, count(*)::int as complaints, count(*) filter (where status = 'open')::int as open,
      string_agg(ref, ', ' order by ref) as refs from complaint_register where about_representative group by representative, brand order by complaints desc`,
  vulnerable: `select ref, brand, complainant, vulnerability, status, owner, received_on from complaint_register
      where vulnerability is not null order by status, received_on`,
  activity: 'select entity_id, action, actor, detail, created_at from activity order by created_at desc, id desc limit 50',
};

// Ten questions, each one query. /insights runs them all.
export const QUESTIONS = [
  ['Which products draw the most complaints, and how many are still open?',
    `select product, count(*)::int as complaints, count(*) filter (where status = 'open')::int as open from complaint_register group by product order by complaints desc, product`],
  ['How many days does each brand take to close a complaint, on average and at worst?',
    `select brand, count(*)::int as closed, round(avg(closed_on - received_on))::int as avg_days, max(closed_on - received_on) as worst_days from complaint_register where closed_on is not null group by brand order by avg_days desc`],
  ['Which owners carry the most open complaints, and how many are past due?',
    `select owner, count(*)::int as open, count(*) filter (where days_left < 0)::int as past_due from open_complaints group by owner order by open desc`],
  ['Which issues keep coming back across brands?',
    `select i.issue, count(*)::int as complaints, count(distinct c.brand_id)::int as brands from complaint_issues i join complaints c on c.id = i.complaint_id group by i.issue having count(*) > 1 order by complaints desc, issue`],
  ['How much have we paid in remedies, by product?',
    `select product, currency, coalesce(sum(remedy_cents), 0)::bigint as remedy_cents from complaint_register group by product, currency having coalesce(sum(remedy_cents), 0) > 0 order by remedy_cents desc`],
  ['Which complainants have complained more than once?',
    `select complainant, count(*)::int as complaints, string_agg(ref, ', ' order by ref) as refs from complaint_register group by complainant having count(*) > 1 order by complaints desc`],
  ['What share of complaints closed inside five business days?',
    `select brand, count(*)::int as closed, count(*) filter (where business_days_between(received_on, resolved_on) <= 5)::int as within_five, round(100.0 * count(*) filter (where business_days_between(received_on, resolved_on) <= 5) / count(*))::int as pct from complaint_register where status = 'closed' group by brand order by brand`],
  ['Which complaints went to AFCA or FSCL, and what were they about?',
    `select ref, brand, scheme, product, issues, escalated_on, scheme_ref from complaint_register where escalated_on is not null order by escalated_on`],
  ['Which representatives have complaints against them?', READS.representatives],
  ['Do complainants who told us about a vulnerability wait longer?',
    `select case when vulnerability is null then 'no vulnerability noted' else 'vulnerability noted' end as complainants, count(*)::int as complaints,
       round(avg(coalesce(resolved_on, current_date) - received_on))::int as avg_days_open from complaint_register group by 1 order by 1`],
];

// Command name -> [positional args, allowed flags]. Unknown flags fail before anything is written.
const SPECS = {
  ...Object.fromEntries(Object.keys(READS).map((k) => [k, [0, []]])),
  complaints: [0, ['status', 'brand', 'owner']],
  due: [0, ['days']],
  insights: [0, []],
  complaint: [1, []],
  'idr-check': [1, []],
  'add-brand': [0, ['actor', 'code', 'name', 'jurisdiction', 'licence', 'scheme', 'member', 'contact']],
  'add-complainant': [0, ['actor', 'code', 'name', 'type', 'email', 'phone', 'postcode', 'vulnerability']],
  'add-holiday': [0, ['actor', 'day', 'name']],
  log: [0, ['actor', 'brand', 'complainant', 'received', 'channel', 'type', 'product', 'summary', 'owner', 'representative', 'issues', 'ref']],
  acknowledge: [1, ['actor', 'on', 'by']],
  contact: [1, ['actor', 'on', 'direction', 'method', 'note', 'by']],
  issue: [1, ['actor', 'add']],
  'delay-notice': [1, ['actor', 'on', 'reason', 'scheme-informed']],
  resolve: [1, ['actor', 'on', 'outcome', 'remedy', 'satisfied', 'wants-letter']],
  respond: [1, ['actor', 'on', 'scheme-informed']],
  close: [1, ['actor', 'on']],
  escalate: [1, ['actor', 'on', 'scheme-ref']],
  'raise-systemic': [0, ['actor', 'code', 'title', 'description', 'owner']],
  'link-systemic': [1, ['actor', 'issue']],
  'report-systemic': [1, ['actor', 'to', 'on', 'root-cause']],
  'close-systemic': [1, ['actor', 'on']],
  'open-period': [0, ['actor', 'code', 'starts', 'ends']],
  lodge: [1, ['actor', 'on', 'receipt']],
  'idr-report': [1, ['file']],
  import: [2, ['actor', 'brand', 'map', 'dry-run']],
  export: [0, ['file']],
  'weekly-review': [0, []],
  'draft-response': [1, []],
  'draft-delay': [1, []],
  'board-report': [1, []],
};
export const COMMANDS = Object.keys(SPECS);

export function help() {
  return `Complaints desk. node scripts/complaints.mjs <command> [arguments] [--key=value] [--json]
${COMMANDS.join(', ')}
Exact syntax: docs/cli.md. Nothing here sends a letter, an email or a report to ASIC.`;
}

// ---------- small helpers ----------

const BOOL_FLAGS = new Set(['dry-run', 'scheme-informed', 'satisfied', 'wants-letter']);
function flag(o, k) {
  if (o[k] === undefined) return false;
  if (o[k] !== true) throw Error(`--${k} takes no value`);
  return true;
}
function required(o, k) {
  const v = o[k];
  if (typeof v !== 'string' || !v.trim()) throw Error(`Required --${k}=value`);
  return v.trim();
}
function optional(o, k) {
  const v = o[k];
  if (v === undefined) return null;
  if (typeof v !== 'string' || !v.trim()) throw Error(`--${k} needs a value`);
  return v.trim();
}
export function today() { return new Date().toISOString().slice(0, 10); }
export function isoDate(s, label = 'date') {
  const v = String(s ?? '');
  const au = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  const iso = au ? `${au[3]}-${au[2].padStart(2, '0')}-${au[1].padStart(2, '0')}` : v;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso) || new Date(iso + 'T00:00:00Z').toISOString().slice(0, 10) !== iso) throw Error(`Invalid ${label}: ${s} (use YYYY-MM-DD)`);
  return iso;
}
export function cents(value) {
  const s = String(value ?? '').replace(/^\$/, '').replaceAll(',', '');
  if (!/^\d{1,9}(\.\d{1,2})?$/.test(s)) throw Error('Amount must be a dollar figure like 1850 or 1850.00');
  const [a, b = ''] = s.split('.');
  return Number(a) * 100 + Number(b.padEnd(2, '0'));
}
function actor(o) { return optional(o, 'actor') || 'operator'; }
const same = (a, b) => String(a ?? '').trim().toLowerCase() === String(b ?? '').trim().toLowerCase();

async function audit(db, id, action, who, detail = {}) {
  await db.query('insert into activity (entity_id, action, actor, detail) values ($1, $2, $3, $4)', [String(id), action, who, JSON.stringify(detail)]);
}
async function one(db, sql, params) { return (await db.query(sql, params))[0]; }

// Find one record by code, id prefix or name. Ambiguous or missing: list and stop.
async function pick(db, kind, ref) {
  if (!ref) throw Error(`Missing ${kind} reference`);
  const q = {
    complaint: 'select c.id, c.ref as key, p.name from complaints c join complainants p on p.id = c.complainant_id order by c.ref',
    brand: 'select id, code as key, name from brands order by code',
    complainant: 'select id, code as key, name from complainants order by code',
    systemic: 'select id, code as key, title as name from systemic_issues order by code',
    period: 'select code as id, code as key, starts_on::text as name from reporting_periods order by code',
  }[kind];
  const rows = await db.query(q);
  const r = String(ref).toLowerCase();
  let hits = rows.filter((x) => same(x.key, ref) || same(x.id, ref) || same(x.name, ref));
  if (!hits.length) hits = rows.filter((x) => String(x.id).toLowerCase().startsWith(r) || String(x.key).toLowerCase().endsWith(r) || String(x.key).toLowerCase().startsWith(r) || String(x.name).toLowerCase().includes(r));
  if (hits.length !== 1) {
    throw Error(`${hits.length ? 'Ambiguous' : 'No matching'} ${kind}: ${ref}\n${(hits.length ? hits : rows).map((x) => `  ${x.key}  ${x.name}`).join('\n')}`);
  }
  return hits[0];
}
async function complaintRow(db, ref) {
  const hit = await pick(db, 'complaint', ref);
  return one(db, 'select * from complaints where id = $1', [hit.id]);
}
async function update(db, tableName, id, values) {
  const keys = Object.keys(values);
  return one(db, `update ${tableName} set ${keys.map((k, i) => `${k} = $${i + 2}`).join(', ')} where id = $1 returning *`, [id, ...Object.values(values)]);
}
async function insert(db, tableName, values) {
  const keys = Object.keys(values);
  return one(db, `insert into ${tableName} (${keys.join(', ')}) values (${keys.map((_, i) => '$' + (i + 1)).join(', ')}) returning *`, Object.values(values));
}
async function nextCode(db, tableName, column, prefix, width) {
  const rows = await db.query(`select ${column} as code from ${tableName} where ${column} like $1`, [prefix + '%']);
  const max = rows.map((x) => Number(String(x.code).slice(prefix.length))).filter(Number.isFinite).reduce((a, b) => Math.max(a, b), 0);
  return prefix + String(max + 1).padStart(width, '0');
}
function notClosed(c) { if (c.status === 'closed') throw Error(`${c.ref} is closed. Its record cannot change through the CLI.`); }
function notBefore(on, c) { if (on < String(c.received_on)) throw Error(`Date ${on} is before ${c.ref} was received (${c.received_on})`); }

function writeFile(file, content) {
  const f = path.resolve(file);
  fs.mkdirSync(path.dirname(f), { recursive: true, mode: 0o700 });
  fs.writeFileSync(f, content, { flag: 'wx', mode: 0o600 });
  return f;
}
function outDir() { return process.env.OUTPUT_DIR || REPO_ROOT; }
function draft(name, body) {
  return { file: writeFile(path.join(outDir(), 'drafts', `${name}-${today()}-${randomUUID().slice(0, 8)}.md`), body) };
}

// ---------- output ----------

function show(v, key) {
  if (v == null) return '';
  if (key.endsWith('_cents')) return (Number(v) / 100).toFixed(2);
  if (typeof v === 'object') return v instanceof Date ? v.toISOString().slice(0, 10) : JSON.stringify(v);
  return v;
}
function render(rows) {
  if (!rows.length) return '(none)';
  return table(rows, Object.keys(rows[0]).map((key) => ({ key, label: key.replace(/_cents$/, '').replaceAll('_', ' '), format: (v) => show(v, key) })));
}
export function human(result) {
  if (Array.isArray(result) && result[0]?.question) return result.map((x) => `${x.question}\n${render(x.rows)}`).join('\n\n');
  if (Array.isArray(result)) return render(result);
  if (result && result.complaint) {
    const c = result.complaint;
    const head = Object.entries(c).filter(([, v]) => v != null && v !== false).map(([k, v]) => `  ${k.replaceAll('_', ' ').padEnd(26)} ${show(v, k)}`).join('\n');
    return `${c.ref}\n${head}\n\nDeadlines\n${render([result.deadlines])}\n\nContacts\n${render(result.contacts)}\n\nHistory\n${render(result.history)}`;
  }
  return JSON.stringify(result, null, 2);
}

// ---------- import: the ASIC IDR data file, as CSV ----------

// The headings follow the IDR data elements in plain words. Use --map=file.json to point them at your own headings.
export const IDR_COLUMNS = ['Unique identifier', 'Brand', 'Complainant name', 'Complainant type', 'Postcode', 'Date received', 'Received via',
  'Complaint type', 'Product or service', 'Issues', 'About a representative', 'Representative', 'Status', 'Date resolved', 'Date closed',
  'Outcomes', 'Monetary remedy', 'Days to close', 'Summary', 'Owner'];
const IMPORT_REQUIRED = ['Unique identifier', 'Complainant name', 'Date received', 'Product or service', 'Status'];
const CHANNELS = ['phone', 'email', 'letter', 'in person', 'website', 'social media', 'other'];

async function importIdr(db, args, o) {
  const [kind, file] = args;
  if (kind !== 'idr') throw Error('Supported import: idr (the ASIC IDR data file saved as CSV)');
  const dry = flag(o, 'dry-run');
  const who = actor(o);
  const map = o.map ? JSON.parse(fs.readFileSync(path.resolve(String(o.map)), 'utf8')) : {};
  for (const k of Object.keys(map)) if (!IDR_COLUMNS.includes(k)) throw Error(`--map names an unknown field: ${k}`);
  const rows = parseCsv(fs.readFileSync(path.resolve(file), 'utf8'));
  if (!rows.length) throw Error('The file has no rows');
  const heading = (k) => map[k] || k;
  const known = new Set(IDR_COLUMNS.map(heading));
  for (const h of Object.keys(rows[0])) if (!known.has(h)) throw Error(`Unknown column "${h}". Map it with --map or remove it.`);
  for (const k of IMPORT_REQUIRED) if (!(heading(k) in rows[0])) throw Error(`Missing column "${heading(k)}"`);
  const get = (r, k) => String(r[heading(k)] ?? '').trim();
  const seen = new Set();
  const defaultBrand = o.brand ? await pick(db, 'brand', String(o.brand)) : null;
  const brands = await db.query('select id, code, name from brands');
  const result = { file: path.resolve(file), rows: rows.length, inserted: 0, skipped: 0, dry_run: dry };

  await db.exec('BEGIN');
  try {
    for (const [i, r] of rows.entries()) {
      const line = `row ${i + 2}`;
      const ref = get(r, 'Unique identifier');
      if (!ref) throw Error(`${line}: no unique identifier`);
      if (seen.has(ref.toLowerCase())) throw Error(`${line}: duplicate Unique identifier ${ref}`);
      seen.add(ref.toLowerCase());
      for (const k of IMPORT_REQUIRED) if (!get(r, k)) throw Error(`${line}: ${k} is empty`);
      const hash = createHash('sha256').update(JSON.stringify(IDR_COLUMNS.map((k) => get(r, k)))).digest('hex');
      const existing = await one(db, 'select id, source_hash from complaints where lower(ref) = lower($1)', [ref]);
      if (existing) {
        if (existing.source_hash === hash) { result.skipped++; continue; }
        throw Error(`${line}: Changed import row for ${ref}. It is already in the register with different values; correct it with the commands, not a re-import.`);
      }
      const brandName = get(r, 'Brand');
      const brand = brandName ? brands.find((b) => same(b.code, brandName) || same(b.name, brandName)) : defaultBrand;
      if (!brand) throw Error(`${line}: brand "${brandName}" is not set up. Add it with add-brand or pass --brand.`);
      const received = isoDate(get(r, 'Date received'), `${line} Date received`);
      const status = get(r, 'Status').toLowerCase();
      if (!['open', 'closed', 'resolved'].includes(status)) throw Error(`${line}: Status must be Open, Resolved or Closed`);
      const closed = get(r, 'Date closed') ? isoDate(get(r, 'Date closed'), `${line} Date closed`) : null;
      const resolved = get(r, 'Date resolved') ? isoDate(get(r, 'Date resolved'), `${line} Date resolved`) : closed;
      if (status !== 'open' && !resolved) throw Error(`${line}: a ${status} complaint needs Date resolved or Date closed`);
      if (status === 'closed' && !closed) throw Error(`${line}: a closed complaint needs Date closed`);
      const channel = (get(r, 'Received via') || 'other').toLowerCase();
      if (!CHANNELS.includes(channel)) throw Error(`${line}: Received via must be one of ${CHANNELS.join(', ')}`);
      const rep = get(r, 'Representative') || null;
      const aboutRep = ['yes', 'y', 'true', '1'].includes(get(r, 'About a representative').toLowerCase()) || !!rep;
      if (aboutRep && !rep) throw Error(`${line}: About a representative is Yes but Representative is empty`);
      const remedy = get(r, 'Monetary remedy') ? cents(get(r, 'Monetary remedy')) : null;

      const name = get(r, 'Complainant name');
      const postcode = get(r, 'Postcode') || null;
      let person = await one(db, 'select id from complainants where lower(name) = lower($1) and coalesce(postcode, \'\') = coalesce($2, \'\')', [name, postcode]);
      if (!person) {
        const type = (get(r, 'Complainant type') || 'individual').toLowerCase();
        person = await insert(db, 'complainants', { code: await nextCode(db, 'complainants', 'code', 'IMP-', 4), name, complainant_type: type, postcode });
      }
      const c = await insert(db, 'complaints', {
        ref, brand_id: brand.id, complainant_id: person.id, received_on: received, channel,
        complaint_type: (get(r, 'Complaint type') || 'standard').toLowerCase(), product: get(r, 'Product or service'),
        about_representative: aboutRep, representative: rep, summary: get(r, 'Summary') || '(imported, no summary)',
        owner: get(r, 'Owner') || 'unassigned', status, resolved_on: resolved, closed_on: status === 'closed' ? closed : null,
        source: 'import', source_hash: hash,
      });
      const issues = get(r, 'Issues').split(';').map((s) => s.trim()).filter(Boolean);
      const outcomes = get(r, 'Outcomes').split(';').map((s) => s.trim()).filter(Boolean);
      if (issues.length > 3 || outcomes.length > 3) throw Error(`${line}: at most three issues and three outcomes`);
      for (const issue of issues) await insert(db, 'complaint_issues', { complaint_id: c.id, issue });
      for (const [j, outcome] of outcomes.entries()) await insert(db, 'complaint_outcomes', { complaint_id: c.id, outcome, remedy_cents: j === 0 ? remedy : null });
      if (remedy != null && !outcomes.length) await insert(db, 'complaint_outcomes', { complaint_id: c.id, outcome: 'Monetary remedy', remedy_cents: remedy });
      await audit(db, c.id, 'import', who, { ref, file: path.basename(file) });
      result.inserted++;
    }
    await db.exec(dry ? 'ROLLBACK' : 'COMMIT');
  } catch (e) {
    await db.exec('ROLLBACK');
    throw e;
  }
  return result;
}

function csvCell(v) {
  const s = v == null ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

// ---------- the commands ----------

export async function run(db, cmd, args = [], o = {}) {
  const spec = SPECS[cmd];
  if (!spec) throw Error(`Unknown command: ${cmd}\n${help()}`);
  if (args.length !== spec[0]) throw Error(`${cmd} takes ${spec[0]} argument(s), got ${args.length}`);
  for (const k of Object.keys(o)) {
    if (!spec[1].includes(k)) throw Error(`Unknown flag --${k} for ${cmd}`);
    if (!BOOL_FLAGS.has(k) && o[k] === true) throw Error(`--${k} needs a value`);
    if (BOOL_FLAGS.has(k) && o[k] !== true) throw Error(`--${k} takes no value`);
  }
  if (READS[cmd]) return db.query(READS[cmd]);
  const who = () => actor(o);

  switch (cmd) {
    case 'complaints': {
      const where = [];
      const params = [];
      for (const [k, col] of [['status', 'status'], ['brand', 'brand'], ['owner', 'owner']]) {
        if (o[k]) { params.push(String(o[k]).toLowerCase()); where.push(`lower(${col}) = $${params.length}`); }
      }
      return db.query(`select ref, brand, complainant, received_on, complaint_type, product, owner, status, issues, outcomes, remedy_cents
        from complaint_register ${where.length ? 'where ' + where.join(' and ') : ''} order by received_on desc, ref`, params);
    }
    case 'due': {
      const days = Number(o.days ?? 14);
      if (!Number.isInteger(days) || days < 0 || days > 365) throw Error('--days must be a whole number from 0 to 365');
      return db.query(`select ref, brand, complainant, owner, complaint_type, respond_by, days_left, delay_notice_on, rule
        from open_complaints where days_left <= $1 order by respond_by, ref`, [days]);
    }
    case 'insights': {
      const out = [];
      for (const [question, sql] of QUESTIONS) out.push({ question, rows: await db.query(sql) });
      return out;
    }
    case 'complaint': {
      const c = await complaintRow(db, args[0]);
      return {
        complaint: await one(db, 'select * from complaint_register where id = $1', [c.id]),
        deadlines: await one(db, 'select acknowledge_by, five_day_close_by, checkpoint_on, respond_by, rule from complaint_deadlines where id = $1', [c.id]),
        contacts: await db.query('select on_date, direction, method, note, by_whom from contacts where complaint_id = $1 order by on_date, created_at', [c.id]),
        history: await db.query('select action, actor, detail, created_at from activity where entity_id = $1 order by created_at, id', [c.id]),
      };
    }
    case 'idr-check': {
      const p = await pick(db, 'period', args[0]);
      return db.query(`select ref, brand, status,
          concat_ws(', ', case when product is null then 'no product' end, case when issues is null then 'no issue' end,
            case when status = 'closed' and outcomes is null then 'no outcome' end, case when postcode is null then 'no postcode' end,
            case when outcomes ilike '%monetary%' and coalesce(remedy_cents, 0) = 0 then 'monetary outcome with no amount' end) as gaps
        from idr_period_rows where period = $1 and (issues is null or postcode is null or (status = 'closed' and outcomes is null)
          or (outcomes ilike '%monetary%' and coalesce(remedy_cents, 0) = 0)) order by ref`, [p.id]);
    }

    case 'add-brand': {
      const jurisdiction = required(o, 'jurisdiction').toUpperCase();
      const scheme = required(o, 'scheme').toUpperCase();
      const s = await one(db, 'select jurisdiction from edr_schemes where code = $1', [scheme]);
      if (!s) throw Error(`Unknown scheme ${scheme}. Schemes: ${(await db.query('select code from edr_schemes order by code')).map((x) => x.code).join(', ')}`);
      if (s.jurisdiction !== jurisdiction) throw Error(`${scheme} is a ${s.jurisdiction} scheme, not ${jurisdiction}`);
      const b = await insert(db, 'brands', { code: required(o, 'code').toUpperCase(), name: required(o, 'name'), jurisdiction, licence: required(o, 'licence'),
        scheme_code: scheme, scheme_member_no: optional(o, 'member'), complaints_contact: required(o, 'contact') });
      await audit(db, b.id, 'add-brand', who(), { code: b.code });
      return b;
    }
    case 'add-complainant': {
      const code = optional(o, 'code') || await nextCode(db, 'complainants', 'code', 'P-', 2);
      const p = await insert(db, 'complainants', { code, name: required(o, 'name'), complainant_type: optional(o, 'type') || 'individual',
        email: optional(o, 'email'), phone: optional(o, 'phone'), postcode: optional(o, 'postcode'), vulnerability: optional(o, 'vulnerability') });
      await audit(db, p.id, 'add-complainant', who(), { code });
      return p;
    }
    case 'add-holiday': {
      const h = await insert(db, 'holidays', { day: isoDate(required(o, 'day')), name: required(o, 'name') });
      await audit(db, h.day, 'add-holiday', who(), h);
      return h;
    }
    case 'log': {
      const brand = await pick(db, 'brand', required(o, 'brand'));
      const person = await pick(db, 'complainant', required(o, 'complainant'));
      const received = isoDate(o.received ?? today(), 'received date');
      if (received > today()) throw Error('A complaint cannot be received in the future');
      const type = (optional(o, 'type') || 'standard').toLowerCase();
      const b = await one(db, 'select jurisdiction from brands where id = $1', [brand.id]);
      const tf = await one(db, 'select 1 from idr_timeframes where jurisdiction = $1 and complaint_type = $2', [b.jurisdiction, type]);
      if (!tf) throw Error(`No ${b.jurisdiction} timeframe for complaint type "${type}". Types: ${(await db.query('select complaint_type from idr_timeframes where jurisdiction = $1', [b.jurisdiction])).map((x) => x.complaint_type).join(', ')}`);
      const channel = (optional(o, 'channel') || 'phone').toLowerCase();
      if (!CHANNELS.includes(channel)) throw Error(`--channel must be one of ${CHANNELS.join(', ')}`);
      const rep = optional(o, 'representative');
      const issues = (optional(o, 'issues') || '').split(';').map((s) => s.trim()).filter(Boolean);
      if (issues.length > 3) throw Error('At most three issues');
      const ref = optional(o, 'ref') || await nextCode(db, 'complaints', 'ref', 'C-', 4);
      await db.exec('BEGIN');
      try {
        const c = await insert(db, 'complaints', { ref, brand_id: brand.id, complainant_id: person.id, received_on: received, channel, complaint_type: type,
          product: required(o, 'product'), about_representative: !!rep, representative: rep, summary: required(o, 'summary'), owner: required(o, 'owner') });
        for (const issue of issues) await insert(db, 'complaint_issues', { complaint_id: c.id, issue });
        await audit(db, c.id, 'log', who(), { ref, received, type });
        await db.exec('COMMIT');
        return one(db, 'select ref, brand, complainant, received_on, acknowledge_by, respond_by, rule from complaint_deadlines where id = $1', [c.id]);
      } catch (e) { await db.exec('ROLLBACK'); throw e; }
    }
    case 'acknowledge': {
      const c = await complaintRow(db, args[0]);
      notClosed(c);
      if (c.acknowledged_on) throw Error(`${c.ref} was already acknowledged on ${c.acknowledged_on}`);
      const on = isoDate(o.on ?? today());
      notBefore(on, c);
      const by = required(o, 'by');
      await update(db, 'complaints', c.id, { acknowledged_on: on, acknowledged_by: by });
      await audit(db, c.id, 'acknowledge', who(), { on, by });
      return one(db, 'select ref, acknowledged_on, acknowledge_by from complaint_deadlines where id = $1', [c.id]);
    }
    case 'contact': {
      const c = await complaintRow(db, args[0]);
      const on = isoDate(o.on ?? today());
      notBefore(on, c);
      const row = await insert(db, 'contacts', { complaint_id: c.id, on_date: on, direction: required(o, 'direction'), method: required(o, 'method'),
        note: required(o, 'note'), by_whom: required(o, 'by') });
      await audit(db, c.id, 'contact', who(), { on, direction: row.direction, method: row.method });
      return row;
    }
    case 'issue': {
      const c = await complaintRow(db, args[0]);
      notClosed(c);
      const n = await one(db, 'select count(*)::int as n from complaint_issues where complaint_id = $1', [c.id]);
      if (n.n >= 3) throw Error('A complaint carries at most three issues. Log a separate complaint for another product.');
      const row = await insert(db, 'complaint_issues', { complaint_id: c.id, issue: required(o, 'add') });
      await audit(db, c.id, 'issue', who(), { issue: row.issue });
      return row;
    }
    case 'delay-notice': {
      const c = await complaintRow(db, args[0]);
      if (c.status !== 'open') throw Error(`${c.ref} is ${c.status}: a delay notice is for an open complaint`);
      if (c.delay_notice_on) throw Error(`${c.ref} already has a delay notice from ${c.delay_notice_on}`);
      const on = isoDate(o.on ?? today());
      notBefore(on, c);
      const informed = flag(o, 'scheme-informed');
      const reason = required(o, 'reason');
      await update(db, 'complaints', c.id, { delay_notice_on: on, delay_reason: reason, scheme_informed: c.scheme_informed || informed });
      await audit(db, c.id, 'delay-notice', who(), { on, reason, scheme_informed: informed });
      const d = await one(db, 'select ref, delay_notice_on, respond_by, checkpoint_on from complaint_deadlines where id = $1', [c.id]);
      return { ...d, late: on > String(d.respond_by), scheme_informed: c.scheme_informed || informed };
    }
    case 'resolve': {
      const c = await complaintRow(db, args[0]);
      if (c.status !== 'open') throw Error(`${c.ref} is already ${c.status}`);
      const on = isoDate(o.on ?? today());
      notBefore(on, c);
      if (on > today()) throw Error('Resolution date cannot be in the future');
      const outcome = required(o, 'outcome');
      const remedy = o.remedy !== undefined ? cents(o.remedy) : null;
      if (/monetary/i.test(outcome) && remedy == null) throw Error('A monetary outcome needs --remedy=<dollars>. ASIC asks for the amount, not "unknown".');
      await db.exec('BEGIN');
      try {
        await update(db, 'complaints', c.id, { status: 'resolved', resolved_on: on, satisfaction_confirmed: flag(o, 'satisfied'),
          written_response_requested: c.written_response_requested || flag(o, 'wants-letter') });
        await insert(db, 'complaint_outcomes', { complaint_id: c.id, outcome, remedy_cents: remedy });
        await audit(db, c.id, 'resolve', who(), { on, outcome, remedy_cents: remedy, satisfied: flag(o, 'satisfied') });
        await db.exec('COMMIT');
      } catch (e) { await db.exec('ROLLBACK'); throw e; }
      const d = await one(db, `select c.ref, c.resolved_on, d.five_day_close_by, c.complaint_type, c.written_response_requested, c.satisfaction_confirmed, b.jurisdiction
        from complaints c join brands b on b.id = c.brand_id join complaint_deadlines d on d.id = c.id where c.id = $1`, [c.id]);
      const tf = await one(db, 'select always_written from idr_timeframes where jurisdiction = $1 and complaint_type = $2', [d.jurisdiction, d.complaint_type]);
      const exception = d.jurisdiction === 'AU' && d.satisfaction_confirmed && !d.written_response_requested
        && !tf?.always_written && String(d.resolved_on) <= String(d.five_day_close_by);
      return { ...d, next: exception ? 'Five business day exception applies: close it, or send a written response anyway.' : 'Send the written IDR response (draft-response), record it with respond, then close.' };
    }
    case 'respond': {
      const c = await complaintRow(db, args[0]);
      if (c.status !== 'resolved') throw Error(`${c.ref} is ${c.status}. Resolve it first, then record the response.`);
      if (c.response_on) throw Error(`${c.ref} already has a response from ${c.response_on}`);
      const on = isoDate(o.on ?? today());
      if (on < String(c.resolved_on)) throw Error('The response cannot predate the resolution');
      const informed = flag(o, 'scheme-informed');
      await update(db, 'complaints', c.id, { response_on: on, scheme_informed: informed });
      await audit(db, c.id, 'respond', who(), { on, scheme_informed: informed });
      const d = await one(db, 'select ref, response_on, respond_by from complaint_deadlines where id = $1', [c.id]);
      return { ...d, on_time: on <= String(d.respond_by), scheme_informed: informed };
    }
    case 'close': {
      const c = await complaintRow(db, args[0]);
      if (c.status !== 'resolved') throw Error(`${c.ref} is ${c.status}. Only a resolved complaint closes.`);
      const on = isoDate(o.on ?? today());
      if (on < String(c.resolved_on)) throw Error('Close date cannot predate the resolution');
      if (!c.response_on) {
        const d = await one(db, `select d.five_day_close_by, b.jurisdiction, coalesce(t.always_written, false) as always_written from complaint_deadlines d
          join complaints c on c.id = d.id join brands b on b.id = c.brand_id
          left join idr_timeframes t on t.jurisdiction = b.jurisdiction and t.complaint_type = c.complaint_type where d.id = $1`, [c.id]);
        const why = d.jurisdiction !== 'AU' ? 'New Zealand complaints close with a final written response'
          : c.written_response_requested ? 'the complainant asked for a written response'
          : d.always_written ? `${c.complaint_type} complaints always get a written response (RG 271.75)`
          : !c.satisfaction_confirmed ? 'satisfaction was not confirmed'
          : String(c.resolved_on) > String(d.five_day_close_by) ? `it was resolved after ${d.five_day_close_by}, outside five business days` : null;
        if (why) throw Error(`${c.ref} needs a written response before it closes: ${why}. Draft one with draft-response, then record it with respond.`);
      }
      await update(db, 'complaints', c.id, { status: 'closed', closed_on: on });
      await audit(db, c.id, 'close', who(), { on });
      return one(db, 'select ref, status, received_on, resolved_on, response_on, closed_on from complaints where id = $1', [c.id]);
    }
    case 'escalate': {
      const c = await complaintRow(db, args[0]);
      if (c.escalated_on) throw Error(`${c.ref} was already escalated on ${c.escalated_on}`);
      const on = isoDate(o.on ?? today());
      notBefore(on, c);
      const ref = required(o, 'scheme-ref');
      await update(db, 'complaints', c.id, { escalated_on: on, scheme_ref: ref });
      await audit(db, c.id, 'escalate', who(), { on, scheme_ref: ref });
      return one(db, 'select ref, scheme, escalated_on, scheme_ref, status from complaint_register where id = $1', [c.id]);
    }
    case 'raise-systemic': {
      const code = optional(o, 'code') || await nextCode(db, 'systemic_issues', 'code', 'SI-', 2);
      const s = await insert(db, 'systemic_issues', { code, title: required(o, 'title'), description: required(o, 'description'), owner: required(o, 'owner') });
      await audit(db, s.id, 'raise-systemic', who(), { code });
      return s;
    }
    case 'link-systemic': {
      const c = await complaintRow(db, args[0]);
      const s = await pick(db, 'systemic', required(o, 'issue'));
      await update(db, 'complaints', c.id, { systemic_issue_id: s.id });
      await audit(db, c.id, 'link-systemic', who(), { systemic: s.key });
      return one(db, 'select code, title, complaints, open_complaints from systemic_register where code = $1', [s.key]);
    }
    case 'report-systemic': {
      const s = await pick(db, 'systemic', args[0]);
      const row = await one(db, 'select * from systemic_issues where id = $1', [s.id]);
      if (row.status !== 'open') throw Error(`${s.key} is already ${row.status}`);
      const on = isoDate(o.on ?? today());
      const out = await update(db, 'systemic_issues', s.id, { status: 'reported', reported_to: required(o, 'to'), reported_on: on, root_cause: optional(o, 'root-cause') ?? row.root_cause });
      await audit(db, s.id, 'report-systemic', who(), { to: out.reported_to, on });
      return out;
    }
    case 'close-systemic': {
      const s = await pick(db, 'systemic', args[0]);
      const row = await one(db, 'select * from systemic_issues where id = $1', [s.id]);
      if (row.status !== 'reported') throw Error(`${s.key} is ${row.status}. Report it to the board or owner first.`);
      const on = isoDate(o.on ?? today());
      const out = await update(db, 'systemic_issues', s.id, { status: 'closed', closed_on: on });
      await audit(db, s.id, 'close-systemic', who(), { on });
      return out;
    }
    case 'open-period': {
      const starts = isoDate(required(o, 'starts'));
      const ends = isoDate(required(o, 'ends'));
      const due = new Date(ends + 'T00:00:00Z');
      due.setUTCDate(due.getUTCDate() + 1);
      due.setUTCMonth(due.getUTCMonth() + 2);
      due.setUTCDate(due.getUTCDate() - 1);
      const p = await insert(db, 'reporting_periods', { code: required(o, 'code'), starts_on: starts, ends_on: ends, due_on: due.toISOString().slice(0, 10) });
      await audit(db, p.code, 'open-period', who(), p);
      return p;
    }
    case 'lodge': {
      const p = await pick(db, 'period', args[0]);
      const row = await one(db, 'select * from reporting_periods where code = $1', [p.id]);
      if (row.submitted_on) throw Error(`${row.code} was lodged on ${row.submitted_on}`);
      const on = isoDate(o.on ?? today());
      if (on <= String(row.ends_on)) throw Error(`${row.code} ends ${row.ends_on}. Lodge after the period closes.`);
      const out = await one(db, 'update reporting_periods set submitted_on = $2, submission_ref = $3, submitted_by = $4 where code = $1 returning *',
        [row.code, on, required(o, 'receipt'), who()]);
      await audit(db, row.code, 'lodge', who(), { on, receipt: out.submission_ref });
      return out;
    }
    case 'idr-report': {
      const p = await pick(db, 'period', args[0]);
      const rows = await db.query('select * from idr_period_rows where period = $1 order by received_on, ref', [p.id]);
      const lines = [IDR_COLUMNS.map(csvCell).join(',')];
      for (const r of rows) {
        lines.push([r.ref, r.brand, r.complainant, r.complainant_type, r.postcode, r.received_on, r.channel, r.complaint_type, r.product, r.issues,
          r.about_representative ? 'Yes' : 'No', r.representative, r.status === 'open' ? 'Open' : r.status === 'resolved' ? 'Resolved' : 'Closed',
          r.resolved_on, r.closed_on, r.outcomes, r.remedy_cents == null ? '' : (Number(r.remedy_cents) / 100).toFixed(2), r.days_to_close, r.summary, r.owner]
          .map(csvCell).join(','));
      }
      const file = o.file ? String(o.file) : path.join(outDir(), 'exports', `idr-${p.id}-${today()}.csv`);
      const gaps = await run(db, 'idr-check', [p.id]);
      return { file: writeFile(file, lines.join('\n') + '\n'), period: p.id, complaints: rows.length, nil_submission: rows.length === 0, gaps: gaps.length };
    }
    case 'import':
      return importIdr(db, args, o);
    case 'export': {
      const archive = {};
      for (const t of TABLES) archive[t] = await db.query(`select * from ${t}`);
      const file = o.file ? String(o.file) : path.join(outDir(), 'exports', `complaints-${today()}-${randomUUID().slice(0, 8)}.json`);
      return { file: writeFile(file, JSON.stringify(archive, null, 2)), tables: TABLES.length, complaints: archive.complaints.length };
    }

    case 'weekly-review': {
      const attention = await run(db, 'attention');
      const due = await run(db, 'due', [], { days: '7' });
      const compliance = await run(db, 'compliance');
      const breaches = compliance.filter((r) => r.severity === 'breach');
      const body = `# Complaints review, week of ${today()}

Drafted from three commands: attention, due --days=7 and compliance. Read it, correct it, then share it. Nothing sends.

## What needs a person (${attention.length})

${render(attention)}

## Responses due in the next 7 days (${due.length})

${render(due)}

## Rule checks: ${breaches.length} breach(es), ${compliance.length - breaches.length} warning(s)

${render(compliance)}

## For the meeting

- Owners with overdue responses: ${[...new Set(attention.filter((a) => a.item.startsWith('response overdue')).map((a) => a.owner))].join(', ') || 'none'}.
- Delay or extension notices to send before the deadline passes: ${attention.filter((a) => /extension|due in 7/.test(a.item)).map((a) => a.ref).join(', ') || 'none'}.
- Systemic issues waiting on the board: ${attention.filter((a) => a.item.startsWith('systemic')).map((a) => a.ref).join(', ') || 'none'}.
`;
      return draft('weekly-review', body);
    }
    case 'draft-response': {
      const c = await complaintRow(db, args[0]);
      const r = await one(db, 'select * from complaint_register where id = $1', [c.id]);
      const b = await one(db, 'select b.*, s.name as scheme_name, s.phone, s.email as scheme_email, s.website, s.postal, s.refer_within from brands b join edr_schemes s on s.code = b.scheme_code where b.id = $1', [c.brand_id]);
      const outcomes = await db.query('select outcome, remedy_cents from complaint_outcomes where complaint_id = $1 order by outcome', [c.id]);
      const contacts = await db.query('select on_date, direction, method, note from contacts where complaint_id = $1 order by on_date', [c.id]);
      const money = (x) => `${r.currency} ${(Number(x) / 100).toFixed(2)}`;
      const body = `# DRAFT ${b.jurisdiction === 'AU' ? 'IDR response' : 'final response'}: ${r.ref}

Draft for ${r.owner} to check and send. Nothing sends from here. Replace every [bracket] with the facts from the file.

---

${b.name}
${b.licence}

${today()}

Dear ${r.complainant},

**Your complaint, reference ${r.ref}, received ${r.received_on}**

Thank you for raising your concerns with us. You told us: ${r.summary}

**What we looked at**

${contacts.length ? contacts.map((x) => `- ${x.on_date}: ${x.direction === 'in' ? 'from you' : 'from us'} by ${x.method}. ${x.note}`).join('\n') : '- [the records reviewed]'}

**Our decision**

[Explain the decision and the reasons for it, issue by issue: ${r.issues || 'the issues raised'}.]

${outcomes.length ? outcomes.map((x) => `- ${x.outcome}${x.remedy_cents != null ? `: ${money(x.remedy_cents)}` : ''}`).join('\n') : '- [the outcome]'}

**If you are not satisfied**

${b.jurisdiction === 'AU'
    ? `You can take your complaint to the ${b.scheme_name} (AFCA), a free and independent dispute resolution service.

- Website: ${b.website}
- Email: ${b.scheme_email}
- Phone: ${b.phone} (free call)
- Mail: ${b.postal}

Time limits may apply to complain to AFCA, so you should act promptly or check the AFCA website to find out if or when the time limit relevant to your circumstances expires.`
    : `You can take your complaint to ${b.scheme_name} (FSCL), a free and independent dispute resolution scheme. Our member number is ${b.scheme_member_no || '[member number]'}.

- Website: ${b.website}
- Email: ${b.scheme_email}
- Phone: ${b.phone}

${b.refer_within}`}

Yours sincerely,

[Name]
${b.name}
${b.complaints_contact}

---

When it has gone, record it: \`node scripts/complaints.mjs respond ${r.ref} --on=<date> --scheme-informed\`
`;
      return draft(`response-${r.ref}`, body);
    }
    case 'draft-delay': {
      const c = await complaintRow(db, args[0]);
      const r = await one(db, 'select r.*, d.respond_by, d.checkpoint_on from complaint_register r join complaint_deadlines d on d.id = r.id where r.id = $1', [c.id]);
      const b = await one(db, 'select b.*, s.name as scheme_name, s.phone, s.email as scheme_email, s.website, s.postal from brands b join edr_schemes s on s.code = b.scheme_code where b.id = $1', [c.brand_id]);
      const body = `# DRAFT ${b.jurisdiction === 'AU' ? 'IDR delay notification' : 'notice of extension'}: ${r.ref}

Must reach the complainant before ${b.jurisdiction === 'AU' ? r.respond_by : r.checkpoint_on}. Nothing sends from here.

---

Dear ${r.complainant},

**Your complaint, reference ${r.ref}, received ${r.received_on}**

We have not been able to finish looking into your complaint within the time we aim for, and we want to tell you why.

The reason for the delay: [specific reason, for example waiting on a third party's records].

${b.jurisdiction === 'AU'
    ? `You have the right to complain to the ${b.scheme_name} (AFCA) now if you are not satisfied. AFCA is free and independent: ${b.website}, ${b.scheme_email}, ${b.phone}, ${b.postal}.`
    : `We expect to respond by [date]. If you would rather not wait, you can take your complaint to ${b.scheme_name} (FSCL): ${b.website}, ${b.scheme_email}, ${b.phone}.`}

Yours sincerely,

[Name]
${b.name}

---

When it has gone, record it: \`node scripts/complaints.mjs delay-notice ${r.ref} --on=<date> --reason="..." --scheme-informed\`
`;
      return draft(`delay-${r.ref}`, body);
    }
    case 'board-report': {
      const p = await pick(db, 'period', args[0]);
      const period = await one(db, 'select * from reporting_periods where code = $1', [p.id]);
      const byBrand = await db.query(`select brand, count(*)::int as complaints, count(*) filter (where received_on >= $2)::int as received_in_period,
          count(*) filter (where closed_on between $2 and $3)::int as closed_in_period, count(*) filter (where status = 'open')::int as still_open,
          count(*) filter (where escalated_on is not null)::int as to_scheme from idr_period_rows where period = $1 group by brand order by brand`, [p.id, period.starts_on, period.ends_on]);
      const issues = await db.query(`select i.issue, count(*)::int as complaints from idr_period_rows r join complaint_issues i on i.complaint_id = r.id
          where r.period = $1 group by i.issue order by complaints desc, issue limit 5`, [p.id]);
      const systemic = await run(db, 'systemic');
      const breaches = (await run(db, 'compliance')).filter((x) => x.severity === 'breach');
      const body = `# DRAFT complaints report to the board: ${period.code} (${period.starts_on} to ${period.ends_on})

Drafted from the register. Check the numbers against idr-report before it goes to the board. RG 271 expects complaints data and systemic issues to reach senior management and the board regularly.

## Complaints by brand

${render(byBrand)}

## The five most common issues

${render(issues)}

## Systemic issues

${render(systemic)}

## Open rule breaches today (${breaches.length})

${render(breaches)}

## ASIC IDR report

Due ${period.due_on}. ${period.submitted_on ? `Lodged ${period.submitted_on}, receipt ${period.submission_ref}.` : 'Not lodged yet.'}
`;
      return draft(`board-report-${period.code}`, body);
    }
  }
  throw Error(`Unhandled command ${cmd}`);
}
