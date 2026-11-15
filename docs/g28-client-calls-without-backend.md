# G28: client calls with no FastAPI handler

Read-only inventory at `dea673ed` (`fixes/energy-p0-2026-10-15`).
A path is missing when it does not match a route in the FastAPI OpenAPI document from `runtime/backend` (102 paths).
Path parameters are written as `{}`. Query strings are ignored. Test files are not scanned.
Comments are not scanned. These are not calls and are omitted: `proxy.ts` prefix checks for `/api` and `/api/auth`, the OpenAPI server URL `/api/v1` in `runtime/web/src/app/api/v1/docs/route.ts`, and the `/api/backend` base whose fetch is `/api/backend/entitlements` (rewritten to FastAPI `GET /api/entitlements`).
`/api/v1/finance/${type}` is omitted because `POST /api/v1/finance/solar`, `/wind`, and `/storage` exist.

## No FastAPI route and no Next.js route file

64 paths, 78 call sites.

| Path | Call sites |
| --- | --- |
| `/api/reports/scheduled` | `web-global/src/lib/api.ts:397`, `web-global/src/lib/api.ts:399` |
| `/api/v1/admin/ai-stats` | `web-global/src/lib/api.ts:379` |
| `/api/v1/admin/skills` | `web-global/src/lib/api.ts:380` |
| `/api/v1/admin/system/health` | `web-global/src/lib/api.ts:381` |
| `/api/v1/admin/users` | `web-global/src/lib/api.ts:378` |
| `/api/v1/ai/conversations` | `web-global/src/lib/api.ts:240` |
| `/api/v1/ai_assistant/chat` | `android-cn/lib/services/api_service.dart:353`, `ios-cn/lib/services/api_service.dart:353`, `android-global/lib/services/api_service.dart:331`, `ios-global/lib/services/api_service.dart:334` |
| `/api/v1/audit/logs` | `web-global/src/lib/api.ts:383` |
| `/api/v1/audit/logs/my` | `web-global/src/lib/api.ts:385` |
| `/api/v1/auth/logout` | `web-global/src/lib/api.ts:81` |
| `/api/v1/dashboard/metrics` | `web-global/src/lib/api.ts:489`, `web-global/src/app/(dashboard)/analytics/page.tsx:11`, `android-cn/lib/services/api_service.dart:381`, `ios-cn/lib/services/api_service.dart:381`, `android-global/lib/services/api_service.dart:362`, `ios-global/lib/services/api_service.dart:365` |
| `/api/v1/external/carbon-intensity` | `web-global/src/lib/api.ts:324` |
| `/api/v1/external/carbon-intensity/factors` | `web-global/src/lib/api.ts:325` |
| `/api/v1/external/countries` | `web-global/src/lib/api.ts:332` |
| `/api/v1/external/country` | `web-global/src/lib/api.ts:331` |
| `/api/v1/external/geocode` | `web-global/src/lib/api.ts:321` |
| `/api/v1/external/pvwatts` | `web-global/src/lib/api.ts:317` |
| `/api/v1/external/reverse-geocode` | `web-global/src/lib/api.ts:323` |
| `/api/v1/external/stock/intraday` | `web-global/src/lib/api.ts:329` |
| `/api/v1/external/stock/quote` | `web-global/src/lib/api.ts:327` |
| `/api/v1/external/weather` | `web-global/src/lib/api.ts:313` |
| `/api/v1/external/weather/historical` | `web-global/src/lib/api.ts:315` |
| `/api/v1/fal/status` | `web-global/src/lib/api.ts:364` |
| `/api/v1/fal/t2v` | `web-global/src/lib/api.ts:370` |
| `/api/v1/fal/tts` | `web-global/src/lib/api.ts:366` |
| `/api/v1/finance/depreciation` | `web-global/src/lib/api.ts:194` |
| `/api/v1/finance/irr` | `web-global/src/lib/api.ts:166` |
| `/api/v1/finance/models` | `web-global/src/lib/api.ts:197` |
| `/api/v1/finance/monte-carlo` | `web-global/src/lib/api.ts:190` |
| `/api/v1/finance/npv` | `web-global/src/lib/api.ts:170` |
| `/api/v1/finance/quick-model` | `web-global/src/lib/api.ts:186`, `web-global/src/lib/api.ts:209` |
| `/api/v1/finance/sensitivity` | `web-global/src/lib/api.ts:214` |
| `/api/v1/interconnection/queue` | `web-global/src/pages/InterconnectionPage.tsx:62`, `web-global/src/components/pages/InterconnectionPage.tsx:62` |
| `/api/v1/knowledge/documents` | `web-global/src/lib/api.ts:416`, `web-global/src/lib/api.ts:421` |
| `/api/v1/knowledge/documents/{}` | `web-global/src/lib/api.ts:431` |
| `/api/v1/knowledge/documents/{}/vectorize` | `web-global/src/lib/api.ts:433` |
| `/api/v1/knowledge/search` | `web-global/src/lib/api.ts:412` |
| `/api/v1/notifications` | `web-global/src/lib/api.ts:268` |
| `/api/v1/notifications/{}/read` | `web-global/src/lib/api.ts:270` |
| `/api/v1/operations/anomaly/{}` | `web-global/src/lib/api.ts:225` |
| `/api/v1/operations/sites` | `web-global/src/lib/api.ts:228` |
| `/api/v1/operations/stats` | `web-global/src/lib/api.ts:227` |
| `/api/v1/personalize/hero/{}` | `web-global/src/hooks/usePersonalizedDashboard.ts:51` |
| `/api/v1/personalize/widgets/{}` | `web-global/src/hooks/usePersonalizedDashboard.ts:52` |
| `/api/v1/plant-data/import` | `web-global/src/lib/api.ts:450` |
| `/api/v1/plant-data/inverters` | `web-global/src/lib/api.ts:444` |
| `/api/v1/plant-data/query` | `web-global/src/lib/api.ts:442` |
| `/api/v1/plant-data/stats` | `web-global/src/lib/api.ts:439` |
| `/api/v1/policies` | `web-global/src/pages/PoliciesPage.tsx:26`, `web-global/src/components/pages/PoliciesPage.tsx:26` |
| `/api/v1/reports/scheduled/{}` | `web-global/src/lib/api.ts:404` |
| `/api/v1/resource` | `web-global/src/lib/api.ts:132` |
| `/api/v1/resource/history` | `web-global/src/lib/api.ts:133` |
| `/api/v1/ux/calculator/convert` | `web-global/src/lib/api.ts:348` |
| `/api/v1/ux/calculator/units` | `web-global/src/lib/api.ts:346` |
| `/api/v1/ux/daily-brief` | `web-global/src/lib/api.ts:343` |
| `/api/v1/ux/favorites` | `web-global/src/lib/api.ts:338`, `web-global/src/lib/api.ts:340` |
| `/api/v1/ux/favorites/{}` | `web-global/src/lib/api.ts:342` |
| `/api/v1/ux/health` | `web-global/src/lib/api.ts:344` |
| `/api/v1/ux/onboarding/status` | `web-global/src/lib/api.ts:345` |
| `/api/v1/ux/presets` | `web-global/src/lib/api.ts:355` |
| `/api/v1/ux/quick-assess` | `web-global/src/lib/api.ts:350` |
| `/api/v1/ux/quick-assess/popular-cities` | `web-global/src/lib/api.ts:351` |
| `/api/v1/ux/recent-activities` | `web-global/src/lib/api.ts:354` |
| `/api/v1/voice/asr` | `web-global/src/components/multimodal/MultimodalInput.tsx:27` |

