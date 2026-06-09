'use strict';

function requireEnvVars(...names) {
  const missing = names.filter(n => !process.env[n]);
  if (missing.length) {
    const err = new Error(`Server configuration error: ${missing.join(', ')} not set`);
    err.isMissingEnv = true;
    throw err;
  }
}

module.exports = { requireEnvVars };
