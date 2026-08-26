/* card.js — builds one battlecard as a DOM element and draws its radar chart.
   The element is a plain 1354x752 div styled by card.css; export.js rasterises it. */

var TBC = window.TBC || (window.TBC = {});

(function () {
  var M = TBC.metrics;
  var ICONS = TBC.ICONS;

  var CARD_W = 1354;
  var CARD_H = 752;

  function el(tag, className, text) {
    var n = document.createElement(tag);
    if (className) n.className = className;
    if (text != null) n.textContent = text;
    return n;
  }

  function icon(src, cls) {
    var img = el('img', cls || null);
    img.src = src;
    img.alt = '';
    return img;
  }

  function panelTitle(text, iconSrc) {
    var t = el('div', 'bc-panel-title');
    if (iconSrc) t.appendChild(icon(iconSrc));
    t.appendChild(el('span', null, text));
    return t;
  }

  /* Initials fallback for the logo bubble when no image has been uploaded. */
  function initialsOf(name) {
    var words = String(name || 'Faction').split(/\s+/).filter(Boolean);
    return words.slice(0, 2).map(function (w) { return w[0]; }).join('').toUpperCase();
  }

  /* ------------------------------------------------------------- the radar */

  /* Draws the seven-axis performance web.
     Axes are plotted by RANK within the faction, not by raw value: the top
     performer on a metric sits on the outer ring and the bottom sits near the
     centre. Scaling by raw value instead collapses almost every card to a dot,
     because one or two members typically post several times the faction median.
     The printed number beside each axis is still the real value. */
  function drawRadar(canvas, member) {
    var cssW = 480, cssH = 336;
    var dpr = 2;                          // fixed 2x so exports are crisp at any scale
    canvas.width = cssW * dpr;
    canvas.height = cssH * dpr;
    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';

    var ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, cssW, cssH);

    // R is deliberately conservative: the axis labels sit outside it and the
    // widest ("FOREIGN ATTACKS") must not run off the edge of the canvas.
    var cx = cssW / 2, cy = cssH / 2 + 4, R = 88, LABEL_GAP = 30;
    var axes = M.HEADLINE;
    var n = axes.length;
    var step = (Math.PI * 2) / n;

    function point(i, r) {
      var a = -Math.PI / 2 + i * step;
      return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
    }

    // concentric guide rings
    ctx.lineWidth = 1;
    for (var ring = 1; ring <= 4; ring++) {
      ctx.beginPath();
      for (var i = 0; i < n; i++) {
        var p = point(i, R * ring / 4);
        i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]);
      }
      ctx.closePath();
      ctx.strokeStyle = ring === 4 ? '#4a4b50' : '#2e2f33';
      ctx.stroke();
    }

    // spokes
    ctx.strokeStyle = '#2e2f33';
    for (var s = 0; s < n; s++) {
      var q = point(s, R);
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(q[0], q[1]); ctx.stroke();
    }

    // 0 for an unranked (zero) stat, 1.0 for the faction's best on that metric
    function share(key) {
      var rank = member.ranks[key];
      var size = member.roster_size || 1;
      return rank ? (size - rank + 1) / size : 0;
    }

    // the player's shape
    ctx.beginPath();
    for (var k = 0; k < n; k++) {
      var pt = point(k, R * share(axes[k].key));
      k ? ctx.lineTo(pt[0], pt[1]) : ctx.moveTo(pt[0], pt[1]);
    }
    ctx.closePath();
    ctx.fillStyle = 'rgba(200, 145, 46, 0.68)';
    ctx.fill();
    ctx.strokeStyle = '#e0a838';
    ctx.lineWidth = 2;
    ctx.stroke();

    // vertex dots
    for (var d = 0; d < n; d++) {
      var vd = share(axes[d].key);
      if (!vd) continue;
      var pd = point(d, R * vd);
      ctx.beginPath();
      ctx.arc(pd[0], pd[1], 3.2, 0, Math.PI * 2);
      ctx.fillStyle = '#f0c264';
      ctx.fill();
    }

    // axis labels and values
    for (var L = 0; L < n; L++) {
      var lp = point(L, R + LABEL_GAP);
      var ax = axes[L];
      var angle = -Math.PI / 2 + L * step;
      var cos = Math.cos(angle);
      ctx.textAlign = Math.abs(cos) < 0.25 ? 'center' : (cos > 0 ? 'left' : 'right');
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#b9b6b1';
      ctx.font = '600 13px Oswald, sans-serif';
      ctx.fillText(ax.label.toUpperCase(), lp[0], lp[1] - 9);
      ctx.fillStyle = '#c8912e';
      ctx.font = '600 16px Oswald, sans-serif';
      ctx.fillText(M.formatValue(ax.key, member[ax.key]), lp[0], lp[1] + 10);
    }
  }

  /* -------------------------------------------------------- card assembly */

  function buildHeader(member, opts) {
    var h = el('div', 'bc-header');

    var logo = el('div', 'bc-logo');
    if (opts.logoDataUrl) {
      var img = el('img');
      img.src = opts.logoDataUrl;
      img.alt = '';
      logo.appendChild(img);
    } else {
      logo.appendChild(el('div', 'bc-logo-initials', initialsOf(member.faction_name)));
    }
    h.appendChild(logo);

    var ident = el('div', 'bc-identity');
    ident.appendChild(el('div', 'bc-kicker', 'Torn War Report Card'));

    var nameline = el('div', 'bc-nameline');
    var nameEl = el('h1', 'bc-name', member.name);
    // Step the name down rather than letting a long handle clip.
    if (member.name.length > 16) nameEl.classList.add('is-verylong');
    else if (member.name.length > 11) nameEl.classList.add('is-long');
    nameline.appendChild(nameEl);
    nameline.appendChild(el('span', 'bc-rankhash', '#' + member.overall_rank));
    ident.appendChild(nameline);

    var factionText = member.faction_name || '';
    if (member.faction_tag) factionText += (factionText ? ' ' : '') + '[' + member.faction_tag + ']';
    ident.appendChild(el('div', 'bc-faction', factionText));
    h.appendChild(ident);

    var meta = el('div', 'bc-meta');
    function metaCell(label, value, plain) {
      var box = el('div');
      box.appendChild(el('div', 'bc-meta-label', label));
      box.appendChild(el('div', 'bc-meta-value' + (plain ? ' is-plain' : ''), value || '–'));
      meta.appendChild(box);
    }
    metaCell('Opponent', member.opponent_faction);
    metaCell('Result', member.war_result);
    metaCell('War Date', member.war_date, true);
    metaCell('Net Respect', M.formatValue('net_respect', member.net_respect));
    h.appendChild(meta);

    h.appendChild(el('div', 'bc-bigrank', String(member.overall_rank)));
    return h;
  }

  function buildSummary(member) {
    var p = el('section', 'bc-panel bc-col-summary');
    p.appendChild(panelTitle('War Summary', ICONS.summary));

    var rows = el('div', 'bc-summary-rows');
    M.HEADLINE.forEach(function (m) {
      var row = el('div', 'bc-summary-row');
      row.appendChild(icon(ICONS[m.key], 'bc-icon'));

      var main = el('div', 'bc-summary-main');
      main.appendChild(el('div', 'bc-summary-label', m.label.toUpperCase()));
      main.appendChild(el('div', 'bc-summary-value', M.formatValue(m.key, member[m.key])));
      row.appendChild(main);

      var rank = el('div', 'bc-summary-rank');
      rank.appendChild(el('div', 'bc-summary-label', 'Rank'));
      rank.appendChild(el('div', 'bc-rankval', M.formatRank(member.ranks[m.key], member.roster_size)));
      row.appendChild(rank);

      rows.appendChild(row);
    });
    p.appendChild(rows);

    var impact = el('div', 'bc-impact');
    var left = el('div');
    left.appendChild(el('div', 'bc-impact-title', 'Overall Impact'));
    left.appendChild(el('div', 'bc-impact-sub', member.impact_label || ''));
    impact.appendChild(left);
    impact.appendChild(el('div', 'bc-impact-grade', member.grade || '–'));
    p.appendChild(impact);

    return p;
  }

  function buildDetail(member) {
    var p = el('section', 'bc-panel bc-col-detail');
    p.appendChild(panelTitle('Detailed Stats', ICONS.detail));

    var head = el('div', 'bc-detail-head');
    head.appendChild(el('span', null, 'Rank'));
    p.appendChild(head);

    var rows = el('div', 'bc-detail-rows');
    M.DETAIL.forEach(function (m) {
      var row = el('div', 'bc-detail-row');
      row.appendChild(el('div', 'bc-detail-name', m.label));
      row.appendChild(el('div', 'bc-detail-value', M.formatValue(m.key, member[m.key])));
      var r = member.ranks[m.key];
      row.appendChild(el('div', 'bc-detail-rank' + (r ? '' : ' is-na'), M.formatRank(r, member.roster_size)));
      rows.appendChild(row);
    });
    p.appendChild(rows);

    var legend = el('div', 'bc-legend');
    legend.appendChild(el('div', null, 'Rank = placing within the faction for this war'));
    legend.appendChild(el('div', null, '– = not applicable'));
    p.appendChild(legend);

    return p;
  }

  function buildRight(member) {
    var col = el('div', 'bc-col-right');

    var radarPanel = el('section', 'bc-panel bc-panel-radar');
    radarPanel.appendChild(panelTitle('Performance Breakdown', ICONS.performance));
    var wrap = el('div', 'bc-radar-wrap');
    var canvas = el('canvas');
    wrap.appendChild(canvas);
    radarPanel.appendChild(wrap);
    col.appendChild(radarPanel);

    var notesPanel = el('section', 'bc-panel bc-panel-notes');
    notesPanel.appendChild(panelTitle("Coach's Notes", ICONS.notes));
    var text = el('div', 'bc-notes-text', member.notes || '');
    if ((member.notes || '').length > 170) text.classList.add('is-dense');
    notesPanel.appendChild(text);
    col.appendChild(notesPanel);

    // Canvas must be in the document before it is drawn on, so defer to the caller.
    col._radarCanvas = canvas;
    col._draw = function () { drawRadar(canvas, member); };
    return col;
  }

  /* Build a detached card element. Call element._drawRadar() once it is in the DOM. */
  function buildCard(member, opts) {
    opts = opts || {};
    var card = el('div', 'bc-card');
    card.appendChild(buildHeader(member, opts));

    var body = el('div', 'bc-body');
    body.appendChild(buildSummary(member));
    body.appendChild(buildDetail(member));
    var right = buildRight(member);
    body.appendChild(right);
    card.appendChild(body);

    card._drawRadar = right._draw;
    return card;
  }

  TBC.card = {
    WIDTH: CARD_W,
    HEIGHT: CARD_H,
    buildCard: buildCard
  };
})();
