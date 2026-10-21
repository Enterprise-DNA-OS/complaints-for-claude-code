# CLI reference

`node scripts/complaints.mjs <command> [arguments] [--key=value] [--json]`

Human tables by default, `--json` for machines. References match exactly first (complaint ref, brand code, complainant code or name), then by prefix, suffix or part of a name. More than one match lists the candidates and exits 1. Unknown flags fail before anything is written. Dates are `YYYY-MM-DD` (imports also accept `DD/MM/YYYY`). `--on` defaults to today. `--actor=<name>` labels any write in the activity log.

## Reads

| Command | Returns |
|---|---|
| `attention` | Everything that needs a person, worst first |
| `open` | Open complaints with respond-by date and days left |
| `due [--days=14]` | Open complaints due within N days |
| `acknowledge-due` | Open complaints not yet acknowledged |
| `delays` | Complaints that need a delay notice (AU) or written reason to extend (NZ) soon |
| `complaint <ref>` | One complaint: details, deadlines, contacts, history |
| `complaints [--status] [--brand] [--owner]` | The register |
| `compliance` | Rule findings with the rule cited (docs/compliance.md) |
| `systemic` | Systemic issues and the complaints behind each |
| `periods` | ASIC reporting periods |
| `idr-check <period>` | Data gaps for one period |
| `timeframes` | The timeframe rules in force |
| `remedies` | Complaints and remedies by product |
| `representatives` | Complaints about representatives |
| `vulnerable` | Complaints from people who disclosed a vulnerability |
| `brands`, `complainants`, `activity` | Reference lists and the change log |
| `insights` | Ten questions across the register |

## Writes

| Command | Does | Refuses when |
|---|---|---|
| `add-brand --code --name --jurisdiction --licence --scheme [--member] --contact` | Sets up a brand | The scheme is unknown or belongs to the other country |
| `add-complainant --name [--code] [--type] [--email] [--phone] [--postcode] [--vulnerability]` | Records a complainant | |
| `add-holiday --day --name` | Adds a public holiday to business day counts | The day is already recorded |
| `log --brand --complainant --product --summary --owner [--received] [--channel] [--type] [--issues="a; b"] [--representative] [--ref]` | Logs a complaint and returns its deadlines | The type has no timeframe, the date is in the future, more than three issues |
| `acknowledge <ref> --by [--on]` | Records the acknowledgement | Already acknowledged, closed, dated before receipt |
| `contact <ref> --direction --method --note --by [--on]` | Logs a call, email or letter | Dated before receipt |
| `issue <ref> --add` | Adds an issue | Three already, or the complaint is closed |
| `delay-notice <ref> --reason [--on] [--scheme-informed]` | Records a delay notice or NZ extension notice | Not open, or a notice is already on file |
| `resolve <ref> --outcome [--remedy] [--satisfied] [--wants-letter]` | Records the outcome and says whether the five day exception applies | Not open, a monetary outcome without an amount, a future date |
| `respond <ref> [--on] [--scheme-informed]` | Records the written response | Not resolved, already responded |
| `close <ref> [--on]` | Closes a resolved complaint | A written response is still owed (says which rule) |
| `escalate <ref> --scheme-ref [--on]` | Records referral to AFCA or FSCL | Already escalated |
| `raise-systemic --title --description --owner [--code]` | Raises a systemic issue | |
| `link-systemic <ref> --issue` | Links a complaint to it | |
| `report-systemic <code> --to [--on] [--root-cause]` | Records the report to the board or owner | Not open |
| `close-systemic <code> [--on]` | Closes it | Not reported yet |
| `open-period --code --starts --ends` | Opens an ASIC period; due date is two months after it ends | |
| `lodge <period> --receipt [--on]` | Records the ASIC lodgement | Already lodged, or the period has not ended |
| `import idr <file.csv> [--brand] [--map=headings.json] [--dry-run]` | Imports the IDR data file | Any bad row: the whole file rolls back |

## Files

| Command | Writes |
|---|---|
| `idr-report <period> [--file]` | `exports/idr-<period>-<date>.csv`, one row per complaint received or open in the period |
| `export [--file]` | Every table to one JSON file; never overwrites |
| `draft-response <ref>` | `drafts/response-<ref>-...md`, the IDR or final response with the scheme's details |
| `draft-delay <ref>` | `drafts/delay-<ref>-...md` |
| `weekly-review` | `drafts/weekly-review-...md` from attention, due and compliance |
| `board-report <period>` | `drafts/board-report-<period>-...md` |

`npm run view` writes `views/week.html`, `views/deadlines.html` and `views/board.html`. `npm run docs` writes a complaint file per complaint, a board pack per period and a report per systemic issue to `docs-out/`.

## The import file

Headings, in plain words for the IDR data elements: Unique identifier, Brand, Complainant name, Complainant type, Postcode, Date received, Received via, Complaint type, Product or service, Issues, About a representative, Representative, Status, Date resolved, Date closed, Outcomes, Monetary remedy, Days to close, Summary, Owner. Required: Unique identifier, Complainant name, Date received, Product or service, Status. Issues and Outcomes take up to three values separated by `;`. A `--map` file renames headings: `{"Summary": "Complaint description"}`. `idr-report` writes the same headings, so a file it writes imports cleanly elsewhere.
