---
description: "Set up a brand with its licence and dispute scheme."
---

# add-brand

Set up a brand with its licence and dispute scheme.

Read fresh data. Never invent a complaint, a date, a remedy or command output. Complaints hold personal information: keep output inside the business.

```bash
node scripts/complaints.mjs add-brand --code=<CODE> --name="<name>" --jurisdiction=<AU|NZ> --licence="<licence>" --scheme=<AFCA|FSCL> --member=<member no> --contact=<complaints email> --json
```

Replace angle-bracket placeholders with what the person told you; leave out optional flags they did not ask for. If a name or reference is ambiguous, list the candidates and ask. For IFSO, Banking Ombudsman or FDRS, add the scheme with /customise first. Nothing here sends a letter, an email or a report.
