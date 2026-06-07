// qb-auth.js
// Step 1 of OAuth2 — redirects to QuickBooks login page.
// Usage: visit https://raveloavtech.com/.netlify/functions/qb-auth
// QB will ask you to sign in and authorize the app, then redirect to qb-callback.

const SCOPES = 'com.intuit.quickbooks.accounting';

exports.handler = async function () {
  const CLIENT_ID = process.env.QUICKBOOKS_CLIENT_ID;
  const IS_SANDBOX = process.env.QUICKBOOKS_ENV !== 'production';
  const SITE_URL   = process.env.URL || 'https://raveloavtech.com';

  const redirectUri = `${SITE_URL}/.netlify/functions/qb-callback`;

  // Random state to prevent CSRF
  const state = Math.random().toString(36).substring(2);

  const baseUrl = IS_SANDBOX
    ? 'https://appcenter.intuit.com/connect/oauth2'
    : 'https://appcenter.intuit.com/connect/oauth2';

  const params = new URLSearchParams({
    client_id:     CLIENT_ID,
    response_type: 'code',
    scope:         SCOPES,
    redirect_uri:  redirectUri,
    state,
  });

  return {
    statusCode: 302,
    headers: { Location: `${baseUrl}?${params.toString()}` },
    body: '',
  };
};
