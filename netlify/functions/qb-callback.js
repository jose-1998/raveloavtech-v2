// qb-callback.js
// Step 2 of OAuth2 — QB redirects here with a code, we exchange it for tokens.
// Tokens are saved to Netlify Blobs (free plan compatible, no redeploy needed).

const { getStore } = require('@netlify/blobs');

exports.handler = async function (event) {
  const { code, realmId, error } = event.queryStringParameters || {};

  if (error) {
    return html(`<h2>❌ QB Authorization Error</h2><p>${error}</p>`);
  }

  if (!code || !realmId) {h
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

    // Save tokens to Netlify Blobs (free plan, no redeploy needed)
    let blobSaved = false;
    let blobError = '';
    try {
      const store = getStore({ name: 'qb-tokens', consistency: 'strong', siteID: process.env.NETLIFY_SITE_ID, token: process.env.NETLIFY_API_TOKEN });
      await store.setJSON('tokens', {
        accessToken:  tokens.access_token,
        refreshToken: tokens.refresh_token,
        realmId,
        updatedAt: new Date().toISOString(),
      });
      blobSaved = true;
      console.log('QB tokens saved to Netlify Blobs');
    } catch (e) {
      blobError = e.message;
      console.error('Blob save failed:', e.message);
    }

    const statusBanner = blobSaved
      ? `<div style="font-family:sans-serif;background:#d1fae5;border-left:4px solid #10b981;padding:16px 20px;border-radius:4px;margin-bottom:20px;">
           <p style="margin:0;font-weight:700;color:#065f46;font-size:16px;">🎉 QuickBooks connected! Tokens saved automatically.</p>
           <p style="margin:6px 0 0;color:#065f46;font-size:13px;">The system will auto-refresh tokens from now on. You can close this page.</p>
         </div>`
      : `<div style="font-family:sans-serif;background:#fff0f0;border-left:4px solid #dc3545;padding:16px 20px;border-radius:4px;margin-bottom:20px;">
           <p style="margin:0 0 8px;font-weight:700;color:#dc3545;font-size:16px;">❌ Auto-save failed — ACTION REQUIRED</p>
           <p style="margin:0;color:#555;font-size:13px;">
             Go to <strong>Netlify → Site configuration → Environment variables</strong> and paste the values from the table below.<br>
             Then trigger a new deploy.<br><small style="color:#999;">Error: ${blobError}</small>
           </p>
         </div>`;

    return html(`
      <h1 style="color:#072b3e;font-family:sans-serif;margin:0 0 20px;">✅ QuickBooks Connected!</h1>
      ${statusBanner}
      ${!blobSaved ? `
      <p style="font-family:sans-serif;font-weight:600;color:#555;margin:0 0 10px;">⬇️ Copy these into Netlify environment variables:</p>
      <table style="font-family:monospace;border-collapse:collapse;margin:0 0 12px;width:100%;max-width:700px">
        <tr style="background:#072b3e;color:#fff">
          <th style="padding:10px 16px;text-align:left">Variable</th>
          <th style="padding:10px 16px;text-align:left">Value</th>
        </tr>
        <tr style="background:#f0f4f8">
          <td style="padding:10px 16px;font-weight:700;white-space:nowrap">QUICKBOOKS_REALM_ID</td>
          <td style="padding:10px 16px">${realmId}</td>
        </tr>
        <tr>
          <td style="padding:10px 16px;font-weight:700;white-space:nowrap">QUICKBOOKS_ACCESS_TOKEN</td>
          <td style="padding:10px 16px;word-break:break-all">${tokens.access_token}</td>
        </tr>
        <tr style="background:#f0f4f8">
          <td style="padding:10px 16px;font-weight:700;white-space:nowrap">QUICKBOOKS_REFRESH_TOKEN</td>
          <td style="padding:10px 16px;word-break:break-all">${tokens.refresh_token}</td>
        </tr>
      </table>
      <p style="font-family:sans-serif;color:#888;font-size:12px;">⚠️ The access_token expires in 1 hour. The refresh_token lasts 100 days.</p>
      ` : ''}
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
      <style>body{margin:40px;background:#f0f4f8}pre{background:#fff;padding:16px;border-radius:4px}h1,h2{font-family:sans-serif}</style>
    </head><body>${body}</body></html>`,
  };
}
