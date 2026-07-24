// get-opens.js
// Returns estimate open status from Netlify Blobs.
// Called by admin/estimates.html to show "👀 Opened" badges.
// Protected by Netlify Identity JWT.

const { getStore } = require('@netlify/blobs');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const { adminUser } = require('./lib/estimate-link');

exports.handler = async function (event, context) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };

  // Validated Identity JWT + email allow-list.
  if (!adminUser(context)) {
    return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  const ids = (event.queryStringParameters?.ids || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  if (!ids.length) {
    return { statusCode: 200, headers: { ...CORS, 'Content-Type': 'application/json' }, body: '{}' };
  }

  const store = getStore({ name: 'estimate-opens', consistency: 'strong' });
  const results = {};

  await Promise.all(ids.map(async id => {
    try {
      const data = await store.get(`estimate-${id}`, { type: 'json' });
      if (data) results[id] = data;
    } catch { /* not opened yet */ }
  }));

  return {
    statusCode: 200,
    headers: { ...CORS, 'Content-Type': 'application/json' },
    body: JSON.stringify(results),
  };
};

async function validateNetlifyJWT(authHeader, siteUrl) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return false;
  try {
    const res = await fetch(`${siteUrl}/.netlify/identity/user`, {
      headers: { Authorization: authHeader },
    });
    return res.ok;
  } catch {
    return false;
  }
}
