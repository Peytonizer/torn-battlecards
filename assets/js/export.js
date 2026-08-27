/* export.js — rasterises cards to PNG and packages them for Discord.
   Cards are rendered in an off-screen stage that is still laid out by the browser
   (position:absolute, far off to the left) because html2canvas cannot measure an
   element with display:none. */

var TBC = window.TBC || (window.TBC = {});

(function () {
  var STAGE_ID = 'bc-export-stage';

  function stage() {
    var s = document.getElementById(STAGE_ID);
    if (!s) {
      s = document.createElement('div');
      s.id = STAGE_ID;
      s.style.cssText = 'position:absolute;left:-10000px;top:0;width:' +
        TBC.card.WIDTH + 'px;height:0;overflow:visible;';
      document.body.appendChild(s);
    }
    return s;
  }

  function safeName(s) {
    return String(s).replace(/[^A-Za-z0-9._-]+/g, '_').replace(/^_+|_+$/g, '') || 'member';
  }

  /* File name pattern: 01_LuckyHornet.png — the rank prefix keeps Discord's
     upload order matching the leaderboard order. */
  function fileNameFor(member) {
    var pad = String(member.overall_rank).padStart(2, '0');
    return pad + '_' + safeName(member.name) + '.png';
  }

  function renderToCanvas(member, opts) {
    var host = stage();
    var card = TBC.card.buildCard(member, opts);
    host.appendChild(card);
    card._drawRadar();

    return html2canvas(card, {
      backgroundColor: '#0a0a0b',
      scale: opts.scale || 2,
      width: TBC.card.WIDTH,
      height: TBC.card.HEIGHT,
      windowWidth: TBC.card.WIDTH,
      windowHeight: TBC.card.HEIGHT,
      useCORS: true,
      logging: false
    }).then(function (canvas) {
      host.removeChild(card);
      return canvas;
    }, function (err) {
      if (card.parentNode) host.removeChild(card);
      throw err;
    });
  }

  function canvasToBlob(canvas) {
    return new Promise(function (resolve) { canvas.toBlob(resolve, 'image/png'); });
  }

  function renderToBlob(member, opts) {
    return renderToCanvas(member, opts).then(canvasToBlob);
  }

  function download(blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    // Revoking immediately can cancel the download in some browsers.
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }

  /* Render every member and hand back a single .zip. onProgress(done, total, name)
     is called after each card so the UI can show where it is up to. */
  function exportAll(members, opts, onProgress) {
    var zip = new JSZip();
    var folder = zip.folder('battlecards');
    var chain = Promise.resolve();

    members.forEach(function (m, i) {
      chain = chain.then(function () {
        return renderToBlob(m, opts).then(function (blob) {
          folder.file(fileNameFor(m), blob);
          if (onProgress) onProgress(i + 1, members.length, m.name);
        });
      });
    });

    return chain.then(function () {
      return zip.generateAsync({ type: 'blob', compression: 'STORE' });
    });
  }

  TBC.exporter = {
    fileNameFor: fileNameFor,
    renderToCanvas: renderToCanvas,
    renderToBlob: renderToBlob,
    exportAll: exportAll,
    download: download,
    zipName: function (members) {
      var m = members[0] || {};
      var bits = ['battlecards'];
      if (m.faction_name) bits.push(safeName(m.faction_name));
      if (m.war_date) bits.push(safeName(m.war_date));
      return bits.join('_') + '.zip';
    }
  };
})();
