---
description: "Every open complaint with its deadline and days left."
---

# open

Every open complaint with its deadline and days left.

Read fresh data. Never invent a complaint, a date, a remedy or command output. Complaints hold personal information: keep output inside the business.

```bash
node scripts/complaints.mjs open --json
```

Replace angle-bracket placeholders with what the person told you; leave out optional flags they did not ask for. If a name or reference is ambiguous, list the candidates and ask. Sort by days left. Point out any complaint inside 5 days with no delay notice. Nothing here sends a letter, an email or a report.
