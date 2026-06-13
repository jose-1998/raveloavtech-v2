// track-open.js
// Called when a client opens the NDA email (tracking pixel).
// Returns a 1x1 transparent GIF and sends a notification to the business.

const TRANSPARENT_GIF = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
);

const FROM = 'Ravelo AV Tech <support@raveloavtech.com>';

exports.handler = async function (event) {
  const { id = '', name = 'Client', email = '' } = event.queryStringParameters || {};

  // Fire-and-forget — don't delay the pixel response
  sendNotification(id, name, email).catch(err =>
    console.error('track-open notification failed:', err.message)
  );
  sendSMS(id, name).catch(err =>
    console.error('track-open SMS failed:', err.message)
  );

  return {
    statusCode: 200,
    headers: {
      'Content-Type':  'image/gif',
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma':        'no-cache',
      'Expires':       '0',
    },
    body:            TRANSPARENT_GIF.toString('base64'),
    isBase64Encoded: true,
  };
};

async function sendSMS(id, name) {
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) return;
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization:  `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from:    FROM,
      to:      ['6159620401@txt.att.net'],
      subject: '',
      text:    `👀 ${name} just opened Estimate #${id}. Good time to follow up!`,
    }),
  });
}

async function sendNotification(id, name, email) {
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) return;

  const openedAt = new Date().toLocaleString('en-US', {
    timeZone:  'America/Chicago',
    dateStyle: 'full',
    timeStyle: 'short',
  });

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization:  `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from:    FROM,
      to:      ['support@raveloavtech.com', 'jose.rojas@raveloavtech.com'],
      subject: `👀 ${name} just opened Estimate #${id}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:500px;margin:40px auto;background:#f4f6f9;padding:32px 16px;">
          <div style="background:#0c2d3a;border-radius:4px 4px 0 0;padding:28px 36px;">
            <p style="margin:0 0 6px;color:#82A0CC;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;font-weight:700;">Ravelo AV Tech — Estimate Opened</p>
            <h1 style="margin:0;color:#fff;font-size:20px;font-weight:700;">👀 ${name} opened your estimate</h1>
            <p style="margin:8px 0 0;color:rgba(255,255,255,0.45);font-size:12px;">${openedAt} (CT)</p>
          </div>
          <div style="background:#fff;padding:28px 36px;">
            <table style="border-collapse:collapse;width:100%;font-size:14px;">
              <tr style="border-bottom:1px solid #eee;">
                <td style="padding:10px 16px 10px 0;color:#888;width:110px;">Estimate</td>
                <td style="padding:10px 0;color:#222;font-weight:600;">#${id}</td>
              </tr>
              <tr style="border-bottom:1px solid #eee;">
                <td style="padding:10px 16px 10px 0;color:#888;">Client</td>
                <td style="padding:10px 0;color:#222;font-weight:600;">${name}</td>
              </tr>
              ${email ? `<tr>
                <td style="padding:10px 16px 10px 0;color:#888;">Email</td>
                <td style="padding:10px 0;"><a href="mailto:${email}" style="color:#0c2d3a;">${email}</a></td>
              </tr>` : ''}
            </table>
            <div style="margin-top:24px;padding:16px 20px;background:#f0f9f4;border-left:3px solid #34c759;border-radius:3px;">
              <p style="margin:0;font-size:13px;color:#1a7a3a;font-weight:600;">Good time to follow up! 🎯</p>
              <p style="margin:6px 0 0;font-size:13px;color:#555;">They just opened the estimate — they're likely reading it right now.</p>
            </div>
          </div>
          <div style="background:#0c2d3a;border-radius:0 0 4px 4px;padding:16px 36px;">
            <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.4);">Ravelo AV Technologies LLC · raveloavtech.com</p>
          </div>
        </div>
      `,
    }),
  });
}
