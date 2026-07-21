# pr-elements

Purple Ruler purpose-built web components, embedded into Wix pages as Wix Custom Elements and
hosted on GitHub Pages (the closed-loop CE lane: push to main, it is live). Part of the
test.purpleruler.com testing-system program (see `curriculum-workbooks/TESTING_PROGRAM.md`).

## Components

- **`pr-placement`** (`placement.js`) — adaptive placement check. First hosted build runs a
  labelled PREVIEW sequence client-side so the embed pipeline is demonstrable; the live version
  fetches items and submits answers to the server (keys never reach the browser) and writes the
  result to Lark `WB-Adaptive`, which the Velo sync mirrors to Wix `AREAssessments`.

## Embed in Wix

1. Wix Editor: Add (+) > Embed Code > Custom Element.
2. Element Attributes > Server URL = this file's GitHub Pages URL (e.g.
   `https://purpleruler.github.io/pr-elements/placement.js`).
3. Tag Name = `pr-placement`.
4. Optional attributes: `subject` (default `maths`), `member-token` (Velo-signed, set by the page),
   `api` (default `https://test.purpleruler.com`).
5. Publish. Iterate by pushing to this repo.

Not an iframe: the element renders in the Wix page DOM (Shadow DOM isolates its styles), so it is
responsive and keeps no cross-origin storage of its own.
