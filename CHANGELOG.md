# Changelog

## Unreleased

### Added

- **Import a YATA Attacks report directly.** The raw per-attack `.xlsx` export
  (not the "Total Respect" summary sheet) can be dropped onto a second drop
  zone in step 1. The app detects your faction and the opponent, aggregates
  every derivable column itself, and populates the roster/preview exactly as
  an uploaded CSV would. A **Download CSV for the faction leader** button
  exports the result as a war CSV with `grade`/`impact_label`/`notes` left
  blank. Every column — including `assists`, once it was clear that a
  member dying while attacking still counts as an assist, not just a loss —
  was reverse-engineered against a real war's known-good numbers until it
  matched exactly. See `docs/SPEC.md` §11 for the full derivation.
  Adds `vendor/xlsx.mini.min.js` (SheetJS 0.18.5) and `assets/js/attacks-report.js`.

### Removed

- **Faction tag.** The "Your faction" form was name + tag; the card showed
  `FACTION [TAG]`. Now it's just the faction name — no bracketed tag anywhere
  in the UI or on the card. `localStorage` under `tbc.myFaction` now stores
  only `{ name }`; loading an older stored value with a `tag` field just
  ignores it. A CSV with a leftover `faction_tag`/`tag` column still parses
  fine — it's recognised and silently dropped, same as before.

### Changed

- **War metadata moved out of the CSV, into the app.** `faction_name`, `faction_tag`,
  `opponent_faction`, `war_result` and `war_date` are no longer CSV columns — they
  never had a source in Torn's export, and inheriting them down the file still meant
  retyping the same five values on row 1 of every new upload. They are now two small
  forms in the app: "Your faction" (name + tag, persisted in `localStorage` like the
  logo) and "This war" (opponent, result, date, typed fresh per upload; date defaults
  to today). Editing a field re-stamps every loaded member and re-renders the
  preview immediately. A CSV that still has these columns (from before this change,
  or a raw export) parses fine — the columns are recognised and silently dropped.
- `data/template.csv` and `data/sample-war.csv` updated to the 15-column schema.

## v0.1 — 2026-08-26

First working version: CSV in, battlecard PNGs out.

### Added

- Static single-page app (`index.html` + `assets/`), no build step and no backend.
- CSV loading by drag-and-drop or file picker, plus a **Load sample war** button
  backed by real data from the August 2026 war.
- Roster list with live card preview, single-card PNG download, and whole-roster
  ZIP download with a progress readout.
- Faction logo upload, stored in `localStorage` per browser, with a gold initials
  fallback when none is set.
- Export size selector: 1× (1354×752, sized to stay under Discord's 10 MB ZIP
  limit for a full roster) and 2× (2708×1504).

### CSV schema

- Replaced the two-tables-in-one-file layout with a single header row and one row
  per member.
- Dropped `Total Respect` — it was net respect and duplicated in another column; it
  is now derived from `respect_gain - respect_loss`. A file that still supplies it is
  cross-checked and a mismatch is reported rather than silently ignored.
- Renamed `Defends Loss` to `defends_lost`; the reference card called the same
  number "Defensive Hits" in one panel and "Defends Loss" in another.
- Added `grade`, `impact_label` and `notes` — the card displayed all three with no
  source in the data.
- Added `faction_name`, `faction_tag`, `opponent_faction`, `war_result`, `war_date`,
  which inherit down the file so they are typed once on row 1.
- Dropped `Hospitalization` — not displayed on the card.
- Header matching is case/space/underscore insensitive with aliases, so a raw Torn
  export still parses with its original column names.

### Card design decisions

- Removed Class, Level and Role from the header: they appeared on the reference card
  but had no source in the CSV and no way to derive them. The freed space now shows
  the war metadata (opponent, result, date, net respect).
- Faction tag corrected from `SB` to `Silver Brigade`.
- Radar axes are plotted by **rank within the faction**, not raw value. Raw-value
  scaling was tried first and made every card except the top one or two collapse to a
  dot, because respect and hit counts are so top-heavy.
- A zero stat is deliberately unranked and shows `–`, matching the reference card.
- Icons are inline SVG data URIs and must carry explicit `width`/`height` — without
  them html2canvas gives them zero intrinsic size and silently drops them from the
  exported PNG while the on-screen preview still looks correct.
- Cards are built as DOM and rasterised rather than drawn on a canvas, so the layout
  stays editable in CSS.

### Chosen dependencies

- PapaParse over hand-rolled splitting: quoted fields containing commas are normal in
  the `notes` column.
- html2canvas over `html-to-image`: more predictable font handling, at the cost of
  avoiding modern CSS (`filter`, `clip-path`, `mask`) in `card.css`.
- Fonts base64-embedded rather than linked from Google Fonts, so the cards render
  identically offline and never depend on a third-party host at export time.
