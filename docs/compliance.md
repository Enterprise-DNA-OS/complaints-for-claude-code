# The rules this register checks

`/compliance` (and `node scripts/complaints.mjs compliance`) checks the records against the rules below. Each finding names its rule. The timeframes themselves are rows in the `idr_timeframes` table, so a change in the guidance is one migration through `/customise`, not a code change.

This is a records check. It is not legal advice, and it does not decide whether a complaint was handled fairly. Your complaints policy and your compliance adviser decide that. Confirm every rule against the source before you rely on it, and again whenever ASIC or your scheme updates its guidance.

## Australia: ASIC Regulatory Guide 271, Internal dispute resolution

Applies to complaints received on or after 5 October 2021 by AFS licensees, credit licensees and the other firms RG 271 names. Source: https://asic.gov.au/regulatory-resources/find-a-document/regulatory-guides/rg-271-internal-dispute-resolution/

| Check | What the guide says | What the register flags |
|---|---|---|
| `ACKNOWLEDGE` | RG 271.51: acknowledge a complaint within 24 hours (or one business day) of receiving it, or as soon as practicable. ASIC sets this as an expectation, not an enforceable requirement. | No acknowledgement by the next business day (weekends and recorded holidays skipped). Warning. |
| `IDR-TIMEFRAME` | RG 271.56 to 271.59 and Table 2 maximum timeframes for the IDR response: 30 calendar days for a standard complaint; 45 for superannuation trustee and traditional trustee complaints; 21 for complaints about a default notice, a hardship notice or a request to postpone enforcement. The maximum timeframes are enforceable through s912A of the Corporations Act and s47 of the National Consumer Credit Protection Act. | An open complaint past its respond-by date with no delay notice, or a response sent late without one. Breach. |
| `IDR-DELAY-NOTICE` | RG 271.65 and 271.66: where a firm has no reasonable opportunity to respond in time (complexity, or circumstances beyond its control), it must give an IDR delay notification before the timeframe expires, with the reasons, the right to complain to AFCA and AFCA's contact details. | A delay notice dated after the deadline. Breach. |
| `FIVE-DAY-EXCEPTION` | RG 271.71 to 271.75: no IDR response is needed when the complaint is closed by the end of the fifth business day after receipt, resolved to the complainant's satisfaction (or with an explanation or apology where nothing more can be done). A written response is still required if the complainant asks for one, if the complaint is about hardship, a declined insurance claim or the value of an insurance claim, or for a superannuation trustee decision. Those types carry `always_written` in the timeframes table. | A manually logged complaint closed with no written response where any condition fails. The CLI also refuses to close it. Breach. |
| `SCHEME-INFORMED` | RG 271.53 and 271.66: the IDR response, and any delay notification, tells the complainant they can take the complaint to AFCA, with AFCA's contact details. | A response or delay notice recorded without `--scheme-informed`. Breach. |
| `SYSTEMIC` | Firms identify, escalate and report systemic issues from complaints to senior management and the board. RG 271 does not set a number of days. | A systemic issue open for more than 30 days with no report recorded. The 30 days is this register's default; set your own in your policy and with `/customise`. Warning. |

Not covered by the shipped timeframes: superannuation death benefit distribution complaints (90 days after the objection period ends) and any industry code timeframe stricter than RG 271. Add them as rows with `/customise`; `log` refuses a complaint type with no timeframe rather than guessing.

## Australia: ASIC IDR data reporting

Source: https://www.asic.gov.au/regulatory-resources/financial-services/dispute-resolution/internal-dispute-resolution-data-reporting

- AFS licensees with retail clients and credit licensees report complaints to ASIC every six months: 1 January to 30 June and 1 July to 31 December, in the window after the period ends. A licensee with no complaints lodges a nil submission.
- The report covers complaints received in the period and complaints still open during it, and uses the same unique identifier each time a complaint is reported again.
- Each complaint carries one product or service, up to three issues and up to three outcomes, and the dollar amount of any monetary remedy. ASIC has called out overuse of "unknown" remedy amounts.

| Check | What the register flags |
|---|---|
| `IDR-DATA` | A closed complaint with no issue, no outcome, no postcode, or a monetary outcome with no amount. `resolve` refuses a monetary outcome without `--remedy`. Warning. |
| `IDR-REPORT` | A period that has ended with no lodgement recorded: a warning inside the window, a breach after the due date. |

`idr-report` writes a working file with every data element in plain words. ASIC's IDR data reporting handbook sets the codes for the lodged file: map products, issues and outcomes to its codes (or have the mapping built in) before lodging through the ASIC Regulatory Portal.

## New Zealand: Financial Services Complaints Limited (FSCL)

Source: FSCL Terms of Reference, https://fscl.org.nz/wp-content/uploads/2021/09/FSCL-Terms-of-Reference-1-January-2019.pdf, and https://fscl.org.nz/complaints/how-make-complaint

- A complaint is deadlocked, and the complainant can go to FSCL, if 20 working days pass without the provider telling them in writing that it has good reason to extend the time and what that reason is; after 40 working days in any case; or when the provider says deadlock has been reached.
- When deadlock is reached the provider tells the complainant they can refer the complaint to FSCL, with FSCL's contact details, and that they have two months to do so.
- FSCL's current guidance and flowchart (July 2024) also describe extensions of up to two months. Check which version binds your membership.

| Check | What the register flags |
|---|---|
| `NZ-EXTENSION` | An open complaint past 20 working days with no written reason to extend (recorded with `delay-notice`). Breach. |
| `IDR-TIMEFRAME` | An open complaint past 40 working days with no notice. Breach. |
| `SCHEME-INFORMED` | A final response or extension notice recorded without the FSCL details. Breach. |

Members of the Insurance and Financial Services Ombudsman, the Banking Ombudsman Scheme or Financial Dispute Resolution Service: add the scheme to `edr_schemes` and its timeframe to `idr_timeframes` with `/customise`.

## What the register does not do

- Decide whether a complaint is upheld, or what remedy is fair. People do, and the register records it.
- Send anything. Responses, delay notices and board reports are drafts in `drafts/`.
- Lodge with ASIC. It writes the working file and records the receipt once a person has lodged.
- Imported history is not judged against the response and five day rules, because the letters behind it were never seen. It is checked for ASIC data gaps.
