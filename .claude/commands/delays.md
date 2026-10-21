---
description: "Open complaints that need a delay notice (AU) or a written reason to extend (NZ) before the clock runs out."
---

# delays

Open complaints that need a delay notice (AU) or a written reason to extend (NZ) before the clock runs out.

Read fresh data. Never invent a complaint, a date, a remedy or command output. Complaints hold personal information: keep output inside the business.

```bash
node scripts/complaints.mjs delays --json
```

Replace angle-bracket placeholders with what the person told you; leave out optional flags they did not ask for. If a name or reference is ambiguous, list the candidates and ask. For each, offer /draft-delay. A notice only counts if it reaches the complainant before the deadline. Nothing here sends a letter, an email or a report.
