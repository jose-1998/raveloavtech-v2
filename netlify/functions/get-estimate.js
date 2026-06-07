// get-estimate.js — Phase 2: pulls real data from QuickBooks API

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// Use sandbox endpoint unless QUICKBOOKS_ENV=production
const IS_PRODUCTION = process.env.QUICKBOOKS_ENV === 'production';
const QB_BASE = IS_PRODUCTION
  ? 'https://quickbooks.api.intuit.com/v3/company'
  : 'https://sandbox-quickbooks.api.intuit.com/v3/company';
const TOKEN_URL = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';

exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS, body: '' };
  }

  const params = event.queryStringParameters || {};
  const id   = params.id;   // DocNumber — used by estimate.html client link
  const qbid = params.qbid; // QB internal ID — used by send-estimate webhook

  if (!id && !qbid) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Missing estimate id' }) };
  }

  try {
    const estimate = qbid
      ? await getQBEstimateByInternalId(qbid)
      : await getQBEstimate(id);

    if (!estimate) {
      return { statusCode: 404, headers: CORS, body: JSON.stringify({ error: 'Estimate not found' }) };
    }
    return {
      statusCode: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify(estimate),
    };
  } catch (err) {
    console.error('get-estimate error:', err.message);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};

// ── QB API: fetch estimate with auto token refresh ────────────────────────────
async function getQBEstimate(docNumber) {
  let token = process.env.QUICKBOOKS_ACCESS_TOKEN;
  const realmId = process.env.QUICKBOOKS_REALM_ID;

  // Query by DocNumber (the number shown in QB, e.g. 1169)
  let res = await qbQuery(token, realmId, docNumber);
  if (res.status === 401) {
    console.log('Access token expired — refreshing...');
    token = await refreshAccessToken();
    res = await qbQuery(token, realmId, docNumber);
  }

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`QB API ${res.status}: ${body}`);
  }

  const data = await res.json();
  const e = data.QueryResponse?.Estimate?.[0];
  if (!e) throw new Error(`Estimate #${docNumber} not found in QB`);

  // Get customer details for email/phone
  const customer = await getQBCustomer(token, realmId, e.CustomerRef.value);

  return normalizeEstimate(e, customer);
}

// ── QB API: fetch estimate by QB internal ID (used by webhook) ────────────────
async function getQBEstimateByInternalId(qbId) {
  let token = process.env.QUICKBOOKS_ACCESS_TOKEN;
  const realmId = process.env.QUICKBOOKS_REALM_ID;

  let res = await fetch(`${QB_BASE}/${realmId}/estimate/${qbId}?minorversion=65`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  if (res.status === 401) {
    token = await refreshAccessToken();
    res = await fetch(`${QB_BASE}/${realmId}/estimate/${qbId}?minorversion=65`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
  }
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`QB API ${res.status}: ${body}`);
  }
  const data = await res.json();
  const e = data.Estimate;
  if (!e) throw new Error(`Estimate QB ID ${qbId} not found`);

  const customer = await getQBCustomer(token, realmId, e.CustomerRef.value);
  return normalizeEstimate(e, customer);
}

function qbQuery(token, realmId, docNumber) {
  const query = encodeURIComponent(`SELECT * FROM Estimate WHERE DocNumber = '${docNumber}'`);
  return fetch(`${QB_BASE}/${realmId}/query?query=${query}&minorversion=65`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
}

// ── Refresh token and save new tokens to Netlify env vars ─────────────────────
async function refreshAccessToken() {
  const { QUICKBOOKS_CLIENT_ID, QUICKBOOKS_CLIENT_SECRET, QUICKBOOKS_REFRESH_TOKEN } = process.env;
  const credentials = Buffer.from(`${QUICKBOOKS_CLIENT_ID}:${QUICKBOOKS_CLIENT_SECRET}`).toString('base64');

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: QUICKBOOKS_REFRESH_TOKEN }).toString(),
  });

  if (!res.ok) throw new Error(`Token refresh failed: ${await res.text()}`);
  const tokens = await res.json();

  // Save new tokens to Netlify so they persist for next invocation
  await saveNetlifyEnvVars({
    QUICKBOOKS_ACCESS_TOKEN: tokens.access_token,
    QUICKBOOKS_REFRESH_TOKEN: tokens.refresh_token,
  });

  return tokens.access_token;
}

