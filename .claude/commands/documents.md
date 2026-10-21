---
description: "Render the branded paperwork: complaint files for AFCA or FSCL, board packs and systemic issue reports."
---

# documents

Render the paperwork from the records, in the business's brand (brand.json).

```bash
npm run docs                              # every document
npm run docs -- complaint-file            # one complaint file per complaint
npm run docs -- complaint-file <id-prefix>
npm run docs -- board-pack                # one per ASIC reporting period
npm run docs -- systemic-issue
```

Files land in docs-out/. They are internal records and hold personal information. Say which files were written. Nothing is sent.
