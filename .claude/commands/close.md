---
description: "Close a resolved complaint."
---

# close

Close a resolved complaint.

Read fresh data. Never invent a complaint, a date, a remedy or command output. Complaints hold personal information: keep output inside the business.

```bash
node scripts/complaints.mjs close <ref> --on=<YYYY-MM-DD> --json
```

Replace angle-bracket placeholders with what the person told you; leave out optional flags they did not ask for. If a name or reference is ambiguous, list the candidates and ask. It refuses when a written response is still owed, and says why. Do not work around that. Nothing here sends a letter, an email or a report.
