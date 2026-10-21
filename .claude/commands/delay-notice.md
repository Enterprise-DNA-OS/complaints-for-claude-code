---
description: "Record a delay notice (AU) or written reason to extend (NZ) that has been sent."
---

# delay-notice

Record a delay notice (AU) or written reason to extend (NZ) that has been sent.

Read fresh data. Never invent a complaint, a date, a remedy or command output. Complaints hold personal information: keep output inside the business.

```bash
node scripts/complaints.mjs delay-notice <ref> --on=<YYYY-MM-DD> --reason="<reason>" --scheme-informed --json
```

Replace angle-bracket placeholders with what the person told you; leave out optional flags they did not ask for. If a name or reference is ambiguous, list the candidates and ask. Add --scheme-informed only if the notice named AFCA or FSCL and how to reach it. Nothing here sends a letter, an email or a report.
