import { Router } from 'express';
import { requireAuth } from '../auth/middleware.js';

const router = Router();

router.get('/', requireAuth, (req, res) => {
  const { first_name, role, ventilator_beta } = req.user;
  const roleLabel = { admin: 'Admin', employee_power: 'Power User', employee_standard: 'Employee' }[role] || role;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(toolsPage({ first_name, roleLabel, ventilator_beta }));
});

export default router;

function toolsPage({ first_name, roleLabel, ventilator_beta }) {
  const hasTools = !!ventilator_beta;
  const initials = escH((first_name || 'U').charAt(0).toUpperCase());

  const ventCard = ventilator_beta ? `
    <a href="/ventilator" class="tool-card">
      <div class="tool-card__accent" style="background:#e07c24"></div>
      <div class="tool-card__body">
        <div class="tool-card__icon">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#e07c24" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="3"/>
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
          </svg>
        </div>
        <div class="tool-card__info">
          <div class="tool-card__name">Natural Ventilator Selector</div>
          <div class="tool-card__desc">Calculate airflow, heat load, and ventilator specs for Moffitt installations.</div>
        </div>
        <span class="badge badge--amber">BETA</span>
      </div>
      <div class="tool-card__footer">
        <span class="tool-card__open">Open
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M5 12h14M12 5l7 7-7 7"/>
          </svg>
        </span>
      </div>
    </a>` : '';

  const emptyState = !hasTools ? `
    <div class="empty-state">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>
      </svg>
      <p>No tools are available for your account yet.</p>
      <p class="empty-state__sub">Contact <a href="mailto:nrentas@moffittcorp.com">Nestor Rentas</a> to request access.</p>
    </div>` : '';

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Moffitt Tools</title>
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Montserrat','Helvetica Neue',Helvetica,Arial,sans-serif;font-weight:300;background:#fff;color:#003055;min-height:100vh;display:flex;flex-direction:column;font-size:16px;line-height:24px;-webkit-font-smoothing:antialiased}
a{color:#003055;text-decoration:none}
a:hover{text-decoration:underline}
/* MASTHEAD — white, 80px, 2px SKY-BLUE underline (Tools accent) */
.header{background:#fff;height:80px;display:flex;align-items:center;padding:0 32px;gap:16px;flex-shrink:0;border-bottom:2px solid #57cef6}
.header__logo{display:flex;align-items:center;gap:14px;text-decoration:none}
.header__logo img{height:52px;width:auto;display:block}
.header__logo-pill{display:none}
.header__section{font-size:11px;font-weight:600;letter-spacing:.16em;color:#1e7fae;text-transform:uppercase;padding-left:14px;border-left:2px solid #57cef6}
.header__back{font-size:11px;font-weight:600;color:#737373;text-decoration:none;display:inline-flex;align-items:center;gap:5px;letter-spacing:.08em;text-transform:uppercase}
.header__back:hover{color:#003055;text-decoration:underline}
.header__sep{color:#cad6e3;margin:0 4px}
.header__spacer{flex:1}
.header__user{display:flex;align-items:center;gap:12px}
.header__role{font-size:10px;font-weight:600;letter-spacing:.1em;color:#737373;text-transform:uppercase}
.header__name{font-size:13px;font-weight:500;color:#003055}
.header__avatar{width:38px;height:38px;border-radius:50%;background:#003055;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:600;color:#fff}
/* MAIN + HERO (centered) */
.main{flex:1;padding:56px 32px 32px;max-width:1200px;width:100%;margin:0 auto}
.page-hero{margin-bottom:40px;text-align:center}
.page-hero__eyebrow{font-size:11px;font-weight:600;letter-spacing:.18em;color:#737373;text-transform:uppercase;margin-bottom:14px}
.page-hero__accent{display:none}
.page-hero h1{font-family:'Montserrat',sans-serif;font-size:42px;font-weight:300;color:#003055;text-transform:uppercase;letter-spacing:.02em;line-height:1.1}
/* TOOL CARDS */
.tool-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:24px}
.tool-card{background:#fff;border:1px solid #e2e4e6;border-radius:5px;overflow:hidden;text-decoration:none;color:inherit;box-shadow:0 1px 2px rgba(0,48,85,.05);transition:box-shadow .15s,transform .15s,border-color .15s;display:flex;flex-direction:column;position:relative}
.tool-card::before{content:"";position:absolute;top:0;left:0;right:0;height:4px;background:#57cef6}
.tool-card:hover{box-shadow:0 4px 12px rgba(0,48,85,.08);transform:translateY(-2px);border-color:#cad6e3;text-decoration:none}
.tool-card__accent{display:none}
.tool-card__body{padding:28px;display:flex;align-items:flex-start;gap:18px;flex:1}
.tool-card__icon{flex-shrink:0;width:52px;height:52px;border-radius:5px;background:#dfeff5;display:flex;align-items:center;justify-content:center;color:#003055}
.tool-card__info{flex:1}
.tool-card__name{font-family:'Montserrat',sans-serif;font-size:18px;font-weight:600;color:#003055;margin-bottom:8px;text-transform:uppercase;letter-spacing:.04em;line-height:1.2}
.tool-card__desc{font-size:14px;color:#003055;line-height:1.55;font-weight:300}
.tool-card__footer{padding:14px 28px;border-top:1px solid #e2e4e6;display:flex;justify-content:flex-end}
.tool-card__open{font-size:11px;font-weight:600;color:#1e7fae;display:flex;align-items:center;gap:6px;text-transform:uppercase;letter-spacing:.08em}
/* BADGES */
.badge{display:inline-flex;align-items:center;padding:3px 10px;border-radius:9999px;font-size:10px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;flex-shrink:0;border:0}
.badge--amber{background:#fff3d6;color:#8a6500;border:0}
/* EMPTY STATE */
.empty-state{text-align:center;padding:80px 32px;color:#737373}
.empty-state svg{margin:0 auto 18px;display:block;stroke:#9aa6b3}
.empty-state p{font-size:16px;margin-bottom:6px;font-weight:400;color:#003055}
.empty-state__sub{font-size:13px;font-weight:300}
.empty-state__sub a{color:#003055;font-weight:500}
/* FOOTER — navy with sky-blue top stroke */
.footer{background:#003055;color:#cfe2f3;padding:20px 32px;border-top:4px solid #57cef6;display:flex;align-items:center;flex-shrink:0;font-weight:300}
.footer__text{font-size:13px;color:#cfe2f3}
.footer__spacer{flex:1}
.footer__logout{background:none;border:none;cursor:pointer;font-size:11px;color:#cfe2f3;font-family:inherit;padding:0;letter-spacing:.06em;text-transform:uppercase;font-weight:500}
.footer__logout:hover{color:#fff;text-decoration:underline}
@media (max-width:980px){
  .header{padding:12px 20px;height:auto;flex-wrap:wrap;gap:8px}
  .header__section{display:none}
  .main{padding:32px 20px}
  .page-hero h1{font-size:30px}
  .tool-grid{grid-template-columns:1fr}
}
</style>
</head>
<body>
<header class="header">
  <a href="https://connect.moffittcorp.com/" class="header__logo"><img src="https://connect.moffittcorp.com/static/logo" alt="Moffitt"></a>
  <a href="https://connect.moffittcorp.com/" class="header__back">&#8592; Connect</a>
  <span class="header__sep">/</span>
  <span class="header__section">TOOLS</span>
  <div class="header__spacer"></div>
  <div class="header__user">
    <span class="header__role">${roleLabel}</span>
    <span class="header__name">${escH(first_name)}</span>
    <div class="header__avatar">${initials}</div>
  </div>
</header>
<main class="main">
  <div class="page-hero">
    <div class="page-hero__eyebrow">Moffitt Tools</div>
    <div class="page-hero__accent"></div>
    <h1>Your Tools</h1>
  </div>
  <div class="tool-grid">${ventCard}${emptyState}</div>
</main>
<footer class="footer">
  <span class="footer__text">&copy; 2026 Moffitt Corporation &nbsp;&middot;&nbsp; Powered by Claude</span>
  <div class="footer__spacer"></div>
  <form method="POST" action="/auth/logout" style="display:inline">
    <button class="footer__logout" type="submit">Sign out</button>
  </form>
</footer>
</body></html>`;
}

function escH(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
