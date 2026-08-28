# Torn Battlecards — Specification

Status: **v0.2 working end-to-end.** Loads a war CSV (by hand or generated from a
YATA Attacks report), previews a card per member, exports single PNGs or a ZIP of
all cards.

---

## 1. Purpose

After a Torn City ranked war, a faction officer exports a CSV of member war
efforts. This app turns that CSV into one "battlecard" PNG per member, downloadable
in bulk as a ZIP for posting to Discord.

Non-goals (deliberately out of scope for now):

- No Torn API integration. The CSV is the only input.
- No accounts, no database, no server.
- No AI/LLM at runtime — the coach's notes are typed by the officer. `grade` is a
  deterministic formula (§11.1), auto-filled when generated from an Attacks report
  and freely hand-editable afterward; a CSV built by hand still needs it typed in.

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
- **GitHub Pages** — a personal repo publishes to `<username>.github.io/<repo>`, which puts the GitHub username in the URL, but a custom domain (via a `CNAME` file plus DNS) avoids that.

Chosen approach: **GitHub Pages**, deployed automatically on every push to `master`
by `.github/workflows/pages.yml`, served from a custom domain
(`battlecards.noradz.io`). Deploying is a `git push`; there is nothing to build.

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
│       ├── attacks-report.js  # aggregates a raw YATA Attacks report into member rows (§11)
│       ├── card.js            # builds one card's DOM + draws the radar canvas
│       ├── export.js          # html2canvas → PNG, JSZip → bulk ZIP
│       └── app.js             # UI wiring
├── vendor/                    # pinned third-party libs, committed on purpose
│   ├── html2canvas.min.js     # 1.4.1
│   ├── jszip.min.js           # 3.10.1
│   ├── papaparse.min.js       # 5.4.1
│   └── xlsx.mini.min.js       # 0.18.5 — reads the YATA Attacks report (§11)
├── data/
│   ├── template.csv           # blank header row for officers to fill in
│   └── sample-war.csv         # August 2026 war data (names anonymized), example grades/notes
├── docs/
│   ├── SPEC.md                # this file
│   └── reference/             # total_respect.csv and the raw Attacks report (names anonymized)
├── README.md
└── CHANGELOG.md
```

Vendored libraries are committed rather than installed. That is the whole point of
"no build step": the deployed folder is the repo folder.

## 5. CSV format

One header row, one row per member, one table. (The original export had two
different tables side by side in one file, with the second table's header on row 1
— that is what made it awkward to handle.) War metadata — your faction, the
opponent, the result, the date — is **not** in the CSV at all; see §5.4.

### 5.1 Columns

| # | Column | Type | Required | Notes |
|---|---|---|---|---|
| 1 | `name` | text | ✅ | Torn handle. Rows with no name are skipped. |
| 2 | `respect_gain` | number | | |
| 3 | `respect_loss` | number | | |
| 4 | `total_energy` | number | | |
| 5 | `war_hits` | number | | |
| 6 | `losses` | number | | Attacks lost. |
| 7 | `average_ff` | number | | Average fair-fight multiplier. |
| 8 | `defends_lost` | number | | Torn exports this as "Defends Loss". |
| 9 | `chain_hits` | number | | |
| 10 | `assists` | number | | |
| 11 | `foreign_attacks` | number | | |
| 12 | `retaliations` | number | | |
| 13 | `defensive_hospitalizations` | number | | Only produced by the Attacks-report import (§11) — no manual "paste from the war report" source. Deliberately not shown on the card; see §5.2 point 8. |
| 14 | `grade` | text | | Auto-filled by the Attacks-report import (§11.1), e.g. `A+`, `B-`. Freely hand-editable afterward — a manually built CSV still needs it typed in. Shown in the gold impact bar. |
| 15 | `impact_label` | text | | Typed by hand, e.g. `SOLID CONTRIBUTOR`. |
| 16 | `notes` | text | | Typed by hand. The Coach's Notes panel. Quote it if it contains commas. |

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
6. **Moved war metadata out of the CSV entirely** (§5.4) — it never had a source in
   Torn's export anyway; it was typed by the officer, once per row-1, and inherited
   down the file. That inheritance still repeated the same five values across every
   row of the underlying spreadsheet and had to be re-typed for every new upload.
   It is now typed once per session, in the app.
7. **Dropped `Hospitalization`.** Not shown anywhere on the card. If it should be,
   add it to `FIELDS`, `DETAIL` and `RANKED` in `metrics.js`.
8. **Added `defensive_hospitalizations`.** Distinct from the dropped raw
   `Hospitalization` column above — this is a *derived* stat, only ever produced
   by the Attacks-report import (§11): a member hospitalizing their own
   faction-mate (e.g. "mercy-hosping" an inactive member so the enemy can't keep
   hitting them for free), credited to the attacker. It's in `FIELDS` (so it
   round-trips through the CSV) but deliberately absent from
   `HEADLINE`/`DETAIL`/`RANKED` — CSV-only, never shown on the card.

### 5.3 Header tolerance

`metrics.js` matches headers case-, space- and underscore-insensitively and carries
aliases, so a raw Torn export can be pasted in with its original headers
("Defends Loss", "Average FF", "Total Energy") and still parse. Unrecognised columns
are ignored and reported in the UI rather than causing a failure. A CSV from before
§5.4 (or a raw export) that still has `faction_name`, `faction_tag`,
`opponent_faction`, `war_result` or `war_date` columns parses fine — those columns
are recognised and silently dropped rather than flagged as unknown, since the app
fields below now win regardless.

### 5.4 War metadata lives in the app, not the CSV

Faction name, opponent, result and date describe the war, not the member, so
one CSV row's worth of them is one too many: every row repeated the same four
values, and inheriting them down the file (the old approach) still meant retyping
them on row 1 of every new upload. They are now two small forms in the app itself:

- **"Your faction"** (name only) — persisted in `localStorage` alongside the logo,
  since it rarely changes between wars.
- **"This war"** (opponent, result, date) — typed fresh each upload; the date
  defaults to today.

Editing any of these fields stamps the value onto every loaded member immediately
and re-renders the live preview — no re-upload needed to fix a typo.

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
name · `#rank` · faction name · a 2×2 meta grid (Opponent, Result, War Date,
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

