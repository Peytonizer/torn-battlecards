/* metrics.js — the data contract.
   Defines the CSV schema, normalises a parsed CSV into member records, derives
   everything the card needs that is NOT typed by hand (net respect, per-metric
   ranks, overall rank), and formats numbers for display. */

var TBC = window.TBC || (window.TBC = {});

(function () {
  /* ---------------------------------------------------------------- schema */

  /* Every field the app understands. `aliases` let a raw Torn war-report export
     be pasted in with its original headers — matching is case/space/underscore
     insensitive, so "Defends Loss", "defends loss" and "defends_lost" all land
     in the same place. */
  var FIELDS = [
    { key: 'name',             type: 'text', required: true,  aliases: ['player', 'member', 'username'] },
    { key: 'respect_gain',     type: 'num',  aliases: ['respect gained'] },
    { key: 'respect_loss',     type: 'num',  aliases: ['respect lost'] },
    { key: 'total_energy',     type: 'num',  aliases: ['energy'] },
    { key: 'war_hits',         type: 'num',  aliases: ['hits'] },
    { key: 'losses',           type: 'num',  aliases: ['attacks lost'] },
    { key: 'average_ff',       type: 'num',  aliases: ['average fair fight', 'avg ff', 'ff'] },
    { key: 'defends_lost',     type: 'num',  aliases: ['defends loss', 'defensive hits', 'defends'] },
    { key: 'chain_hits',       type: 'num',  aliases: [] },
    { key: 'assists',          type: 'num',  aliases: [] },
    { key: 'foreign_attacks',  type: 'num',  aliases: ['foreign attack'] },
    { key: 'retaliations',     type: 'num',  aliases: ['retals', 'retaliation'] },
    // Faction-mate hospitalized their own teammate (e.g. "mercy-hosping" an
    // inactive member so the enemy can't keep hitting them free). CSV-only:
    // deliberately absent from HEADLINE/DETAIL/RANKED, so it never renders
    // on the card or feeds the radar/rank calculations.
    { key: 'defensive_hospitalizations', type: 'num', aliases: [] },
    { key: 'grade',            type: 'text', aliases: ['rating', 'overall grade'] },
    { key: 'impact_label',     type: 'text', aliases: ['impact', 'overall impact'] },
    { key: 'notes',            type: 'text', aliases: ["coach's notes", 'coach notes', 'comments'] }
  ];

  /* The seven metrics that appear in the War Summary panel and on the radar. */
  var HEADLINE = [
    { key: 'respect_gain',    label: 'Respect Gain' },
    { key: 'war_hits',        label: 'War Hits' },
    { key: 'defends_lost',    label: 'Defends Lost' },
    { key: 'chain_hits',      label: 'Chain Hits' },
    { key: 'assists',         label: 'Assists' },
    { key: 'foreign_attacks', label: 'Foreign Attacks' },
    { key: 'retaliations',    label: 'Retaliations' }
  ];

  /* The twelve rows of the Detailed Stats panel. `net_respect` is derived. */
  var DETAIL = [
    { key: 'respect_gain',    label: 'Respect Gain' },
    { key: 'respect_loss',    label: 'Respect Loss' },
    { key: 'net_respect',     label: 'Net Respect' },
    { key: 'total_energy',    label: 'Total Energy' },
    { key: 'losses',          label: 'Losses' },
    { key: 'average_ff',      label: 'Average FF' },
    { key: 'defends_lost',    label: 'Defends Lost' },
    { key: 'chain_hits',      label: 'Chain Hits' },
    { key: 'war_hits',        label: 'War Hits' },
    { key: 'assists',         label: 'Assists' },
    { key: 'foreign_attacks', label: 'Foreign Attacks' },
    { key: 'retaliations',    label: 'Retaliations' }
  ];

  /* Every numeric key that gets a rank, including the derived one. */
  var RANKED = ['net_respect', 'total_energy', 'respect_gain', 'losses', 'average_ff',
    'defends_lost', 'respect_loss', 'chain_hits', 'war_hits', 'assists',
    'foreign_attacks', 'retaliations'];

  /* Values shown to 2 decimal places; everything else is rendered as a whole number. */
  var DECIMAL_KEYS = { respect_gain: 1, respect_loss: 1, net_respect: 1, average_ff: 1 };

  /* ------------------------------------------------------------- utilities */

  function slug(s) {
    return String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  }

  function toNumber(v) {
    if (v == null || v === '') return 0;
    var n = parseFloat(String(v).replace(/[, ]/g, ''));
    return isFinite(n) ? n : 0;
  }

  /* Build a lookup from every acceptable header spelling to its canonical key. */
  var HEADER_MAP = (function () {
    var m = {};
    FIELDS.forEach(function (f) {
      m[slug(f.key)] = f.key;
      (f.aliases || []).forEach(function (a) { m[slug(a)] = f.key; });
    });
    // "Total Respect" in a raw Torn export is actually gain minus loss, i.e. net.
    m['total_respect'] = 'net_respect_input';
    m['hospitalization'] = null;   // present in raw exports, not shown on the card
    m['hospitalisation'] = null;
    // War metadata moved into the app itself (see app.js) so it is typed once per
    // upload instead of repeated on every row. A CSV from before that change, or a
    // raw export still carrying these, is recognised and silently dropped rather
    // than reported as an unknown column.
    ['faction_name', 'faction', 'faction_tag', 'tag', 'opponent_faction', 'opponent',
      'enemy_faction', 'war_result', 'result', 'war_date', 'date'].forEach(function (k) {
      m[k] = null;
    });
    return m;
  })();

  /* --------------------------------------------------------- normalisation */

  /* Turn Papa Parse output (array of objects keyed by raw header) into member
     records. Returns { members, warnings, unknownColumns }. */
  function normalise(rows) {
    var warnings = [];
    var unknown = [];
    var members = [];

    if (!rows.length) {
      warnings.push('The file has no data rows.');
      return { members: members, warnings: warnings, unknownColumns: unknown };
    }

    Object.keys(rows[0]).forEach(function (h) {
      var canon = HEADER_MAP[slug(h)];
      if (canon === undefined && slug(h)) unknown.push(h);
    });

    rows.forEach(function (row, i) {
      var rec = {};
      Object.keys(row).forEach(function (h) {
        var canon = HEADER_MAP[slug(h)];
        if (!canon) return;
        rec[canon] = typeof row[h] === 'string' ? row[h].trim() : row[h];
      });

      if (!rec.name) return;   // skip blank/padding rows silently

      FIELDS.forEach(function (f) {
        var v = rec[f.key];
        if (f.type === 'num') rec[f.key] = toNumber(v);
        else if (rec[f.key] == null) rec[f.key] = '';
      });

      rec.net_respect = rec.respect_gain - rec.respect_loss;

      // If a raw export supplied its own "Total Respect", check it agrees.
      if (rec.net_respect_input !== undefined && rec.net_respect_input !== '') {
        var supplied = toNumber(rec.net_respect_input);
        if (Math.abs(supplied - rec.net_respect) > 0.05) {
          warnings.push('Row ' + (i + 2) + ' (' + rec.name + '): supplied total respect ' +
            supplied.toFixed(2) + ' does not match respect_gain - respect_loss (' +
            rec.net_respect.toFixed(2) + '). Using the calculated value.');
        }
        delete rec.net_respect_input;
      }

      if (!rec.grade) warnings.push('Row ' + (i + 2) + ' (' + rec.name + '): no grade — the impact box will show a dash.');
      if (!rec.notes) warnings.push('Row ' + (i + 2) + ' (' + rec.name + '): no notes — the Coach\'s Notes panel will be empty.');

      members.push(rec);
    });

    if (!members.length) warnings.unshift('No rows had a name — check that the file has a "name" column.');

    return { members: members, warnings: warnings, unknownColumns: unknown };
  }

  /* ----------------------------------------------------------- derivations */

  /* Rank every member on every numeric metric, highest value first. Ties share a
     rank. A value of zero is deliberately unranked and renders as an em dash,
     which is how the original card handles empty stats. */
  function addRanks(members) {
    var n = members.length;
    RANKED.forEach(function (key) {
      var sorted = members.slice().sort(function (a, b) { return b[key] - a[key]; });
      var lastVal = null, lastRank = 0;
      sorted.forEach(function (m, i) {
        m.ranks = m.ranks || {};
        if (!m[key]) { m.ranks[key] = null; return; }
        var rank = (m[key] === lastVal) ? lastRank : i + 1;
        lastVal = m[key]; lastRank = rank;
        m.ranks[key] = rank;
      });
    });
    // Overall placing is by net respect, and unlike the per-metric ranks it is
    // always assigned — even for a member who finished on zero or negative.
    var byNet = members.slice().sort(function (a, b) { return b.net_respect - a.net_respect; });
    byNet.forEach(function (m, i) { m.overall_rank = i + 1; });
    members.forEach(function (m) { m.roster_size = n; });
    return members;
  }

  /* ------------------------------------------------------------ formatting */

  function formatValue(key, value) {
    if (DECIMAL_KEYS[key]) return (Math.round(value * 100) / 100).toFixed(2);
    return String(Math.round(value));
  }

  function formatRank(rank, size) {
    return rank ? rank + ' / ' + size : '–';
  }

  /* Numeric fields get 2 decimals if they're ever fractional, otherwise a
     plain integer — matches how the CSV format's own examples look. */
  var CSV_DECIMAL_KEYS = { respect_gain: 1, respect_loss: 1, average_ff: 1 };

  /* Members back to CSV text, in the same column order as data/template.csv —
     the shape officers fill by hand and the app itself round-trips. Sorted by
     respect gain, highest first, so a faction leader skimming the file to
     hand out grades sees the top performers up top rather than in upload order. */
  function toCsv(members) {
    var rows = members.slice().sort(function (a, b) {
      return (b.respect_gain || 0) - (a.respect_gain || 0);
    }).map(function (m) {
      var row = {};
      FIELDS.forEach(function (f) {
        var v = m[f.key];
        if (f.type === 'num') {
          v = CSV_DECIMAL_KEYS[f.key] ? round2(v || 0) : Math.round(v || 0);
        } else {
          v = v || '';
        }
        row[f.key] = v;
      });
      return row;
    });
    return Papa.unparse({ fields: FIELDS.map(function (f) { return f.key; }), data: rows });
  }

  function round2(n) { return Math.round(n * 100) / 100; }

  TBC.metrics = {
    FIELDS: FIELDS,
    HEADLINE: HEADLINE,
    DETAIL: DETAIL,
    columnNames: FIELDS.map(function (f) { return f.key; }),
    normalise: normalise,
    addRanks: addRanks,
    formatValue: formatValue,
    formatRank: formatRank,
    toCsv: toCsv,
    slug: slug
  };
})();
