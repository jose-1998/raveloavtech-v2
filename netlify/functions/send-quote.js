exports.handler = async function (event) {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type' },
      body: '',
    };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const RESEND_API_KEY = process.env.RESEND_API_KEY;

  let data;
  try {
    data = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: 'Bad Request' };
  }

  const {
    first_name = '',
    last_name = '',
    email = '',
    phone = '',
    service = '',
    address = '',
    message = '',
  } = data;

  async function sendEmail(payload) {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(err);
    }
    return res.json();
  }

  const FROM = 'Ravelo AV Tech <support@raveloavtech.com>';

  // If no API key yet, return success so the form doesn't show an error
  if (!RESEND_API_KEY) {
    console.warn('RESEND_API_KEY not set — skipping emails');
    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ success: true, warning: 'emails skipped' }),
    };
  }

  try {
    // 1 — Notify the business
    await sendEmail({
      from: FROM,
      to: ['jose.rojas@raveloavtech.com'],
      subject: `Nueva cotización — ${service || 'Consulta general'}`,
      html: `
        <div style="font-family:Arial,sans-serif;color:#333;max-width:560px;margin:0 auto;padding:32px;">
          <h2 style="color:#0c2d3a;margin-bottom:24px;">Nueva solicitud de cotización</h2>
          <table style="border-collapse:collapse;width:100%;font-size:15px;">
            <tr><td style="padding:8px 12px 8px 0;color:#666;white-space:nowrap;">Nombre</td><td style="padding:8px 0;">${first_name} ${last_name}</td></tr>
            <tr><td style="padding:8px 12px 8px 0;color:#666;">Email</td><td style="padding:8px 0;"><a href="mailto:${email}">${email}</a></td></tr>
            <tr><td style="padding:8px 12px 8px 0;color:#666;">Teléfono</td><td style="padding:8px 0;">${phone || '—'}</td></tr>
            <tr><td style="padding:8px 12px 8px 0;color:#666;">Dirección</td><td style="padding:8px 0;">${address || '—'}</td></tr>
            <tr><td style="padding:8px 12px 8px 0;color:#666;">Servicio</td><td style="padding:8px 0;">${service || '—'}</td></tr>
            <tr><td style="padding:8px 12px 8px 0;color:#666;vertical-align:top;">Mensaje</td><td style="padding:8px 0;">${message || '—'}</td></tr>
          </table>
        </div>
      `,
    });

    // 2 — Auto-reply to client (Spanish + warranty)
    if (email) {
      await sendEmail({
        from: FROM,
        to: [email],
        reply_to: 'support@raveloavtech.com',
        subject: 'Thank you for contacting Ravelo AV Tech',
        html: `
          <!DOCTYPE html>
          <html lang="en">
          <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
          <body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
            <div style="max-width:560px;margin:40px auto;background:#ffffff;border-radius:4px;overflow:hidden;">

              <!-- Header -->
              <div style="background:#0c2d3a;padding:32px 40px;">
                <p style="margin:0;color:#82A0CC;font-size:12px;letter-spacing:0.15em;text-transform:uppercase;">Ravelo AV Technologies LLC</p>
                <h1 style="margin:12px 0 0;color:#ffffff;font-size:22px;font-weight:600;">We received your request</h1>
              </div>

              <!-- Body -->
              <div style="padding:36px 40px;">
                <p style="font-size:16px;color:#333;line-height:1.6;">
                  Hi <strong>${first_name}</strong>,
                </p>
                <p style="font-size:15px;color:#555;line-height:1.7;">
                  Thank you for reaching out. We have received your request and
                  <strong style="color:#0c2d3a;">we will be in touch with you shortly.</strong>
                </p>

                ${service ? `<p style="font-size:14px;color:#888;margin-top:4px;">Service requested: <strong style="color:#333;">${service}</strong></p>` : ''}

                <!-- Warranty box -->
                <div style="margin:28px 0;padding:20px 24px;background:#f8f9fb;border-left:3px solid #82A0CC;">
                  <h3 style="margin:0 0 10px;font-size:13px;letter-spacing:0.12em;text-transform:uppercase;color:#0c2d3a;">
                    Warranties &amp; Liability
                  </h3>
                  <p style="margin:0;font-size:14px;color:#555;line-height:1.7;">
                    We stand behind our workmanship. Labor performed by Ravelo AV Technologies LLC is warranted for
                    <strong>30 days</strong> after installation. Manufacturer warranties apply separately to any
                    equipment or products installed.
                  </p>
                </div>

                <hr style="border:none;border-top:1px solid #eee;margin:28px 0;">

                <p style="font-size:14px;color:#555;line-height:1.8;">
                  If you have any urgent questions, feel free to reach us:<br><br>
                  📞 <a href="tel:+19319335040" style="color:#0c2d3a;">+1 (931) 933-5040</a><br>
                  📱 <a href="tel:+16159620401" style="color:#0c2d3a;">+1 (615) 962-0401</a><br>
                  ✉️ <a href="mailto:support@raveloavtech.com" style="color:#0c2d3a;">support@raveloavtech.com</a>
                </p>
              </div>

              <!-- Footer -->
              <div style="background:#f0f0f0;padding:20px 40px;">
                <p style="margin:0;font-size:12px;color:#999;line-height:1.6;">
                  Sincerely, <strong style="color:#555;">The Ravelo AV Tech Team</strong><br>
                  Nashville Metro Area, TN &nbsp;·&nbsp; raveloavtech.com
                </p>
              </div>

            </div>
          </body>
          </html>
        `,
      });
    }

    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ success: true }),
    };
  } catch (error) {
    console.error('Email error:', error.message);
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: error.message }),
    };
  }
};
