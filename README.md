# Givells Kakelugnsmakeri & Murverk

Website for Givells Kakelugnsmakeri och murverk AB, a tile-stove and masonry firm in Gävleborg. Swedish-language, single page.

A plain static site: no framework, no build step, no dependencies to install.

## Run locally

```sh
python3 -m http.server 4321
```

Then open http://localhost:4321. The hero videos need a server that supports HTTP range requests to play in Safari (Python's `http.server` doesn't; Chrome is fine with it).

## Deploy on Vercel

Import the repo in Vercel with these settings:

- **Framework preset:** Other
- **Build command:** none
- **Output directory:** the repo root

## Structure

| File | What it does |
|---|---|
| `index.html` | The page, plus the inline intro script in `<head>` |
| `styles.css` | All styles: dark/light themes, layout, animations |
| `main.js` | Intro loader, theme toggle, header, menu, hero video, gallery slider, quote pop-up, form |
| `motion.js` | Scroll-driven effects |
| `embers.js` | Background embers (dark mode) / snow (light mode) |
| `explore.js` | The 3D tile stove, loaded lazily |
| `assets/vendor/` | three.js r186, self-hosted (MIT, see `LICENSE-three.txt`) |
| `assets/fonts/` | Fraunces and Figtree, self-hosted |

## Before going live

- **Contact form:** there's no backend yet. Set `data-endpoint` on `#offertformular` in `index.html` once the destination is confirmed. Until then, the form opens the visitor's email app addressed to teodor@givellskakelugnsmakeri.se.
- **Hero video:** it's AI-generated and still carries the "Veo" watermark. Swap it for a clean export or real footage, and decide on an AI disclosure (EU AI Act).
- **Copy:** some Swedish copy was written for the redesign and needs Teodor's sign-off: the hero text, service checklists, 3D chapter texts, button labels and footer headline.
- **Domain:** `canonical` and `og:url` already point to https://givellskakelugnsmakeri.se/.
