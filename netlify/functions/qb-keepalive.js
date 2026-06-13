// qb-keepalive.js
// Scheduled function — runs every 30 days to silently refresh the QB tokens.
// When QB issues a new access_token it also rotates the refresh_token, so
// calling this before the 100-day window closes keeps the connection alive
// indefinitely without any manual re-auth.
// Schedule is defined in netlify.toml.

const TOKEN_URL = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';

exports.handler = async function () {
  const {
    QUICKBOOKS_CLIENT_ID,
    QUICKBOOKS_CLIENT_SECRET,
    QUICKBOOKS_REFRESH_TOKEN,
    NETLIFY_TOKEN,
    SITE_ID,
  } = process.env;

  if (!QUICKBOOKS_REFRESH_TOKEN || !QUICKBOOKS_CLIENT_ID || !QUICKBOOKS_CLIENT_SECRET) {
    console.error('qb-keepalive: missing QB credentials — skipping');
    return { statusCode: 200, body: 'skipped: missing credentials' };
  }

  try {
    const credentials = Buffer.from(`${QUICKBOOKS_CLIENT_ID}:${QUICKBOOKS_CLIENT_SECRET}`).toString('base64');

    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: new URLSearchParams({
        grant_type:    'refresh_token',
        refresh_token: QUICKBOOKS_REFRESH_TOKEN,
      }).toString(),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('qb-keepalive: token refresh failed —', err);
      // Send alert email so you know to re-auth manually
      await sendAlert(err);
      return { statusCode: 500, body: 'refresh failed' };
    }

    const tokens = await res.json();

    // Save both tokens back to Netlify env vars
    await saveNetlifyEnvVars(
      { QUICKBOOKS_ACCESS_TOKEN: tokens.access_token, QUICKBOOKS_REFRESH_TOKEN: tokens.refresh_token },
      NETLIFY_TOKEN,
      SITE_ID
    );

    console.log('qb-keepalive: tokens refreshed and saved successfully');
    return { statusCode: 200, body: 'ok' };

  } catch (err) {
    console.error('qb-keepalive error:', err.message);
    await sendAlert(err.message);
    return { statusCode: 500, body: err.message };
  }
};

async function saveNetlifyEnvVars(vars, token, siteId) {
  if (!token || !siteId) {
    console.warn('qb-keepalive: NETLIFY_TOKEN or SITE_ID missing — tokens not persisted');
    return;
  }

  // Env var API is account-scoped — resolve account_id from site info first
  let accountId;
  try {
    const siteRes = await fetch(`https://api.netlify.com/api/v1/sites/${siteId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (siteRes.ok) {
      const site = await siteRes.json();
      accountId = site.account_id || site.account_slug;
    }
  } catch { /* ignore */ }

  if (!accountId) {
    console.warn('qb-keepalive: could not resolve account_id — tokens not persisted');
    return;
  }

  for (const [key, value] of Object.entries(vars)) {
    let res = await fetch(`https://api.netlify.com/api/v1/accounts/${accountId}/env/${key}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, values: [{ context: 'all', value }] }),
    });
    if (!res.ok) {
      res = await fetch(`https://api.netlify.com/api/v1/accounts/${accountId}/env`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify([{ key, values: [{ context: 'all', value }] }]),
      });
    }
    if (res.ok) console.log(`qb-keepalive: saved ${key}`);
    else console.warn(`qb-keepalive: failed to save ${key} —`, await res.text());
  }
}

async function sendAlert(errMsg) {
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) return;
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from:    'Ravelo AV Tech <support@raveloavtech.com>',
      to:      ['jose.rojas@raveloavtech.com'],
      subject: '⚠️ QuickBooks token refresh failed — action needed',
      html: `<p style="font-family:Arial,sans-serif;font-size:15px;color:#333;">
        The automatic QB token refresh failed. You need to re-authenticate manually:<br><br>
        <a href="https://raveloavtech.com/.netlify/functions/qb-auth"
           style="background:#0c2d3a;color:#fff;padding:12px 28px;border-radius:4px;text-decoration:none;font-weight:700;display:inline-block;">
          🔗 Reconnect QuickBooks
        </a><br><br>
        <small style="color:#888;">Error: ${errMsg}</small>
      </p>`,
    }),
  }).catch(() => {});
}
