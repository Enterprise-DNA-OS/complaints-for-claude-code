---
description: "Log a new complaint the day it arrives."
---

# log

Log a new complaint the day it arrives.

Read fresh data. Never invent a complaint, a date, a remedy or command output. Complaints hold personal information: keep output inside the business.

```bash
node scripts/complaints.mjs log --brand=<code> --complainant=<code or name> --received=<YYYY-MM-DD> --channel=<phone|email|letter|in person|website|social media|other> --type=<standard|hardship|default notice|postponement|insurance claim declined|insurance claim value|superannuation|traditional trustee> --product="<product>" --issues="<issue>; <issue>" --summary="<what they said>" --owner=<name> --json
```

Replace angle-bracket placeholders with what the person told you; leave out optional flags they did not ask for. If a name or reference is ambiguous, list the candidates and ask. Add the complainant first with add-complainant if they are new. Report the acknowledge-by and respond-by dates back. Nothing here sends a letter, an email or a report.
