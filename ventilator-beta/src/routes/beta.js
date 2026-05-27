import { Router } from 'express';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { readFile, writeFile, copyFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { requireAuth, requireVentilatorBeta, requireCanDeploy } from '../auth/middleware.js';
import {
  getTestCases, getTestRuns, upsertTestRun, getUserFeedback,
  insertDeploy, getRecentDeploys,
  getNotices, insertNotice, retireNotice,
  insertTestCase, retireTestCase,
  recentBetaActivity,
} from '../db.js';

const TEST_AREAS = ['Heat Load','Airflow','Validation','Vent Type','Louver','Reset','Design Comparison','PDF Export','Feedback Widget'];

const execFileP = promisify(execFile);
const router = Router();

const __dir   = dirname(fileURLToPath(import.meta.url));
const ROOT    = join(__dir, '../..');
const PUBLIC  = join(ROOT, 'public');
const LIVE    = join(PUBLIC, 'v213.html');
const BACKUPS = join(PUBLIC, 'backups');
const REPO    = join(ROOT, 'repo');
const REPO_CALC = join(REPO, 'public', 'index.html');

const SEP = '|@@|';  // field separator for git log parsing (never appears in commit data)

// ── Panel data — one call populates the whole Beta panel ────────────────────
router.get('/ventilator/beta/data', requireAuth, requireVentilatorBeta, async (req, res) => {
  try {
    const [cases, runs, feedback, changelog, deploys, notices] = await Promise.all([
      getTestCases(),
      getTestRuns(req.user.email),
      getUserFeedback(req.user.email),
      gitChangelog(),
      getRecentDeploys(10),
      getNotices(),
    ]);
    res.json({
      ok: true,
      user: { email: req.user.email, can_deploy: !!req.user.can_deploy },
      cases, runs, feedback, changelog, deploys,
      notices: notices.filter(n => n.kind === 'notice'),
      updates: notices.filter(n => n.kind === 'update'),
    });
  } catch (err) {
    console.error('[beta] data error:', err.message);
    res.status(500).json({ ok: false, error: 'Could not load beta data' });
  }
});

// ── Recent activity ticker feed (last 3 beta actions across all users) ──────
router.get('/ventilator/beta/activity', requireAuth, requireVentilatorBeta, async (req, res) => {
  try { res.json({ ok: true, activity: await recentBetaActivity(6) }); }
  catch (err) { console.error('[beta] activity error:', err.message); res.json({ ok: false, activity: [] }); }
});

// ── Notices + Latest Updates ────────────────────────────────────────────────
// Lightweight list for the banner (and the panel). Returns active notices/updates.
router.get('/ventilator/beta/notices', requireAuth, requireVentilatorBeta, async (req, res) => {
  try {
    const all = await getNotices();
    res.json({
      ok: true,
      can_deploy: !!req.user.can_deploy,
      notices: all.filter(n => n.kind === 'notice'),
      updates: all.filter(n => n.kind === 'update'),
    });
  } catch (err) {
    console.error('[beta] notices error:', err.message);
    res.status(500).json({ ok: false, error: 'Could not load notices' });
  }
});

// Post a notice or update (can_deploy only).
router.post('/ventilator/beta/notices', requireAuth, requireVentilatorBeta, requireCanDeploy, async (req, res) => {
  const { kind, severity, title, body } = req.body || {};
  if (!title || String(title).trim().length < 2) {
    return res.status(400).json({ ok: false, error: 'Title required' });
  }
  try {
    const id = await insertNotice({
      kind, severity, title: String(title).trim().slice(0, 200),
      body: body ? String(body).slice(0, 4000) : null,
      created_by: req.user.email,
    });
    res.json({ ok: true, id });
  } catch (err) {
    console.error('[beta] notice create error:', err.message);
    res.status(500).json({ ok: false, error: 'Could not post' });
  }
});

// Retire a notice/update (can_deploy only).
router.post('/ventilator/beta/notices/:id/retire', requireAuth, requireVentilatorBeta, requireCanDeploy, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id) return res.status(400).json({ ok: false, error: 'bad id' });
  try {
    await retireNotice(id);
    res.json({ ok: true });
  } catch (err) {
    console.error('[beta] notice retire error:', err.message);
    res.status(500).json({ ok: false, error: 'Could not retire' });
  }
});

// ── Save a test result (upsert per user+test) ──────────────────────────────
// ── Manage test cases (can_deploy only) ─────────────────────────────────────
router.post('/ventilator/beta/test-cases', requireAuth, requireVentilatorBeta, requireCanDeploy, async (req, res) => {
  const { area, title, steps, expected } = req.body || {};
  if (!TEST_AREAS.includes(area)) {
    return res.status(400).json({ ok: false, error: 'Pick a valid area' });
  }
  if (!title || String(title).trim().length < 3) {
    return res.status(400).json({ ok: false, error: 'Title required' });
  }
  try {
    const test_key = await insertTestCase({
      area,
      title: String(title).trim().slice(0, 255),
      steps: (steps || '').slice(0, 2000),
      expected: (expected || '').slice(0, 2000),
    });
    res.json({ ok: true, test_key });
  } catch (err) {
    console.error('[beta] test-case create error:', err.message);
    res.status(500).json({ ok: false, error: 'Could not add test' });
  }
});

