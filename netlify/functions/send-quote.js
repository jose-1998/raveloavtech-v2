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
    const submittedAt = new Date().toLocaleString('en-US', { timeZone: 'America/Chicago', dateStyle: 'full', timeStyle: 'short' });
    await sendEmail({
      from: FROM,
      to: ['support@raveloavtech.com', 'jose.rojas@raveloavtech.com'],
      reply_to: email || undefined,
      subject: `New quote request — ${service || 'General inquiry'} (${first_name} ${last_name})`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f4f6f9;padding:32px 16px;">

          <!-- Header -->
          <div style="background:#0c2d3a;border-radius:4px 4px 0 0;padding:28px 36px;">
            <p style="margin:0 0 6px;color:#82A0CC;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;font-weight:700;">Ravelo AV Tech — New Lead</p>
            <h1 style="margin:0;color:#fff;font-size:20px;font-weight:700;">New Quote Request</h1>
            <p style="margin:8px 0 0;color:rgba(255,255,255,0.45);font-size:12px;">${submittedAt} (CT)</p>
          </div>

          <!-- Body -->
          <div style="background:#fff;padding:32px 36px;">

            <!-- Reply CTA -->
            ${email ? `<div style="margin-bottom:28px;">
              <a href="mailto:${email}?subject=Re: Your quote request — ${encodeURIComponent(service || 'General inquiry')}" style="display:inline-block;background:#0c2d3a;color:#82A0CC;text-decoration:none;padding:12px 24px;border-radius:3px;font-size:13px;font-weight:700;letter-spacing:0.08em;">Reply to ${first_name} →</a>
            </div>` : ''}

            <!-- Details table -->
            <table style="border-collapse:collapse;width:100%;font-size:14px;">
              <tr style="border-bottom:1px solid #eee;">
                <td style="padding:10px 16px 10px 0;color:#888;white-space:nowrap;width:110px;">Name</td>
                <td style="padding:10px 0;color:#222;font-weight:600;">${first_name} ${last_name}</td>
              </tr>
              <tr style="border-bottom:1px solid #eee;">
                <td style="padding:10px 16px 10px 0;color:#888;">Email</td>
                <td style="padding:10px 0;"><a href="mailto:${email}" style="color:#0c2d3a;">${email}</a></td>
              </tr>
              <tr style="border-bottom:1px solid #eee;">
                <td style="padding:10px 16px 10px 0;color:#888;">Phone</td>
                <td style="padding:10px 0;">${phone ? `<a href="tel:${phone.replace(/\D/g,'')}" style="color:#0c2d3a;">${phone}</a>` : '—'}</td>
              </tr>
              <tr style="border-bottom:1px solid #eee;">
                <td style="padding:10px 16px 10px 0;color:#888;">Address</td>
                <td style="padding:10px 0;color:#222;">${address || '—'}</td>
              </tr>
              <tr style="border-bottom:1px solid #eee;">
                <td style="padding:10px 16px 10px 0;color:#888;">Service</td>
                <td style="padding:10px 0;"><strong style="color:#0c2d3a;">${service || '—'}</strong></td>
              </tr>
              <tr>
                <td style="padding:10px 16px 10px 0;color:#888;vertical-align:top;">Message</td>
                <td style="padding:10px 0;color:#444;line-height:1.6;">${message || '—'}</td>
              </tr>
            </table>
          </div>

          <!-- Footer -->
          <div style="background:#e8ecf0;border-radius:0 0 4px 4px;padding:16px 36px;">
            <p style="margin:0;font-size:11px;color:#999;">Submitted via raveloavtech.com · Ravelo AV Technologies LLC</p>
          </div>

        </div>
      `,
    });

    // 2 — Auto-reply to client
    if (email) {
      await sendEmail({
        from: FROM,
        to: [email],
        reply_to: 'support@raveloavtech.com',
        subject: 'Your quote request — Ravelo AV Technologies LLC',
        html: `
          <!DOCTYPE html>
          <html lang="en">
          <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
          <body style="margin:0;padding:0;background:#eef1f4;font-family:Arial,sans-serif;">

            <div style="max-width:580px;margin:40px auto 60px;">

              <!-- HEADER -->
              <div style="background:#0c2d3a;padding:36px 44px 30px;border-radius:4px 4px 0 0;">
                <p style="margin:0 0 14px;color:#82A0CC;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;font-weight:600;">Ravelo AV Technologies LLC</p>
                <h1 style="margin:0 0 6px;color:#ffffff;font-size:24px;font-weight:700;line-height:1.25;">Your request is confirmed</h1>
                <p style="margin:0;color:rgba(255,255,255,0.55);font-size:14px;">We'll be in touch within <strong style="color:rgba(255,255,255,0.85);">1 business day</strong>.</p>
              </div>

              <!-- BODY -->
              <div style="background:#ffffff;padding:40px 44px;">

                <p style="margin:0 0 10px;font-size:16px;color:#222;font-weight:600;">Hi ${first_name},</p>
                <p style="margin:0 0 24px;font-size:15px;color:#555;line-height:1.75;">
                  Thank you for reaching out to Ravelo AV Tech. We have received your quote request
                  ${service ? `for <strong style="color:#0c2d3a;">${service}</strong> ` : ''}and our team will review it and get back to you promptly.
                </p>

                <!-- WHAT HAPPENS NEXT -->
                <div style="background:#f7f9fc;border-radius:4px;padding:24px 28px;margin-bottom:32px;">
                  <p style="margin:0 0 16px;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#82A0CC;font-weight:700;">What happens next</p>
                  <table style="border-collapse:collapse;width:100%;">
                    <tr>
                      <td style="width:28px;vertical-align:top;padding:0 12px 14px 0;">
                        <div style="width:24px;height:24px;background:#0c2d3a;border-radius:50%;text-align:center;line-height:24px;color:#82A0CC;font-size:12px;font-weight:700;">1</div>
                      </td>
                      <td style="vertical-align:top;padding:0 0 14px;">
                        <p style="margin:0;font-size:14px;color:#333;font-weight:600;">We review your request</p>
                        <p style="margin:4px 0 0;font-size:13px;color:#777;line-height:1.6;">Our technicians will analyze your project details and prepare a tailored proposal.</p>
                      </td>
                    </tr>
                    <tr>
                      <td style="width:28px;vertical-align:top;padding:0 12px 14px 0;">
                        <div style="width:24px;height:24px;background:#0c2d3a;border-radius:50%;text-align:center;line-height:24px;color:#82A0CC;font-size:12px;font-weight:700;">2</div>
                      </td>
                      <td style="vertical-align:top;padding:0 0 14px;">
                        <p style="margin:0;font-size:14px;color:#333;font-weight:600;">We contact you to schedule</p>
                        <p style="margin:4px 0 0;font-size:13px;color:#777;line-height:1.6;">A team member will call or email you to confirm project details and schedule a site visit if needed.</p>
                      </td>
                    </tr>
                    <tr>
                      <td style="width:28px;vertical-align:top;padding:0 12px 0 0;">
                        <div style="width:24px;height:24px;background:#0c2d3a;border-radius:50%;text-align:center;line-height:24px;color:#82A0CC;font-size:12px;font-weight:700;">3</div>
                      </td>
                      <td style="vertical-align:top;padding:0;">
                        <p style="margin:0;font-size:14px;color:#333;font-weight:600;">Installation &amp; walkthrough</p>
                        <p style="margin:4px 0 0;font-size:13px;color:#777;line-height:1.6;">Once approved, we complete the install and walk you through the system so you feel confident using everything.</p>
                      </td>
                    </tr>
                  </table>
                </div>

                <!-- DIVIDER -->
                <hr style="border:none;border-top:1px solid #e8ecf0;margin:0 0 32px;">

                <!-- WARRANTIES & GUARANTEES -->
                <p style="margin:0 0 16px;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#82A0CC;font-weight:700;">Warranties &amp; Guarantees</p>

                <!-- Labor Warranty -->
                <div style="border:1px solid #dde3ea;border-radius:4px;padding:20px 24px;margin-bottom:14px;">
                  <p style="margin:0 0 6px;font-size:14px;font-weight:700;color:#0c2d3a;">&#128295; Labor Warranty — 30 Days</p>
                  <p style="margin:0;font-size:13px;color:#555;line-height:1.75;">
                    All work performed by Ravelo AV Technologies LLC is covered by a <strong>30-day labor warranty</strong>
                    from the date of installation. If any issue arises directly from our installation workmanship
                    within this period, we will return and correct it at <strong>no additional charge</strong>.
                  </p>
                </div>

                <!-- Manufacturer Warranty -->
                <div style="border:1px solid #dde3ea;border-radius:4px;padding:20px 24px;margin-bottom:14px;">
                  <p style="margin:0 0 6px;font-size:14px;font-weight:700;color:#0c2d3a;">&#128230; Manufacturer Warranty — Varies by Product</p>
                  <p style="margin:0;font-size:13px;color:#555;line-height:1.75;">
                    All equipment and products we install come with the <strong>manufacturer's own warranty</strong>,
                    which typically ranges from 1 to 5 years depending on the brand and product type.
                    Manufacturer warranties cover hardware defects, factory failures, and premature component failure
                    under normal use. We will provide you with all warranty documentation for installed products at
                    the time of service completion.
                  </p>
                </div>

                <!-- What is covered / not covered -->
                <div style="border:1px solid #dde3ea;border-radius:4px;padding:20px 24px;margin-bottom:14px;">
                  <p style="margin:0 0 12px;font-size:14px;font-weight:700;color:#0c2d3a;">&#9989; What Is Covered</p>
                  <ul style="margin:0 0 16px;padding-left:18px;font-size:13px;color:#555;line-height:2;">
                    <li>Faulty wiring or connections made during our installation</li>
                    <li>Incorrect configuration of equipment we set up</li>
                    <li>Components or hardware that fail due to a manufacturer defect</li>
                    <li>System performance issues directly related to our workmanship</li>
                  </ul>
                  <p style="margin:0 0 12px;font-size:14px;font-weight:700;color:#0c2d3a;">&#10060; What Is Not Covered</p>
                  <ul style="margin:0;padding-left:18px;font-size:13px;color:#555;line-height:2;">
                    <li>Damage caused by misuse, power surges, or acts of nature</li>
                    <li>Modifications made to the system by a third party after our installation</li>
                    <li>Normal wear and tear of equipment over time</li>
                    <li>Internet or ISP-related issues affecting connected systems</li>
                    <li>Equipment or products purchased and supplied by the client</li>
                  </ul>
                </div>

                <!-- How to claim -->
                <div style="background:#0c2d3a;border-radius:4px;padding:20px 24px;margin-bottom:32px;">
                  <p style="margin:0 0 6px;font-size:14px;font-weight:700;color:#ffffff;">&#128222; How to Make a Warranty Claim</p>
                  <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.7);line-height:1.75;">
                    Simply contact us within the warranty period by phone or email, describe the issue,
                    and reference your original service date. We will schedule a follow-up visit at no cost
                    if the issue falls within warranty coverage.
                  </p>
                </div>

                <!-- DIVIDER -->
                <hr style="border:none;border-top:1px solid #e8ecf0;margin:0 0 28px;">

                <!-- CONTACT -->
                <p style="margin:0 0 14px;font-size:13px;color:#888;font-weight:600;text-transform:uppercase;letter-spacing:0.1em;">Have questions? Reach us directly</p>
                <table style="border-collapse:collapse;font-size:14px;color:#555;line-height:2;">
                  <tr><td style="padding-right:10px;color:#82A0CC;">&#128222;</td><td><a href="tel:+19319335040" style="color:#0c2d3a;text-decoration:none;">+1 (931) 933-5040</a> &nbsp;<span style="color:#aaa;font-size:12px;">Office</span></td></tr>
                  <tr><td style="padding-right:10px;color:#82A0CC;">&#128241;</td><td><a href="tel:+16159620401" style="color:#0c2d3a;text-decoration:none;">+1 (615) 962-0401</a> &nbsp;<span style="color:#aaa;font-size:12px;">Phone / Text</span></td></tr>
                  <tr><td style="padding-right:10px;color:#82A0CC;">&#9993;</td><td><a href="mailto:support@raveloavtech.com" style="color:#0c2d3a;text-decoration:none;">support@raveloavtech.com</a></td></tr>
                </table>

              </div>

              <!-- FOOTER -->
              <div style="background:#0c2d3a;padding:24px 44px;border-radius:0 0 4px 4px;">
                <p style="margin:0 0 6px;font-size:12px;color:rgba(255,255,255,0.85);font-weight:600;">Ravelo AV Technologies LLC</p>
                <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.4);line-height:1.6;">
                  Licensed &amp; Insured &nbsp;·&nbsp; Nashville Metro Area, TN &nbsp;·&nbsp;
                  <a href="https://raveloavtech.com" style="color:#82A0CC;text-decoration:none;">raveloavtech.com</a>
                </p>
                <p style="margin:16px 0 0;font-size:11px;color:rgba(255,255,255,0.25);line-height:1.6;">
                  You received this email because you submitted a quote request at raveloavtech.com.
                  This is an automated confirmation — no reply is needed, but you can respond to this email and we'll get back to you.
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
