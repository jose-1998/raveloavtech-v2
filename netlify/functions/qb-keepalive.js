// qb-keepalive.js
// Scheduled function — runs every 30 days to silently refresh the QB tokens.
// When QB issues a new access_token it also rotates the refresh_token, so
// calling this before the 100-day window closes keeps the connection alive
// indefinitely without any manual re-auth.
// Schedule is defined in netlify.toml.

const { getStore } = require('@netlify/blobs');

const TOKEN_URL = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';

exports.handler = async function () {
  const { QUICKBOOKS_CLIENT_ID, QUICKBOOKS_CLIENT_SECRET } = process.env;

  if (!QUICKBOOKS_CLIENT_ID || !QUICKBOOKS_CLIENT_SECRET) {
    console.error('qb-keepalive: missing QB credentials — skipping');
    return { statusCode: 200, body: 'skipped: missing credentials' };
  }

  // Load tokens from Blobs first, fall back to env vars
  let refreshToken, realmId;
  try {
    const store = getStore({ name: 'qb-tokens', consistency: 'strong' });
    const data = await store.get('tokens', { type: 'json' });
    if (data?.refreshToken) {
      refreshToken = data.refreshToken;
      realmId      = data.realmId;
      console.log('qb-keepalive: loaded tokens from Blobs');
    }
  } catch (e) {
    console.warn('qb-keepalive: blob read failed:', e.message);
  }

  if (!refreshToken) {
    refreshToken = process.env.QUICKBOOKS_REFRESH_TOKEN;
    realmId      = process.env.QUICKBOOKS_REALM_ID;
    console.log('qb-keepalive: falling back to env var tokens');
  }

  if (!refreshToken) {
    console.error('qb-keepalive: no refresh token found anywhere — skipping');
    return { statusCode: 200, body: 'skipped: no refresh token' };
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
        refresh_token: refreshToken,
      }).toString(),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('qb-keepalive: token refresh failed —', err);
      await sendAlert(err);
      return { statusCode: 500, body: 'refresh failed' };
    }

    const tokens = await res.json();

    // Save rotated tokens to Blobs
    const store = getStore({ name: 'qb-tokens', consistency: 'strong' });
    await store.setJSON('tokens', {
      accessToken:  tokens.access_token,
      refreshToken: tokens.refresh_token,
      realmId:      realmId || process.env.QUICKBOOKS_REALM_ID,
      updatedAt:    new Date().toISOString(),
    });

    console.log('qb-keepalive: tokens refreshed and saved to Blobs successfully');
    return { statusCode: 200, body: 'ok' };

  } catch (err) {
    console.error('qb-keepalive error:', err.message);
    await sendAlert(err.message);
    return { statusCode: 500, body: err.message };
  }
};

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