router.post('/ventilator/beta/test-cases/:key/retire', requireAuth, requireVentilatorBeta, requireCanDeploy, async (req, res) => {
  const key = req.params.key;
  if (!key) return res.status(400).json({ ok: false, error: 'bad key' });
  try {
    await retireTestCase(key);
    res.json({ ok: true });
  } catch (err) {
    console.error('[beta] test-case retire error:', err.message);
    res.status(500).json({ ok: false, error: 'Could not retire test' });
  }
});

router.post('/ventilator/beta/test-run', requireAuth, requireVentilatorBeta, async (req, res) => {
  const { test_key, status, notes } = req.body || {};
  if (!test_key || typeof test_key !== 'string') {
    return res.status(400).json({ ok: false, error: 'test_key required' });
  }
  if (!['pass', 'fail', 'skip'].includes(status)) {
    return res.status(400).json({ ok: false, error: 'invalid status' });
  }
  const cleanNotes = (notes == null ? '' : String(notes)).slice(0, 2000);
  try {
    await upsertTestRun(req.user.email, test_key, status, cleanNotes);
    res.json({ ok: true });
  } catch (err) {
    console.error('[beta] test-run error:', err.message);
    res.status(500).json({ ok: false, error: 'Could not save result' });
  }
});

// ── Deploy: upload a new calculator HTML (can_deploy only) ──────────────────
router.post('/ventilator/beta/deploy/upload', requireAuth, requireVentilatorBeta, requireCanDeploy, async (req, res) => {
  const { content_b64 } = req.body || {};
  if (!content_b64 || typeof content_b64 !== 'string') {
    return res.status(400).json({ ok: false, error: 'content_b64 required' });
  }
  let html;
  try {
    html = Buffer.from(content_b64, 'base64').toString('utf8');
  } catch {
    return res.status(400).json({ ok: false, error: 'invalid base64' });
  }
  if (!/id\s*=\s*["']calc["']/.test(html)) {
    return res.status(400).json({ ok: false, error: 'File does not look like the calculator (missing #calc element). Upload rejected.' });
  }
  if (html.length > 2 * 1024 * 1024) {
    return res.status(400).json({ ok: false, error: 'File too large' });
  }
  let backupName = null;
  try {
    backupName = await backupLive();
    await writeFile(LIVE, html, 'utf8');
  } catch (err) {
    console.error('[beta] upload error:', err.message);
    await insertDeploy({ user_email: req.user.email, method: 'upload', detail: err.message, backup_file: backupName, ok: false }).catch(() => {});
    return res.status(500).json({ ok: false, error: 'Could not write file' });
  }
  await insertDeploy({ user_email: req.user.email, method: 'upload', detail: `uploaded ${html.length} bytes`, backup_file: backupName, ok: true }).catch(() => {});
  res.json({ ok: true, backup: backupName, bytes: html.length });
});

// ── Deploy: git pull the repo and publish its calculator (can_deploy only) ──
router.post('/ventilator/beta/deploy/git-pull', requireAuth, requireVentilatorBeta, requireCanDeploy, async (req, res) => {
  let pullOut = '';
  try {
    const { stdout } = await execFileP('git', ['-C', REPO, 'pull', '--ff-only'], { timeout: 30000 });
    pullOut = stdout.trim();
  } catch (err) {
    const msg = (err.stderr || err.message || '').toString().slice(0, 500);
    console.error('[beta] git-pull error:', msg);
    await insertDeploy({ user_email: req.user.email, method: 'git-pull', detail: `pull failed: ${msg}`, ok: false }).catch(() => {});
    return res.status(500).json({ ok: false, error: `git pull failed: ${msg}` });
  }
  let backupName = null;
  try {
    backupName = await backupLive();
    await copyFile(REPO_CALC, LIVE);
  } catch (err) {
    console.error('[beta] git-pull publish error:', err.message);
    await insertDeploy({ user_email: req.user.email, method: 'git-pull', detail: `publish failed: ${err.message}`, backup_file: backupName, ok: false }).catch(() => {});
    return res.status(500).json({ ok: false, error: 'Pulled, but could not publish calculator file' });
  }
  const head = await gitHead().catch(() => '');
  await insertDeploy({ user_email: req.user.email, method: 'git-pull', detail: `pulled @ ${head}: ${pullOut}`.slice(0, 500), backup_file: backupName, ok: true }).catch(() => {});
  res.json({ ok: true, backup: backupName, pull: pullOut, head });
});

// ── helpers ─────────────────────────────────────────────────────────────────
async function backupLive() {
  await mkdir(BACKUPS, { recursive: true });
  let current;
  try { current = await readFile(LIVE); } catch { return null; }
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const name = `v213-${ts}.html`;
  await writeFile(join(BACKUPS, name), current);
  return name;
}

async function gitChangelog() {
  try {
    const { stdout } = await execFileP(
      'git', ['-C', REPO, 'log', `--pretty=%h${SEP}%an${SEP}%ad${SEP}%s`, '--date=short', '-15'],
      { timeout: 10000 }
    );
    return stdout.trim().split('\n').filter(Boolean).map(line => {
      const parts = line.split(SEP);
      return { hash: parts[0], author: parts[1], date: parts[2], subject: parts[3] };
    });
  } catch {
    return [];
  }
}

async function gitHead() {
  const { stdout } = await execFileP('git', ['-C', REPO, 'rev-parse', '--short', 'HEAD'], { timeout: 10000 });
  return stdout.trim();
}

export default router;
