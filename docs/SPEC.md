# Torn Battlecards — Specification

Status: **v0.1 working end-to-end.** Loads a war CSV, previews a card per member,
exports single PNGs or a ZIP of all cards.

---

## 1. Purpose

After a Torn City ranked war, a faction officer exports a CSV of member war
efforts. This app turns that CSV into one "battlecard" PNG per member, downloadable
in bulk as a ZIP for posting to Discord.

Non-goals (deliberately out of scope for now):

- No Torn API integration. The CSV is the only input.
- No accounts, no database, no server.
- No AI/LLM at runtime — the coach's notes and grade are typed by the officer.

## 2. Constraints

| Constraint | Consequence |
|---|---|
| Zero hosting cost | Static files only. No backend, no build step, no npm at deploy time. |
| Runs in the browser | CSV never leaves the officer's machine. |
| Must work from `file://` too | Plain `<script>` tags, no ES modules (CORS blocks module loading from disk). |
| Discord distribution | Default export is 1354×752 PNG so a full roster ZIP stays under Discord's 10 MB standard upload limit. |

## 3. Hosting

The app is a folder of static files. Anything that serves static files works:

- **Cloudflare Pages** — free, direct upload (drag the folder in, or `wrangler pages deploy`), URL is `<project-name>.pages.dev`. No GitHub link required.
- **Netlify Drop** — free, drag the folder onto `app.netlify.com/drop`, URL is `<site-name>.netlify.app`, renameable in site settings.
- **Vercel** — free Hobby tier, `<project-name>.vercel.app`. Fine, but it wants a Git repo or the `vercel` CLI, so it is slightly more setup than the two above.
- **GitHub Pages** — works, but a personal repo publishes to `<username>.github.io/<repo>`, which puts the GitHub username in the URL. Hosting under a free GitHub **organisation** avoids that (`<org>.github.io/<repo>`).

Chosen approach: **direct upload to Cloudflare Pages or Netlify**, keeping the Git
repo private (or local-only). Deploying is copying a folder; there is nothing to build.

## 4. Repository layout

```
torn-battlecards/
├── index.html                 # the whole UI
├── assets/
│   ├── css/app.css            # page chrome: upload, roster, preview, buttons
│   ├── css/card.css           # the battlecard itself (fixed 1354×752)
│   ├── fonts/fonts.css        # Oswald + Barlow Condensed, base64-embedded (OFL)
│   └── js/
│       ├── icons.js           # inline SVG icons as data: URIs
│       ├── metrics.js         # CSV schema, normalisation, ranking, formatting
│       ├── card.js            # builds one card's DOM + draws the radar canvas
│       ├── export.js          # html2canvas → PNG, JSZip → bulk ZIP
│       └── app.js             # UI wiring
├── vendor/                    # pinned third-party libs, committed on purpose
│   ├── html2canvas.min.js     # 1.4.1
│   ├── jszip.min.js           # 3.10.1
│   └── papaparse.min.js       # 5.4.1
├── data/
│   ├── template.csv           # blank header row for officers to fill in
│   └── sample-war.csv         # real August 2026 war data, example grades/notes
├── docs/
│   ├── SPEC.md                # this file
│   └── reference/             # original battlecard.png and total_respect.csv
├── README.md
└── CHANGELOG.md
```

Vendored libraries are committed rather than installed. That is the whole point of
"no build step": the deployed folder is the repo folder.

## 5. CSV format

One header row, one row per member, one table. (The original export had two
different tables side by side in one file, with the second table's header on row 1
— that is what made it awkward to handle.)

### 5.1 Columns

| # | Column | Type | Required | Notes |
|---|---|---|---|---|
| 1 | `name` | text | ✅ | Torn handle. Rows with no name are skipped. |
| 2 | `faction_name` | text | | Fill on row 1 only; blanks below inherit it. |
| 3 | `faction_tag` | text | | Ditto. Rendered as `FACTION NAME [TAG]`. |
| 4 | `opponent_faction` | text | | Ditto. |
| 5 | `war_result` | text | | Ditto. Free text — "Win", "Loss". |
| 6 | `war_date` | text | | Ditto. Free text; `YYYY-MM-DD` sorts and reads well. |
| 7 | `respect_gain` | number | | |
| 8 | `respect_loss` | number | | |
| 9 | `total_energy` | number | | |
| 10 | `war_hits` | number | | |
| 11 | `losses` | number | | Attacks lost. |
| 12 | `average_ff` | number | | Average fair-fight multiplier. |
| 13 | `defends_lost` | number | | Torn exports this as "Defends Loss". |
| 14 | `chain_hits` | number | | |
| 15 | `assists` | number | | |
| 16 | `foreign_attacks` | number | | |
| 17 | `retaliations` | number | | |
| 18 | `grade` | text | | Typed by hand. Shown in the gold impact bar, e.g. `A+`, `B-`. |
| 19 | `impact_label` | text | | Typed by hand, e.g. `SOLID CONTRIBUTOR`. |
| 20 | `notes` | text | | Typed by hand. The Coach's Notes panel. Quote it if it contains commas. |

Blank numeric cells are read as `0`. Whitespace is trimmed.

### 5.2 What changed from the original CSV, and why

1. **One table, not two.** The original file had `name,gain,loss,net` in columns
   A–D and a completely separate stats table starting at column F, whose header sat
   in row 1 next to the first data row. Every consumer of that file has to special-case
   it. Now: one header row, one row per member.
