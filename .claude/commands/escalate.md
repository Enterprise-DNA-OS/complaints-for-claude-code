---
description: "Record that a complaint went to AFCA or FSCL."
---

# escalate

Record that a complaint went to AFCA or FSCL.

Read fresh data. Never invent a complaint, a date, a remedy or command output. Complaints hold personal information: keep output inside the business.

```bash
node scripts/complaints.mjs escalate <ref> --on=<YYYY-MM-DD> --scheme-ref=<their reference> --json
```

Replace angle-bracket placeholders with what the person told you; leave out optional flags they did not ask for. If a name or reference is ambiguous, list the candidates and ask. Then render the complaint file with /documents for the scheme. Nothing here sends a letter, an email or a report.
