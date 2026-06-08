// log-nda.js
// Called when a client signs the NDA on estimate.html.
// Logs the signer to Google Sheets via Apps Script webhook.

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
};

exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const { estimateNumber, signerName, clientEmail, clientName, total } = body;

  if (!estimateNumber || !signerName) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Missing fields' }) };
  }

  const WEBHOOK = process.env.GOOGLE_SHEETS_WEBHOOK;
  if (!WEBHOOK) {
    console.warn('GOOGLE_SHEETS_WEBHOOK not set — skipping log');
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true, skipped: true }) };
  }

  try {
    // Get client IP from Netlify headers
    const ip = event.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';

    const payload = {
      timestamp:      new Date().toISOString(),
      estimateNumber,
      signerName,
      clientEmail:    clientEmail || '',
      clientName:     clientName  || signerName,
      total:          total       || '',
      ip,
    };

    const res = await fetch(WEBHOOK, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Sheets webhook error: ${err}`);
    }

    console.log(`NDA logged: Estimate #${estimateNumber} signed by ${signerName}`);
    return {
      statusCode: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true }),
    };

  } catch (err) {
    console.error('log-nda error:', err.message);
    // Don't block the client — return 200 even if logging fails
    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({ ok: false, error: err.message }),
    };
  }
};
