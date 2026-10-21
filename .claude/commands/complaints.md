---
description: "The register, filtered by status, brand or owner."
---

# complaints

The register, filtered by status, brand or owner.

Read fresh data. Never invent a complaint, a date, a remedy or command output. Complaints hold personal information: keep output inside the business.

```bash
node scripts/complaints.mjs complaints --status=<open|resolved|closed> --brand=<code> --owner=<name> --json
```

Replace angle-bracket placeholders with what the person told you; leave out optional flags they did not ask for. If a name or reference is ambiguous, list the candidates and ask. Leave out any filter the person did not ask for. Nothing here sends a letter, an email or a report.