// ── Save env vars via Netlify API ─────────────────────────────────────────────
async function saveNetlifyEnvVars(vars) {
  const NETLIFY_TOKEN = process.env.NETLIFY_TOKEN;
  const siteId = process.env.SITE_ID; // Netlify injects this automatically

  if (!NETLIFY_TOKEN || !siteId) {
    console.warn('NETLIFY_TOKEN or SITE_ID not available — skipping token save');
    return;
  }

  for (const [key, value] of Object.entries(vars)) {
    const res = await fetch(`https://api.netlify.com/api/v1/sites/${siteId}/env/${key}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${NETLIFY_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ context: 'all', value }),
    });
    if (!res.ok) console.warn(`Failed to save ${key}:`, await res.text());
    else console.log(`Saved ${key} to Netlify`);
  }
}

// ── Fetch QB customer details ─────────────────────────────────────────────────
async function getQBCustomer(token, realmId, customerId) {
  try {
    const res = await fetch(`${QB_BASE}/${realmId}/customer/${customerId}?minorversion=65`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.Customer || null;
  } catch {
    return null;
  }
}

// ── Normalize QB Estimate → our format ───────────────────────────────────────
function normalizeEstimate(e, customer) {
  const fmt = d => {
    if (!d) return '';
    const [y, m, day] = d.split('-');
    const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    return `${months[parseInt(m,10)-1]} ${parseInt(day,10)}, ${y}`;
  };

  // Build address from BillAddr
  const addr = e.BillAddr || {};
  const addrParts = [addr.Line1, addr.Line2, addr.Line3].filter(Boolean);
  const cityLine = [addr.City, addr.CountrySubDivisionCode, addr.PostalCode].filter(Boolean).join(', ');
  if (cityLine) addrParts.push(cityLine);

  // Line items (skip SubTotal and DiscountLine types)
  const lines = (e.Line || [])
    .filter(l => l.DetailType === 'SalesItemLineDetail')
    .map(l => {
      const detail = l.SalesItemLineDetail || {};
      return {
        name: detail.ItemRef?.name || l.Description || 'Service',
        description: l.Description || '',
        qty: detail.Qty || 1,
        unitPrice: detail.UnitPrice || 0,
        total: l.Amount || 0,
      };
    });

  // Discount line
  const discountLine = (e.Line || []).find(l => l.DetailType === 'DiscountLineDetail');
  const discount = discountLine ? {
    label: 'Discount',
    amount: Math.abs(discountLine.Amount || 0),
  } : null;

  // SubTotal
  const subTotalLine = (e.Line || []).find(l => l.DetailType === 'SubTotalLineDetail');
  const subtotal = subTotalLine?.Amount || lines.reduce((s, l) => s + l.total, 0);

  const tax = e.TxnTax?.TotalTax || 0;
  const taxRate = 9.75; // TN rate — QB doesn't always return the rate
  const total = e.TotalAmt || 0;

  // Customer contact info
  const phone = customer?.PrimaryPhone?.FreeFormNumber || customer?.Mobile?.FreeFormNumber || '';
  // BillEmail is what QB actually uses when the boss hits "Send" — prefer it over the customer record
  const email = e.BillEmail?.Address || customer?.PrimaryEmailAddr?.Address || '';

  return {
    id: e.Id,
    docNumber: e.DocNumber,
    date: fmt(e.TxnDate),
    validUntil: fmt(e.ExpirationDate),
    status: e.TxnStatus || 'Pending',
    client: {
      name: e.CustomerRef?.name || '',
      address: addrParts.join('\n'),
      phone,
      email,
    },
    project: {
      name: e.CustomerMemo?.value || e.CustomerRef?.name || 'Project',
      description: e.ShipAddr?.Line1 || '',
    },
    lines,
    subtotal,
    tax,
    taxRate,
    discount,
    total,
    notes: 'Thank you for choosing Ravelo AV Technologies LLC. This estimate is valid for 30 days. A 50% deposit is required to schedule installation.',
  };
}
