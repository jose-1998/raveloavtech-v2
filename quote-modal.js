(function () {
  // ── Google Places address autocomplete (PlaceAutocompleteElement API) ──
  const GOOGLE_API_KEY = 'AIzaSyB35urwsF5EBu7nMSpP_pfdMsjYmfLRrqI';

  function loadGooglePlaces() {
    return new Promise(function (resolve) {
      // Already loaded
      if (window.__gmapPlacesLib) { resolve(window.__gmapPlacesLib); return; }
      // Queue if loading in progress
      if (window.__gmapResolvers) { window.__gmapResolvers.push(resolve); return; }
      if (document.getElementById('gmap-places-script')) {
        window.__gmapResolvers = window.__gmapResolvers || [];
        window.__gmapResolvers.push(resolve); return;
      }
      // google.maps already on page — just importLibrary
      if (window.google && window.google.maps && typeof window.google.maps.importLibrary === 'function') {
        window.__gmapResolvers = [resolve];
        google.maps.importLibrary('places').then(function (lib) {
          window.__gmapPlacesLib = lib;
          (window.__gmapResolvers || []).forEach(function (fn) { fn(lib); });
          window.__gmapResolvers = [];
        });
        return;
      }
      // Fresh load — use callback so Maps calls us when fully ready
      window.__gmapResolvers = [resolve];
      window.__gmapReady = function () {
        google.maps.importLibrary('places').then(function (lib) {
          window.__gmapPlacesLib = lib;
          (window.__gmapResolvers || []).forEach(function (fn) { fn(lib); });
          window.__gmapResolvers = [];
        });
      };
      var s = document.createElement('script');
      s.id = 'gmap-places-script';
      s.src = 'https://maps.googleapis.com/maps/api/js?key=' + GOOGLE_API_KEY
            + '&loading=async&callback=__gmapReady';
      s.async = true;
      document.head.appendChild(s);
    });
  }

  function initAutocomplete(lib) {
    var input = document.getElementById('qm-address-input');
    if (!input || input._acInit) return;
    input._acInit = true;

    var AC = lib.AutocompleteSuggestion;
    var ST = lib.AutocompleteSessionToken;
    if (!AC || !ST) return; // library didn't expose expected classes

    // Touch devices (Android/iOS) always use inline dropdown — no position:fixed.
    // Desktop (non-touch) uses fixed dropdown appended to body.
    var isMobile = ('ontouchstart' in window) || window.innerWidth <= 768;

    var dropdown = document.createElement('div');
    dropdown.className = 'qm-ac-dropdown' + (isMobile ? ' qm-ac-inline' : '');
    dropdown.id = 'qm-ac-dropdown';

    if (isMobile) {
      input.parentElement.appendChild(dropdown); // inside .qm-address-wrap
    } else {
      document.body.appendChild(dropdown);
    }

    function positionDropdown() {
      if (isMobile) return; // inline — no coords needed
      var r = input.getBoundingClientRect();
      // getBoundingClientRect() is already relative to the visual viewport —
      // add scrollY/scrollX only to convert to page coordinates for position:fixed.
      dropdown.style.top   = (r.bottom + 2) + 'px';
      dropdown.style.left  = r.left + 'px';
      dropdown.style.width = r.width + 'px';
    }

    if (!isMobile && window.visualViewport) {
      window.visualViewport.addEventListener('resize', function () {
        if (dropdown.classList.contains('open')) positionDropdown();
      });
      window.visualViewport.addEventListener('scroll', function () {
        if (dropdown.classList.contains('open')) positionDropdown();
      });
    }

    // Hide dropdown when the modal card is scrolled (both mobile and desktop)
    var card = modal.querySelector('.qm-card');
    if (card) {
      card.addEventListener('scroll', function () {
        dropdown.classList.remove('open');
      }, { passive: true });
    }

    var sessionToken = new ST();
    var debounceTimer;

    input.addEventListener('input', function () {
      clearTimeout(debounceTimer);
      var val = input.value.trim();
      if (val.length < 3) {
        dropdown.innerHTML = '';
        dropdown.classList.remove('open');
        return;
      }
      debounceTimer = setTimeout(function () {
        AC.fetchAutocompleteSuggestions({
          input: val,
          includedRegionCodes: ['us'],
          includedPrimaryTypes: ['street_address', 'route'],
          sessionToken: sessionToken,
        }).then(function (result) {
          var suggestions = result.suggestions || [];
          dropdown.innerHTML = '';
          if (!suggestions.length) { dropdown.classList.remove('open'); return; }
          positionDropdown();
          suggestions.slice(0, 5).forEach(function (sug) {
            var text = sug.placePrediction.text.toString();
            var item = document.createElement('div');
            item.className = 'qm-ac-item';
            item.textContent = text;
            // Desktop: mousedown before blur prevents focus loss
            item.addEventListener('mousedown', function (e) {
              e.preventDefault();
              input.value = text;
              dropdown.innerHTML = '';
              dropdown.classList.remove('open');
              sessionToken = new ST();
            });
            // Mobile: touchstart before blur — select immediately on touch
            item.addEventListener('touchstart', function (e) {
              e.preventDefault();
              input.value = text;
              dropdown.innerHTML = '';
              dropdown.classList.remove('open');
              sessionToken = new ST();
            }, { passive: false });
            dropdown.appendChild(item);
          });
          dropdown.classList.add('open');
          // Scroll suggestions into view on mobile
          if (isMobile) {
            setTimeout(function () {
              dropdown.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            }, 80);
          }
        }).catch(function () { dropdown.classList.remove('open'); });
      }, 150);
    });

    input.addEventListener('blur', function () {
      setTimeout(function () { dropdown.classList.remove('open'); }, 200);
    });

    input.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { dropdown.classList.remove('open'); }
    });
  }
  // ────────────────────────────────────────────────────────────────────────

  // Inject modal HTML
  const modal = document.createElement('div');
  modal.id = 'quoteModal';
  modal.innerHTML = `
    <div class="qm-backdrop"></div>
    <div class="qm-card">
      <button class="qm-close" aria-label="Close">✕</button>
      <p class="label" style="margin-bottom:12px;">Free consultation</p>
      <h2 class="qm-title">Get a quote</h2>
      <form id="qm-form">
        <!-- Honeypot: hidden from humans, bots fill it and get silently dropped -->
        <input type="text" name="company" tabindex="-1" autocomplete="off" aria-hidden="true" style="position:absolute;left:-9999px;width:1px;height:1px;opacity:0;pointer-events:none;" />
        <div class="qm-row">
          <div class="form-field"><label>First name</label><input type="text" name="first_name" placeholder="John" required /></div>
          <div class="form-field"><label>Last name</label><input type="text" name="last_name" placeholder="Smith" /></div>
        </div>
        <div class="qm-row">
          <div class="form-field"><label>Email</label><input type="email" name="email" placeholder="john@email.com" required /></div>
          <div class="form-field"><label>Phone <span class="req">*</span></label><input type="tel" name="phone" placeholder="(615) 000-0000" required /></div>
        </div>
        <div class="form-field">
          <label>Service interested in <span class="req">*</span></label>
          <select name="service" required>
            <option value="">Select a service...</option>
            <option>Audiovisual / Home Theater</option>
            <option>Smart Homes</option>
            <option>Security Systems</option>
            <option>SOHO Networks</option>
            <option>Wireless Networks</option>
            <option>Light Switch Automation (Lutron)</option>
            <option>Wiring</option>
            <option>Low Voltage</option>
            <option>General inquiry</option>
          </select>
        </div>
        <div class="form-field">
          <label>Address <span class="req">*</span></label>
          <div class="qm-address-wrap">
            <input type="text" name="address" id="qm-address-input" placeholder="123 Main St, Nashville TN" required autocomplete="off" />
          </div>
        </div>
        <div class="form-field">
          <label>Message</label>
          <textarea name="message" placeholder="Tell us about your project..."></textarea>
        </div>
        <button type="submit" class="submit-btn" id="qm-submit">Send message</button>
        <p id="qm-status" style="margin-top:14px;font-size:0.9rem;display:none;"></p>
      </form>
    </div>
  `;
  document.body.appendChild(modal);

  // Mobile sticky CTA bar
  const mobileCta = document.createElement('div');
  mobileCta.className = 'mobile-cta-bar';
  mobileCta.innerHTML = `
    <a href="tel:+16159620401" class="mobile-cta-call">
      <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" style="margin-right:6px;flex-shrink:0"><path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z"/></svg>
      Call us
    </a>
    <a href="#quote" class="mobile-cta-quote">Get a quote</a>
  `;
  document.body.appendChild(mobileCta);

  // Inject styles
  const style = document.createElement('style');
  style.textContent = `
    #quoteModal {
      display: none;
      position: fixed;
      inset: 0;
      z-index: 9999;
      align-items: center;
      justify-content: center;
      touch-action: none;
    }
    #quoteModal.open { display: flex; }
    #quoteModal.open .qm-backdrop {
      animation: qm-fade-in 0.25s ease forwards;
    }
    #quoteModal.open .qm-card {
      animation: qm-scale-in 0.28s cubic-bezier(0.34,1.15,0.64,1) forwards;
    }
    #quoteModal.closing .qm-backdrop {
      animation: qm-fade-out 0.2s ease forwards;
    }
    #quoteModal.closing .qm-card {
      animation: qm-scale-out 0.2s ease forwards;
    }
    @keyframes qm-fade-in {
      from { opacity: 0; }
      to   { opacity: 1; }
    }
    @keyframes qm-scale-in {
      from { opacity: 0; transform: scale(0.95) translateY(10px); }
      to   { opacity: 1; transform: scale(1)    translateY(0);    }
    }
    @keyframes qm-fade-out {
      from { opacity: 1; }
      to   { opacity: 0; }
    }
    @keyframes qm-scale-out {
      from { opacity: 1; transform: scale(1)    translateY(0);    }
      to   { opacity: 0; transform: scale(0.95) translateY(10px); }
    }
    .qm-backdrop {
      position: absolute;
      inset: 0;
      background: rgba(5,24,31,0.88);
      backdrop-filter: blur(6px);
      -webkit-backdrop-filter: blur(6px);
    }
    .qm-card {
      position: relative;
      background: #0c2d3a;
      border: 1px solid rgba(130,160,204,0.15);
      max-width: 580px;
      width: 92%;
      max-height: 92vh;
      overflow-y: auto;
      overscroll-behavior: contain;
      touch-action: pan-y;
      padding: 52px 48px;
      z-index: 1;
    }
    .qm-close {
      position: absolute;
      top: 28px;
      right: 22px;
      background: none;
      border: none;
      color: rgba(255,255,255,0.4);
      font-size: 1.3rem;
      cursor: pointer;
      line-height: 1;
      transition: color 0.2s;
    }
    .qm-close:hover { color: #fff; }
    .qm-title {
      font-family: 'DM Serif Display', serif;
      font-size: clamp(1.6rem, 3vw, 2rem);
      font-weight: 400;
      color: #fff;
      margin-bottom: 32px;
      line-height: 1.2;
    }
    .qm-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
    }
    @media (max-width: 540px) {
      .qm-card { padding: 40px 24px; }
      .qm-row { grid-template-columns: 1fr; gap: 0; }
    }
    .req { color: #e07070; font-size: 0.85em; }
    input:user-invalid,
    select:user-invalid {
      border-color: #e07070 !important;
    }
    .qm-address-wrap { position: relative; }
    .qm-ac-dropdown {
      display: none;
      position: fixed;
      background: #0d3344;
      border: 1px solid rgba(130,160,204,0.25);
      border-radius: 4px;
      z-index: 10001;
      overflow: hidden;
    }
    .qm-ac-dropdown.open { display: block; }
    /* Mobile: inline dropdown — no fixed positioning, just flows in the card */
    .qm-ac-inline {
      position: static !important;
      top: auto !important; left: auto !important; width: 100% !important;
      margin-top: 4px;
      z-index: auto;
    }
    .qm-ac-item {
      padding: 10px 14px;
      font-family: 'Figtree', sans-serif;
      font-size: 0.88rem;
      color: rgba(255,255,255,0.75);
      cursor: pointer;
      border-bottom: 1px solid rgba(130,160,204,0.1);
    }
    .qm-ac-item:last-child { border-bottom: none; }
    .qm-ac-item:hover { background: rgba(130,160,204,0.15); color: #fff; }
    .mobile-cta-bar { display: none; }
    @media (max-width: 768px) {
      .mobile-cta-bar {
        display: grid;
        grid-template-columns: 1fr 1fr;
        position: fixed;
        bottom: 0; left: 0; right: 0;
        z-index: 8000;
        background: #0c2d3a;
        border-top: 1px solid rgba(130,160,204,0.15);
        box-shadow: 0 -4px 20px rgba(0,0,0,0.3);
      }
      .mobile-cta-call, .mobile-cta-quote {
        padding: 16px;
        text-align: center;
        font-family: 'Figtree', sans-serif;
        font-size: 14px;
        font-weight: 600;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        text-decoration: none;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .mobile-cta-call { color: #82A0CC; border-right: 1px solid rgba(130,160,204,0.15); }
      .mobile-cta-quote { background: #82A0CC; color: #05181f; }
      body { padding-bottom: 56px; }
    }
  `;
  document.head.appendChild(style);

  var justOpened = false;

  function openModal() {
    justOpened = true;
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
    if (!_gmapStarted) {
      _gmapStarted = true;
      loadGooglePlaces().then(initAutocomplete);
    }
    setTimeout(function () { justOpened = false; }, 400);
  }
  function closeModal() {
    if (justOpened) return;
    modal.classList.add('closing');
    setTimeout(function () {
      modal.classList.remove('open');
      modal.classList.remove('closing');
      document.body.style.overflow = '';
      form.reset();
      var dd = document.getElementById('qm-ac-dropdown');
      if (dd) { dd.innerHTML = ''; dd.classList.remove('open'); }
      status.style.display = 'none';
    }, 200);
  }

  modal.querySelector('.qm-backdrop').addEventListener('click', closeModal);
  modal.querySelector('.qm-close').addEventListener('click', closeModal);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeModal(); });

  // Wire up all "Get a quote" links via click only (touchend caused backdrop to close immediately on iOS)
  document.body.addEventListener('click', function (e) {
    var link = e.target.closest('a[href="#quote"]');
    if (link) {
      e.preventDefault();
      openModal();
    }
  });

  window.openQuoteModal = openModal;

  // Load Google Places lazily on first modal open (saves ~300KB on initial page load)
  var _gmapStarted = false;

  // Phone — strip non-digits as user types, keep cursor position
  var phoneInput = modal.querySelector('[name="phone"]');
  phoneInput.addEventListener('input', function () {
    var pos = phoneInput.selectionStart;
    var raw = phoneInput.value;
    var digits = raw.replace(/\D/g, '');
    if (digits !== raw) {
      phoneInput.value = digits;
      phoneInput.setSelectionRange(Math.max(0, pos - (raw.length - digits.length)), Math.max(0, pos - (raw.length - digits.length)));
    }
  });

  // Form submission
  const form = document.getElementById('qm-form');
  const submitBtn = document.getElementById('qm-submit');
  const status = document.getElementById('qm-status');
  form.addEventListener('submit', async function (e) {
    e.preventDefault();

    // Phone validation — must have at least 10 digits
    const phoneVal = form.phone.value.replace(/\D/g, '');
    if (phoneVal.length < 10) {
      form.phone.focus();
      form.phone.style.borderColor = '#e07070';
      status.textContent = 'Please enter a valid phone number (at least 10 digits).';
      status.style.color = '#e07070';
      status.style.display = 'block';
      return;
    }
    form.phone.style.borderColor = '';


    submitBtn.textContent = 'Sending...';
    submitBtn.disabled = true;
    status.style.display = 'none';
    try {
      const formData = new FormData(form);
      const data = Object.fromEntries(formData.entries());

      // Send via Netlify function (business notification + auto-reply)
      const res = await fetch('/.netlify/functions/send-quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Send error');

      status.textContent = "✓ Message sent! We'll be in touch soon.";
      status.style.color = '#82A0CC';
      form.reset();

      // Google Ads conversion — "Submit lead form"
      if (typeof gtag === 'function') {
        gtag('event', 'conversion', { send_to: 'AW-305909877/OmQfCP_P3LocEPWg75EB' });
      }
    } catch (_) {
      status.textContent = 'Something went wrong. Please call us at (615) 962-0401.';
      status.style.color = '#e07070';
    }
    submitBtn.textContent = 'Send message';
    submitBtn.disabled = false;
    status.style.display = 'block';
  });
  // ── Mobile drawer: service icons + footer ──────────────────────────────
  var navLinks = document.querySelector('.nav-links');
  if (navLinks) {
    // 1. Inject icon before each service link text
    var ICONS = {
      'audiovisual.html':      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="1"/><path d="M8 21h8M12 17v4"/></svg>',
      'smart-homes.html':      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
      'security-systems.html': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
      'soho-networks.html':    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg>',
      'wireless-network.html': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg>',
      'lutron.html':            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="5" width="22" height="14" rx="7"/><circle cx="16" cy="12" r="3"/></svg>',
      'wiring.html':            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h7"/><path d="M15 5v14"/><path d="M19 8l3 4-3 4"/></svg>',
      'low-voltage.html':       '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
    };
    document.querySelectorAll('.dropdown a').forEach(function (a) {
      var key = (a.getAttribute('href') || '').replace(/^\//, '');
      if (ICONS[key]) {
        var span = document.createElement('span');
        span.className = 'nav-service-icon';
        span.innerHTML = ICONS[key];
        a.insertBefore(span, a.firstChild);
      }
    });

    // 2. Footer: phone + quote CTA fills the empty space at bottom of drawer
    var drawerFooter = document.createElement('div');
    drawerFooter.className = 'nav-drawer-footer';
    drawerFooter.innerHTML =
      '<a href="tel:+16159620401" class="nav-drawer-phone">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="14" height="14">' +
          '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.62 3.33 2 2 0 0 1 3.59 1.24h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.78a16 16 0 0 0 6 6l.42-.42a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2z"/>' +
        '</svg>' +
        '(615) 962-0401' +
      '</a>' +
      '<a href="#quote" class="nav-drawer-cta">Get a free quote</a>';
    // Close drawer when quote CTA is tapped
    drawerFooter.querySelector('.nav-drawer-cta').addEventListener('click', function () {
      var overlay = document.querySelector('.nav-overlay');
      navLinks.classList.remove('open');
      if (overlay) overlay.classList.remove('open');
      document.body.style.overflow = '';
    });
    // Wrap in <li> so <ul> children are valid HTML
    var drawerFooterLi = document.createElement('li');
    drawerFooterLi.className = 'nav-drawer-footer-item';
    drawerFooterLi.appendChild(drawerFooter);
    navLinks.appendChild(drawerFooterLi);
  }
})();
