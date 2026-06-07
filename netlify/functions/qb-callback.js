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

    // Auto-save tokens to Netlify env vars
    const saveResults = await saveNetlifyEnvVars({
      QUICKBOOKS_REALM_ID: realmId,
      QUICKBOOKS_ACCESS_TOKEN: tokens.access_token,
      QUICKBOOKS_REFRESH_TOKEN: tokens.refresh_token,
    });

    const allSaved    = saveResults.every(r => r.ok);
    const noToken     = saveResults[0]?.error === 'no_token';

    const statusBanner = noToken
      ? `<p style="font-family:sans-serif;background:#fef3c7;border-left:4px solid #d97706;padding:12px 16px;border-radius:4px;color:#92400e;font-weight:600">
           ⚠️ NETLIFY_TOKEN not configured — auto-save skipped.<br>
           <span style="font-weight:400">Copy the tokens below into Netlify → Site configuration → Environment variables.</span>
         </p>`
      : allSaved
        ? `<p style="font-family:sans-serif;color:#28a745;font-weight:600">🎉 All tokens saved automatically to Netlify!</p>`
        : `<div style="font-family:sans-serif;background:#fff0f0;border-left:4px solid #dc3545;padding:16px;border-radius:4px;margin-bottom:16px">
             <p style="margin:0 0 10px;font-weight:700;color:#dc3545;font-size:16px">❌ Auto-save failed — ACTION REQUIRED</p>
             <p style="margin:0;color:#555">The NETLIFY_TOKEN may be invalid or lack write permissions.<br>
             Go to <strong>Netlify → Site configuration → Environment variables</strong> and paste the values from the table below.</p>
           </div>`;

    const saveStatusRows = noToken ? '' : saveResults.map(r =>
      `<tr>
         <td style="padding:6px 12px">${r.ok ? '✅' : '❌'}</td>
         <td style="padding:6px 12px;font-family:monospace;font-size:13px">${r.key}</td>
         <td style="padding:6px 12px;font-size:13px;color:${r.ok ? '#28a745' : '#dc3545'}">${r.ok ? 'saved' : r.error}</td>
       </tr>`
    ).join('');

    return html(`
      <h1 style="color:#072b3e;font-family:sans-serif">✅ QuickBooks Connected!</h1>
      ${statusBanner}

      ${saveStatusRows ? `<table style="border-collapse:collapse;margin:12px 0 24px">${saveStatusRows}</table>` : ''}

      <p style="font-family:sans-serif;color:#555;font-weight:600;margin-top:24px">
        ${allSaved && !noToken ? 'Values saved (keep as backup):' : '⬇️ Copy these into Netlify environment variables:'}
      </p>
      <table style="font-family:monospace;border-collapse:collapse;margin:12px 0;width:100%;max-width:700px">
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

      <p style="font-family:sans-serif;color:#888;font-size:13px">
        ⚠️ The access_token expires in 1 hour. The refresh_token lasts 100 days.<br>
        Once saved in Netlify, the system will auto-refresh the access_token as needed.
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

// ── Save env vars via Netlify API so tokens persist automatically ─────────────
// Returns array of { key, ok, error? } — one entry per variable.
async function saveNetlifyEnvVars(vars) {
  // Accept NETLIFY_TOKEN (custom) or NETLIFY_API_TOKEN (auto-injected by some Netlify plans)
  const token  = process.env.NETLIFY_TOKEN || process.env.NETLIFY_API_TOKEN;
  const siteId = process.env.SITE_ID; // Auto-injected by Netlify

  if (!token || !siteId) {
    console.warn('NETLIFY_TOKEN / NETLIFY_API_TOKEN or SITE_ID not set — skipping auto-save');
    return Object.keys(vars).map(key => ({ key, ok: false, error: 'no_token' }));
  }

  const results = [];
  for (const [key, value] of Object.entries(vars)) {
    try {
      // PATCH updates an existing env var (correct method for Netlify API v1)
      const res = await fetch(`https://api.netlify.com/api/v1/sites/${siteId}/env/${key}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ key, values: [{ context: 'all', value }] }),
      });

      if (res.ok) {
        console.log(`Saved ${key} to Netlify (PATCH)`);
        results.push({ key, ok: true });
        continue;
      }

      const patchErr = await res.text();
      console.warn(`PATCH failed for ${key} (${res.status}): ${patchErr} — trying POST`);

      // Fallback: POST creates the var if it doesn't exist yet
      const res2 = await fetch(`https://api.netlify.com/api/v1/sites/${siteId}/env`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([{ key, values: [{ context: 'all', value }] }]),
      });

      if (res2.ok) {
        console.log(`Saved ${key} to Netlify (POST fallback)`);
        results.push({ key, ok: true });
      } else {
        const postErr = await res2.text();
        console.warn(`POST also failed for ${key} (${res2.status}): ${postErr}`);
        results.push({ key, ok: false, error: `HTTP ${res.status}: ${patchErr.slice(0, 120)}` });
      }
    } catch (e) {
      console.error(`Exception saving ${key}:`, e.message);
      results.push({ key, ok: false, error: e.message.slice(0, 120) });
    }
  }
  return results;
}
