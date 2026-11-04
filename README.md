# Portfolio: flight deck

A personal portfolio styled as an aircraft carrier flight deck, drawn entirely in coloured
ASCII (Three.js, rendered through a glyph pass and a tilt-shift blur). The landing view is a
live miniature: deck crews work, a jet comes up the elevator and is shot off the bow every
8 seconds, a helicopter circles, and the escort steams alongside.

- **Your projects are the aircraft.** Each featured project is parked in the row forward of
  the island, tagged with its side number. Hover or tab to one for its tagline; click it and
  it launches while its mission card opens. Jets (F-35Cs) taxi to the catapult, spread their
  wings, launch, and trap back aboard when the card closes. A project marked as a quadcopter
  lifts off its UAS pad and circles over the deck instead.
- **The camera follows.** It tracks your launches off the bow and pans aft for recoveries,
  pulling the tilt-shift focus onto the aircraft.
- **A status strip** shows both catapults, recoveries, the UAS pad and what's airborne, with a
  pause button for the motion.

Below the deck are plain, skimmable sections for recruiters: About, Experience, Projects
(plus your other public GitHub repos), Platforms (Groups 1 to 5), and Contact.

There are two themes. Day is daylight flight ops; Night is moonlit, with deck edge lights and
navigation lights. The site follows the visitor's system setting until they pick one. The
page chrome follows glass-cockpit conventions in Night and a VFR sectional chart in Day.

### Above the skies

A second page, at `/skies/`, about stargazing and the Greek and Roman myths behind the
constellations. Visitors reach it from "Above the skies" in the top bar or footer. Arriving
that way, the view pitches up off the terrain, past the horizon, with a pitch ladder as on a
flight display, until it looks straight up. Shared links and reloads skip the transition, and
so does any key or click.

The page is a planetarium-style sky chart you can drag and zoom. It opens on the sky directly
over your `location` at the current time, with the horizon and the compass points marked.
All 88 constellations are drawn and can be clicked. Ones with a story glow, and the guide
panel lists them. Opening a constellation flies the chart to it and fades in its figure from
Johann Bayer's *Uranometria* (1603, plus its 1661 printing). The Hunting Dogs are younger than
Bayer's atlas, so theirs comes from Hevelius (1690). The card beside it holds the myth, its
ancient sources, and when and how high the constellation rises from where you live.
Constellations without a story get a short fact card. Each one has its own link, e.g.
`/skies/#Ori`. In the Day theme, the chart is a printed star atlas: ink on cream.

## Edit your content

Almost everything lives in **`src/data/profile.ts`**:

| Field | What it controls |
| --- | --- |
| `name`, `role`, `summary`, `callsign` | Hero, top bar, page title; the digits in `callsign` are the carrier's hull number |
| `location` | Hero eyebrow and "Based in" |
| `availability`, `yearsExperience` | Status light in the top bar, Contact, Experience intro |
| `email`, `links`, `githubUsername` | Contact buttons and the GitHub repo list |
| `experience` | The Experience timeline |
| `projects` | The first four are the aircraft on deck (set `vehicle: "quadcopter"` for a Group 1 quadcopter); all appear in the Projects section |
| `platforms`, `skills` | Platforms section |
| `about` | About section paragraphs |

Other files:

- **Resume:** replace `public/resume.pdf` with your own (the current one is a placeholder).
- **Headshot (optional):** add e.g. `public/me.jpg` and set `photo: "/me.jpg"`.
- **Project screenshots (optional):** add e.g. `public/projects/mavdeck.png` and set
  `image: "/projects/mavdeck.png"` on the project.
- **Search/social description:** edit the `<title>` and `<meta name="description">` in `index.html`
  (and `skies/index.html` for the sky page).

The sky page has its own files:

- **`src/data/skies.ts`**: the page title, and your note on how you got into stargazing
  (currently a placeholder).
