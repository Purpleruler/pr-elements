# LANE pr-placement: spec (PM-approved, pending Daniel on the Lark Decisions table)

Status: PM verdict APPROVE (21 Jul 2026) with one correction incorporated: the SSO
JSON mode + CORS helper are OWNED by the wix-embed lane (approved, coding now); this
lane CONSUMES them per SPEC-wix-embed.md. Not coding until Daniel's approval lands.
Note: no "LANE pr-placement" card existed on the desk (only pr-capstone references
it); this spec is derived from the dispatch prompt's definition of done plus the
Pilot section of TESTING_PROGRAM.md.

## Definition of done (given)
pr-placement runs a real signed-in placement inside a Wix page, writes WB-Adaptive,
and no answer key ever reaches the browser.

## What exists today (verified 21 Jul 2026)
- pr-elements `placement.js`: hosted PREVIEW custom element, 5 hardcoded questions with
  answers client-side, no auth, no persistence. Embed pipeline proven (GitHub Pages ->
  Wix Custom Element).
- `assets/adaptive-engine.js` (workbooks repo): the real ARE engine, fully client-side;
  `q.answer` is in the browser for the whole 1,928-item placement pool (part of the
  97k-key leak-guard RED).
- `POST /api/adaptive`: session-gated WB-Adaptive write + WB-Learning-Plan gap upserts,
  but it trusts a CLIENT-COMPUTED result (score, band, gaps). A signed-in student could
  post a perfect score without answering anything.
- `GET /api/auth/sso`: verifies a Velo-signed token; the wix-embed lane (approved,
  coding now) is adding `&mode=json` returning `{ok, token, email, name}`, fail-closed
  claims (403 `no-enrolment` / 503 `claims-unavailable` + Retry-After / 401 bad token),
  and a shared CORS allowlist helper driven by `WIX_ALLOWED_ORIGINS`. Secrets
  (`VELO_SSO_SECRET`, `SESSION_SECRET`) land via that lane.

## Plain-language spec

### A. Server side (repo: purple-ruler-scripts, Cloudflare Pages Functions)
1. **Server-only placement pool.** Build step emits
   `functions/api/_placement/<subject>.js` (stems + options + keys + strand/year
   metadata), same server-only pattern as `_schemes/` and the planned `_capstone/`.
   Client bundle never includes it.
2. **Port the ARE engine server-side.** Same phase-1 ladder + phase-2 strand probing
   logic as `adaptive-engine.js`, but running in the Function. Pages Functions are
   stateless, so the adaptive state (items asked, per-strand tallies, ability estimate)
   travels as an HMAC-signed state blob (same signing approach as the session cookie);
   the client cannot read or tamper with it.
3. **Three endpoints, all requiring a valid `x-pr-session` (fail closed):**
   - `POST /api/placement/start` {subject} -> {state, item:{id, stem, options}}. No key.
   - `POST /api/placement/answer` {state, itemId, chosen} -> {correct:true/false, state,
     next item OR done:true}. Feedback is correct/incorrect ONLY; the right option is
     never identified, so no key ever reaches the browser, even after answering.
   - `POST /api/placement/finish` {state} -> server computes scaled score, band, gap
     strands and gap modules from the signed state, then writes WB-Adaptive and the
     WB-Learning-Plan upserts SERVER-SIDE (reusing adaptive.js logic). Returns the
     result summary for display. The client never posts a result; the fake-score hole
     in today's /api/adaptive closes for this flow.
4. **SSO swap and CORS: CONSUMED, not built (owned by wix-embed, per
   SPEC-wix-embed.md).** This lane does not implement the endpoint or the CORS
   helper. The element swaps its member-token at
   `/api/auth/sso?token=...&mode=json` and parses `{ok, token, email, name}`
   (SPEC-wix-embed.md:32-33), then sends `token` as `x-pr-session` on the placement
   endpoints. The new `/api/placement/*` endpoints WIRE IN wix-embed's shared CORS
   helper (allowlist via `WIX_ALLOWED_ORIGINS`, no code default) rather than
   shipping their own headers.

### B. Element side (this repo: pr-elements, branch cl/pr-placement)
5. Replace PREVIEW_BANK with the server flow: read `member-token` attribute (set by the
   Wix page's Velo code, wix-embed's `getMemberToken()`), swap it at
   `/api/auth/sso?token=...&mode=json`, then start -> answer loop -> finish, rendering
   only what the server sends. Keep the existing Purple Ruler brand shell, progress
   bar, and result screen; drop the PREVIEW labels.
6. Fail-closed UX mapping wix-embed's three SSO outcomes: missing member-token or 401
   renders "please sign in on Purple Ruler" with a link to the Wix login; 403
   `no-enrolment` renders a clear not-enrolled state; 503 `claims-unavailable` renders
   "try again in a moment" and auto-retries per Retry-After. No items are ever fetched
   unauthenticated.

### C. Out of scope for this lane (dependencies)
- The SSO JSON mode, claims resolver, CORS helper, secrets (`VELO_SSO_SECRET` /
  `SESSION_SECRET` / `WIX_ALLOWED_ORIGINS`), and the Velo `getMemberToken()` snippet:
  wix-embed lane (desk card 20260721-142227-26278, approved, coding now; MJ
  publishes the Velo side). This lane consumes the contract in SPEC-wix-embed.md.
- Stripping the EXISTING client qbank keys: anticheat lane. This lane must not make
  leak-guard worse and adds no new keys to any client bundle.

## Acceptance (as behaviour)
1. A real signed-in Wix member opens the Wix page, completes a full adaptive placement
   inside the embedded element, and sees their scaled score and band.
2. A new WB-Adaptive row appears for their email with Session Verified true and a
   correct Placement #; gap modules appear in WB-Learning-Plan as todo.
3. A full network trace of the run (DevTools export) contains zero answer keys: item
   payloads carry only id/stem/options, answer responses carry only correct:true/false.
4. Signed out (or tampered state blob): no items served, element shows the sign-in
   state, endpoints return 401.
5. leak-guard.sh stays at or below current counts; a new placement check (pool file
   absent from client bundle) reports 0.

## Risk class and routing
Touches the auth trust boundary and the anticheat boundary: permissions / HIGH.
Server PR (purple-ruler-scripts) and element PR (pr-elements) both go TO THE DESK;
no auto-merge; Daniel holds the merge button. Frontend acceptance is a human act.

## Guards
- leak-guard.sh extended with a `placement` mode: greps built client assets for any
  `_placement/` content or placement pool keys, must be 0.
- Fail-closed permission tests: no session, wrong-email session, expired session,
  tampered state blob all rejected.