2. **Dropped `Total Respect`.** Despite the name it was *net* respect —
   `respect_gain - respect_loss` — and it was also duplicated in column D. The app
   derives it, so it cannot drift out of sync with its own inputs. If a file still
   contains a `Total Respect` column the app checks it against the calculation and
   warns on a mismatch rather than silently disagreeing with the spreadsheet.
3. **Renamed `Defends Loss` → `defends_lost`.** The reference card labelled the same
   number "Defensive Hits" in one panel and "Defends Loss" in another. It is defends
   *lost*; both panels now say so.
4. **`snake_case` headers.** No spaces to quote, no capitalisation to get wrong.
5. **Added the manual columns** `grade`, `impact_label`, `notes` — previously these
   existed on the card with nowhere to come from.
6. **Added war metadata** `faction_name`, `faction_tag`, `opponent_faction`,
   `war_result`, `war_date`, with row-1 inheritance so they are typed once.
7. **Dropped `Hospitalization`.** Not shown anywhere on the card. If it should be,
   add it to `FIELDS`, `DETAIL` and `RANKED` in `metrics.js`.

### 5.3 Header tolerance

`metrics.js` matches headers case-, space- and underscore-insensitively and carries
aliases, so a raw Torn export can be pasted in with its original headers
("Defends Loss", "Average FF", "Total Energy") and still parse. Unrecognised columns
are ignored and reported in the UI rather than causing a failure.

## 6. Derived values

Nothing derived is ever read from the CSV.

- `net_respect` = `respect_gain - respect_loss`.
- **Per-metric rank** — for each numeric metric, members are sorted by value
  descending; ties share a rank. **A value of zero is unranked** and renders as `–`,
  matching the reference card's behaviour for empty stats.
- **Overall rank** (`#9`, and the big numeral) — placing by `net_respect`. Unlike
  per-metric ranks this is always assigned, including for zero or negative totals.
- **Roster size** — the denominator in `9 / 22`, i.e. the number of rows in the file.

## 7. Card design

Fixed 1354×752 layout, dark with `#c8912e` gold. Rendered as DOM and rasterised —
not drawn on a canvas — so the layout stays editable in CSS.

**Header:** faction logo bubble (or initials fallback) · "TORN WAR REPORT CARD" ·
name · `#rank` · `FACTION [TAG]` · a 2×2 meta grid (Opponent, Result, War Date,
Net Respect) · oversized rank numeral.

**Column 1 — War Summary:** the seven headline metrics with value and rank, then the
gold Overall Impact bar carrying `impact_label` and `grade`.

**Column 2 — Detailed Stats:** twelve rows, value + rank, with a legend.

**Column 3 — Performance Breakdown** (radar) and **Coach's Notes**.

### 7.1 Radar scaling

The radar plots each axis by **rank within the faction**, not raw value:
`r = (roster_size - rank + 1) / roster_size`, and `0` for an unranked (zero) stat.

Scaling by raw value was tried first and is wrong for this data: one or two members
typically post several times the faction median, so every other card collapsed to a
dot near the centre. The number printed beside each axis is still the real value.

### 7.2 Class / Level / Role

Removed from the design. They were on the reference card but had no source in the
data. If they come back, they need either three more CSV columns or a Torn API key.

## 8. Export

- `html2canvas` rasterises the card from an off-screen stage (`position:absolute;
  left:-10000px` — `display:none` cannot be measured).
- Two sizes: **1×** = 1354×752 (default; a 22-card ZIP is ~6.7 MB, under Discord's
  10 MB standard limit) and **2×** = 2708×1504 (~10.7 MB for the same roster — the
  app warns when a ZIP goes over 9.5 MB).
- Filenames are `01_LuckyHornet.png`, rank-prefixed so Discord upload order matches
  the leaderboard.
- ZIP uses `STORE` (no compression) — PNGs are already compressed.
- Whole-roster export runs sequentially with a progress readout; 22 cards takes
  roughly 7 seconds.

### 8.1 html2canvas gotchas already hit

- **SVG data URIs need explicit `width`/`height` attributes.** Without them the icons
  have no intrinsic size and are silently dropped from the PNG while looking fine in
  the live preview. Any new icon must keep them.
- Avoid `filter`, `backdrop-filter`, `clip-path` and `mask` in `card.css` — html2canvas
  does not rasterise them.
- Inline `<canvas>` (the radar) copies across fine; the radar is drawn at a fixed 2×
  backing store so it stays sharp at either export size.

## 9. Faction logo

Uploaded in the app, stored as a data URI in `localStorage` under `tbc.factionLogo`,
so it persists per browser. It cannot live in the CSV. Falls back to the faction's
initials in a gold ring. `localStorage` access is wrapped in `try`/`catch` for
private-browsing mode.

## 10. Known gaps / backlog

1. **No CSV round-trip.** An officer who wants to tweak a note must edit the CSV and
   re-upload. An in-app editable notes/grade field that re-exports the CSV would help.
2. **Ties on `net_respect`** get sequential overall ranks, not shared ones.
3. **Very long handles** are stepped down at 11 and 16 characters. Beyond ~22 they
   will still ellipsise.
4. **Nothing is validated as a number range** — a typo of `1000` energy vs `100000`
   just skews the ranks.
5. **No per-war archive.** Each upload is independent; nothing is remembered between
   wars except the logo.
6. **Icons are hand-drawn SVG paths** and coarser than the reference card's
   illustrated set. Swapping them is a one-file change (`icons.js`).
