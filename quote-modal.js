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
          <label>Message</label>
          <textarea name="message" placeholder="Tell us about your project..."></textarea>
        </div>
        <button type="submit" class="submit-btn" id="qm-submit">Send message</button>
        <p id="qm-status" style="margin-top:14px;font-size:0.9rem;display:none;"></p>
      </form>
    </div>
  `;
  document.body.appendChild(modal);

  // Mobile floating CTA (disabled)
  const fab = document.createElement('span'); // placeholder so close logic still works

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
  `;
  document.head.appendChild(style);

  function openModal() {
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
  function closeModal() {
    modal.classList.remove('open');
    document.body.style.overflow = '';
  }

  modal.querySelector('.qm-backdrop').addEventListener('click', closeModal);
  modal.querySelector('.qm-close').addEventListener('click', closeModal);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeModal(); });

  // Wire up all "Get a quote" links via event delegation (more reliable on iOS)
  function handleQuoteLink(e) {
    var link = e.target.closest('a[href="about.html"]');
    if (link && !link.closest('.footer-nav')) {
      e.preventDefault();
      openModal();
    }
  }
  document.body.addEventListener('click', handleQuoteLink);
  document.body.addEventListener('touchend', handleQuoteLink);

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
      await fetch('https://formspree.io/f/mykvgddk', {
        method: 'POST',
        headers: { 'Accept': 'application/json' },
        body: new FormData(form)
      });
      status.textContent = '✓ Message sent! We\'ll be in touch soon.';
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