- **`src/data/myths.ts`**: the myth stories. Each story names its constellation by IAU
  abbreviation (`Ori`, `CVn`, …) and has a group, a title, the retelling, and its sources. Add
  a story and that constellation starts glowing and joins the list.
- **`src/data/figures.ts`** and **`public/skies/figures/`**: the atlas figures. Each one is a
  white alpha mask that the chart tints for the theme, plus an affine fit that places it on the
  sky. Figures are optional; a story without one still works.
- **`public/skies/sky.json`**: stars to magnitude 6, constellation lines and boundaries, and
  the Milky Way. Regenerate it with `node scripts/build-sky-data.mjs` (pass a magnitude limit
  as the first argument to change how many stars it includes).

> Keep everything public-release safe: no ITAR-controlled technical data, CUI, or
> program details your employer hasn't cleared. Generic aircraft types ("MALE fixed-wing")
> are safer than program names.

## Run it locally

Requires Node 20.19+ or 22.12+.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check and build to dist/
npm run preview  # serve the production build
```

## Deploy to GitHub Pages

1. Create a GitHub repository named **`<your-username>.github.io`**.
2. Push this folder to its `main` branch:
   ```bash
   git init
   git add .
   git commit -m "Initial portfolio"
   git branch -M main
   git remote add origin https://github.com/<your-username>/<your-username>.github.io.git
   git push -u origin main
   ```
3. In the repo, open **Settings → Pages** and set **Source** to **GitHub Actions**.

The workflow in `.github/workflows/deploy.yml` builds and deploys on every push to `main`.
The site will be live at `https://<your-username>.github.io`.

If you deploy to a project repo instead (`<your-username>.github.io/portfolio`), set
`base: "/portfolio/"` in `vite.config.ts`.

## Customizing

- **Colors and type:** the tokens at the top of `src/styles/base.css`. The palette follows
  glass-cockpit conventions: magenta for the active route, cyan for selected or interactive
  elements, and green/amber/red for status lights only.
- **The flight deck:** the scene lives in `src/carrier/scene/` (carrier, F-35Cs, quadcopter, sea,
  flight ops, and the glyph and tilt-shift passes); the overlay, tags and mission cards are in
  `src/carrier/CarrierApp.tsx`, styled in `src/styles/carrier.css`.
- **UAS group definitions** (the weight, altitude, and speed limits): `src/lib/uas.ts`.
- **Sky chart colors:** the `--sky-*` tokens in `src/styles/base.css`, one set per theme. They
  are plain color values because the canvas reads them directly.

## Notes

- The font is [B612](https://github.com/polarsys/b612), designed for Airbus cockpit displays, self-hosted via Fontsource.
- The GitHub repo list uses the public API, which allows 60 requests per hour per visitor;
  results are cached for 30 minutes. Forks, archived repos, featured projects, and this site's
  own repo are left out.
- Motion respects `prefers-reduced-motion`. With it on, the flight deck shows one still frame
  and opening a project just opens its card; the custom cursor is off. The custom cursor only
  appears with a mouse. On the sky page, it also skips the pitch-up, and the chart jumps
  instead of flying.
- The flight deck needs WebGL 2. Without it, the hero shows a plain list of the projects. If
  frames run slow, the scene steps down its own render quality; in dev, `/?fps` shows the
  frame rate and quality level.
- The myths are set in [EB Garamond](https://github.com/octaviopardo/EBGaramond12), a revival
  of the type of Bayer's era, self-hosted via Fontsource.
- Sky data comes from [d3-celestial](https://github.com/ofrohn/d3-celestial) by Olaf Frohn
  (BSD licence, copied to `public/skies/LICENSE-d3-celestial.txt`). It compiles Hipparcos (XHIP)
  stars, IAU constellation lines, Davenhall and Leggett's (1989) boundaries, and Jose R.
  Vieira's Milky Way outlines. The atlas figures are public-domain scans from Wikimedia
  Commons; each story card links to its source.
