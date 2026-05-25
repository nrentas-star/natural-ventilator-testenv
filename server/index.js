const express = require('express');
const cors    = require('cors');
const fs      = require('fs');
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 3200;

const FEEDBACK_FILE = path.join(__dirname, '..', 'data', 'feedback.json');
const RESULTS_DIR   = path.join(__dirname, '..', 'data', 'results');
const PUBLIC_DIR    = path.join(__dirname, '..', 'public');
const WIDGET_FILE   = path.join(__dirname, '..', 'widget', 'feedback.js');

app.use(cors());
app.use(express.json());

// ── Serve the app with feedback widget injected ──────────────────────────────
app.get('/', (req, res) => {
  const appFile = path.join(PUBLIC_DIR, 'index.html');
  if (!fs.existsSync(appFile)) {
    return res.status(404).send('index.html not found in /public. Copy the ventilator selector HTML there.');
  }
  let html   = fs.readFileSync(appFile, 'utf8');
  const widget = fs.existsSync(WIDGET_FILE) ? fs.readFileSync(WIDGET_FILE, 'utf8') : '';
  // Inject widget script before closing body tag
  html = html.replace('</body>', `<script>\n${widget}\n</script>\n</body>`);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});

// ── Feedback API ─────────────────────────────────────────────────────────────
app.post('/feedback', (req, res) => {
  const { name, type, description, formState } = req.body;
  if (!description) return res.status(400).json({ error: 'description is required' });

  const entry = {
    id:        Date.now(),
    timestamp: new Date().toISOString(),
    name:      name || 'Anonymous',
    type:      type || 'general',
    description,
    formState: formState || {}
  };

  let existing = [];
  if (fs.existsSync(FEEDBACK_FILE)) {
    try { existing = JSON.parse(fs.readFileSync(FEEDBACK_FILE, 'utf8')); } catch {}
  }
  existing.push(entry);
  fs.writeFileSync(FEEDBACK_FILE, JSON.stringify(existing, null, 2));
  res.json({ ok: true, id: entry.id });
});

app.get('/feedback', (req, res) => {
  if (!fs.existsSync(FEEDBACK_FILE)) return res.json([]);
  try { res.json(JSON.parse(fs.readFileSync(FEEDBACK_FILE, 'utf8'))); }
  catch { res.json([]); }
});

// ── Test Results API ──────────────────────────────────────────────────────────
app.get('/results', (req, res) => {
  const files = fs.existsSync(RESULTS_DIR)
    ? fs.readdirSync(RESULTS_DIR).filter(f => f.endsWith('.json')).sort().reverse()
    : [];
  if (!files.length) return res.json({ message: 'No test results yet. Run: npm test' });
  try { res.json(JSON.parse(fs.readFileSync(path.join(RESULTS_DIR, files[0]), 'utf8'))); }
  catch { res.status(500).json({ error: 'Could not read results file.' }); }
});

// ── Dashboard ─────────────────────────────────────────────────────────────────
app.get('/dashboard', (req, res) => {
  let feedback = [];
  if (fs.existsSync(FEEDBACK_FILE)) {
    try { feedback = JSON.parse(fs.readFileSync(FEEDBACK_FILE, 'utf8')); } catch {}
  }

  const resultFiles = fs.existsSync(RESULTS_DIR)
    ? fs.readdirSync(RESULTS_DIR).filter(f => f.endsWith('.json')).sort().reverse()
    : [];
  let results = null;
  if (resultFiles.length) {
    try { results = JSON.parse(fs.readFileSync(path.join(RESULTS_DIR, resultFiles[0]), 'utf8')); } catch {}
  }

  const passed  = results ? (results.stats?.passes  || 0) : 0;
  const failed  = results ? (results.stats?.failures || 0) : 0;
  const total   = results ? (results.stats?.tests    || 0) : 0;
  const runTime = results ? (results.stats?.end      || '') : '';

  const typeBadge = t => ({
    bug:        '#c62828',
    suggestion: '#b26a00',
    question:   '#1565c0',
    general:    '#555'
  }[t] || '#555');

  const feedbackRows = feedback.slice().reverse().map(f => `
    <tr>
      <td>${new Date(f.timestamp).toLocaleString()}</td>
      <td>${f.name}</td>
      <td><span style="background:${typeBadge(f.type)};color:#fff;padding:2px 8px;border-radius:999px;font-size:12px">${f.type}</span></td>
      <td>${f.description}</td>
      <td><details><summary style="cursor:pointer;font-size:12px">View</summary><pre style="font-size:11px;white-space:pre-wrap">${JSON.stringify(f.formState, null, 2)}</pre></details></td>
    </tr>`).join('');

  res.send(`<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/>
  <title>Ventilator Selector — Test Dashboard</title>
  <style>
    body{font-family:system-ui,sans-serif;background:#f4f6fb;color:#1a1a2e;margin:0;padding:24px}
    h1{color:#00589a;margin:0 0 4px}p.sub{color:#666;margin:0 0 24px;font-size:14px}
    .cards{display:flex;gap:16px;margin-bottom:24px;flex-wrap:wrap}
    .card{background:#fff;border:1px solid #d6dde8;border-radius:10px;padding:16px 22px;min-width:140px}
    .card h3{margin:0 0 4px;font-size:12px;color:#666;text-transform:uppercase}
    .card .val{font-size:32px;font-weight:800}
    .pass{color:#2e7d32}.fail{color:#c62828}.neutral{color:#00589a}
    section{background:#fff;border:1px solid #d6dde8;border-radius:10px;padding:18px 22px;margin-bottom:20px}
    h2{margin:0 0 14px;font-size:16px;color:#00589a}
    table{width:100%;border-collapse:collapse;font-size:13px}
    th{text-align:left;padding:8px 10px;background:#f0f4f9;border-bottom:2px solid #d6dde8}
    td{padding:8px 10px;border-bottom:1px solid #eee;vertical-align:top}
    .empty{color:#999;font-style:italic;padding:12px 0}
    a{color:#00589a}
  </style></head><body>
  <h1>Ventilator Selector — Test Dashboard</h1>
  <p class="sub">Beta environment · <a href="/">Open App</a> · <a href="/feedback">Feedback JSON</a> · <a href="/results">Results JSON</a></p>

  <div class="cards">
    <div class="card"><h3>Feedback Submitted</h3><div class="val neutral">${feedback.length}</div></div>
    <div class="card"><h3>Tests Passed</h3><div class="val pass">${passed}</div></div>
    <div class="card"><h3>Tests Failed</h3><div class="val fail">${failed}</div></div>
    <div class="card"><h3>Total Tests</h3><div class="val neutral">${total}</div></div>
    ${runTime ? `<div class="card"><h3>Last Run</h3><div style="font-size:13px;padding-top:8px">${new Date(runTime).toLocaleString()}</div></div>` : ''}
  </div>

  <section>
    <h2>Beta Feedback (${feedback.length})</h2>
    ${feedback.length ? `<table><thead><tr><th>Time</th><th>Name</th><th>Type</th><th>Description</th><th>Form State</th></tr></thead><tbody>${feedbackRows}</tbody></table>`
    : '<p class="empty">No feedback submitted yet.</p>'}
  </section>

  <section>
    <h2>Latest Test Run</h2>
    ${results ? `<p style="font-size:13px;color:#555">File: ${resultFiles[0]}</p>` : '<p class="empty">No test results yet. Run: <code>npm test</code></p>'}
  </section>
  </body></html>`);
});

app.listen(PORT, () => console.log(`Ventilator test env running → http://localhost:${PORT}`));
