# CLAUDE.md

Personal portfolio deployed as a GitHub Pages **user site** (`<username>.github.io`). Static
React 19 + TypeScript + Vite 8 app, no backend. `README.md` is the owner-facing guide to
editing content; this file covers working on the code.

## Commands

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # tsc --noEmit (strict) + vite build → dist/
npm run preview  # serve dist/
node scripts/build-sky-data.mjs [magLimit=6]   # regenerate public/skies/sky.json (needs network)
```

- There are no tests or linter. `npm run build` is the check: run it after every change.
  `tsconfig.json` has `strict`, `noUnusedLocals`, and `noUnusedParameters`, so unused code
  fails the build.
- Node 20.19+ or 22.12+ locally. CI uses Node 24.

## Deploy

- `.github/workflows/deploy.yml` runs `npm ci && npm run build` and publishes `dist/` on every
  push to `main`. Pages source must be set to **GitHub Actions**.
- Commit `package-lock.json` and keep it in sync with `package.json`, or `npm ci` fails in CI.
- Never commit `dist/` or `node_modules/` (both gitignored).

## Layout

Two pages, each its own Vite entry (`build.rolldownOptions.input` in `vite.config.ts`):

| Page | HTML | Entry | Root |
| --- | --- | --- | --- |
| Flight deck (home) `/` | `index.html` | `src/main.tsx` | `src/carrier/CarrierApp.tsx` |
| Above the skies `/skies/` | `skies/index.html` | `src/skies/main.tsx` | `src/skies/SkiesApp.tsx` |

A new page needs all three pieces: an HTML file, an entry, and a key in `input`.

The home page is an ASCII aircraft-carrier flight deck (Three.js, after the `ascii-diorama` skill in
`.claude/skills/`), with the recruiter sections below it. Code is in `src/carrier/`: the React overlay
in `CarrierApp.tsx`, and in `scene/` the procedural carrier, the F-35Cs (`jet.ts`), the Group 1
quadcopter and its pad (`quad.ts`), the sea, flight ops (`ops.ts`), and the glyph and tilt-shift passes
(`post.ts`). Metres, +x toward the bow, +z to starboard. Everything is procedural, with no downloaded
assets. The aircraft on deck are the ASTRUM projects with `deck` set in `src/data/astrum.ts`
(`vehicle: "quadcopter"` gets the quadcopter). In dev, `/?fps` adds a frame-rate and quality-level
readout; the scene steps down quality on its own if frames stay slow.

The Projects section opens with the ASTRUM case study (`src/components/astrum/`, content in
`src/data/astrum.ts`): architecture diagram, tick stepper, a split-S replay with flight-data strips,
speed chart, and a card per project built on ASTRUM, whose "Uses" chips light up the diagram
through `archHighlight` (`highlight.ts`). Replays and charts are JSON in `public/projects/astrum/`,
built by `node scripts/build-astrum-assets.mjs <path to astrum>`; the multi-MB recordings stay in
the ASTRUM repo. Copy starting "Placeholder:" and files with a `filler` note are filler to replace.

- `src/data/`: all site content (`profile.ts`, `skies.ts`, `myths.ts`, `figures.ts`).
  Components read from here. Put new copy in these files, not in components.
- `src/components/`: shared UI: `sections/` for the recruiter sections, plus `StatusBar`,
  `Reticle`, `Panel` and `TerrainBackground` (the last two used by the sky page).
- `src/lib/`: shared hooks and state: theme, cross-page links (`pages.ts`), a tiny pub-sub
  (`bus.ts`), UAS group data (`uas.ts`), terrain contours (`topo.ts`).
- `src/skies/`: sky chart. `skyView.ts` is an imperative canvas renderer. `catalog.ts` loads
  and types `sky.json`. `astro.ts` holds the astronomy math.
- `src/styles/`: plain CSS. Design tokens are at the top of `base.css`; `carrier.css` is the
  flight deck overlay, `sections.css` the recruiter sections, `skies.css` the sky page.

## Conventions

- **Base path.** `base` is `"/"`. Build asset and page URLs from `import.meta.env.BASE_URL`
  (see `src/lib/pages.ts`, `catalog.ts`, `skyView.ts`). `profile.ts` (`resumeUrl`, `photo`,
  project `image`) and the favicon links in both HTML files use root-absolute paths, which
  break if the site moves to a project repo with a non-root `base`.
- **Motion.** Both apps wrap everything in `<LazyMotion features={domAnimation} strict>`.
  Use `m.div` etc. from `motion/react`, never `motion.div`, because strict mode throws on it.
  `MotionConfig reducedMotion="user"` covers motion components. Code outside Motion (canvas,
  scrolling, CSS animation) must check `prefers-reduced-motion` itself; follow
  `usePrefersReducedMotion` / `scrollToId` in `src/lib/hooks.ts`.
- **Theme.** `data-theme="night" | "day"` on `<html>`, saved under the localStorage key
  `theme` only when the visitor picks one; otherwise it follows the system setting. An inline
  script in **both** HTML files repeats the logic in `src/lib/theme.tsx` to avoid a flash
  before first paint. Change all three together.
- **Storage.** Wrap every `localStorage`/`sessionStorage` access in try/catch and degrade
  quietly, as the existing code does.
- **Pitch-up transition.** Links to `/skies/` use `onSkiesLinkClick`/`markPitchUp` (a
  sessionStorage flag). `takePitchUp()` runs once, outside React, so StrictMode's double render
  doesn't consume the flag twice.
- **Colors.** Glass-cockpit palette: magenta = active route, cyan = selected or interactive,
  green/amber/red = status lights only. The canvas reads the `--sky-*` tokens directly, so they
  must stay plain color values (no `var()`, `color-mix()`, etc.) and need a set for each theme.
- **Fonts** are self-hosted via Fontsource (B612, B612 Mono, EB Garamond). Don't add CDN font
  or script links.

## Sky data

- `public/skies/sky.json` is generated by `scripts/build-sky-data.mjs` from d3-celestial.
  Don't hand-edit it. Its shape is `SkyCatalog` in `src/skies/catalog.ts`, so change the
  script and the interface together.
- `Story.id` in `myths.ts` and the keys of `figures.ts` are IAU abbreviations exactly as
  `sky.json` spells them (`Ori`, `CVn`, `UMa`).
- Figures are white alpha-mask `.webp` files in `public/skies/figures/`, placed on the sky by
  a gnomonic-plane affine fit (see the `Figure` doc comment). Only use public-domain sources
  and fill in `credit`.
- Keep `public/skies/LICENSE-d3-celestial.txt` (the BSD licence requires it). The sky guide
  links to it.

## Content rules

- **Public-release safety:** no ITAR-controlled technical data, CUI, or uncleared program
  details. Use generic aircraft types ("MALE fixed-wing") instead of program names.
- Most content is still template sample data: `profile.ts` (`name: "Your Name"`,
  `you@example.com`, `your-github-username`, and sample experience and projects), both HTML
  `<title>`/description tags, `public/resume.pdf`, and `stargazingNote` in
  `src/data/skies.ts`. Don't invent personal details to fill them in; ask the owner.
- The GitHub repo list calls the unauthenticated GitHub API (60 requests/hour per visitor,
  cached for 30 min). Don't add tokens; this is a public static site.
