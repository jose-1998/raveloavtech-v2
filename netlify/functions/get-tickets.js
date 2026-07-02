// Emails allowed to read tickets (must match Netlify Identity accounts)
const ALLOWED_EMAILS = ['support@raveloavtech.com', 'jose.rojas@raveloavtech.com'];

exports.handler = async function (event, context) {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' },
      body: '',
    };
  }

  // Only allow authenticated admins (validated Netlify Identity JWT)
  const user = context.clientContext && context.clientContext.user;
  if (!user || ALLOWED_EMAILS.indexOf(user.email) === -1) {
    return { statusCode: 401, headers: { 'Access-Control-Allow-Origin': '*' }, body: 'Unauthorized' };
  }

  const API_TOKEN = process.env.NETLIFY_API_TOKEN;
  const SITE_ID   = process.env.NETLIFY_SITE_ID;

  if (!API_TOKEN || !SITE_ID) {
    return {
      statusCode: 503,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'NETLIFY_API_TOKEN or NETLIFY_SITE_ID not configured' }),
    };
  }

  try {
    // Find the quote-request form
    const formsRes = await fetch(`https://api.netlify.com/api/v1/sites/${SITE_ID}/forms`, {
      headers: { Authorization: `Bearer ${API_TOKEN}` },
    });
    if (!formsRes.ok) throw new Error('Failed to fetch forms: ' + formsRes.status);
    const forms = await formsRes.json();
    const form  = forms.find(f => f.name === 'quote-request');

    if (!form) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify([]),
      };
    }

    // Get submissions (newest first, up to 100)
    const subRes = await fetch(
      `https://api.netlify.com/api/v1/forms/${form.id}/submissions?per_page=100&page=1`,
      { headers: { Authorization: `Bearer ${API_TOKEN}` } }
    );
    if (!subRes.ok) throw new Error('Failed to fetch submissions: ' + subRes.status);
    const submissions = await subRes.json();

    // Return only the fields we need
    const tickets = submissions.map(s => ({
      id:         s.id,
      created_at: s.created_at,
      name:       ((s.data.first_name || '') + ' ' + (s.data.last_name || '')).trim(),
      email:      s.data.email      || '',
      phone:      s.data.phone      || '',
      address:    s.data.address    || '',
      service:    s.data.service    || '',
      message:    s.data.message    || '',
    }));

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify(tickets),
    };
  } catch (err) {
    console.error('get-tickets error:', err.message);
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: err.message }),
    };
  }
};
