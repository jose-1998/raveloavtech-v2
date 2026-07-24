// create-payment.js
// Creates a 50% deposit invoice in QB and returns the QB Payments link.
// Called by estimate.html when client clicks "Pay Deposit".

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type' };
const TOKEN_URL = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';
const IS_PRODUCTION = process.env.QUICKBOOKS_ENV === 'production';
const QB_BASE = IS_PRODUCTION
  ? 'https://quickbooks.api.intuit.com/v3/company'
  : 'https://sandbox-quickbooks.api.intuit.com/v3/company';

const { sanitizeDoc, verifyKey, adminUser } = require('./lib/estimate-link');

exports.handler = async function (event, context) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS, body: '' };
  }

  // This endpoint CREATES a real QuickBooks invoice — never allow a plain GET.
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const params = event.queryStringParameters || {};
  const docNumber = params.id; // Estimate DocNumber e.g. "1187"
  const key       = params.k;  // HMAC link signature

  if (!docNumber) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Missing estimate id' }) };
  }

  // Only the estimate owner (valid signed link) or a logged-in admin may
  // trigger invoice creation. Blocks anonymous/bulk invoice spam.
  if (!adminUser(context) && !verifyKey(docNumber, key)) {
    return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  // Reject anything that isn't a plain DocNumber before it reaches a QB query.
  if (!sanitizeDoc(docNumber)) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid estimate id' }) };
  }

  try {
    let token = process.env.QUICKBOOKS_ACCESS_TOKEN;
    const realmId = process.env.QUICKBOOKS_REALM_ID;

    // ── 1. Fetch the estimate ───────────────────────────────────────────────
    const query = encodeURIComponent(`SELECT * FROM Estimate WHERE DocNumber = '${docNumber}'`);
    let res = await qbGet(token, realmId, `query?query=${query}&minorversion=65`);
    if (res.status === 401) {
      token = await refreshAccessToken();
      res = await qbGet(token, realmId, `query?query=${query}&minorversion=65`);
    }
    if (!res.ok) throw new Error(`QB query failed: ${res.status}`);

    const data = await res.json();
    const estimate = data.QueryResponse?.Estimate?.[0];
    if (!estimate) throw new Error(`Estimate #${docNumber} not found`);

    const total      = estimate.TotalAmt || 0;
    const depositAmt = Math.round(total * 0.5 * 100) / 100;
    const customerId = estimate.CustomerRef?.value;

    // ── 2. Find a service item to reference in the invoice line ────────────
    // QB invoices require a valid ItemRef — grab the first active Service item
    const itemQuery = encodeURIComponent("SELECT * FROM Item WHERE Type = 'Service' AND Active = true MAXRESULTS 1");
    const itemRes = await qbGet(token, realmId, `query?query=${itemQuery}&minorversion=65`);
    const itemData = await itemRes.json();
    const serviceItem = itemData.QueryResponse?.Item?.[0];
    if (!serviceItem) throw new Error('No active Service item found in QB — add one at least in QB catalog.');
    const itemRef = { value: serviceItem.Id, name: serviceItem.Name };

    // ── 3. Create deposit invoice ───────────────────────────────────────────
    const invoiceBody = {
      CustomerRef: { value: customerId },
      Line: [{
        DetailType: 'SalesItemLineDetail',
        Amount: depositAmt,
        Description: `50% Deposit — Estimate #${docNumber}`,
        SalesItemLineDetail: { ItemRef: itemRef, Qty: 1, UnitPrice: depositAmt },
      }],
      CustomerMemo: {
        value: `50% deposit for Estimate #${docNumber}. Remaining balance due upon project completion.`,
      },
      ...(estimate.BillEmail ? { BillEmail: estimate.BillEmail } : {}),
    };

    const invRes = await fetch(`${QB_BASE}/${realmId}/invoice?minorversion=65`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(invoiceBody),
    });

    if (!invRes.ok) {
      const err = await invRes.text();
      throw new Error(`Invoice creation failed (${invRes.status}): ${err}`);
    }

    const invData = await invRes.json();
    const inv = invData.Invoice;

    // InvoiceLink is populated by QB when QB Payments is enabled
    const paymentUrl = inv.InvoiceLink;
    if (!paymentUrl) {
      throw new Error('QB Payments link not returned — verify QB Payments is fully active in Settings → Payments.');
    }

    return {
      statusCode: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        invoiceId:     inv.Id,
        invoiceNumber: inv.DocNumber,
        depositAmount: depositAmt,
        total,
        paymentUrl,
      }),
    };

  } catch (err) {
    console.error('create-payment error:', err.message);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};

// ── Helpers ────────────────────────────────────────────────────────────────────
function qbGet(token, realmId, path) {
  return fetch(`${QB_BASE}/${realmId}/${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
}

async function refreshAccessToken() {
  const { QUICKBOOKS_CLIENT_ID, QUICKBOOKS_CLIENT_SECRET, QUICKBOOKS_REFRESH_TOKEN } = process.env;
  const creds = Buffer.from(`${QUICKBOOKS_CLIENT_ID}:${QUICKBOOKS_CLIENT_SECRET}`).toString('base64');
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { Authorization: `Basic ${creds}`, 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: QUICKBOOKS_REFRESH_TOKEN }).toString(),
  });
  if (!res.ok) throw new Error(`Token refresh failed: ${await res.text()}`);
  const tokens = await res.json();
  await saveNetlifyEnvVars({ QUICKBOOKS_ACCESS_TOKEN: tokens.access_token, QUICKBOOKS_REFRESH_TOKEN: tokens.refresh_token });
  return tokens.access_token;
}

async function saveNetlifyEnvVars(vars) {
  const token  = process.env.NETLIFY_TOKEN || process.env.NETLIFY_API_TOKEN;
  const siteId = process.env.SITE_ID;
  if (!token || !siteId) return;
  for (const [key, value] of Object.entries(vars)) {
    try {
      const r = await fetch(`https://api.netlify.com/api/v1/sites/${siteId}/env/${key}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, values: [{ context: 'all', value }] }),
      });
      if (!r.ok) await fetch(`https://api.netlify.com/api/v1/sites/${siteId}/env`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify([{ key, values: [{ context: 'all', value }] }]),
      });
    } catch (e) { console.warn(`Save ${key} failed:`, e.message); }
  }
}
