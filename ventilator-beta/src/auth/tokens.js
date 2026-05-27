import jwt from 'jsonwebtoken';
import { cfg } from '../config.js';

/** Sign a portal session JWT (30-day expiry). */
export function signPortalJwt(payload) {
  return jwt.sign(payload, cfg.JWT_SECRET, { expiresIn: '30d', issuer: 'tools.moffittcorp.com' });
}

/** Verify and decode a portal JWT. Returns payload or null on failure. */
export function verifyPortalJwt(token) {
  try {
    return jwt.verify(token, cfg.JWT_SECRET, { issuer: 'tools.moffittcorp.com' });
  } catch {
    return null;
  }
}


/** Sign a one-click feedback-response token (60-day expiry). */
export function signFeedbackToken({ fid, email }) {
  return jwt.sign({ fid, email, purpose: 'fb-respond' }, cfg.JWT_SECRET, { expiresIn: '60d', issuer: 'tools.moffittcorp.com' });
}

/** Verify a feedback-response token. Returns { fid, email } or null. */
export function verifyFeedbackToken(token) {
  try {
    const p = jwt.verify(token, cfg.JWT_SECRET, { issuer: 'tools.moffittcorp.com' });
    return (p && p.purpose === 'fb-respond') ? p : null;
  } catch {
    return null;
  }
}
