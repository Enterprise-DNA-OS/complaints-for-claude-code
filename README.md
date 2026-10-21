<h1 align="center">Complaints for Claude Code</h1>

<p align="center">
  <strong>The open-source complaints register that is just a database and Claude Code.</strong>
</p>

<p align="center">
  Created by <a href="https://www.enterprisedna.co"><strong>Enterprise DNA</strong></a>. Free and open source. Works with Claude Code, Codex, OpenCode or Cursor.
</p>

<!-- three-doors -->
<table align="center">
  <tr>
    <td align="center"><strong>Do it yourself</strong><br/>Clone it, run it, own it. Free, MIT.<br/><a href="#quick-start">Quick start</a></td>
    <td align="center"><strong>We customise it</strong><br/>Your fields, your rules, your Aptean Respond data brought across.<br/><a href="https://enterprisedna.co/omni/book/?utm_source=github&utm_medium=readme&utm_campaign=aptean-respond">Book a call</a></td>
    <td align="center"><strong>We run it for you</strong><br/>Installed, connected and operated inside Omni. Setup fee, then a retainer.<br/><a href="https://enterprisedna.co/omni/instead-of/aptean-respond?utm_source=github&utm_medium=readme&utm_campaign=aptean-respond">How it works</a></td>
  </tr>
</table>

<p align="center">
  <a href="#what-is-this">What is this</a> &bull;
  <a href="#why-no-front-end">Why no front end</a> &bull;
  <a href="#quick-start">Quick start</a> &bull;
  <a href="#the-commands">Commands</a> &bull;
  <a href="#instead-of-aptean-respond">Instead of Aptean Respond</a> &bull;
  <a href="#want-it-installed-and-run-for-you">Installed for you</a> &bull;
  <a href="#license">License</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Node-20+-339933?style=flat-square" alt="Node 20+" />
  <img src="https://img.shields.io/badge/PostgreSQL-any-336791?style=flat-square" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/PGlite-embedded-3ecf8e?style=flat-square" alt="PGlite" />
  <img src="https://img.shields.io/badge/License-MIT-yellow?style=flat-square" alt="MIT License" />
</p>

---

## What is this

