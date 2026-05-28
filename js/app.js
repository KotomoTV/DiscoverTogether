// Crave — onboarding, pairing, questionnaire, and result controller.
//
// Architecture:
//   - One screen visible at a time. goto(name) hides the current screen
//     and shows the next with a 220ms enter animation (140ms for the
//     question tile swap, per the brief).
//   - State lives in the `state` object plus localStorage for
//     session_token recovery on reload.
//   - All DB access goes through Supabase RPCs in supabase/schema.sql.
//     PostgREST errors surface inline; full error objects are logged
//     to console.error under a [CRAVE] prefix.
//
// Routing contract (do not break):
//   The initial screen on every page load is decided EXCLUSIVELY by
//   THIS device's own localStorage entry under `crave::session::v1`.
//   No URL query/hash is honored, no server "current session" lookup
//   is performed without that token. A device with an empty
//   localStorage always runs the full onboarding (name + gender +
//   code), so a fresh second device never inherits anything from
//   the first. See stripUrlState() and init().

(function () {
  'use strict';

  // -----------------------------------------------------------------------
  // Constants
  // -----------------------------------------------------------------------

  var STORAGE_KEY = 'crave::session::v1';
  var TILE_ANIM_MS = 140;
  var SCREEN_ANIM_MS = 220;
  var RELAX_HOLD_MS = 4000;
  var CODE_CREATE_MAX_ATTEMPTS = 8;

  // Per-question icons rendered inside the gradient card. All shapes are
  // outline-only (fill="none", stroke="currentColor"), so they pick up
  // the white `color` set in CSS. There are 36 entries here — one per
  // unique activity in data/questions.js. Every question carries a
  // deliberate icon name; the `heart` entry below is itself a real
  // question icon (slow-anal) and also serves as last-resort fallback.
  //
  // To add a new icon: register it here and use the name as the
  // `icon: '…'` field on a question.
  var SVG_OPEN  = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">';
  var SVG_CLOSE = '</svg>';
  function I(body) { return SVG_OPEN + body + SVG_CLOSE; }

  var Q_ICONS = {
    bath: I(
      '<path d="M3 12h18v3a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5z"/>'
      + '<path d="M6 12V7a2.4 2.4 0 0 1 2.4-2.4c1.2 0 2.2.9 2.4 2"/>'
      + '<line x1="5"  y1="20" x2="4"  y2="22.5"/>'
      + '<line x1="19" y1="20" x2="20" y2="22.5"/>'
    ),
    hands: I(
      '<path d="M9 5a1.5 1.5 0 0 1 3 0v6"/>'
      + '<path d="M12 4a1.5 1.5 0 0 1 3 0v7"/>'
      + '<path d="M15 6a1.5 1.5 0 0 1 3 0v6a6 6 0 0 1-12 0V9a1.5 1.5 0 0 1 3 0"/>'
      + '<path d="M9 9V6"/>'
    ),
    droplet: I(
      '<path d="M12 3 C 12 3 5.5 10.5 5.5 15.5 a 6.5 6.5 0 0 0 13 0 C 18.5 10.5 12 3 12 3 Z"/>'
    ),
    feather: I(
      '<path d="M20 3c-5 0-9 2-12 5-3 3-5 8-5 13 5 0 10-2 13-5 3-3 5-7 5-12V3z"/>'
      + '<path d="M3 21 L 14 10"/>'
      + '<path d="M17 11H9"/>'
    ),
    eye: I(
      '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/>'
      + '<circle cx="12" cy="12" r="3"/>'
    ),
    bulb: I(
      '<path d="M9 18h6"/>'
      + '<path d="M10 21.5h4"/>'
      + '<path d="M7 11a5 5 0 0 1 10 0c0 2-1.2 3-2 4.2-.6 .8-.7 1.5-.7 2.3H9.7c0-.8-.1-1.5-.7-2.3C8.2 14 7 13 7 11Z"/>'
    ),
    rotate: I(
      '<path d="M3 12a9 9 0 0 1 15.5-6.3L21 8"/>'
      + '<polyline points="21 3 21 8 16 8"/>'
      + '<path d="M21 12a9 9 0 0 1-15.5 6.3L3 16"/>'
      + '<polyline points="3 21 3 16 8 16"/>'
    ),
    sunrise: I(
      '<line x1="12" y1="2"  x2="12" y2="6"/>'
      + '<line x1="5"  y1="6"  x2="6.5" y2="7.5"/>'
      + '<line x1="19" y1="6"  x2="17.5" y2="7.5"/>'
      + '<line x1="2"  y1="13" x2="5"  y2="13"/>'
      + '<line x1="19" y1="13" x2="22" y2="13"/>'
      + '<path d="M6 13a6 6 0 0 1 12 0"/>'
      + '<line x1="2" y1="20" x2="22" y2="20"/>'
      + '<polyline points="9 9 12 6 15 9"/>'
    ),
    hand: I(
      '<path d="M9 11V6a1.5 1.5 0 1 1 3 0v5"/>'
      + '<path d="M12 11V4.5a1.5 1.5 0 1 1 3 0V11"/>'
      + '<path d="M15 11V7a1.5 1.5 0 1 1 3 0v7a6 6 0 0 1-6 6h-2a6 6 0 0 1-6-6v-3.5a1.5 1.5 0 1 1 3 0V13"/>'
    ),
    tree: I(
      '<path d="M12 3 L 7 9 L 9.5 9 L 5.5 14 L 8.5 14 L 4 19 L 20 19 L 15.5 14 L 18.5 14 L 14.5 9 L 17 9 Z"/>'
      + '<line x1="12" y1="19" x2="12" y2="22"/>'
    ),
    car: I(
      '<path d="M5 13 L 7 7 H 17 L 19 13"/>'
      + '<rect x="3" y="13" width="18" height="5" rx="1.5"/>'
      + '<circle cx="7"  cy="18.5" r="1.8"/>'
      + '<circle cx="17" cy="18.5" r="1.8"/>'
    ),
    sailboat: I(
      '<path d="M2 18 a 4 3 0 0 0 20 0"/>'
      + '<line x1="12" y1="3" x2="12" y2="16"/>'
      + '<path d="M12 4 L 19 15 H 12 Z"/>'
      + '<path d="M12 7 L 6 15 H 12 Z"/>'
    ),
    movie: I(
      '<rect x="3" y="8" width="18" height="12" rx="1"/>'
      + '<path d="M3 8 L 21 4"/>'
      + '<path d="M7 7.2 L 9 3.2"/>'
      + '<path d="M11 6.3 L 13 2.3"/>'
      + '<path d="M15 5.5 L 17 1.5"/>'
    ),
    'shopping-bag': I(
      '<path d="M6 8 H 18 L 19 21 a 1 1 0 0 1 -1 1 H 6 a 1 1 0 0 1 -1 -1 Z"/>'
      + '<path d="M9 8 V 6 a 3 3 0 0 1 6 0 V 8"/>'
    ),
    spa: I(
      '<path d="M3 21 c 0 -10 8 -18 18 -18 c 0 10 -8 18 -18 18 Z"/>'
      + '<path d="M3 21 L 21 3"/>'
    ),
    music: I(
      '<path d="M9 18V5l12-2v13"/>'
      + '<circle cx="6"  cy="18" r="3"/>'
      + '<circle cx="18" cy="16" r="3"/>'
    ),
    beach: I(
      '<path d="M2 12 H 22"/>'
      + '<path d="M22 12 C 22 6 17 3 11 3"/>'
      + '<path d="M2 12 C 2 9 6 7 11 7"/>'
      + '<path d="M2 12 C 4 9 8 8 11 9"/>'
      + '<path d="M22 12 C 18 9 14 9 11 11"/>'
      + '<line x1="11" y1="3" x2="11" y2="20"/>'
      + '<path d="M11 20 a 2 2 0 0 0 -2 2"/>'
    ),
    hanger: I(
      '<path d="M12 5 a 1.5 1.5 0 1 1 -1.4 2"/>'
      + '<path d="M10.6 7 L 12 10 L 3 17 a 1 1 0 0 0 1 1 H 20 a 1 1 0 0 0 1 -1 L 12 10"/>'
    ),
    tv: I(
      '<rect x="3" y="7" width="18" height="12" rx="2"/>'
      + '<polyline points="8,3 12,7 16,3"/>'
    ),
    bolt: I(
      '<path d="M13 2 L 4 14 H 11 L 11 22 L 20 10 H 13 Z"/>'
    ),
    mirror: I(
      '<path d="M12 2 a 5 7 0 1 0 0 14 a 5 7 0 1 0 0 -14 Z"/>'
      + '<line x1="12" y1="16" x2="12" y2="22"/>'
      + '<line x1="9"  y1="22" x2="15" y2="22"/>'
    ),
    snowflake: I(
      '<line x1="12" y1="2"  x2="12" y2="22"/>'
      + '<line x1="2"  y1="12" x2="22" y2="12"/>'
      + '<line x1="5"  y1="5"  x2="19" y2="19"/>'
      + '<line x1="5"  y1="19" x2="19" y2="5"/>'
      + '<polyline points="10 4 12 2 14 4"/>'
      + '<polyline points="10 20 12 22 14 20"/>'
      + '<polyline points="4 10 2 12 4 14"/>'
      + '<polyline points="20 10 22 12 20 14"/>'
    ),
    video: I(
      '<rect x="6" y="2" width="12" height="20" rx="3"/>'
      + '<polygon points="10 8 16 12 10 16"/>'
    ),
    'video-camera': I(
      '<rect x="2" y="6" width="14" height="12" rx="2"/>'
      + '<path d="M16 10 L 22 7 V 17 L 16 14 Z"/>'
      + '<circle cx="8" cy="12" r="2.4"/>'
    ),
    'lock-open': I(
      '<rect x="5" y="11" width="14" height="10" rx="2"/>'
      + '<path d="M8 11 V 7 a 4 4 0 0 1 7.5 -2"/>'
    ),
    crown: I(
      '<path d="M3 8 L 6 14 L 9 6 L 12 14 L 15 6 L 18 14 L 21 8 V 18 H 3 Z"/>'
      + '<line x1="3" y1="20.5" x2="21" y2="20.5"/>'
    ),
    palm: I(
      '<path d="M11 11V4.5a1.5 1.5 0 1 1 3 0V11"/>'
      + '<path d="M14 11V7a1.5 1.5 0 1 1 3 0v7a6 6 0 0 1-6 6h-1a5 5 0 0 1-5-5v-3a1.5 1.5 0 1 1 3 0V14"/>'
      + '<path d="M2 11 H 5"/>'
      + '<path d="M3 7  L 5 8"/>'
      + '<path d="M3 15 L 5 14"/>'
    ),
    flame: I(
      '<path d="M12 2c1.2 3.5-.4 5.4-1.5 6.7-1.2 1.4-2.2 2.9-2.2 5 0 1.4.6 2.6 1.5 3.4-.7-.3-2-1.3-2.3-3.3-.7 1.6-1.3 3-1 4.6.4 2.7 2.9 4.6 5.5 4.6 3.5 0 6.5-2.8 6.5-6.5 0-6.5-6.5-9-6.5-14.5z"/>'
    ),
    'eye-off': I(
      '<path d="M9.88 9.88a3 3 0 0 0 4.24 4.24"/>'
      + '<path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/>'
      + '<path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/>'
      + '<line x1="3" y1="3" x2="21" y2="21"/>'
    ),
    lock: I(
      '<rect x="5" y="11" width="14" height="10" rx="2"/>'
      + '<path d="M8 11 V 7 a 4 4 0 0 1 8 0 v 4"/>'
    ),
    remote: I(
      '<rect x="8" y="2.5" width="8" height="19" rx="2"/>'
      + '<circle cx="12" cy="8"  r="0.9"/>'
      + '<circle cx="12" cy="13" r="0.9"/>'
      + '<line x1="10.5" y1="17.5" x2="13.5" y2="17.5"/>'
    ),
    heart: I(
      '<path d="M12 21s-7-4.4-9-9c-1.4-3.2.6-7 4-7 2 0 3.6 1.2 5 3 1.4-1.8 3-3 5-3 3.4 0 5.4 3.8 4 7-2 4.6-9 9-9 9z"/>'
    ),
    robot: I(
      '<rect x="5" y="8" width="14" height="12" rx="2"/>'
      + '<line x1="12" y1="4" x2="12" y2="8"/>'
      + '<circle cx="12" cy="3.2" r="1"/>'
      + '<circle cx="9.5"  cy="13" r="0.9"/>'
      + '<circle cx="14.5" cy="13" r="0.9"/>'
      + '<line x1="9.5" y1="17" x2="14.5" y2="17"/>'
      + '<line x1="3" y1="13" x2="5" y2="13"/>'
      + '<line x1="19" y1="13" x2="21" y2="13"/>'
    ),
    // Threesomes — three small heads with a subtle marker over the centre
    // figure so woman/man/ladyboy read as distinct without color.
    'users-w': I(
      '<circle cx="6"  cy="11" r="2.6"/>'
      + '<circle cx="12" cy="11" r="2.6"/>'
      + '<circle cx="18" cy="11" r="2.6"/>'
      + '<path d="M2.5 19 a 3.5 3.5 0 0 1 7 0"/>'
      + '<path d="M8.5 19 a 3.5 3.5 0 0 1 7 0"/>'
      + '<path d="M14.5 19 a 3.5 3.5 0 0 1 7 0"/>'
      + '<circle cx="12" cy="4.5" r="1.4"/>'
      + '<line  x1="12" y1="5.9" x2="12" y2="7.6"/>'
      + '<line  x1="10.7" y1="7"  x2="13.3" y2="7"/>'
    ),
    'users-m': I(
      '<circle cx="6"  cy="11" r="2.6"/>'
      + '<circle cx="12" cy="11" r="2.6"/>'
      + '<circle cx="18" cy="11" r="2.6"/>'
      + '<path d="M2.5 19 a 3.5 3.5 0 0 1 7 0"/>'
      + '<path d="M8.5 19 a 3.5 3.5 0 0 1 7 0"/>'
      + '<path d="M14.5 19 a 3.5 3.5 0 0 1 7 0"/>'
      + '<circle cx="11.2" cy="6.4" r="1.4"/>'
      + '<line  x1="12.2" y1="5.4" x2="14"   y2="3.6"/>'
      + '<polyline points="11.8 3.4 14 3.4 14 5.6"/>'
    ),
    'users-x': I(
      '<circle cx="6"  cy="11" r="2.6"/>'
      + '<circle cx="12" cy="11" r="2.6"/>'
      + '<circle cx="18" cy="11" r="2.6"/>'
      + '<path d="M2.5 19 a 3.5 3.5 0 0 1 7 0"/>'
      + '<path d="M8.5 19 a 3.5 3.5 0 0 1 7 0"/>'
      + '<path d="M14.5 19 a 3.5 3.5 0 0 1 7 0"/>'
      + '<line x1="10.5" y1="4.5" x2="13.5" y2="7.5"/>'
      + '<line x1="13.5" y1="4.5" x2="10.5" y2="7.5"/>'
    )
  };

  function iconSvgFor(name) {
    return Q_ICONS[name] || Q_ICONS.heart;
  }

  var SVG_LOGO = ''
    + '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 58" role="img" aria-label="Crave">'
    +   '<defs>'
    +     '<clipPath id="__CLIP__">'
    +       '<path d="M32 54 C 12 40 2 28 2 18 C 2 9 9 4 16 4 C 23 4 29 9 32 15 C 35 9 41 4 48 4 C 55 4 62 9 62 18 C 62 28 52 40 32 54 Z"/>'
    +     '</clipPath>'
    +   '</defs>'
    +   '<g clip-path="url(#__CLIP__)">'
    +     '<rect x="0"  y="0" width="31" height="58" fill="#FF6A2C"/>'
    +     '<rect x="33" y="0" width="31" height="58" fill="#FF2E74"/>'
    +   '</g>'
    + '</svg>';

  var prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // -----------------------------------------------------------------------
  // State
  // -----------------------------------------------------------------------

  var state = {
    name: '',
    gender: null,             // 'woman' | 'man'
    sessionToken: null,
    partnerName: null,

    deck: [],                 // array of question objects, filtered by gender
    answers: {},              // matchKey → response (1..4)
    qIndex: 0,                // current position in deck
    currentScreen: null,
    isTransitioning: false,   // disables rating taps during 140ms swap
    relaxTimer: null
  };

  // -----------------------------------------------------------------------
  // Tiny helpers
  // -----------------------------------------------------------------------

  function $(sel, root)  { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function pad2(n) { n = String(n); return n.length < 2 ? '0' + n : n; }

  function setEnabled(el, enabled) {
    if (!el) return;
    el.disabled = !enabled;
    el.setAttribute('aria-disabled', enabled ? 'false' : 'true');
  }

  function vibrate(ms) {
    if (navigator.vibrate) {
      try { navigator.vibrate(ms); } catch (e) { /* ignore */ }
    }
  }

  // -----------------------------------------------------------------------
  // Persistence
  // -----------------------------------------------------------------------

  function persistSession() {
    if (!state.sessionToken) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        sessionToken: state.sessionToken,
        name: state.name,
        gender: state.gender,
        partnerName: state.partnerName
      }));
    } catch (e) { /* ignore */ }
  }

  function loadSession() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      // Reject anything that doesn't carry our required field. This
      // protects against an older shape or partial junk lurking under
      // this key — better to start fresh than to call get_my_state with
      // garbage and let the server decide.
      if (!parsed || typeof parsed.sessionToken !== 'string' || parsed.sessionToken.length < 16) {
        return null;
      }
      return parsed;
    } catch (e) { return null; }
  }

  function clearSession() {
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* ignore */ }
  }

  // -----------------------------------------------------------------------
  // Hashing
  // -----------------------------------------------------------------------

  function hexFromBuffer(buf) {
    var bytes = new Uint8Array(buf);
    var out = '';
    for (var i = 0; i < bytes.length; i++) {
      var h = bytes[i].toString(16);
      out += (h.length === 1 ? '0' : '') + h;
    }
    return out;
  }

  async function hashCode(code) {
    var salt = window.CRAVE_CONFIG && window.CRAVE_CONFIG.CODE_HASH_SALT;
    if (!salt) throw new Error('Missing CODE_HASH_SALT');
    var payload = new TextEncoder().encode(salt + '::' + code);
    var hash = await crypto.subtle.digest('SHA-256', payload);
    return hexFromBuffer(hash);
  }

  // -----------------------------------------------------------------------
  // Supabase client
  // -----------------------------------------------------------------------

  var _supabase = null;

  function supabase() {
    if (_supabase) return _supabase;
    if (!window.supabase || !window.supabase.createClient) {
      throw new Error('Supabase JS not loaded');
    }
    _supabase = window.supabase.createClient(
      window.CRAVE_CONFIG.SUPABASE_URL,
      window.CRAVE_CONFIG.SUPABASE_PUBLISHABLE_KEY,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );
    return _supabase;
  }

  // Temporary diagnostics — see CRAVE_DEBUG in js/config.js.
  function debugEnabled() {
    return !!(window.CRAVE_CONFIG && window.CRAVE_CONFIG.CRAVE_DEBUG);
  }
  function debugLog() {
    if (!debugEnabled()) return;
    var args = ['[CRAVE-DEBUG]'].concat(Array.prototype.slice.call(arguments));
    /* eslint-disable no-console */
    console.log.apply(console, args);
    /* eslint-enable no-console */
  }

  async function rpc(fn, args) {
    var resp;
    try {
      resp = await supabase().rpc(fn, args);
    } catch (netErr) {
      netErr.__crave_kind = 'network';
      throw netErr;
    }
    if (resp.error) {
      var err = resp.error;
      err.__crave_kind = 'postgrest';
      err.__crave_rpc  = fn;
      throw err;
    }
    return resp.data;
  }

  function describeError(err, context) {
    /* eslint-disable no-console */
    console.error('[CRAVE] ' + context + ':', err);
    if (err && err.code)    console.error('[CRAVE] code:',    err.code);
    if (err && err.hint)    console.error('[CRAVE] hint:',    err.hint);
    if (err && err.details) console.error('[CRAVE] details:', err.details);
    /* eslint-enable no-console */
    if (!err) return 'Something went wrong.';
    if (err.__crave_kind === 'network') {
      return 'Network error: ' + (err.message || 'request failed') + '.';
    }
    var bits = [];
    if (err.message) bits.push(err.message);
    if (err.code)    bits.push('code ' + err.code);
    return bits.length ? bits.join(' · ') : String(err);
  }

  // -----------------------------------------------------------------------
  // Logo mounting (split-heart SVG with a unique clip id per instance)
  // -----------------------------------------------------------------------

  function mountLogos() {
    var marks = $$('[data-logo]');
    for (var i = 0; i < marks.length; i++) {
      var holder = marks[i];
      var id = 'crave-clip-' + holder.getAttribute('data-logo');
      holder.innerHTML = SVG_LOGO.replace(/__CLIP__/g, id);
    }
  }

  // -----------------------------------------------------------------------
  // Screen navigation
  // -----------------------------------------------------------------------

  function visibleScreen() {
    var els = document.querySelectorAll('.screen');
    for (var i = 0; i < els.length; i++) {
      if (!els[i].hidden) return els[i];
    }
    return null;
  }

  function goto(name, opts) {
    opts = opts || {};
    var next = document.getElementById('screen-' + name);
    if (!next) return;
    var current = visibleScreen();
    if (current === next) return;

    // Tear down any per-screen timers.
    if (state.relaxTimer) { clearTimeout(state.relaxTimer); state.relaxTimer = null; }

    if (current) {
      current.hidden = true;
      current.classList.remove('is-entering');
    }
    next.hidden = false;
    state.currentScreen = name;

    if (!prefersReducedMotion && !opts.skipAnim) {
      next.classList.remove('is-entering');
      void next.offsetWidth;
      next.classList.add('is-entering');
      window.setTimeout(function () { next.classList.remove('is-entering'); }, SCREEN_ANIM_MS + 40);
    }

    try { window.scrollTo({ top: 0, behavior: 'auto' }); } catch (e) { window.scrollTo(0, 0); }

    // Move focus to the screen heading for SR users.
    var heading = next.querySelector('h1, h2');
    if (heading) {
      if (!heading.hasAttribute('tabindex')) heading.setAttribute('tabindex', '-1');
      try { heading.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
    }

    // Screen-specific entry hooks.
    if (name === 'name') {
      window.setTimeout(function () {
        var i = $('#input-name');
        if (i) i.focus();
      }, SCREEN_ANIM_MS);
    }
    if (name === 'code') {
      window.setTimeout(function () {
        var boxes = $$('#screen-code .code-box');
        if (boxes[0]) boxes[0].focus();
      }, SCREEN_ANIM_MS);
    }
    if (name === 'ready') {
      // The exact deck length depends on gender; never let the placeholder
      // "55 questions" leak through after the rebrand to a smaller deck.
      var deckLen = state.gender ? window.craveDeckForGender(state.gender).length : 0;
      var rc = $('#screen-ready [data-slot="ready-count"]');
      if (rc) rc.textContent = String(deckLen);
    }
    if (name === 'relax') {
      state.relaxTimer = window.setTimeout(function () {
        if (state.currentScreen === 'relax') startQuestionnaire();
      }, RELAX_HOLD_MS);
    }
  }

  // -----------------------------------------------------------------------
  // Inline error display
  // -----------------------------------------------------------------------

  function ensureErrorSlot(screenName) {
    var screen = document.getElementById('screen-' + screenName);
    if (!screen) return null;
    var slot = screen.querySelector('[data-slot="error"]');
    if (slot) return slot;
    slot = document.createElement('p');
    slot.className = 'form-error';
    slot.setAttribute('data-slot', 'error');
    slot.setAttribute('role', 'alert');
    slot.hidden = true;
    var actions = screen.querySelector('.screen-actions');
    if (actions) screen.insertBefore(slot, actions);
    else screen.appendChild(slot);
    return slot;
  }
  function showError(screenName, message) {
    var slot = ensureErrorSlot(screenName);
    if (!slot) return;
    if (message) { slot.textContent = message; slot.hidden = false; }
    else         { slot.textContent = '';      slot.hidden = true; }
  }
  function clearError(screenName) { showError(screenName, ''); }

  // -----------------------------------------------------------------------
  // Busy button state
  // -----------------------------------------------------------------------

  function setBusy(button, busy, busyLabel) {
    if (!button) return;
    if (busy) {
      if (!button.dataset.originalText) button.dataset.originalText = button.textContent;
      button.disabled = true;
      button.setAttribute('aria-disabled', 'true');
      button.classList.add('is-busy');
      if (busyLabel) button.textContent = busyLabel;
    } else {
      button.disabled = false;
      button.removeAttribute('aria-disabled');
      button.classList.remove('is-busy');
      if (button.dataset.originalText) {
        button.textContent = button.dataset.originalText;
        delete button.dataset.originalText;
      }
    }
  }

  // -----------------------------------------------------------------------
  // Back navigation map (steps 2-4 only, per brief)
  // -----------------------------------------------------------------------

  var BACK_MAP = {
    'name':   'welcome',
    'gender': 'name',
    'code':   'gender'
  };

  function onBackTap() {
    var target = BACK_MAP[state.currentScreen];
    if (target) goto(target);
  }

  // -----------------------------------------------------------------------
  // Screen 1 → 2 → 3 → 4 handlers
  // -----------------------------------------------------------------------

  function onWelcomeStart() { goto('name'); }

  // Only shown on Welcome when this device already has a local session.
  // Lets a returning user wipe THIS device's session_token (only) and
  // start a fresh onboarding without touching anything in the database.
  function onWelcomeReset() {
    if (!window.confirm('Clear this device only? Your partner\'s answers stay safe.')) return;
    clearSession();
    state.sessionToken = null;
    state.name = '';
    state.gender = null;
    state.partnerName = null;
    state.answers = {};
    state.deck = [];
    state.qIndex = 0;
    var btn = document.querySelector('[data-action="welcome-reset"]');
    if (btn) btn.hidden = true;
    /* eslint-disable no-console */
    console.info('[CRAVE] welcome: local session_token wiped on user request.');
    /* eslint-enable no-console */
  }

  function refreshWelcomeResetVisibility() {
    var btn = document.querySelector('[data-action="welcome-reset"]');
    if (!btn) return;
    btn.hidden = !loadSession();
  }

  function onNameInput(e) {
    setEnabled($('[data-action="name-next"]'), e.target.value.trim().length >= 1);
  }
  function onNameNext() {
    var v = ($('#input-name').value || '').trim();
    if (v.length < 1) return;
    state.name = v;
    goto('gender');
  }

  function onGenderSelect(e) {
    var g = e.currentTarget.getAttribute('data-gender');
    if (g !== 'woman' && g !== 'man') return;
    state.gender = g;
    // Prep the code screen.
    clearError('code');
    $$('#screen-code .code-box').forEach(function (b) { b.value = ''; });
    setEnabled($('[data-action="code-join"]'), false);
    goto('code');
  }

  // -----------------------------------------------------------------------
  // Code-input behaviour (4 boxes, auto-advance + paste + backspace)
  // -----------------------------------------------------------------------

  function readCode() {
    return $$('#screen-code .code-box').map(function (b) { return b.value.replace(/\D/g, ''); }).join('');
  }

  function refreshJoinEnabled() {
    setEnabled($('[data-action="code-join"]'), readCode().length === 4);
  }

  function onCodeBoxInput(e) {
    var box = e.target;
    var val = (box.value || '').replace(/\D/g, '');
    box.value = val.slice(-1); // single digit
    if (box.value) {
      var next = box.nextElementSibling;
      while (next && !next.classList.contains('code-box')) next = next.nextElementSibling;
      if (next) next.focus();
    }
    refreshJoinEnabled();
    clearError('code');
  }

  function onCodeBoxKeydown(e) {
    var box = e.target;
    if (e.key === 'Backspace' && !box.value) {
      var prev = box.previousElementSibling;
      while (prev && !prev.classList.contains('code-box')) prev = prev.previousElementSibling;
      if (prev) { prev.focus(); prev.value = ''; refreshJoinEnabled(); }
      e.preventDefault();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (readCode().length === 4) onCodeJoin();
    } else if (e.key === 'ArrowLeft') {
      var p = box.previousElementSibling;
      while (p && !p.classList.contains('code-box')) p = p.previousElementSibling;
      if (p) p.focus();
    } else if (e.key === 'ArrowRight') {
      var n = box.nextElementSibling;
      while (n && !n.classList.contains('code-box')) n = n.nextElementSibling;
      if (n) n.focus();
    }
  }

  function onCodePaste(e) {
    var text = ((e.clipboardData || window.clipboardData).getData('text') || '').replace(/\D/g, '').slice(0, 4);
    if (!text) return;
    e.preventDefault();
    var boxes = $$('#screen-code .code-box');
    for (var i = 0; i < boxes.length; i++) {
      boxes[i].value = text.charAt(i) || '';
    }
    var nextEmpty = -1;
    for (var j = 0; j < boxes.length; j++) {
      if (!boxes[j].value) { nextEmpty = j; break; }
    }
    var focusIdx = nextEmpty === -1 ? boxes.length - 1 : nextEmpty;
    if (boxes[focusIdx]) boxes[focusIdx].focus();
    refreshJoinEnabled();
  }

  // -----------------------------------------------------------------------
  // Code Join
  // -----------------------------------------------------------------------

  async function onCodeJoin() {
    var code = readCode();
    if (code.length !== 4) return;
    if (!state.name || !state.gender) { goto('name'); return; }

    var btn = $('[data-action="code-join"]');
    clearError('code');
    setBusy(btn, true, 'Joining…');

    try {
      var codeHash = await hashCode(code);
      var resp = await rpc('join_session', {
        p_code_hash: codeHash,
        p_name: state.name,
        p_gender: state.gender
      });
      state.sessionToken = resp.session_token;
      state.partnerName  = resp.partner_name || null;
      persistSession();
      goto('ready');
    } catch (err) {
      var msg = (err && (err.message || '')) || '';
      var friendly;
      if (msg.indexOf('code_not_found') !== -1) {
        friendly = "We don't know that code. Double-check with your partner.";
      } else if (msg.indexOf('couple_full') !== -1) {
        friendly = 'That code already has two people in it. Try a different code.';
      } else if (msg.indexOf('invalid_') !== -1) {
        friendly = 'Could not join. Please go back and check the steps.';
      } else {
        friendly = describeError(err, 'join_session failed');
      }
      showError('code', friendly);
    } finally {
      setBusy(btn, false);
    }
  }

  // -----------------------------------------------------------------------
  // Code Create
  // -----------------------------------------------------------------------

  function randomFourDigits() {
    var n = Math.floor(Math.random() * 10000);
    var s = String(n);
    while (s.length < 4) s = '0' + s;
    return s;
  }

  async function onCodeCreate() {
    if (!state.name || !state.gender) { goto('name'); return; }

    var btn = $('[data-action="code-create"]');
    clearError('code');
    setBusy(btn, true, 'Generating…');

    var lastErr = null;
    try {
      for (var attempt = 0; attempt < CODE_CREATE_MAX_ATTEMPTS; attempt++) {
        var code = randomFourDigits();
        var hash = await hashCode(code);
        try {
          var resp = await rpc('create_session', {
            p_code_hash: hash,
            p_name: state.name,
            p_gender: state.gender
          });
          state.sessionToken = resp.session_token;
          state.partnerName = null;
          persistSession();
          // Surface the chosen code to the user.
          var slot = $('#screen-code-created [data-slot="code-value"]');
          if (slot) slot.textContent = code;
          goto('code-created');
          return;
        } catch (innerErr) {
          lastErr = innerErr;
          var im = (innerErr && innerErr.message) || '';
          if (im.indexOf('code_in_use') !== -1) {
            // Roll another digit and retry.
            continue;
          }
          throw innerErr;
        }
      }
      throw lastErr || new Error('exhausted code attempts');
    } catch (err) {
      showError('code', describeError(err, 'create_session failed'));
    } finally {
      setBusy(btn, false);
    }
  }

  function onCodeCreatedContinue() {
    var slot = $('#screen-code-created [data-slot="code-value"]');
    if (slot) slot.textContent = ''; // privacy hygiene
    goto('ready');
  }

  // -----------------------------------------------------------------------
  // Ready + Relax
  // -----------------------------------------------------------------------

  function onReadyGo() { goto('relax'); }

  function onRelaxSkip() {
    if (state.relaxTimer) { clearTimeout(state.relaxTimer); state.relaxTimer = null; }
    startQuestionnaire();
  }

  // -----------------------------------------------------------------------
  // Questionnaire
  // -----------------------------------------------------------------------

  function buildDeckAndIndex() {
    state.deck = window.craveDeckForGender(state.gender);
    // Resume at the first unanswered question.
    var firstUnanswered = 0;
    for (var i = 0; i < state.deck.length; i++) {
      if (state.answers[state.deck[i].matchKey] == null) { firstUnanswered = i; break; }
      firstUnanswered = i + 1;
    }
    state.qIndex = Math.min(firstUnanswered, state.deck.length - 1);
    if (firstUnanswered >= state.deck.length) {
      state.qIndex = state.deck.length - 1;
    }
  }

  function startQuestionnaire() {
    buildDeckAndIndex();
    // If all already answered, jump to result.
    var anyMissing = false;
    for (var i = 0; i < state.deck.length; i++) {
      if (state.answers[state.deck[i].matchKey] == null) { anyMissing = true; break; }
    }
    if (!anyMissing) {
      goto('result', { skipAnim: true });
      renderResult();
      return;
    }
    renderQuestion(true);
    goto('question');
  }

  function renderQuestion(initialMount) {
    var q = state.deck[state.qIndex];
    if (!q) return;
    var tile = $('[data-slot="q-tile"]');
    var card = $('#screen-question .q-card');
    var icon = $('[data-slot="q-icon"]');
    var text = $('[data-slot="q-text"]');
    var progress = $('[data-slot="q-progress"]');
    var bar = $('[data-slot="q-progress-bar"]');
    var back = $('[data-action="question-back"]');

    if (icon) icon.innerHTML = iconSvgFor(q.icon);
    if (text) text.textContent = q.text;
    // Scale the question text down for long phrases rather than letting it
    // overflow. Uppercase rendering adds ~12% width on average, so the
    // thresholds are slightly tighter than the raw character count.
    if (card) {
      card.classList.remove('is-long', 'is-extra-long');
      var len = (q.text || '').length;
      if (len > 70)      card.classList.add('is-extra-long');
      else if (len > 48) card.classList.add('is-long');
    }
    if (progress) {
      progress.textContent = pad2(state.qIndex + 1) + ' / ' + pad2(state.deck.length);
    }
    if (bar) {
      var pct = ((state.qIndex) / state.deck.length) * 100;
      bar.style.width = pct + '%';
    }
    if (back) {
      // Undo only available after the first card.
      back.disabled = state.qIndex === 0;
    }

    if (initialMount) return;

    // Enter animation
    if (tile && !prefersReducedMotion) {
      tile.classList.remove('is-entering');
      void tile.offsetWidth;
      tile.classList.add('is-entering');
      window.setTimeout(function () { tile.classList.remove('is-entering'); }, TILE_ANIM_MS + 20);
    }
  }

  function setRatingDisabled(disabled) {
    $$('#screen-question .rating-btn').forEach(function (b) { b.disabled = disabled; });
  }

  async function onRatingTap(e) {
    if (state.isTransitioning) return;
    var btn = e.currentTarget;
    var response = parseInt(btn.getAttribute('data-response'), 10);
    if (!response || response < 1 || response > 4) return;

    var q = state.deck[state.qIndex];
    if (!q) return;

    state.isTransitioning = true;
    setRatingDisabled(true);

    // Press feedback
    btn.classList.add('is-pop');
    vibrate(10);
    window.setTimeout(function () { btn.classList.remove('is-pop'); }, 160);

    // Optimistic: store locally first; the server is the source of truth
    // but we don't want the user to wait per card.
    state.answers[q.matchKey] = response;

    var tile = $('[data-slot="q-tile"]');
    var doAdvance = function () {
      var isLast = state.qIndex >= state.deck.length - 1;
      if (isLast) {
        finishQuestionnaire();
        state.isTransitioning = false;
      } else {
        state.qIndex += 1;
        renderQuestion(false);
        state.isTransitioning = false;
        setRatingDisabled(false);
      }
    };

    if (prefersReducedMotion || !tile) {
      doAdvance();
    } else {
      tile.classList.remove('is-entering');
      tile.classList.add('is-exiting');
      window.setTimeout(function () {
        tile.classList.remove('is-exiting');
        doAdvance();
      }, TILE_ANIM_MS);
    }

    debugLog('submit_answer', {
      match_key: q.matchKey,
      response:  response,            // 1=NO WAY, 2=NEED TO THINK, 3=MAYBE ONCE, 4=ANYTIME
      q_id:      q.id,
      q_index:   state.qIndex + 1,
      total:     state.deck.length
    });

    // Fire-and-forget the network write. If it fails, surface the error
    // and let the user retry from undo.
    try {
      await rpc('submit_answer', {
        p_session_token: state.sessionToken,
        p_match_key: q.matchKey,
        p_response: response
      });
    } catch (err) {
      describeError(err, 'submit_answer failed');
      // Keep going — local state is correct, server can be retried by
      // re-answering after undo.
    }
  }

  function onQuestionBack() {
    if (state.isTransitioning) return;
    if (state.qIndex <= 0) return;
    state.qIndex -= 1;
    renderQuestion(false);
  }

  async function finishQuestionnaire() {
    // Make the progress bar reach 100% before we leave the screen.
    var bar = $('[data-slot="q-progress-bar"]');
    if (bar) bar.style.width = '100%';

    try {
      await rpc('complete_questionnaire', { p_session_token: state.sessionToken });
    } catch (err) {
      describeError(err, 'complete_questionnaire failed');
    }
    goto('result');
    renderResult();
  }

  // -----------------------------------------------------------------------
  // Result screen
  // -----------------------------------------------------------------------

  function emptyEl(host) { while (host.firstChild) host.removeChild(host.firstChild); }

  function makeMatchCard(matchKey, tier) {
    var label = window.CRAVE_RESULT_LABEL[matchKey] || matchKey;
    var card = document.createElement('div');
    card.className = 'match-card';
    card.textContent = label;
    card.setAttribute('data-tier', tier);
    return card;
  }

  function makeMatchGroup(tier, label, iconSvg, matchKeys) {
    var group = document.createElement('section');
    group.className = 'match-group match-group--' + tier;

    var header = document.createElement('h3');
    header.className = 'match-group-header';
    header.innerHTML = iconSvg + '<span>' + label + '</span>';
    group.appendChild(header);

    var list = document.createElement('div');
    list.className = 'match-list';
    matchKeys.forEach(function (k) { list.appendChild(makeMatchCard(k, tier)); });
    group.appendChild(list);

    return group;
  }

  function iconSvg(name) {
    var common = 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"';
    if (name === 'flame') {
      return '<svg viewBox="0 0 24 24" ' + common.replace('fill="none"', 'fill="currentColor"') + '><path d="M12 2c1.2 3.5-.4 5.4-1.5 6.7-1.2 1.4-2.2 2.9-2.2 5 0 1.4.6 2.6 1.5 3.4-.7-.3-2-1.3-2.3-3.3-.7 1.6-1.3 3-1 4.6.4 2.7 2.9 4.6 5.5 4.6 3.5 0 6.5-2.8 6.5-6.5 0-6.5-6.5-9-6.5-14.5z"/></svg>';
    }
    if (name === 'heart') {
      return '<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="0.5" width="16" height="16"><path d="M12 21s-7-4.4-9-9c-1.4-3.2.6-7 4-7 2 0 3.6 1.2 5 3 1.4-1.8 3-3 5-3 3.4 0 5.4 3.8 4 7-2 4.6-9 9-9 9z"/></svg>';
    }
    if (name === 'clock') {
      return '<svg viewBox="0 0 24 24" ' + common + '><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>';
    }
    return '';
  }

  function renderResult(autoRefreshed) {
    if (!state.sessionToken) { goto('welcome'); return; }
    var host = $('[data-slot="result-body"]');
    var actions = $('[data-slot="result-actions"]');
    if (!host) return;
    emptyEl(host);

    // Loading state
    var loading = document.createElement('div');
    loading.className = 'result-waiting';
    loading.innerHTML = '<h3>Tallying matches…</h3><p>Just a second.</p>';
    host.appendChild(loading);
    if (actions) actions.hidden = true;

    rpc('get_results', { p_session_token: state.sessionToken }).then(function (data) {
      debugLog('get_results payload:', data);
      emptyEl(host);
      if (!data || data.ready === false) {
        var box = document.createElement('div');
        box.className = 'result-waiting';
        var who = (data && data.partner_name) ? data.partner_name : 'your partner';
        box.innerHTML = ''
          + '<h3>Your answers are saved.</h3>'
          + '<p>Open results once ' + escapeHtml(who) + ' has finished.</p>';
        var checkBtn = document.createElement('button');
        checkBtn.type = 'button';
        checkBtn.className = 'btn btn--primary';
        checkBtn.textContent = 'Check again';
        checkBtn.addEventListener('click', function () { renderResult(true); });
        box.appendChild(checkBtn);

        var leaveBtn = document.createElement('button');
        leaveBtn.type = 'button';
        leaveBtn.className = 'btn btn--quiet btn--quiet-danger';
        leaveBtn.textContent = 'Start a new session';
        leaveBtn.addEventListener('click', onResultDelete);
        host.appendChild(box);
        host.appendChild(leaveBtn);
        return;
      }

      var anytime = data.both_anytime || [];
      var keen    = data.both_keen    || [];
      var talk    = data.worth_talking|| [];
      var total   = anytime.length + keen.length + talk.length;

      // Hero
      var hero = document.createElement('div');
      hero.className = 'result-hero';
      hero.innerHTML = ''
        + '<div class="result-count">' + total + '</div>'
        + '<div class="result-count-label">things you both want</div>'
        + '<div class="result-privacy">Only mutual answers show. The rest stays private.</div>';
      host.appendChild(hero);

      if (total === 0) {
        var empty = document.createElement('div');
        empty.className = 'result-empty';
        empty.innerHTML = '<strong>No overlaps this round.</strong><p>Try a fresh set when you both feel like it.</p>';
        host.appendChild(empty);

        // Diagnostics for the pairing bug. Mobile devices rarely have
        // DevTools handy, so when the bug reproduces we surface the raw
        // payload inline. Removable in one line by flipping CRAVE_DEBUG
        // off in js/config.js.
        if (debugEnabled()) {
          var dbg = document.createElement('details');
          dbg.className = 'result-debug';
          dbg.innerHTML =
            '<summary>Debug: raw get_results payload</summary>'
            + '<pre>' + escapeHtml(JSON.stringify(data, null, 2)) + '</pre>'
            + '<p>If both arrays are empty here, the two devices either '
            + 'answered different match_keys (one device likely cached an '
            + 'older deck) or one device\'s session_token belongs to a '
            + 'pre-rewrite couple. Use "Delete all our data" and re-pair '
            + 'with both devices reloaded.</p>';
          host.appendChild(dbg);
        }
      } else {
        if (anytime.length) host.appendChild(makeMatchGroup('anytime', 'Both said anytime', iconSvg('flame'), anytime));
        if (keen.length)    host.appendChild(makeMatchGroup('keen',    'Both keen',         iconSvg('heart'), keen));
        if (talk.length)    host.appendChild(makeMatchGroup('talk',    'Worth talking about', iconSvg('clock'), talk));
      }

      if (actions) actions.hidden = false;
    }).catch(function (err) {
      emptyEl(host);
      var box = document.createElement('div');
      box.className = 'result-waiting';
      box.innerHTML = '<h3>Could not load results</h3><p>' + escapeHtml(describeError(err, 'get_results failed')) + '</p>';
      var retry = document.createElement('button');
      retry.type = 'button';
      retry.className = 'btn btn--primary';
      retry.textContent = 'Try again';
      retry.addEventListener('click', function () { renderResult(true); });
      box.appendChild(retry);
      host.appendChild(box);
    });
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[c];
    });
  }

  function onResultShare() {
    var url = window.location.href;
    var text = 'We just tried Crave — see what you both want. ' + url;
    if (navigator.share) {
      navigator.share({ title: 'Crave', text: text }).catch(function () { /* user cancelled */ });
      return;
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(function () {
        showResultToast('Link copied');
      });
    }
  }

  function showResultToast(text) {
    var t = document.createElement('div');
    t.className = 'form-error';
    t.style.position = 'fixed';
    t.style.left = '50%';
    t.style.bottom = '24px';
    t.style.transform = 'translateX(-50%)';
    t.style.zIndex = '999';
    t.style.color = '#FF8FB6';
    t.style.background = '#1A1216';
    t.style.borderColor = 'rgba(255,46,116,.35)';
    t.textContent = text;
    document.body.appendChild(t);
    window.setTimeout(function () { t.remove(); }, 1800);
  }

  function onResultPick() {
    // The brief allows a basic list here; we just scroll the first group
    // into view so the user can pick visually.
    var firstGroup = document.querySelector('.match-group');
    if (firstGroup && firstGroup.scrollIntoView) {
      firstGroup.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  async function onResultDelete() {
    if (!state.sessionToken) {
      hardReset();
      goto('welcome');
      return;
    }
    if (!window.confirm('Delete this session and both sets of answers? This cannot be undone.')) {
      return;
    }
    try {
      await rpc('delete_couple_data', { p_session_token: state.sessionToken });
    } catch (err) {
      describeError(err, 'delete_couple_data failed');
    }
    hardReset();
    goto('welcome');
  }

  function hardReset() {
    clearSession();
    state.name = '';
    state.gender = null;
    state.sessionToken = null;
    state.partnerName = null;
    state.deck = [];
    state.answers = {};
    state.qIndex = 0;
  }

  // -----------------------------------------------------------------------
  // Session restore on reload
  // -----------------------------------------------------------------------

  // Defensive: actively drop any URL query/hash on load. Nothing about
  // session or screen state is ever read from the URL, so the safest
  // posture is to evict anything that lands there (extension, share
  // link, leftover from an old build, etc.) before init proceeds.
  function stripUrlState() {
    try {
      if (window.location.search || window.location.hash) {
        var clean = window.location.pathname;
        window.history.replaceState(null, '', clean);
        /* eslint-disable no-console */
        console.info('[CRAVE] url: stripped query/hash (no URL params are honored).');
        /* eslint-enable no-console */
      }
    } catch (e) { /* ignore */ }
  }

  async function tryRestoreSession() {
    var saved = loadSession();
    if (!saved || !saved.sessionToken) {
      /* eslint-disable no-console */
      console.info('[CRAVE] restore: no local session_token, will run full onboarding.');
      /* eslint-enable no-console */
      return false;
    }
    /* eslint-disable no-console */
    console.info('[CRAVE] restore: calling get_my_state for token ending in …' + saved.sessionToken.slice(-6));
    /* eslint-enable no-console */
    try {
      var st = await rpc('get_my_state', { p_session_token: saved.sessionToken });
      if (!st || !st.user) { clearSession(); return false; }

      state.sessionToken = saved.sessionToken;
      state.name = st.user.name;
      state.gender = st.user.gender;
      state.partnerName = (st.partner && st.partner.name) || null;

      // Reseed answers from server.
      state.answers = {};
      var arr = st.my_answers || [];
      for (var i = 0; i < arr.length; i++) {
        state.answers[arr[i].match_key] = arr[i].response;
      }

      if (st.user.completed_at) {
        // User already done — straight to result.
        goto('result', { skipAnim: true });
        renderResult();
      } else {
        // Resume the questionnaire at the next unanswered card.
        buildDeckAndIndex();
        renderQuestion(true);
        goto('question', { skipAnim: true });
      }
      return true;
    } catch (err) {
      describeError(err, 'session restore failed');
      clearSession();
      return false;
    }
  }

  // -----------------------------------------------------------------------
  // Wire-up
  // -----------------------------------------------------------------------

  function bindEvents() {
    // Logos
    mountLogos();

    // Welcome
    $('[data-action="welcome-start"]').addEventListener('click', onWelcomeStart);
    $('[data-action="welcome-reset"]').addEventListener('click', onWelcomeReset);
    refreshWelcomeResetVisibility();

    // Name
    var nameInput = $('#input-name');
    if (nameInput) {
      nameInput.addEventListener('input', onNameInput);
      nameInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && nameInput.value.trim().length >= 1) {
          e.preventDefault(); onNameNext();
        }
      });
    }
    $('[data-action="name-next"]').addEventListener('click', onNameNext);

    // Gender
    $$('[data-gender]').forEach(function (b) { b.addEventListener('click', onGenderSelect); });

    // Code boxes
    $$('#screen-code .code-box').forEach(function (b) {
      b.addEventListener('input', onCodeBoxInput);
      b.addEventListener('keydown', onCodeBoxKeydown);
      b.addEventListener('paste', onCodePaste);
    });
    $('[data-action="code-join"]').addEventListener('click', onCodeJoin);
    $('[data-action="code-create"]').addEventListener('click', onCodeCreate);
    $('[data-action="code-created-continue"]').addEventListener('click', onCodeCreatedContinue);

    // Ready / Relax
    $('[data-action="ready-go"]').addEventListener('click', onReadyGo);
    $('[data-action="relax-skip"]').addEventListener('click', onRelaxSkip);

    // Question
    $$('#screen-question .rating-btn').forEach(function (b) { b.addEventListener('click', onRatingTap); });
    $('[data-action="question-back"]').addEventListener('click', onQuestionBack);

    // Result
    $('[data-action="result-share"]').addEventListener('click', onResultShare);
    $('[data-action="result-pick"]').addEventListener('click', onResultPick);
    $('[data-action="result-delete"]').addEventListener('click', onResultDelete);

    // Generic Back chevrons (steps 2-4).
    $$('[data-action="back"]').forEach(function (b) { b.addEventListener('click', onBackTap); });
  }

  async function init() {
    bindEvents();
    stripUrlState();

    var saved = loadSession();
    if (!saved || !saved.sessionToken) {
      // Splash already visible from the HTML default.
      /* eslint-disable no-console */
      console.info('[CRAVE] init: no local session → Welcome (fresh device or cleared storage).');
      /* eslint-enable no-console */
      state.currentScreen = 'welcome';
      return;
    }
    /* eslint-disable no-console */
    console.info('[CRAVE] init: local session_token present → attempting resume.');
    /* eslint-enable no-console */
    var restored = await tryRestoreSession();
    if (!restored) {
      /* eslint-disable no-console */
      console.info('[CRAVE] init: restore failed → falling back to Welcome.');
      /* eslint-enable no-console */
      goto('welcome', { skipAnim: true });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
