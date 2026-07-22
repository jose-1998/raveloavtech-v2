// save-agreement.js
// Saves a signed service agreement to Netlify Blobs and emails a summary to the team.
// Public endpoint — no auth required (client-facing).

const { getStore } = require('@netlify/blobs');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const FROM = 'Ravelo AV Tech <support@raveloavtech.com>';
const TO   = ['jose.rojas@raveloavtech.com'];

exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: CORS, body: 'Method not allowed' };

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const { workOrderId, clientName, serviceAddress, serviceDate, scopeItems = [], fullName, signedAt, signatureData, photos = [], conditions = {} } = body;

  // Save to Blobs
  try {
    const store = getStore({ name: 'agreements', consistency: 'strong', siteID: process.env.NETLIFY_SITE_ID, token: process.env.NETLIFY_API_TOKEN });
    await store.setJSON(`agreement-${Date.now()}`, {
      workOrderId, clientName, serviceAddress, serviceDate, fullName, signedAt,
      photoCount: photos.length, conditions,
    });
  } catch (e) {
    console.warn('Blob save failed:', e.message);
  }

  // Email
  const RESEND_KEY = process.env.RESEND_API_KEY;
  if (RESEND_KEY) {
    const conditionLabels = { walls: 'Walls', tv: 'TV / Equipment', floor: 'Floor / Carpet', paint: 'Paint / Finish' };
    const condRows = Object.entries(conditions).map(([k, v]) =>
      `<tr><td style="padding:6px 12px 6px 0;font-size:13px;color:#888;">${conditionLabels[k] || k}</td><td style="padding:6px 0;font-size:13px;font-weight:600;color:#222;">${v}</td></tr>`
    ).join('');

    const scopeRows = scopeItems.map(item =>
      `<tr><td style="padding:5px 0;font-size:13px;padding-right:10px;">✓</td><td style="padding:5px 0;font-size:13px;color:#222;">${item}</td></tr>`
    ).join('');

    const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#eef1f4;font-family:Arial,sans-serif;">
<div style="max-width:560px;margin:40px auto 60px;">
  <div style="background:#072b3e;padding:32px 40px 28px;border-radius:4px 4px 0 0;">
    <p style="margin:0 0 12px;color:#82A0CC;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;font-weight:700;">Ravelo AV Tech — Service Agreement</p>
    <h1 style="margin:0 0 4px;color:#fff;font-size:22px;font-weight:700;">✅ Agreement Signed</h1>
    <p style="margin:6px 0 0;color:rgba(255,255,255,0.45);font-size:12px;">${signedAt}</p>
  </div>
  <div style="background:#fff;padding:32px 40px;">
    <table style="border-collapse:collapse;width:100%;font-size:14px;margin-bottom:24px;">
      <tr style="border-bottom:1px solid #eee;"><td style="padding:9px 16px 9px 0;color:#888;width:110px;">Work Order</td><td style="padding:9px 0;color:#111;font-weight:700;">${workOrderId || '—'}</td></tr>
      <tr style="border-bottom:1px solid #eee;"><td style="padding:9px 16px 9px 0;color:#888;">Client</td><td style="padding:9px 0;color:#222;">${clientName || '—'}</td></tr>
      <tr style="border-bottom:1px solid #eee;"><td style="padding:9px 16px 9px 0;color:#888;">Address</td><td style="padding:9px 0;color:#222;">${serviceAddress || '—'}</td></tr>
      <tr style="border-bottom:1px solid #eee;"><td style="padding:9px 16px 9px 0;color:#888;">Date</td><td style="padding:9px 0;color:#222;">${serviceDate || '—'}</td></tr>
      <tr><td style="padding:9px 16px 9px 0;color:#888;">Signed by</td><td style="padding:9px 0;color:#222;font-weight:700;">${fullName}</td></tr>
    </table>

    ${scopeRows ? `<p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#82A0CC;">Scope of Work</p>
    <table style="border-collapse:collapse;width:100%;margin-bottom:20px;">${scopeRows}</table>` : ''}

    ${condRows ? `<p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#82A0CC;">Pre-Work Conditions</p>
    <table style="border-collapse:collapse;width:100%;margin-bottom:20px;">${condRows}</table>` : ''}

    ${photos.length ? `<div style="padding:14px 18px;background:#f0f9f4;border-left:3px solid #34c759;border-radius:3px;">
      <p style="margin:0;font-size:13px;color:#1a7a3a;font-weight:600;">📷 ${photos.length} pre-work photo${photos.length > 1 ? 's' : ''} attached</p>
    </div>` : ''}

    ${signatureData ? `<div style="margin-top:24px;padding-top:20px;border-top:1px solid #eee;">
      <p style="margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#82A0CC;">Signature on File</p>
      <img src="${signatureData}" style="max-width:220px;border:1px solid #ddd;border-radius:3px;padding:8px;background:#fff;" alt="Client signature"/>
    </div>` : ''}
  </div>
  <div style="background:#072b3e;padding:18px 40px;border-radius:0 0 4px 4px;">
    <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.35);">Ravelo AV Technologies LLC · raveloavtech.com</p>
  </div>
</div>
</body></html>`;

    const attachments = photos.map(function (p, i) {
      const base64 = (p.data || '').replace(/^data:image\/\w+;base64,/, '');
      return { filename: `pre-work-${p.label || i + 1}.jpg`, content: base64 };
    });

    const payload = {
      from: FROM, to: TO,
      subject: `✅ Agreement Signed — ${clientName || 'Client'} · ${workOrderId || ''}`,
      html,
    };
    if (attachments.length) payload.attachments = attachments;

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) console.error('Resend error:', await res.text());
  }

  return {
    statusCode: 200,
    headers: { ...CORS, 'Content-Type': 'application/json' },
    body: JSON.stringify({ ok: true }),
  };
};
