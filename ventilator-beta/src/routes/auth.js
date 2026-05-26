import { Router } from 'express';
import { generateOtp, sendOtp } from '../auth/otp.js';
import { verifyOtp, storeOtp, getUserRole } from '../db.js';
import { signPortalJwt } from '../auth/tokens.js';
import { cfg } from '../config.js';

const router = Router();

// GET /auth/login — show login form
router.get('/auth/login', (req, res) => {
  const next = req.query.next || '/';
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(loginPage(next, '', ''));
});

// POST /auth/request-otp — send OTP if email is in user_roles
router.post('/auth/request-otp', async (req, res) => {
  const email = (req.body.email || '').trim().toLowerCase();
  const next  = req.body.next || '/';

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.send(loginPage(next, email, 'Enter a valid email address.'));
  }

  const user = await getUserRole(email).catch(() => null);
  if (!user) {
    // Don't reveal whether the email exists — show same "check your email" message
    return res.send(otpPage(next, email, ''));
  }

  const code = generateOtp();
  storeOtp(email, code, cfg.OTP_TTL);

  try {
    await sendOtp(email, code);
  } catch (err) {
    console.error('[otp] send error:', err.message);
    return res.send(loginPage(next, email, 'Could not send login code. Try again.'));
  }

  res.send(otpPage(next, email, ''));
});

// POST /auth/verify-otp — validate code, set cookie, redirect
router.post('/auth/verify-otp', async (req, res) => {
  const email = (req.body.email || '').trim().toLowerCase();
  const code  = (req.body.code  || '').trim();
  const next  = req.body.next || '/';

  const result = verifyOtp(email, code);
  if (!result.ok) {
    const msg = result.reason === 'expired' ? 'Code expired. Request a new one.' : 'Incorrect code. Try again.';
    return res.send(otpPage(next, email, msg));
  }

  const user = await getUserRole(email).catch(() => null);
  if (!user) {
    return res.send(otpPage(next, email, 'Account not found.'));
  }

  const token = signPortalJwt({ email: user.email, role: user.role, first_name: user.first_name });

  res.setHeader('Set-Cookie',
    `${cfg.COOKIE_NAME}=${token}; HttpOnly; Secure; SameSite=Lax; Domain=${cfg.COOKIE_DOMAIN}; Path=/; Max-Age=2592000`
  );

  const dest = /^\//.test(next) ? next : '/';
  res.redirect(302, dest);
});

// POST /auth/logout — clear cookie
router.post('/auth/logout', (req, res) => {
  res.setHeader('Set-Cookie',
    `${cfg.COOKIE_NAME}=; HttpOnly; Secure; SameSite=Lax; Domain=${cfg.COOKIE_DOMAIN}; Path=/; Max-Age=0`
  );
  res.redirect(302, '/auth/login');
});

export default router;

// ── HTML helpers ─────────────────────────────────────────────────────────────

function shell(title, body) {
  return `<!doctype html><html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} — Moffitt Connect</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Inter', system-ui, sans-serif; background: #f0f4f8; min-height: 100vh;
         display: flex; align-items: center; justify-content: center; }
  .card { background: #fff; border-radius: 10px; padding: 40px 36px; width: 100%; max-width: 420px;
          box-shadow: 0 1px 4px rgba(0,0,0,.08), 0 4px 16px rgba(0,0,0,.06); }
  .brand { font-size: 11px; font-weight: 700; letter-spacing: 1.5px; color: #6c757d;
           text-transform: uppercase; margin-bottom: 8px; }
  .brand span { color: #0d1f3c; }
  h1 { font-size: 22px; font-weight: 700; color: #0d1f3c; margin-bottom: 6px; }
  .subtitle { font-size: 14px; color: #6c757d; margin-bottom: 28px; }
  label { display: block; font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 6px; }
  input { width: 100%; padding: 10px 14px; border: 1.5px solid #d1d5db; border-radius: 6px;
          font-size: 15px; font-family: inherit; outline: none; transition: border-color .15s; }
  input:focus { border-color: #0d1f3c; }
  input.code { letter-spacing: 6px; font-size: 22px; text-align: center; font-family: monospace; }
  .btn { display: block; width: 100%; padding: 11px; margin-top: 18px; background: #0d1f3c;
         color: #fff; border: none; border-radius: 6px; font-size: 15px; font-weight: 600;
         font-family: inherit; cursor: pointer; transition: background .15s; }
  .btn:hover { background: #162d54; }
  .error { background: #fef2f2; border: 1px solid #fecaca; color: #b91c1c; padding: 10px 14px;
           border-radius: 6px; font-size: 13px; margin-bottom: 18px; }
  .back-link { display: block; text-align: center; margin-top: 16px; font-size: 13px;
               color: #6c757d; text-decoration: none; }
  .back-link:hover { color: #0d1f3c; }
</style></head><body><div class="card">
<div class="brand"><span>MOFFITT</span> CONNECT</div>
${body}
</div></body></html>`;
}

function loginPage(next, email, error) {
  return shell('Sign In', `
    <h1>Sign in</h1>
    <p class="subtitle">Enter your Moffitt email to receive a login code.</p>
    ${error ? `<div class="error">${error}</div>` : ''}
    <form method="POST" action="/auth/request-otp">
      <input type="hidden" name="next" value="${esc(next)}">
      <label for="email">Email address</label>
      <input type="email" id="email" name="email" value="${esc(email)}" placeholder="you@moffittcorp.com" required autocomplete="email">
      <button class="btn" type="submit">Send login code</button>
    </form>
  `);
}

function otpPage(next, email, error) {
  return shell('Enter Code', `
    <h1>Check your email</h1>
    <p class="subtitle">A 6-digit code was sent to <strong>${esc(email)}</strong>.</p>
    ${error ? `<div class="error">${error}</div>` : ''}
    <form method="POST" action="/auth/verify-otp">
      <input type="hidden" name="next"  value="${esc(next)}">
      <input type="hidden" name="email" value="${esc(email)}">
      <label for="code">Login code</label>
      <input class="code" type="text" id="code" name="code" placeholder="000000"
             maxlength="6" inputmode="numeric" pattern="[0-9]{6}" autocomplete="one-time-code" required>
      <button class="btn" type="submit">Sign in</button>
    </form>
    <a class="back-link" href="/auth/login">Use a different email</a>
  `);
}

function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
