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
