---
description: "Add an issue to a complaint (three at most)."
---

# issue

Add an issue to a complaint (three at most).

Read fresh data. Never invent a complaint, a date, a remedy or command output. Complaints hold personal information: keep output inside the business.

```bash
node scripts/complaints.mjs issue <ref> --add="<issue>" --json
```

Replace angle-bracket placeholders with what the person told you; leave out optional flags they did not ask for. If a name or reference is ambiguous, list the candidates and ask. A fourth issue about another product is a separate complaint. Nothing here sends a letter, an email or a report.
