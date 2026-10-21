---
description: "Bring complaints across from your current system's IDR data file saved as CSV."
---

# import

Bring complaints across from your current system's IDR data file saved as CSV.

Read fresh data. Never invent a complaint, a date, a remedy or command output. Complaints hold personal information: keep output inside the business.

```bash
node scripts/complaints.mjs import idr <file.csv> --brand=<default brand> --map=<headings.json> --dry-run --json
```

Replace angle-bracket placeholders with what the person told you; leave out optional flags they did not ask for. If a name or reference is ambiguous, list the candidates and ask. Always run with --dry-run first and report the counts. Then run without it. Guide: docs/replace-aptean-respond.md. Nothing here sends a letter, an email or a report.
