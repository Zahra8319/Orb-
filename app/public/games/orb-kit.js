/*!
 * Shared helpers for the games made for Orb: sound, saved bests, overlays.
 * Sound uses short Web Audio beeps (no files) and remembers the mute setting.
 */
(function () {
  'use strict';

  var MUTE_KEY = 'orb_games_muted';
  var muted = false;
  try { muted = localStorage.getItem(MUTE_KEY) === '1'; } catch (e) {}
  var ctx = null;

  function beep(freq, dur, type, vol) {
    if (muted) return;
    try {
      ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
      if (ctx.state === 'suspended') ctx.resume();
      var o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type || 'sine';
      o.frequency.value = freq;
      g.gain.setValueAtTime(vol || 0.08, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
      o.connect(g); g.connect(ctx.destination);
      o.start(); o.stop(ctx.currentTime + dur);
    } catch (e) { /* no audio */ }
  }

  var sfx = {
    tap: function () { beep(660, 0.06, 'triangle', 0.05); },
    good: function () { beep(880, 0.1, 'triangle', 0.07); },
    bad: function () { beep(180, 0.3, 'sawtooth', 0.06); },
    win: function () { [0, 110, 220, 340].forEach(function (d, i) { setTimeout(function () { beep(520 + i * 160, 0.16, 'triangle', 0.09); }, d); }); },
  };

  function bindMute(btn) {
    function paint() { btn.textContent = muted ? '🔇' : '🔊'; btn.setAttribute('aria-pressed', String(muted)); }
    btn.title = 'Toggle sound';
    btn.setAttribute('aria-label', 'Sound');
    btn.addEventListener('click', function () {
      muted = !muted;
      try { localStorage.setItem(MUTE_KEY, muted ? '1' : '0'); } catch (e) {}
      paint();
      btn.blur();
    });
    paint();
  }

  /** A saved best. `better(a, b)` is true when a beats b. */
  function best(key, better) {
    var v = null;
    try { var raw = localStorage.getItem(key); v = raw === null ? null : Number(raw); } catch (e) {}
    if (v !== null && !isFinite(v)) v = null;
    return {
      get: function () { return v; },
      /** Records `x` if it beats the best; returns true when it is a new record. */
      offer: function (x) {
        if (v !== null && !better(x, v)) return false;
        v = x;
        try { localStorage.setItem(key, String(x)); } catch (e) {}
        return true;
      },
    };
  }

  function show(el) { el.classList.remove('hidden'); var b = el.querySelector('button'); if (b) b.focus({ preventScroll: true }); }
  function hide(el) { el.classList.add('hidden'); }

  window.OrbKit = { sfx: sfx, bindMute: bindMute, best: best, show: show, hide: hide };
})();
