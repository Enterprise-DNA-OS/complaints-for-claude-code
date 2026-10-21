---
description: "Record that a complaint was acknowledged."
---

# acknowledge

Record that a complaint was acknowledged.

Read fresh data. Never invent a complaint, a date, a remedy or command output. Complaints hold personal information: keep output inside the business.

```bash
node scripts/complaints.mjs acknowledge <ref> --on=<YYYY-MM-DD> --by=<name> --json
```

Replace angle-bracket placeholders with what the person told you; leave out optional flags they did not ask for. If a name or reference is ambiguous, list the candidates and ask. Only after the person confirms the acknowledgement went out. Nothing here sends a letter, an email or a report.
