(function () {
  // ── Google Places address autocomplete (PlaceAutocompleteElement API) ──
  const GOOGLE_API_KEY = 'AIzaSyB35urwsF5EBu7nMSpP_pfdMsjYmfLRrqI';

  function loadGooglePlaces() {
    return new Promise(function (resolve) {
      // Case 1: Fully ready
      if (window.google && window.google.maps && window.google.maps.places &&
          window.google.maps.places.PlaceAutocompleteElement) {
        resolve(); return;
      }
      // Case 2: google.maps bootstrap loaded — call importLibrary directly
      if (window.google && window.google.maps && typeof window.google.maps.importLibrary === 'function') {
        google.maps.importLibrary('places').then(function () { resolve(); });
        return;
      }
      // Case 3: Script loading in progress — queue
      if (window.__gmapResolvers) {
        window.__gmapResolvers.push(resolve); return;
      }
      if (document.getElementById('gmap-places-script')) {
        window.__gmapResolvers = window.__gmapResolvers || [];
        window.__gmapResolvers.push(resolve); return;
      }
      // Case 4: Load bootstrap script fresh
      window.__gmapResolvers = [resolve];
      const s = document.createElement('script');
      s.id = 'gmap-places-script';
      s.src = 'https://maps.googleapis.com/maps/api/js?key=' + GOOGLE_API_KEY + '&loading=async';
      s.async = true;
      s.onload = function () {
        google.maps.importLibrary('places').then(function () {
          (window.__gmapResolvers || []).forEach(function (fn) { fn(); });
          window.__gmapResolvers = [];
        });
      };
      document.head.appendChild(s);
    });
  }

  function initAutocomplete() {
    var input = document.getElementById('qm-address-input');
    if (!input || input._acInit) return;
    input._acInit = true;

    // Append dropdown to body so overflow-y:auto on .qm-card doesn't clip it
    var dropdown = document.createElement('div');
    dropdown.className = 'qm-ac-dropdown';
    dropdown.id = 'qm-ac-dropdown';
    document.body.appendChild(dropdown);

    function positionDropdown() {
      var r = input.getBoundingClientRect();
      dropdown.style.top   = (r.bottom + window.scrollY + 2) + 'px';
      dropdown.style.left  = (r.left + window.scrollX) + 'px';
      dropdown.style.width = r.width + 'px';
    }

    var service = new google.maps.places.AutocompleteService();
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
        service.getPlacePredictions({
          input: val,
          componentRestrictions: { country: 'us' },
          types: ['address'],
        }, function (predictions, status) {
          dropdown.innerHTML = '';
          if (status !== google.maps.places.PlacesServiceStatus.OK || !predictions) {
            dropdown.classList.remove('open');
            return;
          }
          positionDropdown();
          predictions.slice(0, 5).forEach(function (pred) {
            var item = document.createElement('div');
            item.className = 'qm-ac-item';
            item.textContent = pred.description;
            item.addEventListener('mousedown', function (e) {
              e.preventDefault();
              input.value = pred.description;
              dropdown.innerHTML = '';
              dropdown.classList.remove('open');
            });
            dropdown.appendChild(item);
          });
          dropdown.classList.add('open');
        });
      }, 150);
    });

    input.addEventListener('blur', function () {
      setTimeout(function () { dropdown.classList.remove('open'); }, 150);
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
      padding: 52px 48px;
      z-index: 1;
    }
    .qm-close {
      position: absolute;
      top: 18px;
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
    setTimeout(function () { justOpened = false; }, 400);
    // Load Google Places lazily the first time the modal opens
    loadGooglePlaces().then(initAutocomplete);
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
    } catch (_) {
      status.textContent = 'Something went wrong. Please call us at (615) 962-0401.';
      status.style.color = '#e07070';
    }
    submitBtn.textContent = 'Send message';
    submitBtn.disabled = false;
    status.style.display = 'block';
  });
})();
