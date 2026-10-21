# Complaints for Claude Code: operating instructions

This file is the brain. Claude Code reads it at the start of every session. It says who this is for, how work gets done, and the one right way to do each recurring job.

## Who this is for

- **Business:** [YOUR FIRM AND BRANDS]
- **Operator:** [YOUR NAME], [complaints officer, compliance manager or principal]
- **What matters most:** every complaint answered inside its timeframe, in writing with the scheme's details, and a clean ASIC report every six months.

Fill this in once. A worker with context knows. A worker without it guesses.

## How to work

1. **Take a brief, not a script.** The operator describes the outcome. You run the right command and present the answer.
2. **Read before you write.** Before drafting anything about a complaint, run `/complaint <ref>` and read its contacts and history.
3. **Plain language.** Short sentences. Numbers and dates in tables. Say the deadline and how many days are left.
4. **Silent success, loud problems.** Lead with anything past its deadline with no delay notice.
5. **Stop at the line.** Anything that sends, deletes, lodges or faces a complainant waits for a yes in this session.

## Routing table: one right way for each recurring job

| When the operator asks for... | Use this |
|---|---|
| Complaints not yet acknowledged, with the business day they were due. | `/acknowledge-due` |
| Record that a complaint was acknowledged. | `/acknowledge` |
| The last 50 changes and who made them. | `/activity` |
| Set up a brand with its licence and dispute scheme. | `/add-brand` |
| Record a new complainant, including any vulnerability they tell you about. | `/add-complainant` |
| Record a public holiday so business day deadlines skip it. | `/add-holiday` |
| What needs a person today across every brand, worst first. | `/attention` |
| Draft the complaints report for the board for a period. | `/board-report` |
| Brands, licences and the scheme each belongs to. | `/brands` |
| Close a systemic issue once the fix is in place. | `/close-systemic` |
| Close a resolved complaint. | `/close` |
| Everyone who has complained, with their complaint count. | `/complainants` |
| One complaint in full: details, deadlines, contacts and history. | `/complaint` |
| The register, filtered by status, brand or owner. | `/complaints` |
| Check the records against RG 271, ASIC IDR reporting and the FSCL terms, with the rule cited. | `/compliance` |
| Log a call, email or letter on a complaint. | `/contact` |
| Make this system yours in plain language. Add a field, rename stages, change a rule, add a column to a document. Writes the migration, applies it, updates the commands that touch it. | `/customise` |
| Record a delay notice (AU) or written reason to extend (NZ) that has been sent. | `/delay-notice` |
| Open complaints that need a delay notice (AU) or a written reason to extend (NZ) before the clock runs out. | `/delays` |
| Render the branded paperwork: complaint files for AFCA or FSCL, board packs and systemic issue reports. | `/documents` |
| Draft a delay notice (AU) or notice of extension (NZ). | `/draft-delay` |
| Draft the written IDR response (AU) or final response (NZ) with the AFCA or FSCL details. | `/draft-response` |
| Responses due in the next N days (default 14). | `/due` |
| Record that a complaint went to AFCA or FSCL. | `/escalate` |
| Archive every record to one JSON file. | `/export` |
| Gaps that would weaken the ASIC IDR report for a period. | `/idr-check` |
| Write the period's IDR working file: every complaint received or open in the period, one row each. | `/idr-report` |
| Bring complaints across from your current system's IDR data file saved as CSV. | `/import` |
| Ten questions answered across the whole register. | `/insights` |
| Add an issue to a complaint (three at most). | `/issue` |
| Link a complaint to a systemic issue. | `/link-systemic` |
| Record that the IDR report was lodged with ASIC. | `/lodge` |
| Log a new complaint the day it arrives. | `/log` |
| Add a read-only HTML view (a dashboard page) from a plain-language description, rendered in the operator's brand by `npm run view`. | `/new-view` |
| Open an ASIC reporting period (1 Jan to 30 Jun, 1 Jul to 31 Dec). | `/open-period` |
| Every open complaint with its deadline and days left. | `/open` |
| ASIC IDR reporting periods: due dates, lodgements and complaint counts. | `/periods` |
| Raise a systemic issue when complaints point at the same cause. | `/raise-systemic` |
| Complaints and remedies paid, by product. | `/remedies` |
| Record that a systemic issue went to the board or the owner your policy names. | `/report-systemic` |
| Complaints about authorised or credit representatives. | `/representatives` |
| Record the outcome of a complaint, with any remedy paid. | `/resolve` |
| Record the written IDR response (AU) or final response (NZ) that has been sent. | `/respond` |
| The systemic issues register: what is open, what the board has seen. | `/systemic` |
| The response timeframes in force, with the rule behind each. | `/timeframes` |
| Render the read-only dashboards: this week, every open clock, and the board view. | `/view` |
| Complaints from people who told you about a vulnerability. | `/vulnerable` |
| Draft the Monday complaints review from attention, due and compliance. | `/weekly-review` |

If an ask fits nothing here, run the CLI directly (`node scripts/complaints.mjs --help`) and then propose a new command for it.

## Hard rules

- Never send a letter, email or message, and never lodge with ASIC, AFCA or FSCL from here. Draft to `drafts/`; a person sends and then records it.
- Record what happened, never what should have happened. Do not record an acknowledgement, notice or response until the operator confirms it went, and add `--scheme-informed` only if the letter named the scheme and its contact details.
- Never decide a complaint, judge whether it should be upheld, or suggest a remedy amount. People decide; the register records.
- Never work around a refusal from `close`. It refuses because a written response is still owed.
- Complaints hold personal information and vulnerabilities. Keep output inside the business. Never paste complainant details into anything outside this folder.
- Never delete records. Never edit an applied migration. Use `/customise` for new fields and rules, with a test.
- Never invent a complaint, a date, a remedy or a rule. If a name is ambiguous, list the candidates and ask.
- Read `docs/compliance.md` before explaining a finding. It is a records check, not legal advice.

## Where things live

- `scripts/complaints.mjs` the one CLI; `scripts/lib/complaints.mjs` every read, write, rule and the import. `docs/cli.md` has the syntax.
- `scripts/lib/db.mjs` picks `DATABASE_URL` (Postgres, Supabase) or the embedded database in `.data/`.
- `supabase/migrations/` the register, the timeframe rules and the views, plain SQL. `npm run migrate` applies it.
- `views.json` and `documents.json` the dashboards (`npm run view`) and paperwork (`npm run docs`); `brand.json` the business name and colours on both.
- `.claude/commands/` the slash commands. Add one every time the same ask comes twice.
- `docs/` the rules with sources, the CLI reference and the guide for moving off Aptean Respond.

Run `npm test` after any change. It must print PASS.

Built by Enterprise DNA. Installed and run for you as part of Omni: https://enterprisedna.co/omni/instead-of/aptean-respond
