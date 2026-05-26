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
