import { Router } from 'express';
import { requireAuth, requireVentilatorBeta } from '../auth/middleware.js';
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

export default router;

function ventilatorShell({ first_name, roleLabel, userEmail, canDeploy }) {
  const initials = escH((first_name || 'U').charAt(0).toUpperCase());
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Natural Ventilator Selector — Moffitt Tools</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Inter',system-ui,sans-serif;background:#f0f4f8;color:#0d1f3c;height:100vh;display:flex;flex-direction:column;overflow:hidden}
.header{background:#0d1f3c;height:64px;display:flex;align-items:center;padding:0 28px;gap:16px;flex-shrink:0}
.header__logo{display:flex;align-items:center;gap:12px;text-decoration:none}
.header__logo-pill{background:#fff;border-radius:6px;padding:4px 10px;font-weight:700;font-size:13px;color:#0d1f3c;letter-spacing:.5px}
.header__breadcrumb{font-size:11px;font-weight:600;letter-spacing:2px;color:rgba(255,255,255,.45);text-transform:uppercase;display:flex;align-items:center;gap:8px}
.header__breadcrumb a{color:rgba(255,255,255,.45);text-decoration:none}
.header__breadcrumb a:hover{color:rgba(255,255,255,.7)}
.header__breadcrumb-sep{color:rgba(255,255,255,.25)}
.header__spacer{flex:1}
.header__user{display:flex;align-items:center;gap:10px}
.header__role{font-size:11px;font-weight:600;letter-spacing:1px;color:rgba(255,255,255,.5);text-transform:uppercase}
.header__name{font-size:14px;font-weight:500;color:#fff}
.header__avatar{width:32px;height:32px;border-radius:50%;background:#e07c24;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:#fff}
.stage{flex:1;position:relative;overflow:hidden}
.calc-frame{width:100%;height:100%;border:none;display:block}
.footer{background:#0d1f3c;height:48px;display:flex;align-items:center;padding:0 28px;flex-shrink:0}
.footer__text{font-size:12px;color:rgba(255,255,255,.35)}
.footer__spacer{flex:1}
.footer__logout{background:none;border:none;cursor:pointer;font-size:12px;color:rgba(255,255,255,.35);font-family:inherit;padding:0}
.footer__logout:hover{color:rgba(255,255,255,.65)}

/* Beta edge tab */
.beta-tab{position:fixed;top:50%;right:0;transform:translateY(-50%);background:#e07c24;color:#fff;border:none;cursor:pointer;font-family:inherit;font-weight:700;font-size:12px;letter-spacing:2px;text-transform:uppercase;padding:16px 8px;writing-mode:vertical-rl;border-radius:8px 0 0 8px;box-shadow:-2px 0 10px rgba(0,0,0,.18);z-index:300}
.beta-tab:hover{background:#c9691b}

/* Beta panel */
.beta-panel{position:fixed;top:0;right:-460px;width:460px;max-width:92vw;height:100vh;background:#fff;box-shadow:-8px 0 32px rgba(0,0,0,.22);z-index:400;display:flex;flex-direction:column;transition:right .25s ease}
.beta-panel.open{right:0}
.beta-head{background:#0d1f3c;color:#fff;padding:18px 20px;display:flex;align-items:center;justify-content:space-between;flex-shrink:0}
.beta-head h2{font-size:15px;font-weight:700;letter-spacing:1px;text-transform:uppercase}
.beta-head .sub{font-size:11px;color:rgba(255,255,255,.5);margin-top:2px}
.beta-close{background:none;border:none;color:rgba(255,255,255,.7);font-size:22px;cursor:pointer;line-height:1}
.beta-close:hover{color:#fff}
.beta-tabs{display:flex;border-bottom:1px solid #e5e9f0;flex-shrink:0}
.beta-tabbtn{flex:1;background:none;border:none;padding:12px 6px;font-family:inherit;font-size:12px;font-weight:600;color:#6c757d;cursor:pointer;border-bottom:2px solid transparent}
.beta-tabbtn.active{color:#0d1f3c;border-bottom-color:#e07c24}
.beta-body{flex:1;overflow-y:auto;padding:18px 20px}
.beta-view{display:none}
.beta-view.active{display:block}

/* progress bar */
.progress{display:flex;align-items:center;gap:10px;margin-bottom:14px;font-size:12px;color:#6c757d}
.progress .bar{flex:1;height:6px;background:#eef2f7;border-radius:3px;overflow:hidden}
.progress .bar span{display:block;height:100%;background:#16a34a;width:0}

/* test cases */
.area-grp{margin-bottom:18px}
.area-grp h3{font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#0d1f3c;margin-bottom:8px;padding-bottom:4px;border-bottom:1px solid #eef2f7}
.tc{border:1px solid #e5e9f0;border-radius:8px;padding:12px;margin-bottom:10px}
.tc__title{font-size:13px;font-weight:600;color:#0d1f3c;margin-bottom:4px}
.tc__steps{font-size:12px;color:#475467;line-height:1.5;margin-bottom:4px}
.tc__exp{font-size:12px;color:#16794a;line-height:1.45;margin-bottom:8px}
.tc__exp b{color:#0d1f3c}
.tc__actions{display:flex;gap:6px;margin-bottom:8px}
.tcb{flex:1;border:1.5px solid #d1d5db;background:#fff;border-radius:6px;padding:6px;font-family:inherit;font-size:12px;font-weight:600;cursor:pointer;color:#374151}
.tcb.pass.on{background:#16a34a;border-color:#16a34a;color:#fff}
.tcb.fail.on{background:#dc2626;border-color:#dc2626;color:#fff}
.tcb.skip.on{background:#6b7280;border-color:#6b7280;color:#fff}
.tc textarea{width:100%;border:1px solid #d1d5db;border-radius:6px;padding:7px 9px;font-family:inherit;font-size:12px;resize:vertical;min-height:34px;outline:none}
.tc textarea:focus{border-color:#0d1f3c}

/* forms / lists */
.fld{margin-bottom:12px}
.fld label{display:block;font-size:11px;font-weight:600;letter-spacing:.5px;text-transform:uppercase;color:#6c757d;margin-bottom:5px}
.fld select,.fld textarea,.fld input[type=file]{width:100%;border:1.5px solid #d1d5db;border-radius:6px;padding:9px 11px;font-family:inherit;font-size:13px;outline:none}
.fld textarea{resize:vertical;min-height:72px}
.fld select:focus,.fld textarea:focus{border-color:#0d1f3c}
.btn{background:#0d1f3c;color:#fff;border:none;border-radius:6px;padding:10px 16px;font-family:inherit;font-size:13px;font-weight:600;cursor:pointer}
.btn:hover{background:#162d54}
.btn.amber{background:#e07c24}.btn.amber:hover{background:#c9691b}
.btn:disabled{opacity:.55;cursor:default}
.note{font-size:12px;color:#6c757d;margin-top:8px}
.ok{color:#16a34a}.err{color:#dc2626}

.item{border:1px solid #e5e9f0;border-radius:8px;padding:10px 12px;margin-bottom:8px;font-size:12px}
.item .top{display:flex;justify-content:space-between;align-items:center;margin-bottom:4px}
.badge{display:inline-block;padding:2px 7px;border-radius:4px;font-size:10px;font-weight:700;letter-spacing:.5px;text-transform:uppercase}
.badge.bug{background:#fde8e8;color:#c0392b}.badge.suggestion{background:#e8f0fe;color:#2563eb}
.badge.question{background:#f3e8ff;color:#7c3aed}.badge.other{background:#eef2f7;color:#475467}
.badge.open{background:#fff4e5;color:#b45309}.badge.resolved{background:#e7f6ec;color:#16a34a}
.item .desc{color:#475467;line-height:1.45;white-space:pre-wrap}
.item .meta{color:#9aa4b2;font-size:11px;margin-top:4px}

.commit{display:flex;gap:10px;padding:8px 0;border-bottom:1px solid #f0f4f8;font-size:12px}
.commit .h{font-family:ui-monospace,monospace;color:#e07c24;font-weight:600}
.commit .s{flex:1;color:#0d1f3c}
.commit .d{color:#9aa4b2;white-space:nowrap}

.deploy-box{background:#fff8f0;border:1px solid #f0d9bd;border-radius:8px;padding:14px;margin-bottom:16px}
.deploy-box h4{font-size:12px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:#b45309;margin-bottom:10px}
.muted{color:#9aa4b2;font-size:12px;text-align:center;padding:14px}
</style>
</head>
<body>
<header class="header">
  <a href="/" class="header__logo"><span class="header__logo-pill">MOFFITT</span></a>
  <div class="header__breadcrumb"><a href="/">TOOLS</a><span class="header__breadcrumb-sep">/</span><span>VENTILATOR SELECTOR</span></div>
  <div class="header__spacer"></div>
  <div class="header__user"><span class="header__role">${roleLabel}</span><span class="header__name">${escH(first_name)}</span><div class="header__avatar">${initials}</div></div>
</header>
<div class="stage"><iframe class="calc-frame" id="calcFrame" src="/ventilator/app" title="Natural Ventilator Selector"></iframe></div>
<footer class="footer">
  <span class="footer__text">&copy; 2026 Moffitt Corporation &nbsp;&middot;&nbsp; Beta Test Environment</span>
  <div class="footer__spacer"></div>
  <form method="POST" action="/auth/logout" style="display:inline"><button class="footer__logout" type="submit">Sign out</button></form>
</footer>

<button class="beta-tab" id="betaTab">Beta &nbsp;Testing</button>

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
      <div id="deployArea"></div>
      <h3 style="font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#0d1f3c;margin:0 0 8px;padding-bottom:4px;border-bottom:1px solid #eef2f7">Latest Changes</h3>
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

$('#betaTab').addEventListener('click', () => { $('#betaPanel').classList.add('open'); if(!DATA) loadData(); });
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
        + '<div class="tc__title">'+esc(c.title)+'</div>'
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
  $('#fbList').innerHTML = list.map(f =>
    '<div class="item"><div class="top">'
    + '<span><span class="badge '+esc(f.feedback_type)+'">'+esc(f.feedback_type)+'</span> '
    + (f.area?'<span style="font-size:11px;color:#6c757d">'+esc(f.area)+'</span>':'')+'</span>'
    + '<span class="badge '+(f.resolved?'resolved':'open')+'">'+(f.resolved?'Resolved':'Open')+'</span>'
    + '</div><div class="desc">'+esc(f.description)+'</div>'
    + '<div class="meta">#'+f.id+' · '+esc(String(f.created_at).slice(0,16).replace('T',' '))+'</div></div>'
  ).join('');
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
      + '<button class="btn amber" id="depUpload">Upload &amp; Publish</button> '
      + '<button class="btn" id="depGit">Deploy latest from Git</button>'
      + '<div class="note" id="depMsg"></div></div>';
    $('#depUpload').addEventListener('click', doUpload);
    $('#depGit').addEventListener('click', doGitPull);
  }
}

async function doUpload() {
  const f = $('#depFile').files[0]; const msg = $('#depMsg');
  if (!f) { msg.textContent='Choose a file first.'; msg.className='note err'; return; }
  msg.textContent='Reading…'; msg.className='note';
  const text = await f.text();
  const content_b64 = btoa(unescape(encodeURIComponent(text)));
  $('#depUpload').disabled=true; msg.textContent='Publishing…';
  try {
    const r = await fetch('/ventilator/beta/deploy/upload', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ content_b64 }) });
    const j = await r.json(); if (!j.ok) throw new Error(j.error||'failed');
    msg.textContent='✓ Published ('+j.bytes+' bytes). Reloading calculator…'; msg.className='note ok';
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
