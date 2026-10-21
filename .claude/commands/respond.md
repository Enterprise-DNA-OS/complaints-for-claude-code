---
description: "Record the written IDR response (AU) or final response (NZ) that has been sent."
---

# respond

Record the written IDR response (AU) or final response (NZ) that has been sent.

Read fresh data. Never invent a complaint, a date, a remedy or command output. Complaints hold personal information: keep output inside the business.

```bash
node scripts/complaints.mjs respond <ref> --on=<YYYY-MM-DD> --scheme-informed --json
```

Replace angle-bracket placeholders with what the person told you; leave out optional flags they did not ask for. If a name or reference is ambiguous, list the candidates and ask. Draft it with /draft-response first. Add --scheme-informed only if the letter names the scheme and its contact details. Nothing here sends a letter, an email or a report.
