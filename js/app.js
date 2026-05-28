// Discover Together — onboarding + pairing controller.
//
// Scope of this chunk:
//   * Screen navigation with subtle slide/fade transitions.
//   * Name → Role → PIN entry, with client-side validation.
//   * Client-side PIN hashing (SHA-256 + fixed app salt from config.js).
//   * Supabase RPC calls: prepare_join, commit_join, get_my_state.
//   * Branching from prepare_join: empty / partner_pending / role_taken / couple_full.
//   * Partner-confirmation screen → commit_join → How-It-Works.
//   * How-It-Works → Privacy Promise → first Question card (inert).
//   * Session persistence in localStorage; on reload, restore via get_my_state.
//
// Out of scope (later chunks):
//   * Answer-button submission, progress tracking, completion, results.

(function () {
  'use strict';

  // -----------------------------------------------------------------------
  // Config
  // -----------------------------------------------------------------------

  var STORAGE_KEY = 'discover-together::session::v1';
  var SCREEN_ANIM_MS = 280;

  var prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // -----------------------------------------------------------------------
  // State (in-memory; the only persisted piece is session_token + a name
  // copy used to render quickly on reload before the RPC resolves).
  // -----------------------------------------------------------------------

  var state = {
    name: '',
    role: null,            // 'her' | 'him'
    pinHash: null,         // only held in memory between PIN screen and commit_join
    sessionToken: null,
    partnerName: null,
    currentScreen: null,
    currentQuestionIndex: 0
  };

  // -----------------------------------------------------------------------
  // localStorage helpers (best-effort; private mode may throw).
  // -----------------------------------------------------------------------

  function persistSession() {
    if (!state.sessionToken) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        sessionToken: state.sessionToken,
        name: state.name,
        role: state.role,
        partnerName: state.partnerName
      }));
    } catch (e) { /* ignore */ }
  }

  function loadSession() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function clearSession() {
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* ignore */ }
  }

  // -----------------------------------------------------------------------
  // PIN hashing: SHA-256 of (salt + '::' + pin), hex-encoded.
  // -----------------------------------------------------------------------

  function hexFromBuffer(buffer) {
    var bytes = new Uint8Array(buffer);
    var out = '';
    for (var i = 0; i < bytes.length; i++) {
      var h = bytes[i].toString(16);
      out += (h.length === 1 ? '0' : '') + h;
    }
    return out;
  }

  async function hashPin(pin) {
    var salt = window.DT_CONFIG && window.DT_CONFIG.PIN_HASH_SALT;
    if (!salt) throw new Error('Missing PIN_HASH_SALT');
    var payload = new TextEncoder().encode(salt + '::' + pin);
    var hash = await crypto.subtle.digest('SHA-256', payload);
    return hexFromBuffer(hash);
  }

  // -----------------------------------------------------------------------
  // Supabase client (lazily constructed).
  // -----------------------------------------------------------------------

  var _supabase = null;

  function supabase() {
    if (_supabase) return _supabase;
    if (!window.supabase || !window.supabase.createClient) {
      throw new Error('Supabase JS not loaded');
    }
    _supabase = window.supabase.createClient(
      window.DT_CONFIG.SUPABASE_URL,
      window.DT_CONFIG.SUPABASE_PUBLISHABLE_KEY,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );
    return _supabase;
  }

  async function rpc(fn, args) {
    var resp;
    try {
      resp = await supabase().rpc(fn, args);
    } catch (networkErr) {
      // Thrown for true network failures (DNS, offline, CORS preflight blocked, …).
      networkErr.__dt_kind = 'network';
      throw networkErr;
    }
    if (resp.error) {
      // PostgrestError shape: { message, code, hint, details, status }.
      var pgErr = resp.error;
      pgErr.__dt_kind = 'postgrest';
      pgErr.__dt_rpc  = fn;
      throw pgErr;
    }
    return resp.data;
  }

  // Turn any thrown error into a single line for the user, while making
  // sure the full object is in console.error for DevTools inspection.
  function describeError(err, context) {
    /* eslint-disable no-console */
    console.error('[DT] ' + context + ':', err);
    if (err && err.cause)    console.error('[DT] cause:',    err.cause);
    if (err && err.status)   console.error('[DT] status:',   err.status);
    if (err && err.code)     console.error('[DT] code:',     err.code);
    if (err && err.details)  console.error('[DT] details:',  err.details);
    if (err && err.hint)     console.error('[DT] hint:',     err.hint);
    /* eslint-enable no-console */

    if (!err) return 'Unknown error.';

    if (err.__dt_kind === 'network') {
      return 'Network error: ' + (err.message || 'request failed') +
             '. Check your connection and try again.';
    }
    // PostgrestError or anything with a message.
    var bits = [];
    if (err.message) bits.push(err.message);
    if (err.code)    bits.push('code ' + err.code);
    if (err.hint)    bits.push(err.hint);
    return bits.length ? bits.join(' · ') : String(err);
  }

  // -----------------------------------------------------------------------
  // Screen navigation
  // -----------------------------------------------------------------------

  function findVisibleScreen() {
    var screens = document.querySelectorAll('.screen');
    for (var i = 0; i < screens.length; i++) {
      if (!screens[i].hidden) return screens[i];
    }
    return null;
  }

  function goto(name, opts) {
    opts = opts || {};
    var next = document.getElementById('screen-' + name);
    if (!next) return;

    var current = findVisibleScreen();
    if (current === next) return;

    if (current) {
      current.hidden = true;
      current.classList.remove('is-entering');
    }

    next.hidden = false;
    state.currentScreen = name;

    // Restart enter animation
    if (!prefersReducedMotion && !opts.skipAnim) {
      next.classList.remove('is-entering');
      // Force reflow so the animation restarts cleanly.
      void next.offsetWidth;
      next.classList.add('is-entering');
      window.setTimeout(function () {
        next.classList.remove('is-entering');
      }, SCREEN_ANIM_MS + 40);
    }

    // Top of viewport on each screen change.
    try { window.scrollTo({ top: 0, behavior: 'auto' }); } catch (e) { window.scrollTo(0, 0); }

    // Move focus to the first heading for screen readers.
    var heading = next.querySelector('h1, h2');
    if (heading) {
      if (!heading.hasAttribute('tabindex')) heading.setAttribute('tabindex', '-1');
      try { heading.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
    }
  }

  // -----------------------------------------------------------------------
  // Inline error display (one slot per screen, created lazily).
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
    if (message) {
      slot.textContent = message;
      slot.hidden = false;
    } else {
      slot.textContent = '';
      slot.hidden = true;
    }
  }

  function clearError(screenName) {
    showError(screenName, '');
  }

  // -----------------------------------------------------------------------
  // Busy state on a primary button
  // -----------------------------------------------------------------------

  function setBusy(button, busy, busyLabel) {
    if (!button) return;
    if (busy) {
      if (!button.dataset.originalText) {
        button.dataset.originalText = button.textContent;
      }
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
  // Question rendering (chunk 3: render Q1 only, answer buttons inert)
  // -----------------------------------------------------------------------

  function renderCurrentQuestion() {
    var list = window.QUESTIONS || [];
    var q = list[state.currentQuestionIndex];
    if (!q) return;

    var screen = document.getElementById('screen-question');
    if (!screen) return;

    var phaseEl = screen.querySelector('[data-slot="phase-name"]');
    var progressEl = screen.querySelector('[data-slot="progress"]');
    var textEl = screen.querySelector('[data-slot="question-text"]');

    if (phaseEl)    phaseEl.textContent = 'Phase ' + q.phase + ': ' + q.phaseName;
    if (progressEl) progressEl.textContent = q.id + ' / ' + list.length;

    var phrase;
    if (q.split) {
      phrase = state.role === 'her' ? q.textHer : q.textHim;
    } else {
      phrase = q.text;
    }
    if (textEl) textEl.textContent = phrase + '?';
  }

  // -----------------------------------------------------------------------
  // Flow handlers
  // -----------------------------------------------------------------------

  function onSplashStart() {
    goto('name');
    window.setTimeout(function () {
      var input = document.getElementById('input-name');
      if (input) input.focus();
    }, SCREEN_ANIM_MS);
  }

  function onNameInput(e) {
    var btn = document.querySelector('[data-action="name-next"]');
    var ok = e.target.value.trim().length >= 2;
    btn.disabled = !ok;
    btn.setAttribute('aria-disabled', ok ? 'false' : 'true');
  }

  function onNameNext() {
    var input = document.getElementById('input-name');
    var val = (input.value || '').trim();
    if (val.length < 2) return;
    state.name = val;
    goto('role');
  }

  function onRoleSelect(e) {
    var role = e.currentTarget.getAttribute('data-role');
    if (role !== 'her' && role !== 'him') return;
    state.role = role;
    // Clear any stale PIN entry / error.
    var pinInput = document.getElementById('input-pin');
    if (pinInput) pinInput.value = '';
    var pinBtn = document.querySelector('[data-action="pin-next"]');
    if (pinBtn) {
      pinBtn.disabled = true;
      pinBtn.setAttribute('aria-disabled', 'true');
    }
    clearError('pin');
    goto('pin');
    window.setTimeout(function () {
      if (pinInput) pinInput.focus();
    }, SCREEN_ANIM_MS);
  }

  function onPinInput(e) {
    // Strip non-digits, clamp to 6.
    var cleaned = (e.target.value || '').replace(/\D/g, '').slice(0, 6);
    if (e.target.value !== cleaned) e.target.value = cleaned;
    var btn = document.querySelector('[data-action="pin-next"]');
    var ok = cleaned.length >= 4 && cleaned.length <= 6;
    btn.disabled = !ok;
    btn.setAttribute('aria-disabled', ok ? 'false' : 'true');
    clearError('pin');
  }

  async function onPinNext() {
    var input = document.getElementById('input-pin');
    var pin = (input.value || '').replace(/\D/g, '');
    if (pin.length < 4 || pin.length > 6) return;
    if (!state.name || !state.role) {
      // Defensive: shouldn't happen — bounce them back to the start.
      goto('name');
      return;
    }

    var btn = document.querySelector('[data-action="pin-next"]');
    clearError('pin');
    setBusy(btn, true, 'Checking…');

    try {
      var pinHash = await hashPin(pin);
      state.pinHash = pinHash;

      var result = await rpc('prepare_join', {
        p_pin_hash: pinHash,
        p_role: state.role
      });

      if (!result || !result.status) {
        showError('pin', 'Something went wrong. Try again?');
        return;
      }

      if (result.status === 'empty') {
        // No one with this PIN yet — create the couple.
        var commit = await rpc('commit_join', {
          p_pin_hash: pinHash,
          p_name: state.name,
          p_role: state.role
        });
        state.sessionToken = commit.session_token;
        state.partnerName = null;
        persistSession();
        // Don't carry the hash beyond commit.
        state.pinHash = null;
        // Confirm the freshly created PIN to the user so they can share it.
        var pinSlot = document.querySelector('#screen-pin-created [data-slot="pin-value"]');
        if (pinSlot) pinSlot.textContent = pin;
        goto('pin-created');
        return;
      }

      if (result.status === 'partner_pending') {
        state.partnerName = result.partner_name;
        var slot = document.querySelector('#screen-confirm-partner [data-slot="partner-name"]');
        if (slot) slot.textContent = result.partner_name;
        clearError('confirm-partner');
        goto('confirm-partner');
        return;
      }

      if (result.status === 'role_taken') {
        var otherLabel = result.other_role === 'her' ? 'Her' : 'Him';
        var requestedLabel = state.role === 'her' ? 'Her' : 'Him';
        showError(
          'pin',
          'Looks like there’s already a ' + requestedLabel +
          ' with this PIN. Try choosing ' + otherLabel + ' instead.'
        );
        return;
      }

      if (result.status === 'couple_full') {
        showError(
          'pin',
          'This PIN is already used by a couple. Try a different PIN with your partner.'
        );
        return;
      }

      showError('pin', 'Something went wrong. Try again?');
    } catch (err) {
      showError('pin', describeError(err, 'prepare_join failed'));
    } finally {
      setBusy(btn, false);
    }
  }

  async function onConfirmYes() {
    if (!state.pinHash || !state.name || !state.role) {
      goto('name');
      return;
    }
    var btn = document.querySelector('[data-action="confirm-yes"]');
    clearError('confirm-partner');
    setBusy(btn, true, 'Joining…');

    try {
      var commit = await rpc('commit_join', {
        p_pin_hash: state.pinHash,
        p_name: state.name,
        p_role: state.role
      });
      state.sessionToken = commit.session_token;
      if (commit.partner_name) state.partnerName = commit.partner_name;
      persistSession();
      state.pinHash = null;
      goto('how');
    } catch (err) {
      var msg = (err && (err.message || err.hint)) || '';
      var friendly;
      if (msg.indexOf('role_taken') !== -1) {
        friendly = 'That role was just taken. Go back and pick the other role.';
        console.error('[DT] commit_join: role_taken', err);
      } else if (msg.indexOf('couple_full') !== -1) {
        friendly = 'This PIN is already used by a couple.';
        console.error('[DT] commit_join: couple_full', err);
      } else {
        friendly = describeError(err, 'commit_join failed');
      }
      showError('confirm-partner', friendly);
    } finally {
      setBusy(btn, false);
    }
  }

  function onConfirmNo() {
    state.pinHash = null;
    state.partnerName = null;
    var input = document.getElementById('input-pin');
    if (input) input.value = '';
    var btn = document.querySelector('[data-action="pin-next"]');
    if (btn) {
      btn.disabled = true;
      btn.setAttribute('aria-disabled', 'true');
    }
    clearError('pin');
    goto('pin');
    window.setTimeout(function () {
      if (input) input.focus();
    }, SCREEN_ANIM_MS);
  }

  function onHowContinue() {
    goto('privacy');
  }

  function onPinCreatedContinue() {
    // Wipe the displayed PIN so it isn't sitting in the DOM after the
    // user moves on (someone might glance at their screen later).
    var slot = document.querySelector('#screen-pin-created [data-slot="pin-value"]');
    if (slot) slot.textContent = '';
    goto('how');
  }

  function onPrivacyContinue() {
    renderCurrentQuestion();
    goto('question');
  }

  // -----------------------------------------------------------------------
  // Session restore on reload
  // -----------------------------------------------------------------------

  async function tryRestoreSession() {
    var saved = loadSession();
    if (!saved || !saved.sessionToken) return false;

    // Leave the splash visible while we ask the server — it's better than
    // a blank screen during the round-trip. If the call returns valid
    // state, goto('question') will replace it; if it fails, we stay on
    // splash and start fresh.
    try {
      var st = await rpc('get_my_state', { p_session_token: saved.sessionToken });
      if (!st || !st.user) {
        clearSession();
        return false;
      }
      state.sessionToken = saved.sessionToken;
      state.name = st.user.name;
      state.role = st.user.role;
      state.partnerName = (st.partner && st.partner.name) || null;

      // For chunk 3 we always land users on the first question card.
      // Later chunks will use my_answers / completed_at to jump to the
      // right question, the waiting screen, or results.
      state.currentQuestionIndex = 0;
      renderCurrentQuestion();
      goto('question', { skipAnim: true });
      return true;
    } catch (err) {
      describeError(err, 'session restore failed');
      clearSession();
      return false;
    }
  }

  // -----------------------------------------------------------------------
  // Wire up DOM events
  // -----------------------------------------------------------------------

  function bind(sel, ev, fn) {
    var el = document.querySelector(sel);
    if (el) el.addEventListener(ev, fn);
  }

  function bindAll(sel, ev, fn) {
    document.querySelectorAll(sel).forEach(function (el) {
      el.addEventListener(ev, fn);
    });
  }

  function bindEvents() {
    // Splash
    bind('[data-action="splash-start"]', 'click', onSplashStart);

    // Name
    var nameInput = document.getElementById('input-name');
    if (nameInput) {
      nameInput.addEventListener('input', onNameInput);
      nameInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          if (nameInput.value.trim().length >= 2) onNameNext();
        }
      });
    }
    bind('[data-action="name-next"]', 'click', onNameNext);

    // Role
    bindAll('[data-role]', 'click', onRoleSelect);

    // PIN
    var pinInput = document.getElementById('input-pin');
    if (pinInput) {
      pinInput.addEventListener('input', onPinInput);
      pinInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          var btn = document.querySelector('[data-action="pin-next"]');
          if (btn && !btn.disabled) onPinNext();
        }
      });
    }
    bind('[data-action="pin-next"]', 'click', onPinNext);

    // Partner confirmation
    bind('[data-action="confirm-yes"]', 'click', onConfirmYes);
    bind('[data-action="confirm-no"]',  'click', onConfirmNo);

    // PIN created confirmation
    bind('[data-action="pin-created-continue"]', 'click', onPinCreatedContinue);

    // How / Privacy
    bind('[data-action="how-continue"]',     'click', onHowContinue);
    bind('[data-action="privacy-continue"]', 'click', onPrivacyContinue);
  }

  // -----------------------------------------------------------------------
  // Boot
  // -----------------------------------------------------------------------

  async function init() {
    // If the dev-preview override (?screen=…) is in use, leave it alone but
    // still wire up handlers so the dev can click through.
    var params = new URLSearchParams(window.location.search);
    if (params.get('screen')) {
      bindEvents();
      return;
    }

    bindEvents();

    var saved = loadSession();
    if (!saved || !saved.sessionToken) {
      // No saved session — splash is already visible from the HTML default.
      state.currentScreen = 'splash';
      return;
    }

    var restored = await tryRestoreSession();
    if (!restored) {
      // Restore failed — fall back to splash with no animation.
      goto('splash', { skipAnim: true });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