Faction name persists the same way, under `tbc.myFaction` (see §5.4) — also
wrapped in `try`/`catch`, also gone in private browsing, in which case the
officer just retypes it for that session.

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

## 11. Importing a YATA Attacks report

An officer doesn't have to build the war CSV by hand. YATA's **Attacks report**
export (`Attacks_report_<warId>_attacks.xlsx`) is a raw log — one row per
individual attack, not one row per member — and the app can turn that
directly into a war CSV. This is a different YATA export from the "Total
Respect" summary sheet; look for one row per attack with columns `tId`,
`timestamp_started`, `attacker_faction`, `attacker_factionname`,
`attacker_id`, `attacker_name`, `defender_faction`, `defender_factionname`,
`defender_id`, `defender_name`, `result`, `respect_gain`, `chain`,
`fair_fight`, `war`, `retaliation`, `group_attack`, `overseas`,
`chain_bonus`, `warlord_bonus`, `code`.

Step 1 of the app is split into two sub-steps for exactly this two-stage
workflow: Step A takes the raw Attacks report and produces the CSV; Step B is
where the finished, leader-edited CSV gets loaded to actually build cards.
Drop the file on Step A's dropzone. `attacks-report.js` parses it with the
vendored SheetJS build (`xlsx.mini.min.js`), detects "your faction" (whoever
attacks most in the file) and "the opponent" (whoever your faction's attacks
land on most), and aggregates it into the same member records the CSV path
produces — so the roster, live preview, and PNG export all work immediately,
as a quick sanity check, exactly as if a CSV had been uploaded. The real next
step is the **Download CSV for the faction leader** button: it exports that
roster as a war CSV, sorted by `respect_gain` descending so the top performers
are easy to find, with `grade` pre-filled with a computed suggestion (§11.1)
and `impact_label`/`notes` left blank for the leader to fill in before it
comes back through Step B.

Every formula below was reverse-engineered empirically: aggregate a real
war's Attacks report every plausible way, diff the result against that war's
known-correct per-member numbers (preserved as `data/sample-war.csv`), and
keep only the formula that matches every member exactly. Torn's actual
server-side formulas aren't published, so this is inference from one war's
data, not a documented spec — if a future war's export doesn't reconcile,
that's the first thing to re-derive.

