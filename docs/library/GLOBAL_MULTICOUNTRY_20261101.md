# Global edition: multi-country library entries (2026-11-01)

All entries are English-only, cite an official primary publisher, and are staged as **Pending review**. None is visible to users until two named reviewers approve it (`POLICY_REVIEWERS`, still empty). Retrieval dates are 2026-11-01. Files: `app/library/data/staged_entries_global_20261101c.json` (s03) and `..._20261101d.json` (s04 to s11).

| Id | Country or region | Topic | Status field | Notes |
|---|---|---|---|---|
| en-intl-s03 | US | Wind and solar tax credits after the 4 July 2026 start-of-construction date; IRS Notice 2025-42 | Contested | Rewritten from the primary court opinion (see below) |
| en-intl-s04 | US | EIA: 86 GW of planned 2026 capacity | Planned | Developer plans, not installed capacity |
| en-intl-s05 | Great Britain | Smart Export Guarantee | In force | Ofgem |
| en-intl-s06 | EU | 2030 renewables target, at least 42.5% | In force | European Commission DG Energy |
| en-intl-s07 | Germany | 60% feed-in limit until a smart meter is fitted | In force | Consolidated EEG text. Commissioning dates are not stated |
| en-intl-s08 | Australia | Cheaper Home Batteries discount step-down | In force | DCCEEW |
| en-intl-s09 | Japan | 7th Strategic Energy Plan, about 40-50% renewables by 2040 | In force | Read via a METI-authored APEC summary; the METI original was not reachable |
| en-intl-s10 | India | PM Surya Ghar subsidy | In force | Figures are the 2024 scheme terms |
| en-intl-s11 | Netherlands | End of net metering on 1 January 2027 | Upcoming | Rijksoverheid |

## IRS Notice 2025-42 (en-intl-s03)

The entry rests on the court's own opinion, read in full from the CourtListener copy of ECF 50 in the D.D.C. case (not on press summaries). It is tier A, with a McGuireWoods summary as `second_source`. The status stays **Contested** because the docket could not be fetched from the box (CourtListener returned 403). Events after 6 June 2026 are not verified: appeal, stay or a revised notice. A human must check the live docket before the entry is approved.

## Gate and retrieval

* Promote gate: 11 of 11 entries keep.
* Held-out retrieval over the working library plus staged entries (18 queries): R@3 1.00, R@1 0.889, MRR 0.935, pinned by a ratchet test.
* Adding s04 made it outrank the existing "16% of new US solar is co-located with batteries" entry on the golden question `en-g-e01`. The golden run caught it. s04's title, summary and tags were narrowed to what the entry is about (the 86 GW total); the solar and battery figures stay in its points.

## Human items

* Name the reviewers (`POLICY_REVIEWERS`).
* Check the live D.D.C. docket for post-6-June events (s03).
* Read the METI original for s09 and the Japanese primary text (flagged `second_source_needed`).
* s07: confirm commissioning-date thresholds against the current EEG text before stating them.
* s10: re-check the PM Surya Ghar terms; the retrieved terms are from 2024.
* Countries not covered: France, Italy, Spain, Canada, Brazil, China (global edition), others. Add only with an official source read in full.
