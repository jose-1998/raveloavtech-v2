// send-estimate.js
// Phase 1: placeholder — structure ready for QB webhook.
// Phase 2: QB POSTs here when an estimate is created/sent to a customer.
//   QB Developer Portal → Webhooks:
//   URL → https://raveloavtech.com/.netlify/functions/send-estimate
//   Entity: Estimate  |  Operations: Create

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const FROM = 'Ravelo AV Tech <support@raveloavtech.com>';

exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS, body: '' };
  }

  // ── Phase 2: uncomment when QB webhook is active ──────────────────────────
  // const payload = JSON.parse(event.body || '{}');
  // const notifications = payload.eventNotifications || [];
  // for (const n of notifications) {
  //   for (const entity of (n.dataChangeEvent?.entities || [])) {
  //     if (entity.name === 'Estimate' && entity.operation === 'Create') {
  //       await handleNewEstimate(entity.id);
  //     }
  //   }
  // }
  // ─────────────────────────────────────────────────────────────────────────

  return {
    statusCode: 200,
    headers: CORS,
    body: JSON.stringify({ status: 'ok' }),
  };
};

// ── Called when QB fires a new estimate event ─────────────────────────────────
async function handleNewEstimate(estimateId) {
  const SITE_URL = process.env.URL || 'https://raveloavtech.com';
  const link = `${SITE_URL}/dev/estimate.html?id=${estimateId}`;

  // Pull estimate data from get-estimate (same function, reused)
  const res = await fetch(`${SITE_URL}/.netlify/functions/get-estimate?id=${estimateId}`);
  if (!res.ok) throw new Error(`Could not load estimate ${estimateId}`);
  const estimate = await res.json();

  await sendEmail({
    from: FROM,
    to: [estimate.client.email],
    reply_to: 'support@raveloavtech.com',
    subject: `Your Estimate #${estimate.docNumber} — Ravelo AV Technologies LLC`,
    html: buildEmailHTML(estimate, link),
  });

  // Optionally notify the business too
  await sendEmail({
    from: FROM,
    to: ['support@raveloavtech.com', 'jose.rojas@raveloavtech.com'],
    subject: `Estimate #${estimate.docNumber} sent to ${estimate.client.name}`,
    html: `<p style="font-family:Arial,sans-serif;font-size:14px;color:#222;">
      Estimate <strong>#${estimate.docNumber}</strong> was automatically sent to
      <a href="mailto:${estimate.client.email}">${estimate.client.name}</a>.<br><br>
      <a href="${link}">Preview estimate →</a>
    </p>`,
  });
}

// ── Reusable send helper (same pattern as send-quote.js) ─────────────────────
async function sendEmail(payload) {
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) {
    console.warn('RESEND_API_KEY not set — skipping email');
    return;
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err);
  }
  return res.json();
}

// ── Client email template ─────────────────────────────────────────────────────
function buildEmailHTML(estimate, link) {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#eef1f4;font-family:Arial,sans-serif;">
  <div style="max-width:580px;margin:40px auto 60px;">

    <!-- HEADER -->
    <div style="background:#072b3e;padding:36px 44px 30px;border-radius:4px 4px 0 0;">
      <p style="margin:0 0 14px;color:#82A0CC;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;font-weight:600;">Ravelo AV Technologies LLC</p>
      <h1 style="margin:0 0 6px;color:#ffffff;font-size:24px;font-weight:700;line-height:1.25;">Your estimate is ready</h1>
      <p style="margin:0;color:rgba(255,255,255,0.55);font-size:14px;">Estimate <strong style="color:rgba(255,255,255,0.85);">#${estimate.docNumber}</strong> — valid until ${estimate.validUntil}</p>
    </div>

    <!-- BODY -->
    <div style="background:#ffffff;padding:40px 44px;">
      <p style="margin:0 0 10px;font-size:16px;color:#222;font-weight:600;">Hi ${estimate.client.name},</p>
      <p style="margin:0 0 28px;font-size:15px;color:#555;line-height:1.75;">
        We've prepared your estimate for <strong style="color:#072b3e;">${estimate.project.name}</strong>.
        Click the button below to review the details and sign a short confidentiality agreement before viewing the full pricing.
      </p>

      <!-- CTA BUTTON -->
      <div style="text-align:center;margin:0 0 36px;">
        <a href="${link}" style="background:#072b3e;color:#ffffff;text-decoration:none;padding:16px 40px;font-size:15px;font-weight:700;letter-spacing:1px;text-transform:uppercase;border-radius:3px;display:inline-block;">
          View My Estimate →
        </a>
      </div>

      <!-- SUMMARY BOX -->
      <div style="background:#f7f9fc;border-radius:4px;padding:20px 24px;margin-bottom:32px;border-left:3px solid #82A0CC;">
        <p style="margin:0 0 10px;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#82A0CC;font-weight:700;">Summary</p>
        <table style="border-collapse:collapse;width:100%;font-size:14px;">
          <tr><td style="padding:5px 16px 5px 0;color:#888;">Project</td><td style="color:#072b3e;font-weight:600;">${estimate.project.name}</td></tr>
          <tr><td style="padding:5px 16px 5px 0;color:#888;">Description</td><td style="color:#555;">${estimate.project.description}</td></tr>
          <tr><td style="padding:5px 16px 5px 0;color:#888;">Total</td><td style="color:#072b3e;font-weight:700;font-size:16px;">$${Number(estimate.total).toFixed(2)}</td></tr>
          <tr><td style="padding:5px 16px 5px 0;color:#888;">Valid until</td><td style="color:#555;">${estimate.validUntil}</td></tr>
        </table>
      </div>

      <hr style="border:none;border-top:1px solid #e8ecf0;margin:0 0 28px;">

      <!-- CONTACT -->
      <p style="margin:0 0 14px;font-size:13px;color:#888;font-weight:600;text-transform:uppercase;letter-spacing:0.1em;">Questions? Contact us directly</p>
      <table style="border-collapse:collapse;font-size:14px;color:#555;line-height:2;">
        <tr><td style="padding-right:10px;color:#82A0CC;">📱</td><td><a href="tel:+16159620401" style="color:#072b3e;text-decoration:none;">(615) 962-0401</a></td></tr>
        <tr><td style="padding-right:10px;color:#82A0CC;">✉</td><td><a href="mailto:support@raveloavtech.com" style="color:#072b3e;text-decoration:none;">support@raveloavtech.com</a></td></tr>
      </table>
    </div>

    <!-- FOOTER -->
    <div style="background:#072b3e;padding:24px 44px;border-radius:0 0 4px 4px;">
      <p style="margin:0 0 6px;font-size:12px;color:rgba(255,255,255,0.85);font-weight:600;">Ravelo AV Technologies LLC</p>
      <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.4);line-height:1.6;">
        Licensed &amp; Insured &nbsp;·&nbsp; Nashville Metro Area, TN &nbsp;·&nbsp;
        <a href="https://raveloavtech.com" style="color:#82A0CC;text-decoration:none;">raveloavtech.com</a>
      </p>
      <p style="margin:16px 0 0;font-size:11px;color:rgba(255,255,255,0.25);line-height:1.6;">
        This estimate was prepared exclusively for you. Please do not forward or share the pricing with third parties.
      </p>
    </div>

  </div>
</body>
</html>`;
}
