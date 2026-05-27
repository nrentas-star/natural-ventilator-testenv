import { verifyPortalJwt } from './tokens.js';
import { getUserRole } from '../db.js';
import { cfg } from '../config.js';

/**
 * requireAuth — reads mcp_portal cookie, validates JWT, fetches user role.
 * Attaches req.user = { email, role, first_name, ventilator_beta, can_deploy }
 * On failure: redirects to /auth/login with ?next= param.
 */
export function requireAuth(req, res, next) {
  const token = req.cookies?.[cfg.COOKIE_NAME];
  if (!token) return redirectToLogin(req, res);

  const payload = verifyPortalJwt(token);
  if (!payload?.email) return redirectToLogin(req, res);

  getUserRole(payload.email)
    .then(user => {
      if (!user) return redirectToLogin(req, res);
      req.user = user;
      next();
    })
    .catch(err => {
      console.error('[auth] DB error:', err.message);
      res.status(500).send('Authentication service unavailable. Please try again.');
    });
}

/**
 * requireVentilatorBeta — extends requireAuth, also checks ventilator_beta flag.
 * Must be used AFTER requireAuth in the middleware chain.
 */
export function requireVentilatorBeta(req, res, next) {
  if (!req.user?.ventilator_beta) {
    return res.status(403).send(`
      <!doctype html><html><head><title>Access Restricted</title>
      <style>body{font-family:system-ui;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f0f4f8}
      .box{text-align:center;max-width:400px;padding:48px 32px}
      h1{font-size:20px;color:#0d1f3c;margin:0 0 12px}p{color:#6c757d;margin:0 0 24px}
      a{display:inline-block;padding:10px 24px;background:#0d1f3c;color:#fff;border-radius:6px;text-decoration:none;font-size:14px}</style></head>
      <body><div class="box">
        <h1>Beta Access Required</h1>
        <p>The Natural Ventilator Selector is available to beta testers only. Contact Nestor to request access.</p>
        <a href="/">Back to Tools</a>
      </div></body></html>
    `);
  }
  next();
}

/**
 * requireCanDeploy — gate for deploy endpoints. Use AFTER requireAuth.
 * Returns JSON 403 (these are API endpoints called via fetch).
 */
export function requireCanDeploy(req, res, next) {
  if (!req.user?.can_deploy) {
    return res.status(403).json({ ok: false, error: 'Deploy permission required' });
  }
  next();
}

// Connect is the single front door / login. Unauthenticated requests go to the
// connect portal (not a tools-local login), so everyone signs in once at connect
// and reaches tools via the portal. SSO (shared mcp_portal cookie) means a user
// already signed in at connect arrives here authenticated.
function redirectToLogin(_req, res) {
  res.redirect(302, 'https://connect.moffittcorp.com/');
}
