// qb-reminder.js
// Scheduled function — runs every 90 days to remind about QuickBooks re-auth.
// Schedule is defined in netlify.toml

exports.handler = async function () {
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  const SITE_URL = process.env.URL || 'https://raveloavtech.com';

  if (!RESEND_API_KEY) {
    console.warn('RESEND_API_KEY not set — skipping reminder');
    return { statusCode: 200, body: 'skipped' };
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Ravelo AV Tech <support@raveloavtech.com>',
      to: ['jose.rojas@raveloavtech.com', 'support@raveloavtech.com'],
      subject: '🔑 QuickBooks re-auth reminder — action needed',
      html: `
        <div style="font-family:Arial,sans-serif;max-width:500px;margin:40px auto;background:#f4f6f9;padding:32px 16px;">
          <div style="background:#0c2d3a;border-radius:4px 4px 0 0;padding:28px 36px;">
            <p style="margin:0 0 6px;color:#82A0CC;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;font-weight:700;">Ravelo AV Tech — Automated Reminder</p>
            <h1 style="margin:0;color:#fff;font-size:20px;font-weight:700;">🔑 QuickBooks needs re-authorization</h1>
          </div>
          <div style="background:#fff;padding:28px 36px;">
            <p style="font-size:15px;color:#333;margin:0 0 16px;">
              The QuickBooks connection token expires every <strong>100 days</strong>.
              It's time to renew it so estimates keep loading in the admin panel.
            </p>
            <p style="font-size:14px;color:#555;margin:0 0 24px;">
              It only takes 30 seconds — just click the button below and sign in with your QuickBooks account.
            </p>
            <div style="text-align:center;margin-bottom:28px;">
              <a href="${SITE_URL}/.netlify/functions/qb-auth"
                 style="display:inline-block;background:#0c2d3a;color:#fff;text-decoration:none;
                        padding:14px 32px;border-radius:4px;font-size:15px;font-weight:700;">
                🔗 Reconnect QuickBooks
              </a>
            </div>
            <p style="font-size:12px;color:#aaa;text-align:center;margin:0;">
              If estimates are already loading fine, you can ignore this email.
            </p>
          </div>
          <div style="background:#0c2d3a;border-radius:0 0 4px 4px;padding:16px 36px;">
            <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.4);">
              Automated reminder · Ravelo AV Technologies LLC · raveloavtech.com
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

  console.log('QuickBooks re-auth reminder sent successfully');
  return { statusCode: 200, body: 'reminder sent' };
};
