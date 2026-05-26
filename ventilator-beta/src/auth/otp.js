import { cfg } from '../config.js';

const EE_SEND_URL = 'https://api.elasticemail.com/v4/emails/transactional';

/** Generate a 6-digit numeric OTP. */
export function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/** Send an OTP to the given email via Elastic Email transactional API. */
export async function sendOtp(email, code) {
  const html = [
    '<div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:32px">',
    '<div style="font-size:13px;font-weight:700;letter-spacing:1px;color:#6c757d;margin-bottom:8px">MOFFITT CONNECT</div>',
    '<h2 style="margin:0 0 24px;font-size:22px;color:#0d1f3c">Your login code</h2>',
    '<div style="background:#f0f4f8;border-radius:8px;padding:24px;text-align:center;margin-bottom:24px">',
    `<span style="font-size:36px;font-weight:700;letter-spacing:8px;color:#0d1f3c;font-family:monospace">${code}</span>`,
    '</div>',
    '<p style="color:#6c757d;font-size:14px;margin:0">This code expires in 5 minutes. If you did not request this, ignore this email.</p>',
    '</div>',
  ].join('');

  const body = {
    Recipients: { To: [email] },
    Content: {
      From:    cfg.EE_FROM,
      ReplyTo: cfg.EE_FROM,
      Subject: 'Moffitt Connect — Your login code',
      Body: [{ ContentType: 'HTML', Content: html }],
    },
  };

  const res = await fetch(EE_SEND_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-ElasticEmail-ApiKey': cfg.EE_API_KEY,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Elastic Email error ${res.status}: ${text}`);
  }
  return res.json();
}
