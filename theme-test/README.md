# Theme test

Static demos of the SWIS Weather Station **themes** (different `data-weather` and `data-period` combinations). No live APIs or JS logic – just HTML + CSS so you can see how the site looks in different situations.

## How to view

Open `index.html` in a browser (double‑click or “Open with Live Server” in VS Code). From the hub, click any situation to see that theme.

If you run the main app from the repo root (e.g. `npx serve .`), open:

- **http://localhost:3000/theme-test/**  
- **http://localhost:3000/theme-test/rain-day.html**  
etc.

## Situations

| Page | Theme | What you see |
|------|--------|---------------|
| **Cloudy (day)** | `data-weather="cloudy"` | Grey‑blue gradient, default look. |
| **Clear / sunny (day)** | `data-weather="clear"` | Bright blue sky, orange accent. |
| **Rain (day)** | `data-weather="rain"` | Rain gradient + **animated rain** over the page. |
| **Hot (day)** | `data-weather="hot"` | Orange/red gradient, warm accent. |
| **Night** | `data-period="night"` | Dark blue background + **twinkling stars**. |
| **Rain + night** | `data-weather="rain"` + `data-period="night"` | Night colors + stars + **rain animation**. |

Weather icons (if present) are loaded from `../ComputerTabletsInterface/images/`; if that folder is missing, the icon area may be empty but the theme (background, rain, stars) still applies.