## runtime/web calls handled by a Next.js `route.ts`, not by FastAPI

72 paths, 100 call sites. These have a handler in `runtime/web/src/app/api`, so no FastAPI route was added.

| Path | Call sites |
| --- | --- |
| `/api/admin/policies` | `runtime/web/src/app/(dashboard)/admin/policies/page.tsx:37` |
| `/api/admin/policies/{}/review` | `runtime/web/src/app/(dashboard)/admin/policies/page.tsx:61` |
| `/api/alerts` | `runtime/web/src/app/(dashboard)/alerts/page.tsx:15`, `runtime/web/src/app/(dashboard)/alerts/page.tsx:23` |
| `/api/assistant/answers/{}/export` | `runtime/web/src/app/(dashboard)/assistant/page.tsx:220` |
| `/api/auth/sms` | `runtime/web/src/app/login/login-form.tsx:55`, `runtime/web/src/components/account/AccountDataPanel.tsx:19` |
| `/api/briefs` | `runtime/web/src/app/(dashboard)/briefs/page.tsx:10` |
| `/api/calculator/analysis` | `runtime/web/src/components/calculator/AIProjectAnalysis.tsx:21` |
| `/api/calculator/storage` | `runtime/web/src/app/(dashboard)/calculator/storage/page.tsx:58` |
| `/api/calculator/wind` | `runtime/web/src/app/(dashboard)/calculator/wind/page.tsx:44` |
| `/api/chat` | `runtime/web/src/app/(dashboard)/assistant/page.tsx:114` |
| `/api/community/questions` | `runtime/web/src/app/(dashboard)/community/page.tsx:31`, `runtime/web/src/app/(dashboard)/community/page.tsx:52` |
| `/api/daily` | `runtime/web/src/app/(dashboard)/daily/page.tsx:10` |
| `/api/dashboard` | `runtime/web/src/app/(dashboard)/dashboard/page.tsx:148` |
| `/api/dashboard/tips` | `runtime/web/src/app/(dashboard)/dashboard/page.tsx:165` |
| `/api/datasets` | `runtime/web/src/app/(dashboard)/datasets/page.tsx:18`, `runtime/web/src/app/(dashboard)/datasets/page.tsx:30` |
| `/api/demo-requests` | `runtime/web/src/app/demo-request/page.tsx:32` |
| `/api/developer/keys` | `runtime/web/src/app/(dashboard)/developer/page.tsx:51`, `runtime/web/src/app/(dashboard)/developer/page.tsx:66`, `runtime/web/src/app/(dashboard)/developer/page.tsx:85` |
| `/api/developer/usage` | `runtime/web/src/app/(dashboard)/developer/page.tsx:491` |
| `/api/exports/download/{}` | `runtime/web/src/app/api/exports/route.ts:140` |
| `/api/exports/office` | `runtime/web/src/components/reports/OfficeExportButtons.tsx:9` |
| `/api/exports/reserve` | `runtime/web/src/app/(dashboard)/calculator/result/page.tsx:290`, `runtime/web/src/app/(dashboard)/calculator/result/page.tsx:340` |
| `/api/feedback` | `runtime/web/src/app/(dashboard)/assistant/page.tsx:301`, `runtime/web/src/app/(dashboard)/assistant/page.tsx:302` |
| `/api/location` | `runtime/web/src/components/map/ComparePage.tsx:41`, `runtime/web/src/components/map/LocationPicker.tsx:59` |
| `/api/location/suggestions` | `runtime/web/src/components/ui/AddressAutocomplete.tsx:48` |
| `/api/maintenance/diagnostics` | `runtime/web/src/components/maintenance/DiagnosticsWorkbench.tsx:20` |
| `/api/map-tiles` | `runtime/web/src/components/map/LocationPicker.tsx:41`, `runtime/web/src/components/map/ResourceMap.tsx:50` |
| `/api/map-tiles/tile` | `runtime/web/src/components/map/DomesticTileMap.tsx:68` |
| `/api/map/layers` | `runtime/web/src/components/map/VectorLayerPanel.tsx:12` |
| `/api/membership/consult` | `runtime/web/src/app/(dashboard)/membership/page.tsx:189` |
| `/api/membership/downgrade` | `runtime/web/src/app/(dashboard)/membership/page.tsx:155`, `runtime/web/src/app/(dashboard)/membership/page.tsx:166` |
| `/api/membership/me` | `runtime/web/src/app/(dashboard)/membership/page.tsx:22`, `runtime/web/src/app/(dashboard)/membership/page.tsx:38` |
| `/api/membership/refund/quote` | `runtime/web/src/app/(dashboard)/membership/page.tsx:177` |
| `/api/membership/upgrade` | `runtime/web/src/app/(dashboard)/checkout/checkout-client.tsx:32` |
| `/api/orchestrator` | `runtime/web/src/components/orchestrator/NextStepsPanel.tsx:37` |
| `/api/papers/ai` | `runtime/web/src/components/papers/PaperDetailView.tsx:71`, `runtime/web/src/components/papers/PaperDetailView.tsx:85`, `runtime/web/src/components/papers/PaperDetailView.tsx:107`, `runtime/web/src/components/papers/PaperDetailView.tsx:120` |
| `/api/papers/chat` | `runtime/web/src/components/papers/PaperDetailView.tsx:162` |
| `/api/papers/graph` | `runtime/web/src/app/(dashboard)/papers/graph/page.tsx:15` |
| `/api/papers/index` | `runtime/web/src/components/papers/PaperDetailView.tsx:134` |
| `/api/papers/recommendations` | `runtime/web/src/components/papers/PaperDetailView.tsx:59` |
| `/api/papers/search` | `runtime/web/src/app/(dashboard)/papers/page.tsx:75` |
| `/api/papers/upload` | `runtime/web/src/app/(dashboard)/papers/library/page.tsx:61` |
| `/api/policies` | `runtime/web/src/components/policy/PolicyTools.tsx:69`, `runtime/web/src/components/home/HomeAside.tsx:43` |
| `/api/policies/cohorts` | `runtime/web/src/components/policy/PolicyTools.tsx:89` |
| `/api/pricing/tariff` | `runtime/web/src/components/calculator/TariffPriceFields.tsx:54` |
| `/api/projects` | `runtime/web/src/app/(dashboard)/projects/page.tsx:35` |
| `/api/projects/diagnosis` | `runtime/web/src/app/(dashboard)/projects/[id]/page.tsx:125` |
| `/api/projects/{}` | `runtime/web/src/app/(dashboard)/projects/[id]/page.tsx:67`, `runtime/web/src/app/(dashboard)/projects/[id]/om/page.tsx:53` |
| `/api/projects/{}/alarms` | `runtime/web/src/app/(dashboard)/projects/[id]/om/page.tsx:66`, `runtime/web/src/components/maintenance/OperationsIngestPanel.tsx:46` |
| `/api/projects/{}/alerts` | `runtime/web/src/app/(dashboard)/projects/[id]/om/page.tsx:65` |
| `/api/projects/{}/maintenance` | `runtime/web/src/app/(dashboard)/projects/[id]/om/page.tsx:89`, `runtime/web/src/components/maintenance/OperationsIngestPanel.tsx:18` |
| `/api/projects/{}/monitoring` | `runtime/web/src/app/(dashboard)/projects/[id]/om/page.tsx:97` |
| `/api/projects/{}/stations` | `runtime/web/src/app/(dashboard)/projects/[id]/om/page.tsx:58` |
| `/api/projects/{}/telemetry` | `runtime/web/src/components/maintenance/OperationsIngestPanel.tsx:34` |
| `/api/projects/{}/timeline` | `runtime/web/src/components/moat/ProjectTimeline.tsx:58` |
| `/api/provinces` | `runtime/web/src/components/policy/PolicyTools.tsx:93` |
| `/api/quota` | `runtime/web/src/components/moat/QuotaPanel.tsx:53` |
| `/api/status` | `runtime/web/src/app/status/page.tsx:20` |
| `/api/user/account` | `runtime/web/src/components/account/AccountDataPanel.tsx:29` |
| `/api/user/export` | `runtime/web/src/components/account/AccountDataPanel.tsx:40` |
| `/api/user/onboarding` | `runtime/web/src/app/onboarding/page.tsx:129` |
| `/api/user/papers` | `runtime/web/src/app/(dashboard)/papers/library/page.tsx:36`, `runtime/web/src/app/(dashboard)/papers/library/page.tsx:36` |
| `/api/user/papers/save` | `runtime/web/src/app/(dashboard)/papers/page.tsx:103` |
| `/api/user/preferences` | `runtime/web/src/components/dashboard/PersonalizationSettings.tsx:14`, `runtime/web/src/components/dashboard/PersonalizationSettings.tsx:24` |
| `/api/user/profile` | `runtime/web/src/app/(dashboard)/settings/page.tsx:38`, `runtime/web/src/app/(dashboard)/settings/page.tsx:64` |
| `/api/v1/calculate/solar` | `runtime/web/src/app/developer/docs/page.tsx:12`, `runtime/web/src/app/api/v1/calculate/solar/route.ts:56` |
| `/api/v1/docs` | `runtime/web/src/app/(dashboard)/developer/page.tsx:575`, `runtime/web/src/app/developer/docs/page.tsx:23` |
| `/api/v1/openclaw` | `runtime/web/src/app/api/v1/openclaw/route.ts:15`, `runtime/web/src/app/api/v1/openclaw/route.ts:16`, `runtime/web/src/lib/audit/openclaw-skill.ts:64`, `runtime/web/src/lib/audit/openclaw-skill.ts:314`, `runtime/web/src/lib/audit/openclaw-skill.ts:325` |
| `/api/v1/papers/search` | `runtime/web/src/app/developer/docs/page.tsx:12` |
| `/api/v1/projects/{}/analytics` | `runtime/web/src/app/developer/docs/page.tsx:12` |
| `/api/v1/projects/{}/monitoring` | `runtime/web/src/app/developer/docs/page.tsx:12` |
| `/api/v2/project/{}/dashboard` | `runtime/web/src/app/project/[id]/dashboard/page.tsx:102` |
| `/api/v2/solar/calculate` | `runtime/web/src/lib/calculator/solar-preview-client.ts:29` |

