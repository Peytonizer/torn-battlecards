/* app.js — UI wiring: load a CSV, list the roster, preview a card, export PNGs. */

(function () {
  var M = TBC.metrics;

  var state = { members: [], active: 0, logo: null, attackRows: null };

  var $ = function (id) { return document.getElementById(id); };
  var dropzone = $('dropzone'), fileInput = $('fileInput'), fileLabel = $('fileLabel');
  var messages = $('messages'), roster = $('roster'), outputPanel = $('outputPanel');
  var previewFrame = $('previewFrame'), previewScaler = $('previewScaler'), progress = $('progress');

  /* ------------------------------------------------------------- messages */

  function clearMessages() { messages.innerHTML = ''; }

  function say(text, isError) {
    var d = document.createElement('div');
    d.className = 'msg' + (isError ? ' error' : '');
    d.textContent = text;
    messages.appendChild(d);
  }

  /* ----------------------------------------------------------- logo (local) */

  var LOGO_KEY = 'tbc.factionLogo';

  function loadStoredLogo() {
    try { state.logo = localStorage.getItem(LOGO_KEY) || null; } catch (e) { state.logo = null; }
  }

  function storeLogo(dataUrl) {
    state.logo = dataUrl;
    try {
      if (dataUrl) localStorage.setItem(LOGO_KEY, dataUrl);
      else localStorage.removeItem(LOGO_KEY);
    } catch (e) { /* private browsing — the logo just won't persist */ }
  }

  $('logoInput').addEventListener('change', function (e) {
    var f = e.target.files && e.target.files[0];
    if (!f) return;
    var reader = new FileReader();
    reader.onload = function () { storeLogo(reader.result); renderPreview(); };
    reader.readAsDataURL(f);
  });

  $('clearLogo').addEventListener('click', function () {
    storeLogo(null);
    $('logoInput').value = '';
    renderPreview();
  });

  /* --------------------------------------------------------- war details */
  /* Faction name/tag/opponent/result/date used to be CSV columns, repeated on
     every row and only typed once thanks to row-1 inheritance. They are war
     metadata, not per-member data, so they live here instead — typed once per
     upload and stamped onto every member record. */

  var FACTION_KEY = 'tbc.myFaction';
  var warFieldIds = ['myFactionName', 'myFactionTag', 'opponentFaction', 'warResult', 'warDate'];

  function loadStoredFaction() {
    try {
      var f = JSON.parse(localStorage.getItem(FACTION_KEY) || 'null');
      if (f) { $('myFactionName').value = f.name || ''; $('myFactionTag').value = f.tag || ''; }
    } catch (e) { /* private browsing — fields just start blank */ }
  }

  function storeFaction() {
    try {
      localStorage.setItem(FACTION_KEY, JSON.stringify({
        name: $('myFactionName').value.trim(), tag: $('myFactionTag').value.trim()
      }));
    } catch (e) { /* private browsing — just won't persist */ }
  }

  /* Stamp the current form values onto every loaded member. Safe to call before
     any CSV is loaded (state.members is empty) or live, after editing a field. */
  function applyWarMeta() {
    var meta = {
      faction_name: $('myFactionName').value.trim(),
      faction_tag: $('myFactionTag').value.trim(),
      opponent_faction: $('opponentFaction').value.trim(),
      war_result: $('warResult').value,
      war_date: $('warDate').value
    };
    state.members.forEach(function (m) {
      m.faction_name = meta.faction_name;
      m.faction_tag = meta.faction_tag;
      m.opponent_faction = meta.opponent_faction;
      m.war_result = meta.war_result;
      m.war_date = meta.war_date;
    });
  }

  warFieldIds.forEach(function (id) {
    ['input', 'change'].forEach(function (ev) {
      $(id).addEventListener(ev, function () {
        storeFaction();
        applyWarMeta();
        if (state.members.length) renderPreview();
      });
    });
  });

  /* ------------------------------------------------------------ CSV intake */

  function handleCsvText(text, label) {
    clearMessages();
    var parsed = Papa.parse(text.trim(), { header: true, skipEmptyLines: 'greedy' });

    if (parsed.errors && parsed.errors.length) {
      parsed.errors.slice(0, 3).forEach(function (err) {
        say('CSV parse issue on row ' + ((err.row || 0) + 2) + ': ' + err.message, true);
      });
    }

    var result = M.normalise(parsed.data);
    if (!result.members.length) {
      result.warnings.forEach(function (w) { say(w, true); });
      outputPanel.hidden = true;
      return;
    }

    state.members = M.addRanks(result.members);
    state.active = 0;
    applyWarMeta();

    fileLabel.textContent = label + ' — ' + state.members.length + ' members';

    if (result.unknownColumns.length) {
      say('Ignored unrecognised column(s): ' + result.unknownColumns.join(', '));
    }
    // Keep the noise down: show the first handful of per-row warnings only.
    result.warnings.slice(0, 6).forEach(function (w) { say(w); });
    if (result.warnings.length > 6) say('…and ' + (result.warnings.length - 6) + ' more warnings.');

    outputPanel.hidden = false;
    renderRoster();
    renderPreview();
  }

  function readFile(file) {
    var reader = new FileReader();
    reader.onload = function () { handleCsvText(String(reader.result), file.name); };
    reader.onerror = function () { say('Could not read that file.', true); };
    reader.readAsText(file);
  }

  dropzone.addEventListener('click', function () { fileInput.click(); });
  fileInput.addEventListener('change', function (e) {
    if (e.target.files && e.target.files[0]) readFile(e.target.files[0]);
  });
  ['dragenter', 'dragover'].forEach(function (ev) {
    dropzone.addEventListener(ev, function (e) { e.preventDefault(); dropzone.classList.add('is-over'); });
  });
  ['dragleave', 'drop'].forEach(function (ev) {
    dropzone.addEventListener(ev, function (e) { e.preventDefault(); dropzone.classList.remove('is-over'); });
  });
  dropzone.addEventListener('drop', function (e) {
    var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) readFile(f);
  });

  $('loadSample').addEventListener('click', function () {
    fetch('data/sample-war.csv')
      .then(function (r) {
        if (!r.ok) throw new Error(r.status);
        return r.text();
      })
      .then(function (t) { handleCsvText(t, 'sample-war.csv'); })
      .catch(function () {
        clearMessages();
        say('Could not load the sample. If you opened index.html straight from disk, ' +
            'the browser blocks reading data/sample-war.csv — drag the file onto the drop zone instead.', true);
      });
  });

  /* ------------------------------------------------------ Attacks report intake */
  /* YATA's "Attacks report" export is a raw per-attack log, not a per-member
     summary — TBC.attacksReport aggregates it into the same member shape the
     CSV path produces, so everything downstream (roster, preview, CSV export)
     is unchanged. See docs/SPEC.md §11 for how each column was derived. */

  var AR = TBC.attacksReport;
  var xlsxDropzone = $('xlsxDropzone'), xlsxInput = $('xlsxInput');
  var factionRow = $('factionRow'), detectedMyFaction = $('detectedMyFaction'), detectedOppFaction = $('detectedOppFaction');

  function runAggregation(label) {
    var myFaction = detectedMyFaction.value.trim();
    var oppFaction = detectedOppFaction.value.trim();
    if (!myFaction) { say('Enter your faction name to calculate from the Attacks report.', true); return; }

    var members = AR.aggregate(state.attackRows, myFaction, oppFaction);
    if (!members.length) {
      say('No attacks found for "' + myFaction + '" in that file — check the faction name.', true);
      return;
    }

    state.members = M.addRanks(members);
    state.active = 0;
    if (!$('opponentFaction').value.trim() && oppFaction) $('opponentFaction').value = oppFaction;
    applyWarMeta();

    fileLabel.textContent = label + ' — ' + state.members.length + ' members';
    outputPanel.hidden = false;
    renderRoster();
    renderPreview();
  }

  function handleAttacksReportFile(file) {
    clearMessages();
    AR.readWorkbook(file).then(function (rows) {
      if (!rows.length) { say('That spreadsheet has no data rows.', true); return; }
      state.attackRows = rows;

      var det = AR.detectFactions(rows);
      if (!det.myFaction) {
        say('Could not detect a faction in that file — is it a YATA Attacks report?', true);
        return;
      }
      detectedMyFaction.value = det.myFaction;
      detectedOppFaction.value = det.oppFaction;
      factionRow.hidden = false;

      runAggregation(file.name);
    }).catch(function (err) { say(err.message, true); });
  }

  xlsxDropzone.addEventListener('click', function () { xlsxInput.click(); });
  xlsxInput.addEventListener('change', function (e) {
    if (e.target.files && e.target.files[0]) handleAttacksReportFile(e.target.files[0]);
  });
  ['dragenter', 'dragover'].forEach(function (ev) {
    xlsxDropzone.addEventListener(ev, function (e) { e.preventDefault(); xlsxDropzone.classList.add('is-over'); });
  });
  ['dragleave', 'drop'].forEach(function (ev) {
    xlsxDropzone.addEventListener(ev, function (e) { e.preventDefault(); xlsxDropzone.classList.remove('is-over'); });
  });
  xlsxDropzone.addEventListener('drop', function (e) {
    var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) handleAttacksReportFile(f);
  });

  $('recalculate').addEventListener('click', function () {
    if (!state.attackRows) return;
    clearMessages();
    runAggregation(fileLabel.textContent.split(' — ')[0]);
  });

  $('downloadGeneratedCsv').addEventListener('click', function () {
    if (!state.members.length) return;
    var csv = M.toCsv(state.members);
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    TBC.exporter.download(blob, 'war-report.csv');
  });

  /* -------------------------------------------------------------- rendering */

  function renderRoster() {
    roster.innerHTML = '';
    state.members.slice().sort(function (a, b) { return a.overall_rank - b.overall_rank; })
      .forEach(function (m) {
        var li = document.createElement('li');
        var idx = state.members.indexOf(m);
        if (idx === state.active) li.className = 'is-active';
        var name = document.createElement('span');
        name.textContent = m.name;
        var rank = document.createElement('span');
        rank.className = 'rank';
        rank.textContent = '#' + m.overall_rank;
        li.appendChild(name);
        li.appendChild(rank);
        li.addEventListener('click', function () { state.active = idx; renderRoster(); renderPreview(); });
        roster.appendChild(li);
      });
  }

  function renderPreview() {
    var m = state.members[state.active];
    if (!m) return;
    previewScaler.innerHTML = '';
    var card = TBC.card.buildCard(m, { logoDataUrl: state.logo });
    previewScaler.appendChild(card);
    card._drawRadar();

    // Scale the fixed-width card down to whatever room the preview column has.
    var scale = previewFrame.clientWidth / TBC.card.WIDTH;
    previewScaler.style.transform = 'scale(' + scale + ')';
    previewFrame.style.height = (TBC.card.HEIGHT * scale) + 'px';
  }

  window.addEventListener('resize', function () {
    if (state.members.length) renderPreview();
  });

  /* --------------------------------------------------------------- exports */

  /* Options passed to the renderer: the logo plus the chosen pixel scale.
     1x keeps a full 22-card ZIP comfortably under Discord's 10 MB upload limit. */
  function exportOpts() {
    return { logoDataUrl: state.logo, scale: parseInt($('cardScale').value, 10) || 1 };
  }

  function humanSize(bytes) {
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  function busy(on, text) {
    $('downloadOne').disabled = on;
    $('downloadAll').disabled = on;
    progress.textContent = text || '';
  }

  $('downloadOne').addEventListener('click', function () {
    var m = state.members[state.active];
    if (!m) return;
    busy(true, 'Rendering ' + m.name + '…');
    TBC.exporter.renderToBlob(m, exportOpts())
      .then(function (blob) {
        TBC.exporter.download(blob, TBC.exporter.fileNameFor(m));
        busy(false, '');
      })
      .catch(function (err) { busy(false, ''); say('Render failed: ' + err.message, true); });
  });

  $('downloadAll').addEventListener('click', function () {
    if (!state.members.length) return;
    busy(true, 'Rendering 0 / ' + state.members.length + '…');
    var ordered = state.members.slice().sort(function (a, b) { return a.overall_rank - b.overall_rank; });
    TBC.exporter.exportAll(ordered, exportOpts(), function (done, total, name) {
      progress.textContent = 'Rendering ' + done + ' / ' + total + ' — ' + name;
    })
      .then(function (zipBlob) {
        TBC.exporter.download(zipBlob, TBC.exporter.zipName(ordered));
        busy(false, 'Done — ' + ordered.length + ' cards, ' + humanSize(zipBlob.size) + '.');
        if (zipBlob.size > 9.5 * 1024 * 1024) {
          say('That ZIP is over Discord\u2019s 10 MB upload limit for standard accounts. ' +
              'Switch the card size to 1\u00d7, or split the upload.');
        }
      })
      .catch(function (err) { busy(false, ''); say('Bulk export failed: ' + err.message, true); });
  });

  /* ----------------------------------------------------------------- start */

  loadStoredLogo();
  loadStoredFaction();
  // Default to today — the common case is generating cards right after a war ends.
  $('warDate').value = new Date().toISOString().slice(0, 10);
  // Wait for the bundled webfonts before any measuring happens, otherwise the
  // first preview lays out with a fallback font and looks wrong until a resize.
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { renderPreview(); });
})();
