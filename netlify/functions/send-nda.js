// send-nda.js
// Boss-triggered NDA email send for a specific estimate.
// Called by admin/estimates.html when boss clicks "Send NDA Email".
// Protected by Netlify Identity JWT validation.

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const FROM = 'Ravelo AV Tech <support@raveloavtech.com>';

exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  // ── Auth: validate Netlify Identity JWT ────────────────────────────────────
  const authHeader = event.headers['authorization'] || event.headers['Authorization'] || '';
  const SITE_URL   = process.env.URL || 'https://raveloavtech.com';

  const authed = await validateNetlifyJWT(authHeader, SITE_URL);
  if (!authed) {
    return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  // ── Parse body ─────────────────────────────────────────────────────────────
  let docNumber;
  try {
    const body = JSON.parse(event.body || '{}');
    docNumber = String(body.docNumber || '').trim();
  } catch {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid JSON body' }) };
  }

  if (!docNumber) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Missing docNumber' }) };
  }

  try {
    // ── Fetch estimate from QB ─────────────────────────────────────────────
    const res = await fetch(`${SITE_URL}/.netlify/functions/get-estimate?id=${encodeURIComponent(docNumber)}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      throw new Error(err.error || `Estimate #${docNumber} not found`);
    }
    const estimate = await res.json();

    if (!estimate.client?.email) {
      throw new Error(`Estimate #${docNumber} has no email address. Add the client email in QuickBooks first.`);
    }

    const link = `${SITE_URL}/dev/estimate.html?id=${estimate.docNumber}`;

    // ── Send NDA email to client ───────────────────────────────────────────
    await sendEmail({
      from: FROM,
      to:   [estimate.client.email],
      reply_to: 'support@raveloavtech.com',
      subject:  `Your Estimate #${estimate.docNumber} — Ravelo AV Technologies LLC`,
      html:     buildEmailHTML(estimate, link),
    });

    // ── Notify business ────────────────────────────────────────────────────
    await sendEmail({
      from: FROM,
      to:   ['support@raveloavtech.com', 'jose.rojas@raveloavtech.com'],
      subject: `NDA sent: Estimate #${estimate.docNumber} → ${estimate.client.name}`,
      html: `<p style="font-family:Arial,sans-serif;font-size:14px;color:#222;">
        NDA email manually sent for estimate <strong>#${estimate.docNumber}</strong>.<br>
        Client: <strong>${estimate.client.name}</strong> — <a href="mailto:${estimate.client.email}">${estimate.client.email}</a><br>
        Total: <strong>$${Number(estimate.total).toFixed(2)}</strong><br><br>
        <a href="${link}">Preview estimate →</a>
      </p>`,
    });

    console.log(`NDA sent for estimate #${estimate.docNumber} to ${estimate.client.email}`);

    return {
      statusCode: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ok:         true,
        docNumber:  estimate.docNumber,
        clientName: estimate.client.name,
        clientEmail: estimate.client.email,
        total:      estimate.total,
      }),
    };

  } catch (err) {
    console.error('send-nda error:', err.message);
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ error: err.message }),
    };
  }
};

// ── Validate Netlify Identity JWT ──────────────────────────────────────────────
async function validateNetlifyJWT(authHeader, siteUrl) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return false;
  try {
    const res = await fetch(`${siteUrl}/.netlify/identity/user`, {
      headers: { Authorization: authHeader },
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ── Resend email helper ────────────────────────────────────────────────────────
async function sendEmail(payload) {
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) {
    console.warn('RESEND_API_KEY not set — skipping email');
    return;
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization:  `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Resend error: ${err}`);
  }
  return res.json();
}

// ── Email template (same as send-estimate.js) ──────────────────────────────────
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

      <!-- CTA BUTTON — table structure for Gmail compatibility -->
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto 36px;">
        <tr>
          <td style="border-radius:3px;background:#072b3e;">
            <a href="${link}" target="_blank" style="background:#072b3e;color:#ffffff;text-decoration:none;padding:16px 40px;font-size:15px;font-weight:700;letter-spacing:1px;text-transform:uppercase;border-radius:3px;display:inline-block;">
              View My Estimate
            </a>
          </td>
        </tr>
      </table>

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
