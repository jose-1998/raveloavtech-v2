// get-estimate.js
// Phase 1: returns mock estimate data by ID.
// Phase 2: swap getMockEstimate() for getQBEstimate() once QB OAuth is connected.

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
};

exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS, body: '' };
  }

  const id = (event.queryStringParameters || {}).id;
  if (!id) {
    return {
      statusCode: 400,
      headers: CORS,
      body: JSON.stringify({ error: 'Missing estimate id' }),
    };
  }

  try {
    // ── Phase 2: replace this line with → const estimate = await getQBEstimate(id);
    const estimate = getMockEstimate(id);

    if (!estimate) {
      return {
        statusCode: 404,
        headers: CORS,
        body: JSON.stringify({ error: 'Estimate not found' }),
      };
    }

    return {
      statusCode: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify(estimate),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ error: err.message }),
    };
  }
};

// ── MOCK DATA — matches the QB Estimate object shape exactly ──────────────────
// When QB is connected, getQBEstimate() returns data in this same structure.
function getMockEstimate(id) {
  const estimates = {
    '1042': {
      id: '1042',
      docNumber: '1042',
      date: 'June 6, 2026',
      validUntil: 'July 6, 2026',
      status: 'Pending Approval',
      client: {
        name: 'John Smith',
        address: '123 Oak Street\nMurfreesboro, TN 37129',
        phone: '(615) 555-0192',
        email: 'john.smith@email.com',
      },
      project: {
        name: 'Home Theater Installation',
        description: 'Living Room + Master Bedroom',
      },
      lines: [
        {
          name: '75" 4K Smart TV — Samsung QN75',
          description: 'Supply and installation, wall mount included',
          qty: 1,
          unitPrice: 1299.00,
          total: 1299.00,
        },
        {
          name: 'Surround Sound System — Sonos',
          description: '5.1 channel, Arc soundbar + Sub + 2 rear speakers',
          qty: 1,
          unitPrice: 1850.00,
          total: 1850.00,
        },
        {
          name: 'HDMI & Speaker Wiring',
          description: 'In-wall cable management, up to 50ft run',
          qty: 1,
          unitPrice: 350.00,
          total: 350.00,
        },
        {
          name: 'Apple TV 4K (3rd gen)',
          description: 'Supply, programming and setup',
          qty: 1,
          unitPrice: 179.00,
          total: 179.00,
        },
        {
          name: 'Labor — Installation',
          description: 'Professional installation, estimated 6 hours',
          qty: 6,
          unitPrice: 95.00,
          total: 570.00,
        },
      ],
      subtotal: 4248.00,
      tax: 414.18,
      taxRate: 9.75,
      discount: { label: 'Veteran Discount (10%)', amount: 424.80 },
      total: 4237.38,
      notes: 'Thank you for choosing Ravelo AV Technologies LLC. This estimate is valid for 30 days. A 50% deposit is required to schedule installation.',
    },
  };

  return estimates[String(id)] || null;
}

// ── Phase 2: QB API fetch (uncomment and fill in when ready) ──────────────────
// async function getQBEstimate(id) {
//   const { QUICKBOOKS_ACCESS_TOKEN, QUICKBOOKS_REALM_ID } = process.env;
//   const url = `https://quickbooks.api.intuit.com/v3/company/${QUICKBOOKS_REALM_ID}/estimate/${id}?minorversion=65`;
//   const res = await fetch(url, {
//     headers: {
//       Authorization: `Bearer ${QUICKBOOKS_ACCESS_TOKEN}`,
//       Accept: 'application/json',
//     },
//   });
//   if (!res.ok) throw new Error(`QB API error: ${res.status}`);
//   const { Estimate: e } = await res.json();
//   return normalizeQBEstimate(e);
// }
