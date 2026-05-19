exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' },
      body: '',
    };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: { 'Access-Control-Allow-Origin': '*' }, body: 'Method Not Allowed' };
  }

  // Require Netlify Identity JWT
  const auth = (event.headers.authorization || '').replace('Bearer ', '').trim();
  if (!auth) {
    return { statusCode: 401, headers: { 'Access-Control-Allow-Origin': '*' }, body: 'Unauthorized' };
  }

  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) {
    return {
      statusCode: 503,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'RESEND_API_KEY not configured' }),
    };
  }

  let data;
  try { data = JSON.parse(event.body); } catch {
    return { statusCode: 400, headers: { 'Access-Control-Allow-Origin': '*' }, body: 'Bad Request' };
  }

  const { name = '', email = '' } = data;
  if (!email) {
    return {
      statusCode: 400,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'email is required' }),
    };
  }

  const firstName = name.split(' ')[0] || 'there';
  const GOOGLE_REVIEW_URL = 'https://g.page/r/raveloavtech/review'; // ← update with real link

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Ravelo AV Tech <support@raveloavtech.com>',
        to: [email],
        reply_to: 'support@raveloavtech.com',
        subject: 'Would you leave us a quick Google review? ⭐',
        html: `
          <!DOCTYPE html>
          <html lang="en">
          <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
          <body style="margin:0;padding:0;background:#eef1f4;font-family:Arial,sans-serif;">
            <div style="max-width:540px;margin:40px auto 60px;">

              <!-- HEADER -->
              <div style="background:#0c2d3a;padding:36px 44px 30px;border-radius:4px 4px 0 0;">
                <p style="margin:0 0 10px;color:#82A0CC;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;font-weight:600;">Ravelo AV Technologies LLC</p>
                <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;line-height:1.3;">How did we do, ${firstName}? ⭐</h1>
              </div>

              <!-- BODY -->
              <div style="background:#ffffff;padding:40px 44px;">
                <p style="margin:0 0 18px;font-size:15px;color:#333;line-height:1.75;">
                  Hi <strong>${firstName}</strong>,
                </p>
                <p style="margin:0 0 18px;font-size:15px;color:#555;line-height:1.75;">
                  Thank you for trusting <strong style="color:#0c2d3a;">Ravelo AV Tech</strong> with your project.
                  It was a pleasure working with you!
                </p>
                <p style="margin:0 0 28px;font-size:15px;color:#555;line-height:1.75;">
                  If you were happy with our service, we'd really appreciate it if you could take
                  <strong>30 seconds</strong> to leave us a Google review — it means a lot to our small
                  business and helps other homeowners find us. 🙏
                </p>

                <!-- CTA BUTTON -->
                <div style="text-align:center;margin-bottom:32px;">
                  <a href="${GOOGLE_REVIEW_URL}"
                     style="display:inline-block;background:#0c2d3a;color:#ffffff;text-decoration:none;
                            padding:16px 36px;border-radius:4px;font-size:15px;font-weight:700;
                            letter-spacing:0.04em;">
                    ⭐ Leave a Google Review
                  </a>
                </div>

                <p style="margin:0;font-size:13px;color:#aaa;text-align:center;line-height:1.6;">
                  Takes less than 30 seconds · No account needed
                </p>
              </div>

              <!-- FOOTER -->
              <div style="background:#0c2d3a;padding:24px 44px;border-radius:0 0 4px 4px;">
                <p style="margin:0 0 4px;font-size:12px;color:rgba(255,255,255,0.85);font-weight:600;">Ravelo AV Technologies LLC</p>
                <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.4);line-height:1.6;">
                  Nashville Metro Area, TN &nbsp;·&nbsp;
                  <a href="https://raveloavtech.com" style="color:#82A0CC;text-decoration:none;">raveloavtech.com</a>
                </p>
              </div>

            </div>
          </body>
          </html>
        `,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(err);
    }

    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ success: true }),
    };
  } catch (err) {
    console.error('send-review error:', err.message);
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: err.message }),
    };
  }
};
