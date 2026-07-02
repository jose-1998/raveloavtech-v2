// qb-reminder.js
// Scheduled health check — runs every 90 days and verifies the qb-keepalive
// machinery is actually rotating tokens. Only emails if something is wrong:
//   - no tokens stored in Blobs, or
//   - tokens haven't been refreshed in over 35 days (keepalive runs monthly).
// If everything is healthy, it stays silent.
// Schedule is defined in netlify.toml

const { getStore } = require('@netlify/blobs');

const STALE_DAYS = 35; // keepalive runs monthly; older than this means it's broken

exports.handler = async function () {
  const SITE_URL = process.env.URL || 'https://raveloavtech.com';

  let problem = null;

  try {
    const store = getStore({ name: 'qb-tokens', consistency: 'strong', siteID: process.env.NETLIFY_SITE_ID, token: process.env.NETLIFY_API_TOKEN });
    const data = await store.get('tokens', { type: 'json' });

    if (!data?.refreshToken) {
      problem = 'No QuickBooks tokens found in storage.';
    } else if (!data.updatedAt) {
      problem = 'Stored tokens have no refresh date — keepalive may not be saving correctly.';
    } else {
      const ageDays = (Date.now() - new Date(data.updatedAt).getTime()) / 86400000;
      if (ageDays > STALE_DAYS) {
        problem = `Tokens were last refreshed ${Math.round(ageDays)} days ago — the monthly auto-refresh (qb-keepalive) appears to be failing.`;
      }
    }
  } catch (e) {
    problem = `Could not read token storage: ${e.message}`;
  }

  if (!problem) {
    console.log('qb-reminder: connection healthy, keepalive rotating tokens — no email needed');
    return { statusCode: 200, body: 'healthy' };
  }

  console.warn('qb-reminder: unhealthy —', problem);

  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) {
    console.warn('RESEND_API_KEY not set — cannot send alert');
    return { statusCode: 200, body: 'unhealthy but no email key' };
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Ravelo AV Tech <support@raveloavtech.com>',
      to: ['support@raveloavtech.com', 'jose.rojas@raveloavtech.com'],
      subject: '🔑 QuickBooks connection needs attention',
      html: `
        <div style="font-family:Arial,sans-serif;max-width:500px;margin:40px auto;background:#f4f6f9;padding:32px 16px;">
          <div style="background:#0c2d3a;border-radius:4px 4px 0 0;padding:28px 36px;">
            <p style="margin:0 0 6px;color:#82A0CC;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;font-weight:700;">Ravelo AV Tech — Automated Health Check</p>
            <h1 style="margin:0;color:#fff;font-size:20px;font-weight:700;">🔑 QuickBooks needs re-authorization</h1>
          </div>
          <div style="background:#fff;padding:28px 36px;">
            <p style="font-size:15px;color:#333;margin:0 0 16px;">
              The automatic token renewal is not working:
            </p>
            <p style="font-size:14px;color:#b00;background:#fdf0f0;border-radius:4px;padding:12px 16px;margin:0 0 24px;">
              ${problem}
            </p>
            <p style="font-size:14px;color:#555;margin:0 0 24px;">
              It only takes 30 seconds — click the button below and sign in with your QuickBooks account.
            </p>
            <div style="text-align:center;margin-bottom:28px;">
              <a href="${SITE_URL}/.netlify/functions/qb-auth"
                 style="display:inline-block;background:#0c2d3a;color:#fff;text-decoration:none;
                        padding:14px 32px;border-radius:4px;font-size:15px;font-weight:700;">
                🔗 Reconnect QuickBooks
              </a>
            </div>
          </div>
          <div style="background:#0c2d3a;border-radius:0 0 4px 4px;padding:16px 36px;">
            <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.4);">
              Automated health check · Ravelo AV Technologies LLC · raveloavtech.com
            </p>
          </div>
        </div>
      `,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error('qb-reminder email failed:', err);
    return { statusCode: 500, body: err };
  }

  console.log('QuickBooks health alert sent');
  return { statusCode: 200, body: 'alert sent' };
};
