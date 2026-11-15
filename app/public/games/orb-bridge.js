/*!
 * Orb bridge: lets a bundled game talk to the Orb app that frames it.
 *
 * Up:   OrbBridge.result(value, detail)  one finished round. What `value` means
 *       (points, moves, a win) is set by the game's entry in src/games/catalog.json.
 * Down: Orb sends its day/sleep shift; during the sleep shift the game is dimmed,
 *       the same way the rest of Orb dims before bed.
 *       Orb also sends an assist level, 0 to 3 (src/games/assist.ts). After a run of
 *       losses it rises and the game reads OrbBridge.assist to go easier; wins bring
 *       it back down. Outside Orb it stays 0.
 *
 * Opened on its own, outside Orb, the game works exactly as before.
 */
(function () {
  'use strict';

  var framed = window.parent !== window;
  var origin = window.location.origin;

  function send(msg) {
    if (!framed) return;
    msg.orb = 1;
    try { window.parent.postMessage(msg, origin); } catch (e) { /* parent gone */ }
  }

  var style = document.createElement('style');
  style.textContent =
    'html{transition:filter .6s ease}' +
    'html[data-orb-theme="sleep"]{filter:brightness(.78) saturate(.7)}' +
    '@media (prefers-reduced-motion: reduce){html{transition:none}}';
  (document.head || document.documentElement).appendChild(style);

  window.addEventListener('message', function (e) {
    if (e.origin !== origin || e.source !== window.parent) return;
    var d = e.data;
    if (!d || d.orb !== 1) return;
    if (d.type === 'theme' && (d.theme === 'day' || d.theme === 'sleep')) {
      document.documentElement.setAttribute('data-orb-theme', d.theme);
    }
    if (d.type === 'assist' && typeof d.level === 'number') {
      bridge.assist = Math.max(0, Math.min(3, Math.round(d.level)));
    }
  });

  var bridge = window.OrbBridge = {
    /** 0 = normal, 3 = easiest. Read it when a round or move starts. */
    assist: 0,
    result: function (value, detail) {
      if (typeof value !== 'number' || !isFinite(value)) return;
      send({ type: 'result', value: value, detail: detail == null ? undefined : String(detail).slice(0, 80) });
    },
  };

  send({ type: 'ready' });
})();
