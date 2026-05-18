(function () {
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
          <div class="form-field"><label>Phone</label><input type="tel" name="phone" placeholder="(615) 000-0000" /></div>
        </div>
        <div class="form-field">
          <label>Service interested in</label>
          <select name="service">
            <option value="">Select...</option>
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
          <label>Address</label>
          <input type="text" name="address" placeholder="123 Main St, Nashville TN" />
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

  // Floating phone button
  const phoneFab = document.createElement('a');
  phoneFab.href = 'tel:+16159620401';
  phoneFab.className = 'phone-fab';
  phoneFab.setAttribute('aria-label', 'Call us');
  phoneFab.innerHTML = `
    <svg class="phone-fab-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z"/></svg>
    <span class="phone-fab-text">(615) 962-0401</span>
  `;
  document.body.appendChild(phoneFab);

  // Auto-open on load, then collapse after 4 s
  setTimeout(function () { phoneFab.classList.add('open'); }, 600);
  setTimeout(function () { phoneFab.classList.remove('open'); }, 4600);

  // Mobile floating CTA placeholder
  const fab = document.createElement('span');

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
    .phone-fab {
      position: fixed;
      bottom: 32px;
      left: 32px;
      z-index: 8000;
      display: flex;
      align-items: center;
      gap: 10px;
      background: #0c2d3a;
      border: 1px solid rgba(130,160,204,0.22);
      border-radius: 50px;
      padding: 13px 14px;
      text-decoration: none;
      box-shadow: 0 2px 8px rgba(0,0,0,0.18), 0 8px 28px rgba(0,0,0,0.22);
      max-width: 48px;
      overflow: hidden;
      transition: max-width 0.35s cubic-bezier(0.4,0,0.2,1),
                  background 0.25s, border-color 0.25s,
                  box-shadow 0.25s, padding 0.35s;
    }
    .phone-fab:hover, .phone-fab.open {
      max-width: 220px;
      background: #82A0CC;
      border-color: #82A0CC;
      padding-right: 20px;
      box-shadow: 0 4px 16px rgba(130,160,204,0.3), 0 12px 36px rgba(0,0,0,0.2);
    }
    .phone-fab-icon {
      flex-shrink: 0;
      width: 20px;
      height: 20px;
      fill: rgba(255,255,255,0.85);
      transition: fill 0.2s;
    }
    .phone-fab:hover .phone-fab-icon,
    .phone-fab.open .phone-fab-icon { fill: #05181f; }
    .phone-fab-text {
      font-family: 'Figtree', sans-serif;
      font-size: 13px;
      font-weight: 600;
      letter-spacing: 0.02em;
      color: #05181f;
      white-space: nowrap;
      opacity: 0;
      transition: opacity 0.15s;
    }
    .phone-fab:hover .phone-fab-text,
    .phone-fab.open .phone-fab-text { opacity: 1; transition-delay: 0.15s; }
    @media (max-width: 768px) {
      .phone-fab { bottom: 24px; left: 20px; padding: 12px 13px; }
    }
  `;
  document.head.appendChild(style);

  var justOpened = false;

  function openModal() {
    justOpened = true;
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
    setTimeout(function () { justOpened = false; }, 400);
  }
  function closeModal() {
    if (justOpened) return;
    modal.classList.remove('open');
    document.body.style.overflow = '';
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

  // Form submission
  const form = document.getElementById('qm-form');
  const submitBtn = document.getElementById('qm-submit');
  const status = document.getElementById('qm-status');
  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    submitBtn.textContent = 'Sending...';
    submitBtn.disabled = true;
    status.style.display = 'none';
    try {
      const formData = new FormData(form);
      const data = Object.fromEntries(formData.entries());

      // 1 — Always send via Formspree (guaranteed business notification)
      const fsRes = await fetch('https://formspree.io/f/mykvgddk', {
        method: 'POST',
        headers: { 'Accept': 'application/json' },
        body: formData,
      });
      if (!fsRes.ok) throw new Error('Formspree error');

      // 2 — Fire Netlify function for auto-reply (won't block submit)
      fetch('/.netlify/functions/send-quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }).catch(function () {});

      status.textContent = "✓ Message sent! We'll be in touch soon.";
      status.style.color = '#82A0CC';
      form.reset();
    } catch (_) {
      status.textContent = 'Something went wrong. Please call us at (931) 933-5040.';
      status.style.color = '#e07070';
    }
    submitBtn.textContent = 'Send message';
    submitBtn.disabled = false;
    status.style.display = 'block';
  });
})();
