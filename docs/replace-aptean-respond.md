# Moving off Aptean Respond (or any complaints system)

Every Australian AFS or credit licensee with retail clients already produces one file that holds its complaints: the IDR data report it lodges with ASIC every six months. That file is the bridge. Whatever you use today, Aptean Respond, a GRC suite set up as a complaints register, a CRM or a spreadsheet, it can produce it.

## 1. Export

- From Aptean Respond, export the complaints for the IDR reporting period (or a case report covering the fields below) to Excel or CSV. If you are not sure which report gives you the IDR data elements, ask Aptean or whoever configured your system.
- Export open complaints as well as closed ones. Open ones arrive with their clock running.
- New Zealand firms: export the complaints register with received, resolved and closed dates.
- Save as CSV (UTF-8).

## 2. Set up your brands

```bash
node scripts/complaints.mjs add-brand --code=ABC --name="Your Brand" --jurisdiction=AU --licence="ACL 123456" --scheme=AFCA --member=12345 --contact=complaints@yourbrand.example
```

Add the public holidays for the year with `add-holiday` so business day deadlines are right.

## 3. Map the headings

The importer reads these headings: Unique identifier, Brand, Complainant name, Complainant type, Postcode, Date received, Received via, Complaint type, Product or service, Issues, About a representative, Representative, Status, Date resolved, Date closed, Outcomes, Monetary remedy, Days to close, Summary, Owner. If yours differ, write a map file:

```json
{ "Unique identifier": "Case Reference", "Date received": "Logged Date", "Summary": "Complaint Description" }
```

Unknown columns are refused, so nothing is silently dropped. Delete columns you do not want to bring across, or ask Claude Code to add a field for them with `/customise`.

## 4. Dry run, then import

```bash
node scripts/complaints.mjs import idr respond-export.csv --brand=ABC --map=map.json --dry-run
node scripts/complaints.mjs import idr respond-export.csv --brand=ABC --map=map.json
```

The import is all or nothing: one bad row rolls back the file and names the row. Running it again skips rows already in. A row that changed since it was imported is refused, because a changed history should be corrected with the commands, not overwritten.

## 5. Check

```bash
node scripts/complaints.mjs periods
node scripts/complaints.mjs idr-check 2026-H2
node scripts/complaints.mjs open
```

Compare the count per period with your last lodged ASIC report. Open complaints show their respond-by date from the received date in the file.

## What carries over

- Complaint references (your ASIC unique identifiers stay the same), brands, complainants and postcodes, dates, channel, type, product, up to three issues and outcomes, remedy amounts, representatives, status, summary and owner.

## What does not

- Attachments, scanned letters and emails. Keep the export from your old system as the archive, or have them linked by file path with `/customise`.
- Letters already sent. Imported complaints are not checked against the response and five day rules, because those letters were never seen here.
- Workflow, queues and user permissions from the old system.
- Social listening and channel capture. Complaints arrive in your inbox, on the phone or through a form and are logged here.

Enterprise DNA does this migration for you, maps your report headings and ASIC codes, and runs both systems side by side until the counts match: https://enterprisedna.co/omni/instead-of/aptean-respond
