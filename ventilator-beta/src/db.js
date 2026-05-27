import mysql from 'mysql2/promise';
import { cfg } from './config.js';

let pool;

export function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      host:            cfg.DB_HOST,
      port:            cfg.DB_PORT,
      user:            cfg.DB_USER,
      password:        cfg.DB_PASSWORD,
      database:        cfg.DB_NAME,
      waitForConnections: true,
      connectionLimit: 5,
      queueLimit:      0,
      enableKeepAlive: true,
    });
  }
  return pool;
}

/**
 * Look up a user by email in user_roles.
 * Returns { email, role, first_name, ventilator_beta, can_deploy } or null.
 */
export async function getUserRole(email) {
  const [rows] = await getPool().execute(
    'SELECT email, role, first_name, ventilator_beta, can_deploy FROM user_roles WHERE email = ? LIMIT 1',
    [email.toLowerCase()]
  );
  return rows.length ? rows[0] : null;
}

/** Insert a feedback record (area is optional). */
export async function insertFeedback({ user_email, feedback_type, area, description, form_state }) {
  const [result] = await getPool().execute(
    'INSERT INTO ventilator_feedback (user_email, feedback_type, area, description, form_state) VALUES (?, ?, ?, ?, ?)',
    [user_email, feedback_type, area || null, description, form_state ? JSON.stringify(form_state) : null]
  );
  return result.insertId;
}

/** All active test cases, ordered for display. */
export async function getTestCases() {
  const [rows] = await getPool().execute(
    'SELECT test_key, area, seq, title, steps, expected FROM ventilator_test_cases WHERE active = 1 ORDER BY seq'
  );
  return rows;
}

/** Add a test case. Auto-generates a unique test_key and appends to the end (max seq + 1). */
export async function insertTestCase({ area, title, steps, expected }) {
  const [[{ nextSeq }]] = await getPool().query(
    'SELECT COALESCE(MAX(seq), 0) + 1 AS nextSeq FROM ventilator_test_cases'
  );
  const test_key = 'tc-' + Date.now().toString(36) + '-' + Math.floor(Math.random() * 1e4).toString(36);
  await getPool().execute(
    'INSERT INTO ventilator_test_cases (test_key, area, seq, title, steps, expected, active) VALUES (?, ?, ?, ?, ?, ?, 1)',
    [test_key, area, nextSeq, title, steps || '', expected || '']
  );
  return test_key;
}

/** Retire a test case (active = 0) — hides it suite-wide, keeps the row + run history. */
export async function retireTestCase(test_key) {
  await getPool().execute('UPDATE ventilator_test_cases SET active = 0 WHERE test_key = ?', [test_key]);
}

/** A user's latest run status per test_key. */
export async function getTestRuns(email) {
  const [rows] = await getPool().execute(
    'SELECT test_key, status, notes, updated_at FROM ventilator_test_runs WHERE user_email = ?',
    [email.toLowerCase()]
  );
  return rows;
}

/** Upsert a user's result for one test (one current row per user+test). */
export async function upsertTestRun(email, test_key, status, notes) {
  await getPool().execute(
    `INSERT INTO ventilator_test_runs (user_email, test_key, status, notes)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE status = VALUES(status), notes = VALUES(notes)`,
    [email.toLowerCase(), test_key, status, notes || null]
  );
}

/** A user's own submitted feedback with resolved status. */
export async function getUserFeedback(email) {
  const [rows] = await getPool().execute(
    `SELECT id, feedback_type, area, description, resolved, created_at
     FROM ventilator_feedback WHERE user_email = ? ORDER BY created_at DESC LIMIT 100`,
    [email.toLowerCase()]
  );
  return rows;
}

/** Record a deploy in the audit log. */
export async function insertDeploy({ user_email, method, detail, backup_file, ok }) {
  const [result] = await getPool().execute(
    'INSERT INTO ventilator_deploys (user_email, method, detail, backup_file, ok) VALUES (?, ?, ?, ?, ?)',
    [user_email, method, detail || null, backup_file || null, ok ? 1 : 0]
  );
  return result.insertId;
}

