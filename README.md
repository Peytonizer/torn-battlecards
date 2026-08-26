# Torn Battlecards

Turns a Torn City ranked-war CSV into a battlecard PNG for every member of the
faction, downloadable in bulk as a ZIP for posting to Discord.

Everything runs in the browser. No server, no accounts, no build step, no hosting
cost — and the CSV never leaves the machine it is opened on.

See [`docs/SPEC.md`](docs/SPEC.md) for the full specification.

---

## Using it

1. Open the app.
2. **Load the war CSV.** Drag it onto the drop zone, or click to browse.
   Start from [`data/template.csv`](data/template.csv), or press **Load sample war**
   to see it working with real data.
3. **Upload the faction logo** once (optional). It is remembered in that browser.
4. **Preview** — click any member in the roster list on the left.
5. **Download** — a single card, or the whole roster as a ZIP.

Card size defaults to 1354×752, which keeps a full roster's ZIP under Discord's
10 MB upload limit. Switch to 2× if you want print-quality cards.

## Filling in the CSV

One row per member. Full column reference is in
[the spec](docs/SPEC.md#5-csv-format); the short version:

- **Type once:** `faction_name`, `faction_tag`, `opponent_faction`, `war_result`,
  `war_date` only need filling on the first row — blank cells below inherit them.
- **Paste from the war report:** `respect_gain`, `respect_loss`, `total_energy`,
  `war_hits`, `losses`, `average_ff`, `defends_lost`, `chain_hits`, `assists`,
  `foreign_attacks`, `retaliations`. Blank counts as zero.
- **Write yourself:** `grade` (e.g. `A+`), `impact_label` (e.g. `SOLID CONTRIBUTOR`),
  `notes` (the Coach's Notes paragraph — wrap it in quotes if it contains commas).

Everything else on the card — net respect, every `9 / 22` rank, the overall placing,
the radar shape — is calculated, so there is nothing to keep in sync by hand.

Headers are matched loosely, so a raw Torn export pasted in with its original column
names ("Defends Loss", "Average FF") still parses. Unknown columns are ignored and
reported.

## Running it locally

Because the app is plain HTML and JavaScript, opening `index.html` in a browser
works. The one exception is the **Load sample war** button, which needs to read
`data/sample-war.csv` over HTTP — drag that file onto the drop zone instead, or
serve the folder:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

## Deploying

The repo folder *is* the deployable site — there is nothing to build. Options that
cost nothing and do not put a GitHub username in the URL:

- **Cloudflare Pages** — create a project, choose *Direct Upload*, drag the folder in.
  Lands on `<project-name>.pages.dev`.
- **Netlify Drop** — drag the folder onto <https://app.netlify.com/drop>, then rename
  the site in its settings. Lands on `<site-name>.netlify.app`.

To update the live site, upload the folder again.

## Third-party code

Pinned and committed under `vendor/` so no install step is needed:

| Library | Version | Purpose |
|---|---|---|
| [PapaParse](https://www.papaparse.com/) | 5.4.1 | CSV parsing |
| [html2canvas](https://html2canvas.hertzen.com/) | 1.4.1 | DOM → PNG |
| [JSZip](https://stuk.github.io/jszip/) | 3.10.1 | bulk ZIP |

Fonts are Oswald and Barlow Condensed (SIL Open Font License 1.1), embedded as
base64 in `assets/fonts/fonts.css` so cards render identically offline.
