// qb-callback.js
// Step 2 of OAuth2 — QB redirects here with a code, we exchange it for tokens.
// The refresh_token is displayed on screen so you can save it to Netlify env vars.
// This only needs to be run ONCE (or when the token expires after 100 days).

exports.handler = async function (event) {
  const { code, realmId, error } = event.queryStringParameters || {};

  if (error) {
    return html(`<h2>❌ QB Authorization Error</h2><p>${error}</p>`);
  }

  if (!code || !realmId) {
    return html(`<h2>❌ Missing code or realmId</h2><p>Make sure you started the flow from <a href="/.netlify/functions/qb-auth">qb-auth</a>.</p>`);
  }

  const CLIENT_ID     = process.env.QUICKBOOKS_CLIENT_ID;
  const CLIENT_SECRET = process.env.QUICKBOOKS_CLIENT_SECRET;
  const SITE_URL      = process.env.URL || 'https://raveloavtech.com';
  const redirectUri   = `${SITE_URL}/.netlify/functions/qb-callback`;

  try {
    // Exchange code for tokens
    const credentials = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
    const res = await fetch('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: new URLSearchParams({
        grant_type:   'authorization_code',
        code,
        redirect_uri: redirectUri,
      }).toString(),
    });

    if (!res.ok) {
      const err = await res.text();
      return html(`<h2>❌ Token exchange failed</h2><pre>${err}</pre>`);
    }

    const tokens = await res.json();

    // Show tokens — copy these to Netlify env vars
    return html(`
      <h1 style="color:#072b3e;font-family:sans-serif">✅ QuickBooks Connected!</h1>
      <p style="font-family:sans-serif;color:#555">Copy these three values to <strong>Netlify → Environment Variables</strong>:</p>

      <table style="font-family:monospace;border-collapse:collapse;margin:24px 0">
        <tr style="background:#072b3e;color:#fff">
          <th style="padding:10px 16px;text-align:left">Variable</th>
          <th style="padding:10px 16px;text-align:left">Value</th>
        </tr>
        <tr style="background:#f0f4f8">
          <td style="padding:10px 16px;font-weight:700">QUICKBOOKS_REALM_ID</td>
          <td style="padding:10px 16px">${realmId}</td>
        </tr>
        <tr>
          <td style="padding:10px 16px;font-weight:700">QUICKBOOKS_ACCESS_TOKEN</td>
          <td style="padding:10px 16px;word-break:break-all;max-width:500px">${tokens.access_token}</td>
        </tr>
        <tr style="background:#f0f4f8">
          <td style="padding:10px 16px;font-weight:700">QUICKBOOKS_REFRESH_TOKEN</td>
          <td style="padding:10px 16px;word-break:break-all;max-width:500px">${tokens.refresh_token}</td>
        </tr>
      </table>

      <p style="font-family:sans-serif;color:#888;font-size:13px">
        ⚠️ The access_token expires in 1 hour. The refresh_token lasts 100 days.<br>
        Once you save these in Netlify, the system will auto-refresh the access_token as needed.
      </p>
    `);

  } catch (err) {
    return html(`<h2>❌ Error</h2><pre>${err.message}</pre>`);
  }
};

function html(body) {
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'text/html' },
    body: `<!DOCTYPE html><html><head><meta charset="UTF-8">
      <style>body{margin:40px;background:#f0f4f8}pre{background:#fff;padding:16px;border-radius:4px}</style>
    </head><body>${body}</body></html>`,
  };
}
