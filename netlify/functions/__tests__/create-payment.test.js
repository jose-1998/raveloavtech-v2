'use strict';

const { handler } = require('../create-payment');

// ── Fixtures ──────────────────────────────────────────────────────────────────

const ESTIMATE = {
  Id: '42',
  DocNumber: '1187',
  TotalAmt: 1000,
  CustomerRef: { value: 'cust-1', name: 'John Doe' },
  BillEmail: { Address: 'john@example.com' },
};

const ITEM = { Id: 'item-1', Name: 'AV Services' };

const INVOICE = {
  Id: 'inv-1',
  DocNumber: '2001',
  InvoiceLink: 'https://payments.quickbooks.com/pay/inv-1',
};

const TOKEN = { access_token: 'new-access-token', refresh_token: 'new-refresh-token' };

// ── Helpers ───────────────────────────────────────────────────────────────────

function jsonResponse(data, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
  });
}

function mockFetch(impl) {
  return jest.spyOn(global, 'fetch').mockImplementation(impl);
}

function defaultFetch(url) {
  if (url.includes('oauth.platform.intuit.com')) return jsonResponse(TOKEN);
  if (url.includes('FROM%20Item'))              return jsonResponse({ QueryResponse: { Item: [ITEM] } });
  if (url.includes('FROM%20Estimate'))          return jsonResponse({ QueryResponse: { Estimate: [ESTIMATE] } });
  if (url.includes('/invoice'))                 return jsonResponse({ Invoice: INVOICE });
  return jsonResponse({});
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  process.env.QUICKBOOKS_ACCESS_TOKEN  = 'test-token';
  process.env.QUICKBOOKS_REALM_ID      = 'test-realm';
  process.env.QUICKBOOKS_CLIENT_ID     = 'test-client-id';
  process.env.QUICKBOOKS_CLIENT_SECRET = 'test-secret';
  process.env.QUICKBOOKS_REFRESH_TOKEN = 'test-refresh';
  process.env.QUICKBOOKS_ENV           = 'sandbox';
  delete process.env.NETLIFY_TOKEN;
  delete process.env.SITE_ID;
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('CORS preflight', () => {
  test('returns 200 with empty body for OPTIONS', async () => {
    const res = await handler({ httpMethod: 'OPTIONS', queryStringParameters: {} });
    expect(res.statusCode).toBe(200);
    expect(res.body).toBe('');
  });
});

describe('input validation', () => {
  test('returns 400 when estimate id is missing', async () => {
    const res = await handler({ httpMethod: 'GET', queryStringParameters: {} });
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error).toMatch(/missing estimate id/i);
  });
});

describe('server configuration', () => {
  test('returns 503 when QuickBooks credentials are not set', async () => {
    delete process.env.QUICKBOOKS_ACCESS_TOKEN;

    const res = await handler({ httpMethod: 'GET', queryStringParameters: { id: '1187' } });
    expect(res.statusCode).toBe(503);
    expect(JSON.parse(res.body).error).toMatch(/unavailable/i);
  });
});

describe('deposit calculation', () => {
  test('deposit is exactly 50% of the estimate total', async () => {
    mockFetch(defaultFetch);

    const res = await handler({ httpMethod: 'GET', queryStringParameters: { id: '1187' } });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.depositAmount).toBe(500);
    expect(body.total).toBe(1000);
  });

  test('deposit rounds correctly to 2 decimal places', async () => {
    const oddEstimate = { QueryResponse: { Estimate: [{ ...ESTIMATE, TotalAmt: 333.33 }] } };
    mockFetch(url => {
      if (url.includes('FROM%20Item'))     return jsonResponse({ QueryResponse: { Item: [ITEM] } });
      if (url.includes('FROM%20Estimate')) return jsonResponse(oddEstimate);
      if (url.includes('/invoice'))        return jsonResponse({ Invoice: INVOICE });
      return jsonResponse({});
    });

    const res = await handler({ httpMethod: 'GET', queryStringParameters: { id: '1187' } });
    expect(res.statusCode).toBe(200);
    // Math.round(333.33 * 0.5 * 100) / 100 = 166.67
    expect(JSON.parse(res.body).depositAmount).toBe(166.67);
  });

  test('response includes invoice ID and payment URL', async () => {
    mockFetch(defaultFetch);

    const res = await handler({ httpMethod: 'GET', queryStringParameters: { id: '1187' } });
    const body = JSON.parse(res.body);
    expect(body.invoiceId).toBe(INVOICE.Id);
    expect(body.invoiceNumber).toBe(INVOICE.DocNumber);
    expect(body.paymentUrl).toBe(INVOICE.InvoiceLink);
  });
});

describe('token refresh', () => {
  test('refreshes token on 401 and retries the QB request', async () => {
    let estimateCalls = 0;
    mockFetch(url => {
      if (url.includes('oauth.platform.intuit.com')) return jsonResponse(TOKEN);
      if (url.includes('FROM%20Estimate')) {
        estimateCalls++;
        if (estimateCalls === 1) return jsonResponse({}, 401);
        return jsonResponse({ QueryResponse: { Estimate: [ESTIMATE] } });
      }
      if (url.includes('FROM%20Item'))  return jsonResponse({ QueryResponse: { Item: [ITEM] } });
      if (url.includes('/invoice'))     return jsonResponse({ Invoice: INVOICE });
      return jsonResponse({});
    });

    const res = await handler({ httpMethod: 'GET', queryStringParameters: { id: '1187' } });
    expect(res.statusCode).toBe(200);
    expect(estimateCalls).toBe(2);
  });
});

describe('error handling', () => {
  test('returns 500 when estimate is not found in QB', async () => {
    mockFetch(() => jsonResponse({ QueryResponse: {} }));

    const res = await handler({ httpMethod: 'GET', queryStringParameters: { id: '9999' } });
    expect(res.statusCode).toBe(500);
    expect(JSON.parse(res.body).error).toMatch(/not found/i);
  });

  test('returns 500 when no active service item exists in QB catalog', async () => {
    mockFetch(url => {
      if (url.includes('FROM%20Item'))     return jsonResponse({ QueryResponse: {} });
      if (url.includes('FROM%20Estimate')) return jsonResponse({ QueryResponse: { Estimate: [ESTIMATE] } });
      return jsonResponse({});
    });

    const res = await handler({ httpMethod: 'GET', queryStringParameters: { id: '1187' } });
    expect(res.statusCode).toBe(500);
    expect(JSON.parse(res.body).error).toMatch(/service item/i);
  });

  test('returns 500 when QB does not return a payment link', async () => {
    mockFetch(url => {
      if (url.includes('FROM%20Item'))     return jsonResponse({ QueryResponse: { Item: [ITEM] } });
      if (url.includes('FROM%20Estimate')) return jsonResponse({ QueryResponse: { Estimate: [ESTIMATE] } });
      if (url.includes('/invoice'))        return jsonResponse({ Invoice: { Id: 'inv-1', DocNumber: '2001' } });
      return jsonResponse({});
    });

    const res = await handler({ httpMethod: 'GET', queryStringParameters: { id: '1187' } });
    expect(res.statusCode).toBe(500);
    expect(JSON.parse(res.body).error).toMatch(/payment/i);
  });
});
