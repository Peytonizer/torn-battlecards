/* icons.js — inline SVG icons served as data: URIs.
   They are <img> sources rather than inline <svg> because html2canvas rasterises
   data-URI images reliably but has known gaps with inline SVG.
   Plain script (no ES modules) so the app also works when index.html is opened
   directly from disk with file:// — modules are blocked by CORS in that case. */

var TBC = window.TBC || (window.TBC = {});

(function () {
  var STROKE = '#d6d3ce';
  var GOLD = '#c8912e';

  function svg(body, stroke) {
    // The explicit width/height matter: html2canvas gives an SVG data URI with no
    // intrinsic size a zero-sized box and silently drops the icon from the PNG.
    var markup =
      '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="' +
      (stroke || STROKE) +
      '" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' + body + '</svg>';
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(markup);
  }

  /* Crossed swords, shared by the respect-gain row and the War Summary heading. */
  var SWORDS =
    '<path d="M2.5 3L15 15.5M21.5 3L9 15.5"/>' +
    '<path d="M12.6 16.2L17.6 11.2M11.4 16.2L6.4 11.2"/>' +
    '<path d="M15 15.5l3.4 3.4M9 15.5l-3.4 3.4"/>' +
    '<circle cx="19.6" cy="20.1" r="1.1"/><circle cx="4.4" cy="20.1" r="1.1"/>';

  /* Keys match the metric ids in metrics.js so the card can look icons up directly. */
  TBC.ICONS = {
    // crossed swords — respect gain
    respect_gain: svg(SWORDS),
    // crosshair — war hits
    war_hits: svg('<circle cx="12" cy="12" r="7.5"/><circle cx="12" cy="12" r="2"/><path d="M12 1.5v4M12 18.5v4M1.5 12h4M18.5 12h4"/>'),
    // shield — defends lost
    defends_lost: svg('<path d="M12 2.5l7.5 3v6c0 4.6-3.1 8.4-7.5 10-4.4-1.6-7.5-5.4-7.5-10v-6z"/>'),
    // burst — chain hits
    chain_hits: svg('<path d="M12 2l2.2 5.1L19.5 5l-2.1 5.3 5.1 1.7-5.1 1.7 2.1 5.3-5.3-2.1L12 22l-2.2-5.1L4.5 19l2.1-5.3L1.5 12l5.1-1.7L4.5 5l5.3 2.1z"/>'),
    // handshake — assists
    // open hand — assists (a handshake is unreadable at this size)
    assists: svg('<path d="M9 13.2V4.9a1.6 1.6 0 013.2 0V11"/><path d="M12.2 11V3.7a1.6 1.6 0 013.2 0V11"/><path d="M15.4 11.5V5.7a1.6 1.6 0 013.2 0V14c0 3.6-2.7 6.5-6.3 6.5-2 0-3.5-.7-4.7-2.2L4.3 14a1.7 1.7 0 012.5-2.2L9 14"/>'),
    // masked face — foreign attacks
    foreign_attacks: svg('<path d="M3 9.5c3-1.5 6-2.2 9-2.2s6 .7 9 2.2v2.2c0 1.4-1.2 2.6-2.6 2.6h-2.1l-1.6 2.1a3.4 3.4 0 01-5.4 0l-1.6-2.1H5.6A2.6 2.6 0 013 11.7z"/><circle cx="8.4" cy="11" r="1.1"/><circle cx="15.6" cy="11" r="1.1"/>'),
    // two figures — retaliations
    retaliations: svg('<circle cx="8" cy="8" r="3"/><circle cx="17" cy="9.5" r="2.4"/><path d="M2.5 19.5c0-3 2.5-5 5.5-5s5.5 2 5.5 5"/><path d="M15 15.2c2.6-.5 6.5.9 6.5 4.3"/>'),
    // radar — "performance breakdown" heading
    performance: svg('<path d="M12 2.5l9 6.5-3.4 10.5H6.4L3 9z"/><path d="M12 7l4.6 3.3-1.8 5.4H9.2L7.4 10.3z"/>', GOLD),
    // clipboard — "coach's notes" heading
    notes: svg('<rect x="4.5" y="4" width="15" height="17" rx="2"/><path d="M9 4V2.8h6V4"/><path d="M8.5 10h7M8.5 14h7M8.5 18h4"/>', GOLD),
    // swords — "war summary" heading
    summary: svg(SWORDS, GOLD),
    // list — "detailed stats" heading
    detail: svg('<path d="M6 6h14M6 12h14M6 18h14"/><circle cx="3.2" cy="6" r="1" fill="' + GOLD + '" stroke="none"/><circle cx="3.2" cy="12" r="1" fill="' + GOLD + '" stroke="none"/><circle cx="3.2" cy="18" r="1" fill="' + GOLD + '" stroke="none"/>', GOLD)
  };
})();
