---
description: "Open an ASIC reporting period (1 Jan to 30 Jun, 1 Jul to 31 Dec)."
---

# open-period

Open an ASIC reporting period (1 Jan to 30 Jun, 1 Jul to 31 Dec).

Read fresh data. Never invent a complaint, a date, a remedy or command output. Complaints hold personal information: keep output inside the business.

```bash
node scripts/complaints.mjs open-period --code=<YYYY-H1|YYYY-H2> --starts=<YYYY-MM-DD> --ends=<YYYY-MM-DD> --json
```

Replace angle-bracket placeholders with what the person told you; leave out optional flags they did not ask for. If a name or reference is ambiguous, list the candidates and ask. The due date is set two months after the period ends. Nothing here sends a letter, an email or a report.
