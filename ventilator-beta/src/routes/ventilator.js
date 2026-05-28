import { Router } from 'express';
import { requireAuth, requireVentilatorBeta } from '../auth/middleware.js';
import { cfg } from '../config.js';
import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const router = Router();
const __dir = dirname(fileURLToPath(import.meta.url));

router.get('/ventilator', requireAuth, requireVentilatorBeta, (req, res) => {
  const { first_name, role, can_deploy } = req.user;
  const roleLabel = { admin: 'Admin', employee_power: 'Power User', employee_standard: 'Employee' }[role] || role;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(ventilatorShell({ first_name, roleLabel, userEmail: req.user.email, canDeploy: !!can_deploy }));
});

router.get('/ventilator/app', requireAuth, requireVentilatorBeta, async (req, res) => {
  try {
    const appPath = join(__dir, '../../public/v213.html');
    const html = await readFile(appPath, 'utf8');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.send(html);
  } catch {
    res.status(503).send('Calculator not yet deployed. Contact Nestor.');
  }
});

const EE_SEND_URL = 'https://api.elasticemail.com/v4/emails/transactional';

// Email the signed-in user their calculator results (identity from JWT, not client input).
router.post('/ventilator/email-results', requireAuth, requireVentilatorBeta, async (req, res) => {
  const to = req.user.email;
  const clip = (arr) => (Array.isArray(arr) ? arr : []).slice(0, 40)
    .map(x => ({ label: String(x && x.label != null ? x.label : '').slice(0, 120),
                 value: String(x && x.value != null ? x.value : '').slice(0, 120) }))
    .filter(x => x.label && x.value);
  const results = clip(req.body && req.body.results);
  const inputs = clip(req.body && req.body.inputs);
  if (!results.length) return res.status(400).json({ ok: false, error: 'No results to send' });

  const esc = (str) => String(str == null ? '' : str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const rows = (arr) => arr.map(x =>
    `<tr><td style="padding:6px 10px;color:#6c757d;border-bottom:1px solid #eef2f7">${esc(x.label)}</td>`
    + `<td style="padding:6px 10px;font-weight:600;border-bottom:1px solid #eef2f7">${esc(x.value)}</td></tr>`).join('');
  const when = new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
  const html = [
    '<div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#0d1f3c">',
    '<h2 style="margin:0 0 4px">Natural Ventilator Selector &mdash; Results</h2>',
    `<div style="font-size:12px;color:#9aa4b2;margin-bottom:16px">Generated ${when}</div>`,
    '<h3 style="margin:14px 0 6px;font-size:15px">Results</h3>',
    `<table style="border-collapse:collapse;width:100%;font-size:14px;background:#f8fafc;border-radius:8px;overflow:hidden">${rows(results)}</table>`,
    inputs.length ? `<h3 style="margin:18px 0 6px;font-size:15px">Inputs</h3><table style="border-collapse:collapse;width:100%;font-size:14px">${rows(inputs)}</table>` : '',
    '<p style="margin:18px 0 0;font-size:12px;color:#6c757d">Sent from the Moffitt Natural Ventilator Selector (beta). Values are estimates for design guidance.</p>',
    '</div>',
  ].join('');

  try {
    const body = {
      Recipients: { To: [to] },
      Content: { From: cfg.EE_FROM, ReplyTo: cfg.EE_FROM, Subject: 'Your Natural Ventilator Selector results',
        Body: [{ ContentType: 'HTML', Content: html }] },
    };
    const r = await fetch(EE_SEND_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-ElasticEmail-ApiKey': cfg.EE_API_KEY },
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error('EE ' + r.status);
    res.json({ ok: true, to });
  } catch (e) {
    console.error('[ventilator] email-results error:', e.message);
    res.status(502).json({ ok: false, error: 'Email service unavailable' });
  }
});

export default router;

function ventilatorShell({ first_name, roleLabel, userEmail, canDeploy }) {
  const initials = escH((first_name || 'U').charAt(0).toUpperCase());
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Natural Ventilator Selector — Moffitt Tools</title>
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Montserrat','Helvetica Neue',Helvetica,Arial,sans-serif;font-weight:300;background:#fff;color:#003055;height:100vh;display:flex;flex-direction:column;overflow:hidden;font-size:16px;line-height:24px;-webkit-font-smoothing:antialiased}
a{color:#003055;text-decoration:none}
a:hover{text-decoration:underline}
/* MASTHEAD — white, 80px, 2px SKY-BLUE underline (Tools accent) */
.header{background:#fff;height:80px;display:flex;align-items:center;padding:0 32px;gap:16px;position:relative;flex-shrink:0;border-bottom:2px solid #57cef6}
.header__logo{display:flex;align-items:center;gap:14px;text-decoration:none}
.header__logo img{height:52px;width:auto;display:block}
.header__logo-pill{display:none}
.header__breadcrumb{font-size:11px;font-weight:600;letter-spacing:.12em;color:#003055;text-transform:uppercase;display:flex;align-items:center;gap:8px}
.header__breadcrumb a{color:#737373;text-decoration:none}
.header__breadcrumb a:hover{color:#003055;text-decoration:underline}
.header__breadcrumb-sep{color:#cad6e3}
.header__spacer{flex:1}
.header__user{display:flex;align-items:center;gap:12px}
.header__role{font-size:10px;font-weight:600;letter-spacing:.1em;color:#737373;text-transform:uppercase}
.header__name{font-size:13px;font-weight:500;color:#003055}
.header__avatar{width:38px;height:38px;border-radius:50%;background:#003055;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:600;color:#fff}
/* CALC IFRAME — keeps full stage */
.stage{flex:1;position:relative;overflow:hidden;background:#fff}
.calc-frame{width:100%;height:100%;border:none;display:block}
/* FOOTER — navy with sky-blue top stroke */
.footer{background:#003055;color:#cfe2f3;padding:14px 32px;display:flex;align-items:center;flex-shrink:0;border-top:3px solid #57cef6;font-weight:300}
.footer__text{font-size:12px;color:#cfe2f3}
.footer__spacer{flex:1}
.footer__logout{background:none;border:none;cursor:pointer;font-size:11px;color:#cfe2f3;font-family:inherit;padding:0;text-transform:uppercase;letter-spacing:.06em;font-weight:500}
.footer__logout:hover{color:#fff;text-decoration:underline}

/* Beta edge tab — sky-blue (Tools accent) */
.beta-tab{position:fixed;top:50%;right:0;transform:translateY(-50%);background:#003055;color:#fff;border:none;cursor:pointer;font-family:inherit;font-weight:600;font-size:11px;letter-spacing:.14em;text-transform:uppercase;padding:18px 9px;writing-mode:vertical-rl;border-radius:5px 0 0 5px;box-shadow:-4px 0 14px rgba(0,48,85,.22);z-index:300;border-left:3px solid #57cef6}
.beta-tab:hover{background:#0f3168}
/* Feedback FAB — green (always-on action color) */
.fb-fab{position:fixed;bottom:24px;right:24px;z-index:300;background:#008c4a;color:#fff;border:none;cursor:pointer;font-family:inherit;font-weight:600;font-size:12px;border-radius:9999px;padding:13px 20px;box-shadow:0 8px 24px rgba(0,140,74,.32);display:flex;align-items:center;gap:8px;letter-spacing:.06em;text-transform:uppercase}
.fb-fab:hover{background:#006f3a}
.fb-fab svg{width:16px;height:16px}

/* Beta panel */
.beta-panel{position:fixed;top:0;right:-460px;width:460px;max-width:92vw;height:100vh;background:#fff;box-shadow:-8px 0 32px rgba(0,48,85,.22);z-index:400;display:flex;flex-direction:column;transition:right .25s ease;border-left:3px solid #57cef6}
.beta-panel.open{right:0}
.beta-head{background:#003055;color:#fff;padding:20px 22px;display:flex;align-items:center;justify-content:space-between;flex-shrink:0}
.beta-head h2{font-family:'Montserrat',sans-serif;font-size:15px;font-weight:600;letter-spacing:.12em;text-transform:uppercase}
.beta-head .sub{font-size:11px;color:rgba(255,255,255,.65);margin-top:3px;font-weight:300}
.beta-close{background:none;border:none;color:rgba(255,255,255,.7);font-size:24px;cursor:pointer;line-height:1}
.beta-close:hover{color:#fff}
.beta-tabs{display:flex;border-bottom:1px solid #e2e4e6;flex-shrink:0;background:#fff}
.beta-tabbtn{flex:1;background:none;border:none;padding:14px 6px;font-family:inherit;font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:#737373;cursor:pointer;border-bottom:2px solid transparent}
.beta-tabbtn:hover{color:#003055}
.beta-tabbtn.active{color:#003055;border-bottom-color:#57cef6}
.beta-body{flex:1;overflow-y:auto;padding:20px 22px;background:#fff}
.beta-view{display:none}
.beta-view.active{display:block}

/* progress bar */
.progress{display:flex;align-items:center;gap:12px;margin-bottom:16px;font-size:12px;color:#737373;font-weight:500}
.progress .bar{flex:1;height:6px;background:#e2e4e6;border-radius:9999px;overflow:hidden}
.progress .bar span{display:block;height:100%;background:#008c4a;width:0;transition:width .25s}

/* test cases */
.area-grp{margin-bottom:20px}
.area-grp h3{font-size:11px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:#003055;margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid #e2e4e6}
.tc{border:1px solid #e2e4e6;border-radius:5px;padding:14px;margin-bottom:12px;background:#fff}
.tc__title{font-size:13px;font-weight:600;color:#003055;margin-bottom:6px}
.tc__retire{float:right;background:#fff;border:1px solid #e2e4e6;border-radius:5px;font-size:10px;font-weight:600;color:#e80000;cursor:pointer;padding:3px 8px;font-family:inherit;letter-spacing:.04em;text-transform:uppercase}
.tc__retire:hover{background:#fde8e8;border-color:#f5b3b3}
.tc__steps{font-size:12px;color:#003055;line-height:1.5;margin-bottom:6px;font-weight:300}
.tc__exp{font-size:12px;color:#006f3a;line-height:1.45;margin-bottom:10px;font-weight:400}
.tc__exp b{color:#003055;font-weight:600}
.tc__actions{display:flex;gap:6px;margin-bottom:10px}
.tcb{flex:1;border:1px solid #e2e4e6;background:#fff;border-radius:5px;padding:7px;font-family:inherit;font-size:11px;font-weight:600;cursor:pointer;color:#003055;letter-spacing:.06em;text-transform:uppercase;transition:all .15s}
.tcb:hover{border-color:#003055}
.tcb.pass.on{background:#008c4a;border-color:#008c4a;color:#fff}
.tcb.fail.on{background:#e80000;border-color:#e80000;color:#fff}
.tcb.skip.on{background:#737373;border-color:#737373;color:#fff}
.tc textarea{width:100%;border:1px solid #e2e4e6;border-radius:5px;padding:8px 10px;font-family:inherit;font-size:12px;resize:vertical;min-height:36px;outline:none;color:#003055;font-weight:400}
.tc textarea:focus{border-color:#003055}

/* forms / lists */
.fld{margin-bottom:14px}
.fld label{display:block;font-size:10px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:#737373;margin-bottom:6px}
.fld select,.fld textarea,.fld input[type=file]{width:100%;border:1px solid #e2e4e6;border-radius:5px;padding:10px 12px;font-family:inherit;font-size:13px;outline:none;color:#003055;background:#fff;font-weight:400}
.fld textarea{resize:vertical;min-height:80px}
.fld select:focus,.fld textarea:focus{border-color:#003055}
.btn{background:#003055;color:#fff;border:none;border-radius:5px;padding:11px 18px;font-family:inherit;font-size:12px;font-weight:600;cursor:pointer;letter-spacing:.06em;text-transform:uppercase;transition:background .15s}
.btn:hover{background:#0f3168}
.btn.amber{background:#57cef6;color:#003055}.btn.amber:hover{background:#3eb8e0}
.btn:disabled{opacity:.5;cursor:default}
.note{font-size:12px;color:#737373;margin-top:8px;font-weight:300}
.ok{color:#008c4a}.err{color:#e80000}

.item{border:1px solid #e2e4e6;border-radius:5px;padding:12px 14px;margin-bottom:10px;font-size:12px;background:#fff}
.item .top{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;flex-wrap:wrap;gap:6px}
.badge{display:inline-block;padding:3px 10px;border-radius:9999px;font-size:10px;font-weight:600;letter-spacing:.08em;text-transform:uppercase}
.badge.bug{background:#fde8e8;color:#e80000}
.badge.suggestion{background:#dfeff5;color:#003055}
.badge.question{background:#e3f5eb;color:#006f3a}
.badge.other{background:#eef0f3;color:#4a5566}
.badge.open{background:#fff3d6;color:#8a6500}
.badge.resolved{background:#e3f5eb;color:#006f3a}
.item .desc{color:#003055;line-height:1.5;white-space:pre-wrap;font-weight:300}
.item .meta{color:#737373;font-size:11px;margin-top:6px;font-weight:400}
.fbthread{margin-top:10px;padding-left:12px;border-left:2px solid #57cef6}
.fbresp{padding:6px 0}
.fbresp-h{font-size:11px;color:#737373;font-weight:500}
.fbresp-b{font-size:13px;color:#003055;white-space:pre-wrap;line-height:1.4;font-weight:300}
.fbsol{margin-top:10px;background:#e3f5eb;border-radius:5px;padding:10px 12px;font-size:13px;color:#003055;white-space:pre-wrap;font-weight:400;border-left:3px solid #008c4a}
.fbsol span{display:block;font-size:10px;font-weight:600;color:#006f3a;text-transform:uppercase;letter-spacing:.08em;margin-bottom:3px}
.fbresolve{margin-top:10px;background:#003055;color:#fff;border:none;cursor:pointer;font-family:inherit;font-size:11px;font-weight:600;padding:8px 14px;border-radius:5px;letter-spacing:.06em;text-transform:uppercase}
.fbresolve:hover{background:#0f3168}
.fbresolve:disabled{opacity:.5;cursor:default}

.commit{display:flex;gap:12px;padding:10px 0;border-bottom:1px solid #e2e4e6;font-size:12px}
.commit .h{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;color:#1e7fae;font-weight:600}
.commit .s{flex:1;color:#003055;font-weight:300}
.commit .d{color:#737373;white-space:nowrap;font-weight:400}

.deploy-box{background:#dfeff5;border:1px solid #c8e0ee;border-left:4px solid #57cef6;border-radius:5px;padding:16px;margin-bottom:18px}
.deploy-box h4{font-size:11px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:#003055;margin-bottom:12px}
.muted{color:#737373;font-size:12px;text-align:center;padding:16px;font-weight:300}

/* Notice banner (top of tool) */
#noticeBanner{flex-shrink:0}
.nb{display:flex;align-items:flex-start;gap:12px;padding:12px 32px;font-size:13px;border-bottom:1px solid #e2e4e6;font-weight:400}
.nb__ico{flex-shrink:0;font-weight:600;font-size:12px;line-height:1.4}
.nb__txt{flex:1;line-height:1.45}.nb__txt b{font-weight:600}
.nb__x{background:none;border:none;cursor:pointer;font-size:18px;line-height:1;color:inherit;opacity:.6;padding:0}
.nb__x:hover{opacity:1}
.nb--info{background:#dfeff5;color:#003055;border-left:4px solid #57cef6}
.nb--warning{background:#fff3d6;color:#8a6500;border-left:4px solid #d4a800}
.nb--success{background:#e3f5eb;color:#006f3a;border-left:4px solid #008c4a}

/* Notice / update items in panel */
.ntc{border:1px solid #e2e4e6;border-radius:5px;padding:12px 14px;margin-bottom:10px;background:#fff}
.ntc__top{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:6px;flex-wrap:wrap}
.ntc__title{font-size:13px;font-weight:600;color:#003055}
.ntc__body{font-size:12px;color:#003055;line-height:1.5;white-space:pre-wrap;font-weight:300}
.ntc__meta{font-size:11px;color:#737373;margin-top:6px;font-weight:400}
.ntc__retire{background:#fff;border:1px solid #e2e4e6;border-radius:5px;font-size:10px;color:#e80000;cursor:pointer;padding:3px 9px;font-family:inherit;font-weight:600;letter-spacing:.04em;text-transform:uppercase}
.ntc__retire:hover{background:#fde8e8;border-color:#f5b3b3}
.sev{display:inline-block;padding:3px 10px;border-radius:9999px;font-size:10px;font-weight:600;letter-spacing:.08em;text-transform:uppercase}
.sev--info{background:#dfeff5;color:#003055}
.sev--warning{background:#fff3d6;color:#8a6500}
.sev--success{background:#e3f5eb;color:#006f3a}

.compose{background:#f7f7f7;border:1px solid #e2e4e6;border-radius:5px;padding:14px;margin-bottom:18px}
.compose h4{font-size:11px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:#003055;margin-bottom:10px}
.compose select,.compose input,.compose textarea{width:100%;border:1px solid #e2e4e6;border-radius:5px;padding:8px 10px;font-family:inherit;font-size:12px;margin-bottom:8px;outline:none;color:#003055;background:#fff;font-weight:400}
.compose select:focus,.compose input:focus,.compose textarea:focus{border-color:#003055}
.compose textarea{resize:vertical;min-height:52px}
.compose .row{display:flex;gap:8px}.compose .row>*{flex:1}

/* Activity ticker — sky accent label, navy body on white header */
.acttick{display:none;position:absolute;left:50%;top:0;height:80px;transform:translateX(-50%);align-items:center;justify-content:center;text-align:center;gap:12px;max-width:42%;font-size:12px;color:#003055;pointer-events:none}
.acttick.show{display:flex}
.acttick__label{flex-shrink:0;color:#1e7fae;font-weight:600;letter-spacing:.14em;font-size:10px;text-transform:uppercase}
.acttick__item{transition:opacity .22s;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:300}
@media(max-width:980px){.acttick{display:none !important}.header{padding:12px 20px;height:auto;flex-wrap:wrap;gap:8px}.header__breadcrumb{display:none}}
</style>
</head>
<body>
<header class="header">
  <div id="activityTicker" class="acttick"></div>
  <a href="/" class="header__logo"><img src="https://connect.moffittcorp.com/static/logo" alt="Moffitt"></a>
  <div class="header__breadcrumb"><a href="https://connect.moffittcorp.com/">&#8592; CONNECT</a><span class="header__breadcrumb-sep">/</span><a href="/">TOOLS</a><span class="header__breadcrumb-sep">/</span><span>VENTILATOR SELECTOR</span></div>
  <div class="header__spacer"></div>
  <div class="header__user"><span class="header__role">${roleLabel}</span><span class="header__name">${escH(first_name)}</span><div class="header__avatar">${initials}</div></div>
</header>
<div id="noticeBanner"></div>
<div class="stage"><iframe class="calc-frame" id="calcFrame" src="/ventilator/app" title="Natural Ventilator Selector"></iframe></div>
<footer class="footer">
  <span class="footer__text">&copy; 2026 Moffitt Corporation &nbsp;&middot;&nbsp; Beta Test Environment</span>
  <div class="footer__spacer"></div>
  <form method="POST" action="/auth/logout" style="display:inline"><button class="footer__logout" type="submit">Sign out</button></form>
</footer>

<button class="beta-tab" id="betaTab">Beta &nbsp;Testing</button>
<button class="fb-fab" id="fbFab" title="Report a bug or suggestion — opens the feedback form"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>Feedback</button>

<aside class="beta-panel" id="betaPanel">
  <div class="beta-head">
    <div><h2>Beta Testing</h2><div class="sub" id="betaWho">${escH(userEmail)}</div></div>
    <button class="beta-close" id="betaClose">&times;</button>
  </div>
  <div class="beta-tabs">
    <button class="beta-tabbtn active" data-view="tests">Test Scripts</button>
    <button class="beta-tabbtn" data-view="bugs">Bugs &amp; Notes</button>
    <button class="beta-tabbtn" data-view="updates">Updates</button>
  </div>
  <div class="beta-body">
    <div class="beta-view active" id="view-tests">
      <div id="tcCompose"></div>
      <div class="progress"><span id="progTxt">0 / 0 passed</span><div class="bar"><span id="progBar"></span></div></div>
      <div id="testList"><div class="muted">Loading test scripts…</div></div>
    </div>

    <div class="beta-view" id="view-bugs">
      <div class="fld"><label>Type</label><select id="fbType"><option value="bug">Bug</option><option value="suggestion">Suggestion</option><option value="question">Question</option><option value="other">Other</option></select></div>
      <div class="fld"><label>Area</label><select id="fbArea">
        <option>General</option><option>Heat Load</option><option>Airflow</option><option>Validation</option><option>Vent Type</option><option>Louver</option><option>Results</option><option>PDF Export</option><option>Feedback Widget</option>
      </select></div>
      <div class="fld"><label>Description</label><textarea id="fbDesc" placeholder="What did you find? Steps, expected vs actual…"></textarea></div>
      <button class="btn" id="fbSubmit">Submit Report</button>
      <span class="note" id="fbMsg"></span>
      <h3 style="font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#0d1f3c;margin:20px 0 8px;padding-bottom:4px;border-bottom:1px solid #eef2f7">Your Reports</h3>
      <div id="fbList"><div class="muted">No reports yet.</div></div>
    </div>

    <div class="beta-view" id="view-updates">
      <div id="noticeCompose"></div>
      <h3 style="font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#0d1f3c;margin:0 0 8px;padding-bottom:4px;border-bottom:1px solid #eef2f7">Notices</h3>
      <div id="noticeList"><div class="muted">No notices.</div></div>
      <h3 style="font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#0d1f3c;margin:20px 0 8px;padding-bottom:4px;border-bottom:1px solid #eef2f7">What's New</h3>
      <div id="whatsNew"><div class="muted">No updates yet.</div></div>
      <div id="deployArea"></div>
      <h3 style="font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#0d1f3c;margin:20px 0 8px;padding-bottom:4px;border-bottom:1px solid #eef2f7">Git Changelog</h3>
      <div id="changelog"><div class="muted">Loading…</div></div>
      <h3 style="font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#0d1f3c;margin:20px 0 8px;padding-bottom:4px;border-bottom:1px solid #eef2f7">Recent Deploys</h3>
      <div id="deployLog"><div class="muted">None yet.</div></div>
    </div>
  </div>
</aside>

<script>
const CAN_DEPLOY = ${canDeploy ? 'true' : 'false'};
const $ = s => document.querySelector(s);
const esc = s => String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
let DATA = null;

// ── Notice banner — loads on page open, independent of the slide-out panel ──
let NOTICES = { notices: [], updates: [], can_deploy: CAN_DEPLOY };
const dismissed = JSON.parse(localStorage.getItem('vbeta_dismissed')||'[]');
fetch('/ventilator/beta/notices').then(r=>r.json()).then(d=>{ if(d.ok){ NOTICES=d; renderBanner(); } }).catch(()=>{});

// ── Recent activity ticker — loads on page open, rotates the last 3 beta actions ──
function vAgo(t){ if(!t) return ''; var d=(Date.now()-new Date(t).getTime())/1000; if(d<0)d=0; if(d<60)return Math.floor(d)+'s ago'; if(d<3600)return Math.floor(d/60)+'m ago'; if(d<86400)return Math.floor(d/3600)+'h ago'; return Math.floor(d/86400)+'d ago'; }
fetch('/ventilator/beta/activity').then(function(r){return r.json();}).then(function(d){
  if(!d||!d.ok||!d.activity||!d.activity.length) return;
  var bar=$('#activityTicker'); bar.classList.add('show');
  bar.innerHTML='<span class="acttick__label">Recent</span><span class="acttick__item" id="actItem"></span>';
  var item=$('#actItem'), i=0, A=d.activity;
  function showAct(){ var a=A[i%A.length]; item.style.opacity='0'; setTimeout(function(){ item.textContent=a.actor+' '+a.label+' · '+vAgo(a.ts); item.style.opacity='1'; },220); i++; }
  showAct(); if(A.length>1) setInterval(showAct,10000);
}).catch(function(){});

function renderBanner(){
  const active=(NOTICES.notices||[]).filter(n=>!dismissed.includes(n.id));
  $('#noticeBanner').innerHTML=active.map(n=>
    '<div class="nb nb--'+esc(n.severity)+'"><span class="nb__ico">'+(n.severity==='warning'?'!':n.severity==='success'?'✓':'i')+'</span>'
    +'<div class="nb__txt"><b>'+esc(n.title)+'</b>'+(n.body?' — '+esc(n.body):'')+'</div>'
    +'<button class="nb__x" data-id="'+n.id+'" title="Dismiss">×</button></div>'
  ).join('');
  $('#noticeBanner').querySelectorAll('.nb__x').forEach(b=>b.addEventListener('click',()=>{
    dismissed.push(parseInt(b.dataset.id,10));
    localStorage.setItem('vbeta_dismissed',JSON.stringify(dismissed));
    renderBanner();
  }));
}

$('#betaTab').addEventListener('click', () => { $('#betaPanel').classList.add('open'); if(!DATA) loadData(); });
$('#fbFab').addEventListener('click', () => {
  $('#betaPanel').classList.add('open');
  if(!DATA) loadData();
  const bugsBtn = document.querySelector('.beta-tabbtn[data-view="bugs"]');
  if (bugsBtn) bugsBtn.click();
  setTimeout(() => { const d = $('#fbDesc'); if (d) d.focus(); }, 300);
});
$('#betaClose').addEventListener('click', () => $('#betaPanel').classList.remove('open'));
document.querySelectorAll('.beta-tabbtn').forEach(b => b.addEventListener('click', () => {
  document.querySelectorAll('.beta-tabbtn').forEach(x => x.classList.remove('active'));
  document.querySelectorAll('.beta-view').forEach(x => x.classList.remove('active'));
  b.classList.add('active'); $('#view-' + b.dataset.view).classList.add('active');
}));

async function loadData() {
  try {
    const r = await fetch('/ventilator/beta/data');
    DATA = await r.json();
    if (!DATA.ok) throw new Error(DATA.error||'load failed');
    renderTests(); renderFeedback(); renderUpdates();
  } catch (e) {
    $('#testList').innerHTML = '<div class="muted err">Could not load: ' + esc(e.message) + '</div>';
  }
}

function renderTests() {
  const runs = {}; (DATA.runs||[]).forEach(r => runs[r.test_key] = r);
  const byArea = {};
  (DATA.cases||[]).forEach(c => { (byArea[c.area] = byArea[c.area] || []).push(c); });
  let pass = 0, total = (DATA.cases||[]).length;
  (DATA.cases||[]).forEach(c => { if (runs[c.test_key] && runs[c.test_key].status==='pass') pass++; });
  $('#progTxt').textContent = pass + ' / ' + total + ' passed';
  $('#progBar').style.width = total ? Math.round(pass/total*100) + '%' : '0';
  let html = '';
  Object.keys(byArea).forEach(area => {
    html += '<div class="area-grp"><h3>' + esc(area) + '</h3>';
    byArea[area].forEach(c => {
      const run = runs[c.test_key] || {};
      const on = s => run.status===s ? ' on' : '';
      html += '<div class="tc" data-key="'+esc(c.test_key)+'">'
        + '<div class="tc__title">'+esc(c.title)+(CAN_DEPLOY?' <button class="tc__retire" data-key="'+esc(c.test_key)+'">retire</button>':'')+'</div>'
        + '<div class="tc__steps">'+esc(c.steps)+'</div>'
        + '<div class="tc__exp"><b>Expect:</b> '+esc(c.expected)+'</div>'
        + '<div class="tc__actions">'
        + '<button class="tcb pass'+on('pass')+'" data-s="pass">Pass</button>'
        + '<button class="tcb fail'+on('fail')+'" data-s="fail">Fail</button>'
        + '<button class="tcb skip'+on('skip')+'" data-s="skip">Skip</button>'
        + '</div>'
        + '<textarea placeholder="Notes (optional)">'+esc(run.notes||'')+'</textarea>'
        + '</div>';
    });
    html += '</div>';
  });
  $('#testList').innerHTML = html || '<div class="muted">No test scripts.</div>';
  document.querySelectorAll('#testList .tc').forEach(tc => {
    const key = tc.dataset.key;
    const ta = tc.querySelector('textarea');
    tc.querySelectorAll('.tcb').forEach(btn => btn.addEventListener('click', () => {
      tc.querySelectorAll('.tcb').forEach(x => x.classList.remove('on'));
      btn.classList.add('on');
      saveRun(key, btn.dataset.s, ta.value);
    }));
    let t; ta.addEventListener('input', () => {
      const cur = tc.querySelector('.tcb.on'); if (!cur) return;
      clearTimeout(t); t = setTimeout(() => saveRun(key, cur.dataset.s, ta.value), 700);
    });
  });
  if (CAN_DEPLOY) {
    document.querySelectorAll('#testList .tc__retire').forEach(b => b.addEventListener('click', e => {
      e.stopPropagation();
      if (confirm('Retire this test? It will be removed from all testers (history is kept).')) retireTest(b.dataset.key);
    }));
    if (!$('#tcArea')) {
      const opts = ['Heat Load','Airflow','Validation','Vent Type','Louver','Reset','Design Comparison','PDF Export','Feedback Widget']
        .map(a => '<option>'+a+'</option>').join('');
      $('#tcCompose').innerHTML =
        '<div class="compose"><h4>Add a test script</h4>'
        + '<select id="tcArea">'+opts+'</select>'
        + '<input id="tcTitle" placeholder="Title (e.g. Vent length for 750k BTU)" maxlength="255">'
        + '<textarea id="tcSteps" placeholder="Steps the tester follows"></textarea>'
        + '<textarea id="tcExp" placeholder="Expected result"></textarea>'
        + '<button class="btn" id="tcAdd">Add test</button> <span class="note" id="tcMsg"></span></div>';
      $('#tcAdd').addEventListener('click', addTest);
    }
  }
}

async function addTest() {
  const title = $('#tcTitle').value.trim(); const msg = $('#tcMsg');
  if (title.length < 3) { $('#tcTitle').focus(); return; }
  $('#tcAdd').disabled = true; msg.textContent = 'Adding…'; msg.className='note';
  try {
    const r = await fetch('/ventilator/beta/test-cases', { method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ area:$('#tcArea').value, title, steps:$('#tcSteps').value.trim(), expected:$('#tcExp').value.trim() }) });
    const j = await r.json(); if (!j.ok) throw new Error(j.error||'failed');
    $('#tcTitle').value=''; $('#tcSteps').value=''; $('#tcExp').value=''; msg.textContent='✓ Added';
    await loadData();
  } catch (e) { msg.textContent='Error: '+e.message; msg.className='note err'; }
  finally { $('#tcAdd').disabled=false; }
}

async function retireTest(key) {
  try {
    await fetch('/ventilator/beta/test-cases/'+encodeURIComponent(key)+'/retire', { method:'POST', headers:{'Content-Type':'application/json'}, body:'{}' });
    await loadData();
  } catch (e) {}
}

async function saveRun(test_key, status, notes) {
  try {
    await fetch('/ventilator/beta/test-run', { method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ test_key, status, notes }) });
    const idx = (DATA.runs||[]).findIndex(r => r.test_key===test_key);
    if (idx>=0) { DATA.runs[idx].status=status; DATA.runs[idx].notes=notes; }
    else { (DATA.runs=DATA.runs||[]).push({test_key,status,notes}); }
    let pass=0,total=DATA.cases.length; DATA.runs.forEach(r=>{if(r.status==='pass')pass++;});
    $('#progTxt').textContent = pass+' / '+total+' passed';
    $('#progBar').style.width = total?Math.round(pass/total*100)+'%':'0';
  } catch (e) {}
}

function renderFeedback() {
  const list = DATA.feedback||[];
  if (!list.length) { $('#fbList').innerHTML = '<div class="muted">No reports yet.</div>'; return; }
  $('#fbList').innerHTML = list.map(f => {
    const resps = (f.responses||[]).map(r =>
      '<div class="fbresp"><div class="fbresp-h">'+esc(r.responder_email)+' · '+esc(String(r.created_at).slice(0,16).replace('T',' '))+'</div><div class="fbresp-b">'+esc(r.body)+'</div></div>'
    ).join('');
    const sol = f.solution ? '<div class="fbsol"><span>Solution</span>'+esc(f.solution)+'</div>' : '';
    const btn = (CAN_DEPLOY && !f.resolved) ? '<button class="fbresolve" data-id="'+f.id+'">Mark resolved + notify</button>' : '';
    return '<div class="item"><div class="top">'
      + '<span><span class="badge '+esc(f.feedback_type)+'">'+esc(f.feedback_type)+'</span> '
      + (f.area?'<span style="font-size:11px;color:#6c757d">'+esc(f.area)+'</span>':'')+'</span>'
      + '<span class="badge '+(f.resolved?'resolved':'open')+'">'+(f.resolved?'Resolved':'Open')+'</span>'
      + '</div><div class="desc">'+esc(f.description)+'</div>'
      + (resps?'<div class="fbthread">'+resps+'</div>':'')
      + sol
      + '<div class="meta">#'+f.id+' · '+esc(String(f.created_at).slice(0,16).replace('T',' '))+'</div>'
      + btn
      + '</div>';
  }).join('');
  document.querySelectorAll('.fbresolve').forEach(b => b.addEventListener('click', onResolveClick));
}

async function onResolveClick(e) {
  const btn = e.target, id = btn.getAttribute('data-id');
  const solution = window.prompt('Describe the fix / solution. This marks the item resolved and emails the thread to all reviewers:');
  if (!solution || solution.trim().length < 3) return;
  btn.disabled = true; btn.textContent = 'Sending...';
  try {
    const r = await fetch('/ventilator/beta/feedback/'+id+'/resolve', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ solution: solution.trim() }) });
    const j = await r.json();
    if (j && j.ok) {
      const f = (DATA.feedback||[]).find(x => String(x.id) === String(id));
      if (f) { f.resolved = 1; f.solution = solution.trim(); }
      renderFeedback();
    } else {
      alert((j && j.error) || 'Could not resolve'); btn.disabled = false; btn.textContent = 'Mark resolved + notify';
    }
  } catch (_) {
    alert('Network error'); btn.disabled = false; btn.textContent = 'Mark resolved + notify';
  }
}

$('#fbSubmit').addEventListener('click', async () => {
  const description = $('#fbDesc').value.trim();
  const msg = $('#fbMsg');
  if (!description) { $('#fbDesc').focus(); return; }
  $('#fbSubmit').disabled = true; msg.textContent = 'Submitting…'; msg.className='note';
  try {
    let form_state = null;
    try { const f = $('#calcFrame').contentWindow; if (f && f.document) {
      const inputs = {}; f.document.querySelectorAll('input,select').forEach(el=>{ if(el.id) inputs[el.id]=el.value; });
      form_state = inputs;
    } } catch(e) {}
    const r = await fetch('/feedback', { method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ feedback_type: $('#fbType').value, area: $('#fbArea').value, description, form_state }) });
    const j = await r.json();
    if (!j.ok) throw new Error(j.error||'failed');
    $('#fbDesc').value=''; msg.textContent='✓ Submitted — thank you!'; msg.className='note ok';
    DATA.feedback = DATA.feedback||[];
    DATA.feedback.unshift({ id:j.id, feedback_type:$('#fbType').value, area:$('#fbArea').value, description, resolved:0, created_at:new Date().toISOString() });
    renderFeedback();
  } catch (e) { msg.textContent='Error: '+e.message; msg.className='note err'; }
  finally { $('#fbSubmit').disabled=false; }
});

function renderUpdates() {
  renderNotices();

  const cl = DATA.changelog||[];
  $('#changelog').innerHTML = cl.length ? cl.map(c =>
    '<div class="commit"><span class="h">'+esc(c.hash)+'</span><span class="s">'+esc(c.subject)+'</span><span class="d">'+esc(c.date)+'</span></div>'
  ).join('') : '<div class="muted">No commits found.</div>';

  const dl = DATA.deploys||[];
  $('#deployLog').innerHTML = dl.length ? dl.map(d =>
    '<div class="item"><div class="top"><span class="badge '+(d.ok?'resolved':'bug')+'">'+esc(d.method)+'</span>'
    + '<span class="meta">'+esc(String(d.created_at).slice(0,16).replace('T',' '))+'</span></div>'
    + '<div class="desc">'+esc(d.user_email)+(d.detail?' — '+esc(d.detail):'')+'</div></div>'
  ).join('') : '<div class="muted">No deploys yet.</div>';

  if (CAN_DEPLOY) {
    $('#deployArea').innerHTML =
      '<div class="deploy-box"><h4>Deploy (you have publish rights)</h4>'
      + '<div class="fld"><label>Upload new calculator HTML</label><input type="file" id="depFile" accept=".html,text/html"></div>'
      + '<div class="fld"><label>Version note (optional)</label><input type="text" id="depNote" placeholder="Describe this change" maxlength="200"></div>'
      + '<button class="btn amber" id="depUpload">Upload &amp; Publish</button> '
      + '<button class="btn" id="depGit">Deploy latest from Git</button>'
      + '<div class="note" id="depMsg"></div></div>';
    $('#depUpload').addEventListener('click', doUpload);
    $('#depGit').addEventListener('click', doGitPull);
  }
}

function renderNotices() {
  const notices = DATA.notices||[];
  const updates = DATA.updates||[];
  const retireBtn = n => CAN_DEPLOY ? '<button class="ntc__retire" data-id="'+n.id+'">Retire</button>' : '';

  $('#noticeList').innerHTML = notices.length ? notices.map(n =>
    '<div class="ntc"><div class="ntc__top"><span class="ntc__title">'+esc(n.title)+'</span>'
    + '<span><span class="sev sev--'+esc(n.severity)+'">'+esc(n.severity)+'</span> '+retireBtn(n)+'</span></div>'
    + (n.body?'<div class="ntc__body">'+esc(n.body)+'</div>':'')
    + '<div class="ntc__meta">'+esc(n.created_by)+' · '+esc(String(n.created_at).slice(0,16).replace('T',' '))+'</div></div>'
  ).join('') : '<div class="muted">No notices.</div>';

  $('#whatsNew').innerHTML = updates.length ? updates.map(n =>
    '<div class="ntc"><div class="ntc__top"><span class="ntc__title">'+esc(n.title)+'</span>'+retireBtn(n)+'</div>'
    + (n.body?'<div class="ntc__body">'+esc(n.body)+'</div>':'')
    + '<div class="ntc__meta">'+esc(String(n.created_at).slice(0,10))+'</div></div>'
  ).join('') : '<div class="muted">No updates yet.</div>';

  if (CAN_DEPLOY && !$('#ncKind')) {
    $('#noticeCompose').innerHTML =
      '<div class="compose"><h4>Post a notice / update</h4>'
      + '<div class="row"><select id="ncKind"><option value="notice">Notice (banner)</option><option value="update">Update / Whats New</option></select>'
      + '<select id="ncSev"><option value="info">Info</option><option value="warning">Warning</option><option value="success">Success</option></select></div>'
      + '<input id="ncTitle" placeholder="Title" maxlength="200">'
      + '<textarea id="ncBody" placeholder="Message (optional)"></textarea>'
      + '<button class="btn" id="ncPost">Post</button> <span class="note" id="ncMsg"></span></div>';
    $('#ncPost').addEventListener('click', postNotice);
  }
  document.querySelectorAll('.ntc__retire').forEach(b => b.addEventListener('click', () => retireNotice(b.dataset.id)));
}

async function postNotice() {
  const title = $('#ncTitle').value.trim(); const msg = $('#ncMsg');
  if (!title) { $('#ncTitle').focus(); return; }
  $('#ncPost').disabled = true; msg.textContent = 'Posting…'; msg.className='note';
  try {
    const r = await fetch('/ventilator/beta/notices', { method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ kind:$('#ncKind').value, severity:$('#ncSev').value, title, body:$('#ncBody').value.trim() }) });
    const j = await r.json(); if (!j.ok) throw new Error(j.error||'failed');
    $('#ncTitle').value=''; $('#ncBody').value=''; msg.textContent='✓ Posted'; msg.className='note ok';
    await refreshNotices();
  } catch (e) { msg.textContent='Error: '+e.message; msg.className='note err'; }
  finally { $('#ncPost').disabled=false; }
}

async function retireNotice(id) {
  try {
    await fetch('/ventilator/beta/notices/'+id+'/retire', { method:'POST', headers:{'Content-Type':'application/json'}, body:'{}' });
    await refreshNotices();
  } catch (e) {}
}

// Re-pull notices for both the panel lists and the top banner.
async function refreshNotices() {
  try {
    const d = await (await fetch('/ventilator/beta/notices')).json();
    if (d.ok) { NOTICES = d; DATA.notices = d.notices; DATA.updates = d.updates; renderNotices(); renderBanner(); }
  } catch (e) {}
}

async function doUpload() {
  const f = $('#depFile').files[0]; const msg = $('#depMsg');
  if (!f) { msg.textContent='Choose a file first.'; msg.className='note err'; return; }
  msg.textContent='Reading…'; msg.className='note';
  const text = await f.text();
  const content_b64 = btoa(unescape(encodeURIComponent(text)));
  const note = (($('#depNote') && $('#depNote').value) || '').trim();
  $('#depUpload').disabled=true; msg.textContent='Publishing…';
  try {
    const r = await fetch('/ventilator/beta/deploy/upload', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ content_b64, note }) });
    const j = await r.json(); if (!j.ok) throw new Error(j.error||'failed');
    var vtxt = j.committed ? (' · version '+(j.hash||'')+(j.pushed?'':' (local only)')) : '';
    msg.textContent='✓ Published ('+j.bytes+' bytes)'+vtxt+'. Reloading calculator…'; msg.className='note ok';
    reloadCalc(); loadData();
  } catch (e) { msg.textContent='Error: '+e.message; msg.className='note err'; }
  finally { $('#depUpload').disabled=false; }
}

async function doGitPull() {
  const msg = $('#depMsg'); $('#depGit').disabled=true; msg.textContent='Pulling from Git…'; msg.className='note';
  try {
    const r = await fetch('/ventilator/beta/deploy/git-pull', { method:'POST', headers:{'Content-Type':'application/json'}, body:'{}' });
    const j = await r.json(); if (!j.ok) throw new Error(j.error||'failed');
    msg.textContent='✓ Deployed '+(j.head||'')+'. Reloading…'; msg.className='note ok';
    reloadCalc(); loadData();
  } catch (e) { msg.textContent='Error: '+e.message; msg.className='note err'; }
  finally { $('#depGit').disabled=false; }
}

function reloadCalc(){ const f=$('#calcFrame'); f.src = '/ventilator/app?t='+Date.now(); }
</script>
</body></html>`;
}

function escH(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}