## Admin and audit guards

`runtime/backend` mounts no path containing `admin` or `audit`. There is no admin or audit-log dependency in `runtime/backend/app` (`require_admin`, `get_current_admin`, and `is_superadmin` are absent). No guard was added and no endpoint was created.

The only existing admin-style dependency in this repo is `requireReviewer` in `runtime/web/src/lib/admin/require-reviewer.ts`. It allows users listed in `POLICY_REVIEWERS`. It is already called by:

| Route | Guard |
| --- | --- |
| `GET /api/admin/policies` | `requireReviewer` at `runtime/web/src/app/api/admin/policies/route.ts:11` |
| `POST /api/admin/policies/{id}/review` | `requireReviewer` at `runtime/web/src/app/api/admin/policies/[id]/review/route.ts:11` |

These are calculation-record reads, not admin audit logs. Each requires a logged-in session and returns only that user's record. `requireReviewer` is the policy-review allowlist, so it was not attached here:

| Route | Guard today |
| --- | --- |
| `GET /api/audit/{id}` | session user must own the record (`runtime/web/src/app/api/audit/[id]/route.ts:16`) |
| `GET /api/v2/audit/{id}` | session user must own the snapshot (`runtime/web/src/app/api/v2/audit/[id]/route.ts:13`) |

Client helpers that ask for an admin or audit-log API have no FastAPI route and no admin dependency to attach:

| Path | Call site |
| --- | --- |
| `GET /api/v1/admin/users` | `web-global/src/lib/api.ts:378` |
| `GET /api/v1/admin/ai-stats` | `web-global/src/lib/api.ts:379` |
| `GET /api/v1/admin/skills` | `web-global/src/lib/api.ts:380` |
| `GET /api/v1/admin/system/health` | `web-global/src/lib/api.ts:381` |
| `GET /api/v1/audit/logs` | `web-global/src/lib/api.ts:383` |
| `GET /api/v1/audit/logs/my` | `web-global/src/lib/api.ts:385` |

