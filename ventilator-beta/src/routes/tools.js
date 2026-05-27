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
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Inter',system-ui,sans-serif;background:#f0f4f8;color:#0d1f3c;min-height:100vh;display:flex;flex-direction:column}
.header{background:#0d1f3c;height:64px;display:flex;align-items:center;padding:0 28px;gap:16px;flex-shrink:0}
.header__logo{display:flex;align-items:center;gap:12px;text-decoration:none}
.header__logo-pill{background:#fff;border-radius:6px;padding:4px 10px;font-weight:700;font-size:13px;color:#0d1f3c;letter-spacing:.5px}
.header__section{font-size:11px;font-weight:600;letter-spacing:2px;color:rgba(255,255,255,.45);text-transform:uppercase}
.header__back{font-size:12px;font-weight:500;color:rgba(255,255,255,.6);text-decoration:none;display:inline-flex;align-items:center;gap:5px}
.header__back:hover{color:#fff}
.header__sep{color:rgba(255,255,255,.2);margin:0 4px}
.header__spacer{flex:1}
.header__user{display:flex;align-items:center;gap:10px}
.header__role{font-size:11px;font-weight:600;letter-spacing:1px;color:rgba(255,255,255,.5);text-transform:uppercase}
.header__name{font-size:14px;font-weight:500;color:#fff}
.header__avatar{width:32px;height:32px;border-radius:50%;background:#e07c24;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:#fff}
.main{flex:1;padding:40px 28px 32px;max-width:1100px;width:100%;margin:0 auto}
.page-hero{margin-bottom:36px}
.page-hero__eyebrow{font-size:11px;font-weight:700;letter-spacing:2px;color:#6c757d;text-transform:uppercase;margin-bottom:8px}
.page-hero__accent{display:inline-block;width:32px;height:3px;background:#e07c24;border-radius:2px;margin-bottom:12px}
.page-hero h1{font-size:28px;font-weight:700;color:#0d1f3c}
.tool-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:20px}
.tool-card{background:#fff;border-radius:10px;overflow:hidden;text-decoration:none;color:inherit;box-shadow:0 1px 3px rgba(0,0,0,.07);transition:box-shadow .15s,transform .15s;display:flex;flex-direction:column}
.tool-card:hover{box-shadow:0 4px 16px rgba(0,0,0,.12);transform:translateY(-2px)}
.tool-card__accent{height:4px}
.tool-card__body{padding:24px;display:flex;align-items:flex-start;gap:16px;flex:1}
.tool-card__icon{flex-shrink:0;width:48px;height:48px;border-radius:10px;background:#fff8f0;display:flex;align-items:center;justify-content:center}
.tool-card__info{flex:1}
.tool-card__name{font-size:15px;font-weight:700;color:#0d1f3c;margin-bottom:6px}
.tool-card__desc{font-size:13px;color:#6c757d;line-height:1.5}
.tool-card__footer{padding:14px 24px;border-top:1px solid #f0f4f8;display:flex;justify-content:flex-end}
.tool-card__open{font-size:13px;font-weight:600;color:#0d1f3c;display:flex;align-items:center;gap:6px}
.badge{display:inline-flex;align-items:center;padding:3px 8px;border-radius:4px;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;flex-shrink:0}
.badge--amber{background:#fff8f0;color:#e07c24;border:1px solid #e07c24}
.empty-state{text-align:center;padding:80px 32px;color:#6c757d}
.empty-state svg{margin:0 auto 16px;display:block}
.empty-state p{font-size:15px;margin-bottom:6px}
.empty-state__sub{font-size:13px}
.empty-state__sub a{color:#2563eb}
.footer{background:#0d1f3c;height:48px;display:flex;align-items:center;padding:0 28px;flex-shrink:0}
.footer__text{font-size:12px;color:rgba(255,255,255,.35)}
.footer__spacer{flex:1}
.footer__logout{background:none;border:none;cursor:pointer;font-size:12px;color:rgba(255,255,255,.35);font-family:inherit;padding:0}
.footer__logout:hover{color:rgba(255,255,255,.65)}
</style>
</head>
<body>
<header class="header">
  <a href="https://connect.moffittcorp.com/" class="header__logo"><span class="header__logo-pill">MOFFITT</span></a>
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
