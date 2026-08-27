/* attacks-report.js — turns a YATA "Attacks report" export (one row per attack,
   not per member) into the same member records metrics.js works with.

   The columns this reads (tId, timestamp_started, attacker_faction,
   attacker_factionname, attacker_id, attacker_name, defender_faction,
   defender_factionname, defender_id, defender_name, result, respect_gain,
   chain, fair_fight, war, retaliation, group_attack, overseas, chain_bonus,
   warlord_bonus, code) are YATA's, not Torn's own export — this is a raw
   attack-by-attack log, one file per war.

   Every formula below was reverse-engineered by aggregating a real war's
   Attacks report and diffing the result against that war's known-correct
   per-member CSV (docs/reference/total_respect-original.csv, reshaped into
   data/sample-war.csv) until every member's numbers matched exactly. See
   docs/SPEC.md §11 for the full writeup of what matched and why. */

var TBC = window.TBC || (window.TBC = {});

(function () {
  var WIN = { Attacked: 1, Hospitalized: 1, Mugged: 1 };
  var ENERGY_PER_ATTACK = 25;

  /* Torn's chain-milestone bonus (10th/25th/50th/100th/250th/500th hit of the
     chain) reports its huge multiplier straight into that one row's
     respect_gain, which is nothing like the attacker's real personal respect
     for that hit — every other row's chain_bonus tops out around 1.7–2.0, so
     >5 unambiguously flags a milestone row. Summing raw would wildly overstate
     respect_gain for whoever happened to land the milestone hit. */
  var MILESTONE_CHAIN_BONUS = 5;

  function num(v) {
    var n = typeof v === 'number' ? v : parseFloat(v);
    return isFinite(n) ? n : 0;
  }

  function round2(n) { return Math.round(n * 100) / 100; }

  /* Guess "your faction" (whoever attacks the most in the report) and "the
     opponent" (whoever your faction's attacks land on the most). Both are
     just defaults — the caller can override either before aggregating. */
  function detectFactions(rows) {
    var attackerCounts = {};
    rows.forEach(function (r) {
      var f = r.attacker_factionname;
      if (f) attackerCounts[f] = (attackerCounts[f] || 0) + 1;
    });
    var myFaction = Object.keys(attackerCounts).sort(function (a, b) {
      return attackerCounts[b] - attackerCounts[a];
    })[0] || '';

    var oppCounts = {};
    rows.forEach(function (r) {
      if (r.attacker_factionname === myFaction && r.defender_factionname &&
          r.defender_factionname !== myFaction && r.defender_factionname !== '-') {
        oppCounts[r.defender_factionname] = (oppCounts[r.defender_factionname] || 0) + 1;
      }
    });
    var oppFaction = Object.keys(oppCounts).sort(function (a, b) {
      return oppCounts[b] - oppCounts[a];
    })[0] || '';

    return {
      myFaction: myFaction, oppFaction: oppFaction,
      attackerCounts: attackerCounts, oppCounts: oppCounts
    };
  }

  /* Aggregate the raw attack rows into one record per member, in the same
     shape TBC.metrics expects (before ranking — call addRanks on the result). */
  function aggregate(rows, myFaction, oppFaction) {
    var byKey = {};

    function ensure(name) {
      var key = name.toLowerCase();
      if (!byKey[key]) {
        byKey[key] = {
          name: name,
          respect_gain: 0, respect_loss: 0, total_energy: 0,
          war_hits: 0, losses: 0, average_ff: 0, defends_lost: 0,
          chain_hits: 0, assists: 0, foreign_attacks: 0, retaliations: 0,
          grade: '', impact_label: '', notes: '',
          _ffSum: 0, _ffN: 0, _normalGain: [], _milestoneHits: 0
        };
      }
      return byKey[key];
    }

    rows.forEach(function (row) {
      var aFac = row.attacker_factionname, dFac = row.defender_factionname;
      var aName = row.attacker_name, dName = row.defender_name;
      var result = row.result;
      var respect = num(row.respect_gain);
      var ff = num(row.fair_fight);
      var chainBonus = num(row.chain_bonus);
      var overseas = num(row.overseas);
      var retaliation = num(row.retaliation);
      var isWin = !!WIN[result];

      if (aFac === myFaction && aName) {
        var m = ensure(aName);
        // Every attack attempt costs energy, win or lose — including the
        // 'Assist' result rows. Verified exactly against the reference war.
        m.total_energy += ENERGY_PER_ATTACK;
        if (ff) { m._ffSum += ff; m._ffN++; }

        if (result === 'Lost') {
          m.losses++;
          // Dying to a target you were attacking still counts as an assist —
          // you contributed damage even though you didn't land the finishing
          // hit. Not mutually exclusive with losses: the same row counts
          // toward both.
          m.assists++;
        } else if (result === 'Assist') {
          m.assists++;
        }

        if (isWin) {
          if (overseas > 1) m.foreign_attacks++;
          if (retaliation > 1) m.retaliations++;
          if (chainBonus > 1) m.chain_hits++;
          if (dFac === oppFaction) {
            m.war_hits++;
            if (chainBonus > MILESTONE_CHAIN_BONUS) m._milestoneHits++;
            else m._normalGain.push(respect);
          }
        }
      }

      if (dFac === myFaction && aFac !== myFaction && dName) {
        var d = ensure(dName);
        // A defend that netted the attacker zero respect (seen only on rows
        // with no recorded attacker identity — an incomplete log entry)
        // evidently isn't tallied as a loss on Torn's own war page either.
        if (isWin && respect > 0) {
          d.defends_lost++;
          d.respect_loss += respect;
        }
      }
    });

    return Object.keys(byKey).map(function (k) {
      var m = byKey[k];
      var normalSum = m._normalGain.reduce(function (a, b) { return a + b; }, 0);
      var normalAvg = m._normalGain.length ? normalSum / m._normalGain.length : 0;
      m.respect_gain = round2(normalSum + normalAvg * m._milestoneHits);
      m.average_ff = m._ffN ? round2(m._ffSum / m._ffN) : 0;
      m.respect_loss = round2(m.respect_loss);
      m.net_respect = round2(m.respect_gain - m.respect_loss);
      delete m._ffSum; delete m._ffN; delete m._normalGain; delete m._milestoneHits;
      return m;
    });
  }

  /* Read a File (the .xlsx) into an array of row objects via SheetJS. */
  function readWorkbook(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onerror = function () { reject(new Error('Could not read that file.')); };
      reader.onload = function () {
        try {
          var wb = XLSX.read(new Uint8Array(reader.result), { type: 'array' });
          var sheet = wb.Sheets[wb.SheetNames[0]];
          var rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
          resolve(rows);
        } catch (e) {
          reject(new Error('Could not parse that spreadsheet: ' + e.message));
        }
      };
      reader.readAsArrayBuffer(file);
    });
  }

  TBC.attacksReport = {
    detectFactions: detectFactions,
    aggregate: aggregate,
    readWorkbook: readWorkbook,
    ENERGY_PER_ATTACK: ENERGY_PER_ATTACK
  };
})();
