// get-walkthroughs.js
// Returns saved site walkthrough records from Netlify Blobs.
// Protected by Netlify Identity JWT.

const { getStore } = require('@netlify/blobs');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const SITE_URL = process.env.URL || 'https://raveloavtech.com';

exports.handler = async function (event, context) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };
  if (event.httpMethod !== 'GET')  return { statusCode: 405, headers: CORS, body: 'Method not allowed' };

  const authHeader = event.headers['authorization'] || event.headers['Authorization'] || '';
  const authed = await validateJWT(authHeader, SITE_URL);
  if (!authed) {
    return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  try {
    const store = getStore({ name: 'walkthroughs', consistency: 'strong' });
    const { blobs } = await store.list();

    const records = await Promise.all(
      blobs.map(async function (b) {
        try {
          const data = await store.get(b.key, { type: 'json' });
          return { key: b.key, ...data };
        } catch {
          return { key: b.key };
        }
      })
    );

    // Newest first (keys are walkthrough-{timestamp})
    records.sort(function (a, b) { return b.key.localeCompare(a.key); });

    return {
      statusCode: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify(records),
    };
  } catch (err) {
    console.error('get-walkthroughs error:', err.message);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};

async function validateJWT(authHeader, siteUrl) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return false;
  try {
    const res = await fetch(`${siteUrl}/.netlify/identity/user`, { headers: { Authorization: authHeader } });
    return res.ok;
  } catch { return false; }
}
