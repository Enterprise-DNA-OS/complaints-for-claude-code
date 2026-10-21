---
description: "Record the outcome of a complaint, with any remedy paid."
---

# resolve

Record the outcome of a complaint, with any remedy paid.

Read fresh data. Never invent a complaint, a date, a remedy or command output. Complaints hold personal information: keep output inside the business.

```bash
node scripts/complaints.mjs resolve <ref> --outcome="<outcome>" --remedy=<dollars> --satisfied --wants-letter --json
```

Replace angle-bracket placeholders with what the person told you; leave out optional flags they did not ask for. If a name or reference is ambiguous, list the candidates and ask. A monetary outcome needs the dollar amount. Add --satisfied only when the complainant confirmed it. The reply says whether the five business day exception applies. Nothing here sends a letter, an email or a report.