/** Recent deploys (audit). */
export async function getRecentDeploys(limit = 20) {
  const n = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));
  const [rows] = await getPool().query(
    'SELECT user_email, method, detail, ok, created_at FROM ventilator_deploys ORDER BY created_at DESC LIMIT ?',
    [n]
  );
  return rows;
}

// ── Notices + Latest Updates (What's New) ──────────────────────────────────
/** Active notices and updates, newest first. */
export async function getNotices() {
  const [rows] = await getPool().query(
    `SELECT id, kind, severity, title, body, created_by, created_at
     FROM ventilator_notices WHERE active = 1 ORDER BY created_at DESC LIMIT 50`
  );
  return rows;
}

/** Create a notice or update entry. */
export async function insertNotice({ kind, severity, title, body, created_by }) {
  const k = ['notice', 'update'].includes(kind) ? kind : 'notice';
  const s = ['info', 'warning', 'success'].includes(severity) ? severity : 'info';
  const [result] = await getPool().execute(
    'INSERT INTO ventilator_notices (kind, severity, title, body, created_by) VALUES (?, ?, ?, ?, ?)',
    [k, s, title, body || null, created_by]
  );
  return result.insertId;
}

/** Retire (deactivate) a notice/update. */
export async function retireNotice(id) {
  await getPool().execute('UPDATE ventilator_notices SET active = 0 WHERE id = ?', [id]);
}

// ── In-memory OTP store (single-instance PM2) ──────────────────────────────
const otpStore = new Map();

export function storeOtp(email, code, ttlSeconds) {
  otpStore.set(email.toLowerCase(), {
    code,
    expires: Date.now() + ttlSeconds * 1000,
    attempts: 0,
  });
}

export function verifyOtp(email, code) {
  const entry = otpStore.get(email.toLowerCase());
  if (!entry) return { ok: false, reason: 'no_otp' };
  if (Date.now() > entry.expires) {
    otpStore.delete(email.toLowerCase());
    return { ok: false, reason: 'expired' };
  }
  entry.attempts++;
  if (entry.code !== code) return { ok: false, reason: 'wrong_code' };
  otpStore.delete(email.toLowerCase());
  return { ok: true };
}




/** Recent USER activity + reported bugs/feedback for the ticker (excludes system notices). */
export async function recentBetaActivity(limit = 5) {
  const n = Math.min(Math.max(parseInt(limit, 10) || 5, 1), 20);
  const [rows] = await getPool().query(
    `SELECT actor, ts, label FROM (
       SELECT (SUBSTRING_INDEX(r.user_email,'@',1) COLLATE utf8mb4_general_ci) AS actor, r.updated_at AS ts,
              (CONCAT('marked ', COALESCE(cs.area,'a'), ' test ', UPPER(r.status)) COLLATE utf8mb4_general_ci) AS label
         FROM ventilator_test_runs r
         LEFT JOIN ventilator_test_cases cs ON cs.test_key = r.test_key
       UNION ALL
       SELECT (SUBSTRING_INDEX(f.user_email,'@',1) COLLATE utf8mb4_general_ci), f.created_at,
              (CONCAT('reported a ', f.feedback_type, COALESCE(CONCAT(' in ', f.area), '')) COLLATE utf8mb4_general_ci)
         FROM ventilator_feedback f
       UNION ALL
       SELECT (SUBSTRING_INDEX(d.user_email,'@',1) COLLATE utf8mb4_general_ci), d.created_at,
              (CONCAT('deployed the calculator (', d.method, ')') COLLATE utf8mb4_general_ci)
         FROM ventilator_deploys d
     ) x
     WHERE ts IS NOT NULL
     ORDER BY ts DESC
     LIMIT ${n}`
  );
  return rows;
}
