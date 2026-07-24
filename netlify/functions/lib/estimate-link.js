// lib/estimate-link.js
// Shared security helpers for estimate access.
// NOT a Netlify function (lives in a subfolder) — imported by other functions.

const crypto = require('crypto');

// Emails allowed to use the admin (raw-id) path and admin-only endpoints.
const ALLOWED_EMAILS = ['support@raveloavtech.com', 'jose.rojas@raveloavtech.com'];

// HMAC key: dedicated secret if set, else reuse an existing stable server secret.
// Never sent to the browser.
function linkSecret() {
  return (
    process.env.ESTIMATE_LINK_SECRET ||
    process.env.QUICKBOOKS_CLIENT_SECRET ||
    process.env.RESEND_API_KEY ||
    ''
  );
}

// QB DocNumbers are short numeric/alphanumeric strings. Reject anything else
// BEFORE it ever reaches a QuickBooks query — blocks query-language injection.
function sanitizeDoc(doc) {
  if (typeof doc !== 'string') doc = String(doc == null ? '' : doc);
  return /^[A-Za-z0-9-]{1,20}$/.test(doc) ? doc : null;
}

// Signature that ties a link to a specific estimate. Unguessable without the key.
function signDoc(docNumber) {
  const secret = linkSecret();
  if (!secret) return '';
  return crypto
    .createHmac('sha256', secret)
    .update('estimate:' + docNumber)
    .digest('base64url')
    .slice(0, 24);
}

// Constant-time comparison of the provided key against the expected signature.
function verifyKey(docNumber, key) {
  if (!key) return false;
  const expected = signDoc(docNumber);
  if (!expected || expected.length !== key.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(key));
  } catch {
    return false;
  }
}

// Build the public client link for an estimate.
function buildEstimateLink(siteUrl, docNumber) {
  return `${siteUrl}/dev/estimate.html?id=${encodeURIComponent(docNumber)}&k=${signDoc(docNumber)}`;
}

// Netlify Identity attaches the decoded, verified user to context.clientContext.user
// for any request carrying a valid Identity JWT. Returns the user if allow-listed.
function adminUser(context) {
  const user = context && context.clientContext && context.clientContext.user;
  if (user && user.email && ALLOWED_EMAILS.indexOf(user.email) !== -1) return user;
  return null;
}

// Token for trusted server-to-server calls between our own functions
// (e.g. the QB webhook asking get-estimate to render an email). Derived from the
// same server secret; never exposed to the browser.
function internalToken() {
  const secret = linkSecret();
  if (!secret) return '';
  return crypto.createHmac('sha256', secret).update('internal-call').digest('base64url').slice(0, 24);
}

function verifyInternal(headers) {
  const provided = headers && (headers['x-internal-auth'] || headers['X-Internal-Auth']);
  const expected = internalToken();
  if (!provided || !expected || provided.length !== expected.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
  } catch {
    return false;
  }
}

module.exports = {
  ALLOWED_EMAILS,
  sanitizeDoc,
  signDoc,
  verifyKey,
  buildEstimateLink,
  adminUser,
  internalToken,
  verifyInternal,
};
