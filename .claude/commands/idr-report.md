---
description: "Write the period's IDR working file: every complaint received or open in the period, one row each."
---

# idr-report

Write the period's IDR working file: every complaint received or open in the period, one row each.

Read fresh data. Never invent a complaint, a date, a remedy or command output. Complaints hold personal information: keep output inside the business.

```bash
node scripts/complaints.mjs idr-report <period> --json
```

Replace angle-bracket placeholders with what the person told you; leave out optional flags they did not ask for. If a name or reference is ambiguous, list the candidates and ask. Map products, issues and outcomes to ASIC's codes in its Excel template before lodging. Nothing is lodged from here. Nothing here sends a letter, an email or a report.
