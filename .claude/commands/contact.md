---
description: "Log a call, email or letter on a complaint."
---

# contact

Log a call, email or letter on a complaint.

Read fresh data. Never invent a complaint, a date, a remedy or command output. Complaints hold personal information: keep output inside the business.

```bash
node scripts/complaints.mjs contact <ref> --direction=<in|out> --method=<phone|email|letter|in person|sms|other> --note="<what was said>" --by=<name> --json
```

Replace angle-bracket placeholders with what the person told you; leave out optional flags they did not ask for. If a name or reference is ambiguous, list the candidates and ask. Keep the note factual. This log is what AFCA or FSCL reads if the complaint is escalated. Nothing here sends a letter, an email or a report.
