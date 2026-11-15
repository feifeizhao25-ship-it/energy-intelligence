# growth kit (2026-11-01)

Stdlib-only helpers for traffic growth. **Nothing is wired into the running app and every flag defaults to OFF.**

| module | what it does |
|---|---|
| `flags.py` | `GROWTH_LOOP_ENABLED`, `REFERRAL_ENABLED`, `SHARECARD_ENABLED`, `SEO_PAGES_ENABLED` (all default off; only the owner changes them on the server) |
| `claims.py` | forbidden-claim scan (medical, prediction, investment, absolute, fake-review) in English and Chinese; language checks |
| `attribution.py` | UTM/referrer to channel (`organic_search`, `ai_search`, `social`, `paid`, `email`, `referral`, `direct`); drops PII-like values; never stores click ids |
| `referral.py` | HMAC referral codes; anti-abuse evaluation (self-referral, duplicate pair, velocity, shared device/payment, caps, hold period); fixed rewards |
| `sharecard.py` | Open Graph + text share cards with language and disclaimer checks |
| `seo_quality.py` | programmatic-page gate (thin, near-duplicate, question mismatch, stale/no sources, forbidden claims, AI note) + Article JSON-LD |
| `loop.py` | tactic admission (freshness, licence, one variable), 15% control, Wilson decision, rollback rule, weekly cap of 3 proposals; **proposes only** |

Wiring (when the owner decides): import the functions from the endpoint or job that needs them and guard with `GrowthFlags.from_env()`.
Run the tests: `python -m pytest tests/test_growth_kit.py --noconftest`.
