# SPEC: pr-capstone (story-driven capstone web component, Wix-embedded)

Status: AWAITING APPROVAL (Loop 1 spec gate). No code written yet.
Lane card: desk 20260721-182504-21712. Depends on: capstone-reader lane (desk 20260721-182504-30373).

## What it does (plain language)

A student who is logged in to the Wix site opens the Capstone page and meets `<pr-capstone>`,
a Purple Ruler web component embedded exactly like `pr-placement` (GitHub Pages URL as the
Custom Element source, not an iframe). It turns one of the 55 QA-passed maths missions into a
read-and-solve experience:

1. **Briefing screen.** Mission title, premise and cast, plus a "case board" showing every
   key (sub-topic) as a locked card. The student sees how many keys the case needs.
2. **Key screen.** One key at a time: the scene (story text), the stem (the actual maths
   question), an optional figure, and an answer input that matches the answer type
   (number + units, or multiple choice from option labels). A hint is available on request.
3. **Submit and reveal.** The answer goes to the server (`POST /api/capstone/answer`).
   The server grades it. Correct: the key unlocks and its story reveal is shown, and the
   case board updates. Incorrect: the student can try again (retry policy is the server's).
4. **Finale.** When all keys are solved, the finale prompt appears: the student makes the
   final deduction (who/what/where) by choosing from dropdown fields, submits to
   `POST /api/capstone/finale`, and gets the verdict. The server records the whole attempt
   to Lark (WB-Test-Attempt + WB-Responses, testType=capstone).
5. **Case closed screen.** Verdict, keys solved, and a friendly wrap-up.

## What never happens (anti-cheat, the point of the whole design)

- The client bundle and every network payload the browser sees contain **zero** answers,
  zero marking expressions, zero reveal text ahead of time, zero finale answers.
  All grading is server-side. `leak-guard.sh capstone` stays 0 against this repo.
- Because real stems previously leaked into `qbank/*.js`, the pre-backend hosted build does
  **not** embed any real mission. It ships one small, invented DEMO mission (clearly
  labelled DEMO, not from the 55-mission bank) purely so the Wix embed pipeline is
  demonstrable. The real missions only ever arrive via `/api/capstone/mission` (reader.json,
  which the capstone-reader lane guarantees is answer-free).

## How (technical shape)

- New file `capstone.js` in `Purpleruler/pr-elements`, same pattern as `placement.js`:
  self-registering `<pr-capstone>`, Shadow DOM, no build step, no dependencies, no secrets.
- Attributes: `member-token` (Velo-signed, same as pr-placement), `mission` (mission id;
  if absent, the element asks the server for the student's assigned/next mission),
  `subject` (default `maths`), `api` (default `https://test.purpleruler.com`).
- Data contract (owned by capstone-reader lane): reader.json with title/premise/cast,
  per key {keyId, topic, scene, stem, fig, units, answerType, option labels, hint},
  finale {prompt, fields[label, options]}. This component renders that contract and
  nothing else.
- Resume: on load the element asks the mission endpoint for current progress (which keys
  are already solved) so a student can leave and come back. **Interface ask to
  capstone-reader lane:** mission response should include per-key solved state and the
  already-earned reveal texts for solved keys.
- Design: Purple Ruler brand (purple gradient family already in placement.js), iPad-first
  layout, readable long-form story typography, keyboard and screen-reader accessible
  (focus-visible, buttons not divs, aria-live for grading feedback).
- Iteration: git push to main = live on GitHub Pages. Frontend class: every visual change
  routes to Daniel; acceptance is a human act, no auto-merge.

## Acceptance (as behaviour)

- A logged-in student on a Wix page reads a mission and answers it end to end: briefing,
  every key, finale, verdict, with the result landing in Lark WB-Test-Attempt.
- `leak-guard.sh capstone` = 0 on this repo's bundle at all times, including the DEMO build.
- Daniel signs off visually (iPad + desktop + phone; 3-viewport CI as backstop).

## Build order (so the lane is never blocked on capstone-reader)

1. `capstone.js` against a mock fetch layer implementing the reader contract, DEMO mission.
2. Hosted DEMO on GitHub Pages + demo page, embedded in a Wix test page for sign-off.
3. When `/api/capstone/*` lands: flip the fetch layer to the real endpoints, delete the
   DEMO path, end-to-end run with a real student account, Lark record verified.

PARKED 22 Jul 2026: testing programme paused by Daniel (ruling-20260722-pause-testing); no new work; resume per ORCHESTRATION ACTIVE-programme section.
