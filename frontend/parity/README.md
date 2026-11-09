# Pixel parity with the design

Every screen of the app is compared with a reference image rendered from the design.
The comparison is the test for pixel parity: **a screen is done when it is within the tolerance.**
Same idea and same rules as the parity checks in Hoard, in TypeScript.

## Run it

From `frontend/`:

| Command | What it does |
|---|---|
| `npm run parity` | Starts the dev server, opens every screen at its design size with the API answered from fixtures, screenshots it, and prints how far each is from its reference. Exit code 1 if any compared screen is outside the tolerance. |
| `npm run parity -- --only board-discussing-light home-dark` | The same for some screens. |
| `npm run parity:tests` | Unit tests of the comparison, the screen table, the fixtures and the references. |
| `npm run parity:references -- --designs <folder>` | Renders the reference images again from the design. |

Screenshots and difference images (differing pixels in red on a dimmed copy) are written to `output/`, which is git-ignored.
Requires the Playwright browsers (`npx playwright install chromium`).

## Tolerance

A pixel differs when any colour channel is more than 24 apart, which is above the anti-aliasing noise between two renders
of the same screen. A screen passes only when no pixel differs, so a layout shift of one pixel fails.
Both numbers are set once in `image-comparison.ts`.

## Where the references come from

The design is a set of React pages in the design artifact (`project/screens/*.jsx`), not in this repository.
`parity:references` takes that `project/` folder with `--designs` (or `RETROSPEKT_DESIGN_DIR`), draws each artboard on its
own at its exact size, and writes `references/<screen>.png`. It runs offline: React and Babel come from a local cache
checked against the integrity hashes the design declares, and font requests are answered with the same font files the app
uses (`@fontsource`, self-hosted). **Look at the references after rendering them**: a defect in the design (a wrapped button,
a clipped page) would otherwise become the target.

`design-boards.jsx` maps each screen name to the design component that draws it.

## Conditions

References and screenshots are taken under the same conditions (`browser-settings.ts`): English (UK) locale, UTC, a fixed
clock (2026-05-05 10:02, so a timer started 5m28s earlier reads 04:32), no animations, Inter and JetBrains Mono from the same
files, and a fresh browser profile per screen. The app's API is answered from `fixtures.ts`, which is the data the design shows.

## Files

- `screens.ts`: every comparable view, with route, size, theme, who is looking, and the steps to reach it. A screen that
  depends on a component that is not built yet is `pending`, with the reason, and is listed in the report as work to do.
  Remove `pending` when the component lands.
- `fixtures.ts`: the data the design shows, in the shapes the API returns.
- `browser-settings.ts`: the conditions above.
- `image-comparison.ts`: counts and marks differing pixels.
- `compare-screens.ts`: runs the whole comparison. `render-references.ts`: renders the references.
- `references/`: the reference images. `design-boards.jsx`: the harness table.

Not covered here, on purpose: the design's specimen sheets (card states, pickers, timer states, tokens, handoff), which are not
screens, and the link banner, which the backend draws with Pillow and cannot match a browser render pixel for pixel.
