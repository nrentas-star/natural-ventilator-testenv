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
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Montserrat','Helvetica Neue',Helvetica,Arial,sans-serif; font-weight: 300;
         background: #fff; color: #003055; min-height: 100vh; display: flex; align-items: center;
         justify-content: center; padding: 32px; font-size: 16px; line-height: 24px;
         -webkit-font-smoothing: antialiased; }
  .card { background: #fff; border: 1px solid #e2e4e6; border-top: 4px solid #57cef6;
          border-radius: 5px; padding: 40px 36px; width: 100%; max-width: 420px;
          box-shadow: 0 4px 12px rgba(0,48,85,.08); }
  .brand { display: flex; align-items: center; justify-content: center; margin-bottom: 22px; }
  .brand img { height: 52px; width: auto; display: block; }
  h1 { font-family: 'Montserrat',sans-serif; font-size: 21px; font-weight: 400; color: #003055;
       text-transform: uppercase; letter-spacing: .04em; margin-bottom: 6px; text-align: center; }
  .subtitle { font-size: 13px; color: #737373; margin-bottom: 26px; text-align: center;
              font-weight: 400; line-height: 1.5; }
  label { display: block; font-size: 11px; font-weight: 600; color: #003055; margin-bottom: 8px;
          letter-spacing: .08em; text-transform: uppercase; }
  input { width: 100%; padding: 13px 16px; border: 1px solid #e2e4e6; border-radius: 5px;
          font-size: 15px; font-family: inherit; outline: none; transition: border-color .15s;
          color: #003055; font-weight: 400; background: #fff; }
  input:focus { border-color: #003055; }
  input.code { letter-spacing: 8px; font-size: 22px; text-align: center;
               font-family: ui-monospace,SFMono-Regular,Menlo,monospace; font-weight: 600; }
  .btn { display: block; width: 100%; padding: 13px; margin-top: 20px; background: #003055;
         color: #fff; border: none; border-radius: 5px; font-size: 13px; font-weight: 600;
         font-family: inherit; cursor: pointer; transition: background .15s;
         letter-spacing: .06em; text-transform: uppercase; }
  .btn:hover { background: #0f3168; }
  .error { background: #fde8e8; border: 1px solid #f5b3b3; color: #e80000; padding: 10px 14px;
           border-radius: 5px; font-size: 13px; margin-bottom: 18px; font-weight: 400; }
  .back-link { display: block; text-align: center; margin-top: 18px; font-size: 11px;
               color: #737373; text-decoration: none; letter-spacing: .06em;
               text-transform: uppercase; font-weight: 500; }
  .back-link:hover { color: #003055; text-decoration: underline; }
</style></head><body><div class="card">
<div class="brand"><img src="https://connect.moffittcorp.com/static/logo" alt="Moffitt"></div>
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
