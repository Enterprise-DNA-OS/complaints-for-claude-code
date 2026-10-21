---
description: "Draft the complaints report for the board for a period."
---

# board-report

Draft the complaints report for the board for a period.

Read fresh data. Never invent a complaint, a date, a remedy or command output. Complaints hold personal information: keep output inside the business.

```bash
node scripts/complaints.mjs board-report <period> --json
```

Replace angle-bracket placeholders with what the person told you; leave out optional flags they did not ask for. If a name or reference is ambiguous, list the candidates and ask. A draft in drafts/. Check the numbers against /idr-report before it goes to the board. Nothing here sends a letter, an email or a report.
