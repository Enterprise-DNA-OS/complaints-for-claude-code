---
description: "Record a new complainant, including any vulnerability they tell you about."
---

# add-complainant

Record a new complainant, including any vulnerability they tell you about.

Read fresh data. Never invent a complaint, a date, a remedy or command output. Complaints hold personal information: keep output inside the business.

```bash
node scripts/complaints.mjs add-complainant --name="<name>" --type=<individual|small business|other organisation|representative> --email=<email> --phone=<phone> --postcode=<postcode> --vulnerability="<what they told you>" --json
```

Replace angle-bracket placeholders with what the person told you; leave out optional flags they did not ask for. If a name or reference is ambiguous, list the candidates and ask. Record only what the person told you. Never guess at a vulnerability. Nothing here sends a letter, an email or a report.
