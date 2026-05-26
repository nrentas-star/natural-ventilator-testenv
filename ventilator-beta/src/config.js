// Single source of truth for all environment config.
// process.env is read once at startup; missing required vars throw immediately.

function require_env(key) {
  const val = process.env[key];
  if (!val) throw new Error();
  return val;
}

function optional_env(key, def = '') {
  return process.env[key] ?? def;
}

export const cfg = {
  PORT:             parseInt(optional_env('PORT', '3200'), 10),
  NODE_ENV:         optional_env('NODE_ENV', 'production'),

  JWT_SECRET:       require_env('JWT_SECRET'),
  COOKIE_NAME:      optional_env('COOKIE_NAME', 'mcp_portal'),
  COOKIE_DOMAIN:    optional_env('COOKIE_DOMAIN', '.moffittcorp.com'),

  DB_HOST:          optional_env('DB_HOST', '127.0.0.1'),
  DB_PORT:          parseInt(optional_env('DB_PORT', '3306'), 10),
  DB_USER:          require_env('DB_USER'),
  DB_PASSWORD:      require_env('DB_PASSWORD'),
  DB_NAME:          require_env('DB_NAME'),

  EE_API_KEY:       require_env('EE_API_KEY'),
  EE_FROM:          optional_env('EE_FROM', 'noreply@moffittcorp.com'),

  FEEDBACK_NOTIFY:  optional_env('FEEDBACK_NOTIFY', 'nrentas@moffittcorp.com')
                      .split(',').map(e => e.trim()).filter(Boolean),

  OTP_TTL:          parseInt(optional_env('OTP_TTL', '300'), 10),
  OTP_MAX_ATTEMPTS: parseInt(optional_env('OTP_MAX_ATTEMPTS', '5'), 10),
};