| Column | Formula |
|---|---|
| `war_hits` | Count of the member's attacks against the opponent faction with `result` in `Attacked` / `Hospitalized` / `Mugged`. |
| `losses` | Count of the member's attacks, against any faction, with `result = Lost`. |
| `defends_lost` | Count of attacks *against* the member, by any other faction, with `result` in the win set **and non-zero `respect_gain`**. A `respect_gain` of exactly 0 was only ever seen on rows with no recorded attacker identity — an incomplete log entry — and Torn's own war page evidently doesn't tally those as a loss either. |
| `chain_hits` | Count of the member's winning attacks where `chain_bonus > 1`. |
| `foreign_attacks` | Count of the member's winning attacks where `overseas > 1`. |
| `retaliations` | Count of the member's winning attacks where `retaliation > 1`. |
| `respect_loss` | Sum of `respect_gain` on the same rows counted for `defends_lost` (an attacker's gain is the defender's loss). |
| `total_energy` | `25 ×` the member's total attack row count, against any faction, **including `result = Assist` rows** — every attack attempt costs energy, win or lose. |
| `average_ff` | Mean of `fair_fight` across the member's total attack row count — again, any faction, any result. Restricting this to war-opponent wins only (the obvious first guess) does not reproduce the real numbers; the full population does, exactly. |
| `respect_gain` | Sum of `respect_gain` on winning attacks against the opponent, **except** chain-milestone rows (the 10th/25th/50th/100th/250th/500th hit of the chain), whose `chain_bonus` — and with it `respect_gain` — spikes to the milestone multiplier itself (e.g. `160.0` for the 250-chain bonus) rather than the attacker's real personal respect for that hit. `chain_bonus > 5` unambiguously flags one (every ordinary hit tops out around 1.7–2.0). Each flagged row is credited at the attacker's own average respect-per-normal-hit instead of its face value. |
| `assists` | Count of the member's attacks, against any faction, with `result = Assist` **or** `result = Lost`. Counting only `Assist` rows undercounts by roughly half — dying to a target you were attacking still credits an assist (you contributed damage even without landing the finishing hit), so a `Lost` row counts toward both `losses` and `assists` at once, not one or the other. |
| `defensive_hospitalizations` | Count of the member's attacks against a fellow faction member (`attacker_faction === defender_faction === myFaction`) with `result = Hospitalized`, credited to the attacker. Unlike every other column here, this isn't reverse-engineered against a known-correct number — Torn's own war page never reported it — it's a straightforward count. Not part of `HEADLINE`/`DETAIL`/`RANKED`, so it's exported to the CSV but never shown on the card. |

`impact_label` and `notes` have no source in this file and are left blank,
same as an uploaded CSV missing those columns. `grade` is computed — see
below.

### 11.1 Auto-computed grade

Only on this Attacks-report → CSV path (never on a manually built or
re-uploaded CSV — see `normalise()` in `metrics.js`, which just keeps
whatever text is already in `grade`, so a leader's hand-edited grade
survives coming back through Step B unchanged). `computeGrades()` in
`metrics.js` blends three signals into one composite z-score per member,
each computed against that roster's own population mean/standard
deviation and clamped to `±2` (so a metric with almost no spread across
the roster — `defensive_hospitalizations` is `0` for most members most
wars — can't let one outlier swamp the composite):

| Signal | Weight | Why |
|---|---|---|
| `net_respect` | 0.70 | The primary signal. |
| `average_ff` | 0.15 | Already a per-attack mean, not a raw count — reflects target quality/effort independently of attack volume. |
| `defensive_hospitalizations` | 0.15 | Mercy-hosping an inactive faction-mate to protect them from the enemy. |

If a metric has zero variance across the roster (every member tied, or a
1-member roster), its z-score is `0` for everyone rather than dividing by
zero. The composite is banded into the same ten grades every sample/
reference CSV already uses — no `S`, no `F`:

| Band | Grade |
|---|---|
| `z ≥ 1.5` | A+ |
| `1.0 ≤ z < 1.5` | A |
| `0.5 ≤ z < 1.0` | A- |
| `0.15 ≤ z < 0.5` | B+ |
| `-0.15 ≤ z < 0.15` | B |
| `-0.5 ≤ z < -0.15` | B- |
| `-1.0 ≤ z < -0.5` | C+ |
| `-1.5 ≤ z < -1.0` | C |
| `-2.0 ≤ z < -1.5` | C- |
| `z < -2.0` | D |

Most members land in the B range, with A and C-and-below as the bell-curve
tails.