Complaints for Claude Code is a complaints register and internal dispute resolution (IDR) desk for Australian and New Zealand financial firms, as a Postgres database and a set of agent commands. There is no web front end. Open the folder in [Claude Code](https://claude.com/claude-code) (or Codex, OpenCode, Cursor: see `AGENTS.md`) and ask: "what is overdue", "draft the response to C-1001", "are we ready for the ASIC report".

**The bill it replaces.** Aptean Respond publishes no price: its product page offers a demo and a pricing request, and it is sold to insurers, lenders and banks as an enterprise complaints platform configured by consultants. Smaller firms end up with a GRC suite set up as a register, or a spreadsheet nobody trusts at reporting time. [Research and sources](docs/research.md).

**What it covers.** Every complaint against a brand you hold a licence for: received, acknowledged, investigated, resolved, answered and closed, with the clock RG 271 sets (30, 45 or 21 calendar days) or the FSCL clock (20 and 40 working days) on every row. Delay notices, the five business day exception, AFCA and FSCL details in every letter, systemic issues to the board, and the six-monthly ASIC IDR report. Built for mortgage and finance brokers, insurance brokers, financial advisers, lenders and credit providers.

Want the same register with a web front end, a complaint form on your website, or built on a different stack? That is a customisation, and it is what Enterprise DNA does: [book a call](https://enterprisedna.co/omni/book/?offer=replace-software&utm_source=github&utm_medium=readme&utm_campaign=aptean-respond).

## Why no front end

- The front end was only there because the database was hard to talk to. That is no longer true.
- Your register sits in plain Postgres tables you own. Your ASIC history never lives in a system you rent.
- No seats, no modules. Every adviser and broker can log a complaint. Read [docs/why-no-front-end.md](docs/why-no-front-end.md) for what you give up too.

## Quick start

Sixty seconds, no database install (an embedded Postgres runs inside Node):

```bash
git clone https://github.com/Enterprise-DNA-OS/complaints-for-claude-code.git
cd complaints-for-claude-code
npm install
npm test
npm run demo
```

`npm run demo` loads two fictional Australian brokers and a New Zealand advice firm, with an overdue response, an unacknowledged complaint, a New Zealand complaint past 20 working days and a systemic issue the board has not seen. Then open the folder in Claude Code and type `/attention`.

`npm run view` renders three read-only dashboards (this week, every open clock, the board view). `npm run docs` renders a complaint file per complaint (the file AFCA or FSCL asks for), a board pack per ASIC period and a report per systemic issue, in your brand from `brand.json`.

### Use it with your own Postgres or Supabase

Copy `.env.example` to `.env`, set `DATABASE_URL`, then `npm run migrate`. Same commands, shared register, no per-seat fee. Never load the demo seed into your real register.

## Five things a complaints officer does every week

1. **Acknowledge** everything that came in, by the next business day (`/acknowledge-due`).
2. **Watch the clock** and send delay notices before the deadline, not after (`/due`, `/delays`, `/draft-delay`).
3. **Answer in writing** with the AFCA or FSCL details, unless the five day exception really applies (`/draft-response`, `/respond`, `/close`).
4. **Spot the pattern** and take it to the board (`/systemic`, `/board-report`).
5. **Report to ASIC** every six months with clean data (`/idr-check`, `/idr-report`, `/lodge`).

`/weekly-review` drafts the Monday note from `/attention`, `/due` and `/compliance`.

## The commands

48 slash commands over one CLI (`node scripts/complaints.mjs`, 45 commands, [reference](docs/cli.md)).

| Command | What it does |
|---|---|
| `/acknowledge-due` | Complaints not yet acknowledged, with the business day they were due. |
| `/acknowledge` | Record that a complaint was acknowledged. |
| `/activity` | The last 50 changes and who made them. |
| `/add-brand` | Set up a brand with its licence and dispute scheme. |
| `/add-complainant` | Record a new complainant, including any vulnerability they tell you about. |
| `/add-holiday` | Record a public holiday so business day deadlines skip it. |
| `/attention` | What needs a person today across every brand, worst first. |
| `/board-report` | Draft the complaints report for the board for a period. |
| `/brands` | Brands, licences and the scheme each belongs to. |
| `/close-systemic` | Close a systemic issue once the fix is in place. |
| `/close` | Close a resolved complaint. |
| `/complainants` | Everyone who has complained, with their complaint count. |
| `/complaint` | One complaint in full: details, deadlines, contacts and history. |
| `/complaints` | The register, filtered by status, brand or owner. |
| `/compliance` | Check the records against RG 271, ASIC IDR reporting and the FSCL terms, with the rule cited. |
| `/contact` | Log a call, email or letter on a complaint. |
| `/customise` | Make this system yours in plain language. Add a field, rename stages, change a rule, add a column to a document. Writes the migration, applies it, updates the commands that touch it. |
| `/delay-notice` | Record a delay notice (AU) or written reason to extend (NZ) that has been sent. |
| `/delays` | Open complaints that need a delay notice (AU) or a written reason to extend (NZ) before the clock runs out. |
| `/documents` | Render the branded paperwork: complaint files for AFCA or FSCL, board packs and systemic issue reports. |
| `/draft-delay` | Draft a delay notice (AU) or notice of extension (NZ). |
| `/draft-response` | Draft the written IDR response (AU) or final response (NZ) with the AFCA or FSCL details. |
| `/due` | Responses due in the next N days (default 14). |
| `/escalate` | Record that a complaint went to AFCA or FSCL. |
| `/export` | Archive every record to one JSON file. |
| `/idr-check` | Gaps that would weaken the ASIC IDR report for a period. |
| `/idr-report` | Write the period's IDR working file: every complaint received or open in the period, one row each. |
| `/import` | Bring complaints across from your current system's IDR data file saved as CSV. |
| `/insights` | Ten questions answered across the whole register. |
| `/issue` | Add an issue to a complaint (three at most). |
| `/link-systemic` | Link a complaint to a systemic issue. |
| `/lodge` | Record that the IDR report was lodged with ASIC. |
| `/log` | Log a new complaint the day it arrives. |
| `/new-view` | Add a read-only HTML view (a dashboard page) from a plain-language description, rendered in the operator's brand by `npm run view`. |
| `/open-period` | Open an ASIC reporting period (1 Jan to 30 Jun, 1 Jul to 31 Dec). |
| `/open` | Every open complaint with its deadline and days left. |
| `/periods` | ASIC IDR reporting periods: due dates, lodgements and complaint counts. |
| `/raise-systemic` | Raise a systemic issue when complaints point at the same cause. |
| `/remedies` | Complaints and remedies paid, by product. |
| `/report-systemic` | Record that a systemic issue went to the board or the owner your policy names. |
| `/representatives` | Complaints about authorised or credit representatives. |
| `/resolve` | Record the outcome of a complaint, with any remedy paid. |
| `/respond` | Record the written IDR response (AU) or final response (NZ) that has been sent. |
| `/systemic` | The systemic issues register: what is open, what the board has seen. |
| `/timeframes` | The response timeframes in force, with the rule behind each. |
| `/view` | Render the read-only dashboards: this week, every open clock, and the board view. |
| `/vulnerable` | Complaints from people who told you about a vulnerability. |
| `/weekly-review` | Draft the Monday complaints review from attention, due and compliance. |

## Ten questions your register answers today

`/insights` answers all ten from your own records. They are shipped queries, not a claim that another system cannot be configured to answer them.

1. Which products draw the most complaints, and how many are still open?
2. How many days does each brand take to close a complaint, on average and at worst?
3. Which owners carry the most open complaints, and how many are past due?
4. Which issues keep coming back across brands?
5. How much have we paid in remedies, by product?
6. Which complainants have complained more than once?
7. What share of complaints closed inside five business days?
8. Which complaints went to AFCA or FSCL, and what were they about?
9. Which representatives have complaints against them?
10. Do complainants who told us about a vulnerability wait longer?

## The rules, with sources

`/compliance` checks every record against ASIC RG 271 (acknowledgement, Table 2 timeframes, delay notifications, the five business day exception and what a response must contain), ASIC IDR data reporting, and the FSCL Terms of Reference in New Zealand. Every finding cites its rule. The timeframes are rows in a table, so a change in the guidance is a one-line migration. [docs/compliance.md](docs/compliance.md). It is a records check, not legal advice.

## Your first hour: ten things to ask for

1. "Put our business name and colours on the complaint files and board pack."
2. "Set up our brands, our licence numbers and our AFCA member number."
3. "Add this year's public holidays for New South Wales."
4. "Import our complaints from this Aptean Respond export. Dry run first."
5. "What is overdue, and who owns it?"
6. "Draft the delay notice for C-1003."
7. "Draft the response to C-1001 from the file."
8. "Which complaints point at the same cause? Raise a systemic issue for them."
9. "Are we ready for the ASIC report for this half?"
10. "Add a field for the lender on every complaint" (through `/customise`).

## Instead of Aptean Respond

The bridge is the IDR data file every Australian licensee already prepares for ASIC: export it (or the equivalent report) from Aptean Respond or whatever you use today, save it as CSV and run `import idr` with a dry run first. Headings can be mapped. The import is all or nothing and safe to repeat. [docs/replace-aptean-respond.md](docs/replace-aptean-respond.md) covers what carries over and what does not.

## Architecture

```
complaints-for-claude-code/
  CLAUDE.md                 how the operator wants this run (routing table + house rules)
  AGENTS.md                 the same, for Codex / OpenCode / Cursor / Gemini CLI
  .claude/commands/         one slash command per recurring job
  scripts/complaints.mjs    the one CLI
  scripts/lib/complaints.mjs every read, write, rule and import
  scripts/lib/db.mjs        one adapter: DATABASE_URL (pg) or embedded PGlite
  supabase/migrations/      the register, the rules and the views, plain SQL
  supabase/seed.sql         fictional demo firms and complaints
  views.json, documents.json the dashboards and paperwork
  docs/                     the rules, the CLI, the migration guide
```

`npm test` runs every CLI command against a temporary database: the clocks, business days and holidays, the five day exception, scheme details, systemic issues, ASIC periods, an all-or-nothing import, drafts, export and escaped HTML. The CI workflow runs it on Windows and Linux, Node 20 and 22, and Postgres 17 (manual trigger).

## Privacy

Complaints hold personal information, including vulnerabilities people tell you about. The free version assumes a trusted operator on a protected machine or a dedicated database with its own access controls. Actor labels in the activity log are labels, not signed identities. Keep `.data`, `exports`, `drafts`, `views` and `docs-out` out of git (the `.gitignore` does). Shared use needs real sign-in and permissions: that is part of what Enterprise DNA builds.

## Built for coding agents

The database, CLI and command recipes work with Claude Code, Codex, OpenCode or Cursor. Ask your coding agent for a new command and have it implement and test the change against the same records.

## Contributing

Issues and pull requests are welcome. Keep the shape: plain SQL, one small CLI, a slash command per recurring job, no front end, and a test for every rule.

## Want it installed and run for you?

Enterprise DNA installs Complaints for Claude Code for your firm, brings your Aptean Respond (or spreadsheet) history across, maps your ASIC codes, connects your inbox and website form, and runs it for you as part of **Omni**, our managed Command Center. One setup fee, then a monthly retainer.

- Book a call: [enterprisedna.co/omni/book](https://enterprisedna.co/omni/book/?offer=replace-software&utm_source=github&utm_medium=readme&utm_campaign=aptean-respond)
- Read more: [enterprisedna.co/omni/instead-of/aptean-respond](https://enterprisedna.co/omni/instead-of/aptean-respond?utm_source=github&utm_medium=readme&utm_campaign=aptean-respond)

## License

MIT. Copyright (c) 2026 Enterprise DNA. Aptean Respond is a trademark of its owner. This independent project is not affiliated with Aptean, ASIC, AFCA or FSCL.
