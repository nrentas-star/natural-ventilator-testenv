import { Router } from 'express';
import { requireAuth, requireVentilatorBeta } from '../auth/middleware.js';
import { insertFeedback, getFeedbackById, getFeedbackResponses, insertFeedbackResponse } from '../db.js';
import { signFeedbackToken, verifyFeedbackToken } from '../auth/tokens.js';
import { cfg } from '../config.js';

const router = Router();
const EE_SEND_URL = 'https://api.elasticemail.com/v4/emails/transactional';
const BASE_URL = 'https://tools.moffittcorp.com';

const AREAS = ['Heat Load','Airflow','Validation','Vent Type','Louver','Results','PDF Export','Feedback Widget','General'];

// ── Submit feedback (auth-guarded) ──────────────────────────────────────────
router.post('/feedback', requireAuth, requireVentilatorBeta, async (req, res) => {
  const { feedback_type, area, description, form_state } = req.body;
  const user_email = req.user.email;

  const type = ['bug', 'suggestion', 'question', 'other'].includes(feedback_type)
    ? feedback_type : 'other';
  const cleanArea = AREAS.includes(area) ? area : null;

  if (!description || String(description).trim().length < 3) {
    return res.status(400).json({ ok: false, error: 'Description required' });
  }

  let id;
  try {
    id = await insertFeedback({ user_email, feedback_type: type, area: cleanArea, description, form_state });
  } catch (err) {
    console.error('[feedback] DB error:', err.message);
    return res.status(500).json({ ok: false, error: 'Could not save feedback' });
  }

  sendAlert({ id, user_email, type, area: cleanArea, description }).catch(e =>
    console.error('[feedback] alert email error:', e.message)
  );

  res.json({ ok: true, id });
});

// ── One-click respond page (public, token-gated) ────────────────────────────
router.get('/feedback/respond', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  const p = verifyFeedbackToken(req.query.t);
  if (!p) {
    return res.status(400).send(pageShell('Link expired',
      '<p>This response link is invalid or has expired. Open the Ventilator beta panel to respond instead.</p>'));
  }
  let fb, responses;
  try {
    fb = await getFeedbackById(p.fid);
    responses = await getFeedbackResponses(p.fid);
  } catch (e) {
    console.error('[feedback] respond load error:', e.message);
    return res.status(500).send(pageShell('Error', '<p>Could not load that feedback item.</p>'));
  }
  if (!fb) return res.status(404).send(pageShell('Not found', '<p>That feedback item no longer exists.</p>'));
  res.send(respondPage({ fb, responses, token: req.query.t, responder: p.email }));
});

// ── Store a response (public, token-gated) ──────────────────────────────────
router.post('/feedback/respond', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  const { t, body } = req.body;
  const p = verifyFeedbackToken(t);
  if (!p) {
    return res.status(400).send(pageShell('Link expired',
      '<p>This response link is invalid or has expired.</p>'));
  }
  const text = String(body || '').trim();
  if (text.length < 2) {
    return res.status(400).send(pageShell('Empty response',
      '<p>Please enter a response, then go back and submit again.</p>'));
  }

  try {
    await insertFeedbackResponse({ feedback_id: p.fid, responder_email: p.email, body: text, source: 'email' });
    console.log(`[feedback] response stored: fid=${p.fid} by=${p.email} chars=${text.length}`);
  } catch (e) {
    console.error('[feedback] response DB error:', e.message);
    return res.status(500).send(pageShell('Error', '<p>Could not save your response. Please try again.</p>'));
  }

  notifyResponse({ fid: p.fid, responder: p.email, body: text }).catch(e =>
    console.error('[feedback] notifyResponse error:', e.message));

  res.send(pageShell('Response recorded',
    `<p>Thanks &mdash; your response to feedback #${escHtml(String(p.fid))} has been recorded and now shows as a note on the Ventilator portal.</p>`
    + '<p style="color:#6c757d;font-size:13px;margin-top:14px">You can close this window.</p>'));
});

// ── Email: new-feedback alert with a personalized respond link per recipient ─
async function sendAlert({ id, user_email, type, area, description }) {
  const subject = `[Ventilator Beta] New ${type}${area ? ' (' + area + ')' : ''} from ${user_email}`;
  const recipients = String(cfg.FEEDBACK_NOTIFY || '')
    .split(',').map(s => s.trim()).filter(Boolean);
  if (!recipients.length) return;

  for (const to of recipients) {
    const token = signFeedbackToken({ fid: id, email: to });
    const respondUrl = `${BASE_URL}/feedback/respond?t=${encodeURIComponent(token)}`;
    const html = buildAlertHtml({ id, user_email, type, area, description, respondUrl });
    try {
      await sendOne(to, subject, html);
    } catch (e) {
      console.error(`[feedback] send to ${to} failed:`, e.message);
    }
  }
}

function buildAlertHtml({ id, user_email, type, area, description, respondUrl }) {
  return [
    '<div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px">',
    `<h3 style="margin:0 0 16px;color:#0d1f3c">New Feedback #${id}</h3>`,
    '<table style="width:100%;border-collapse:collapse;font-size:14px">',
    `<tr><td style="padding:8px 0;color:#6c757d;width:120px">From</td><td>${escHtml(user_email)}</td></tr>`,
    `<tr><td style="padding:8px 0;color:#6c757d">Type</td><td>${escHtml(type)}</td></tr>`,
    `<tr><td style="padding:8px 0;color:#6c757d">Area</td><td>${escHtml(area || '—')}</td></tr>`,
    '<tr><td style="padding:8px 0;color:#6c757d;vertical-align:top">Details</td>',
    `<td style="padding:8px 0;white-space:pre-wrap">${escHtml(description)}</td></tr>`,
    '</table>',
    `<a href="${respondUrl}" style="display:inline-block;margin:18px 0 6px;background:#e07c24;color:#fff;text-decoration:none;font-weight:600;padding:11px 20px;border-radius:8px;font-size:14px">Respond to this feedback</a>`,
    '<p style="margin:10px 0 0;font-size:12px;color:#6c757d">Your reply is stored against this item and shown as a note on the Ventilator portal. Replying to this email directly will not be recorded.</p>',
    '</div>',
  ].join('');
}

// ── Email: notify reviewers that a response was added ───────────────────────
async function notifyResponse({ fid, responder, body }) {
  const recipients = String(cfg.FEEDBACK_NOTIFY || '')
    .split(',').map(s => s.trim()).filter(Boolean);
  if (!recipients.length) return;
  const subject = `[Ventilator Beta] Response added to feedback #${fid}`;
  const html = [
    '<div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px">',
    `<h3 style="margin:0 0 12px;color:#0d1f3c">Response on feedback #${escHtml(String(fid))}</h3>`,
    `<p style="font-size:14px;margin:0 0 6px"><b>${escHtml(responder)}</b> wrote:</p>`,
    `<div style="background:#f8fafc;border:1px solid #e5e9f0;border-radius:8px;padding:12px;white-space:pre-wrap;font-size:14px">${escHtml(body)}</div>`,
    '<p style="margin:16px 0 0;font-size:12px;color:#6c757d">View the full thread in the Ventilator beta panel.</p>',
    '</div>',
  ].join('');
  await sendBulk(recipients, subject, html);
}

// ── Elastic Email helpers ───────────────────────────────────────────────────
async function sendOne(to, subject, html) {
  return eeSend({ To: [to] }, subject, html);
}
async function sendBulk(toList, subject, html) {
  return eeSend({ To: toList }, subject, html);
}
async function eeSend(recipients, subject, html) {
  const body = {
    Recipients: recipients,
    Content: {
      From: cfg.EE_FROM, ReplyTo: cfg.EE_FROM, Subject: subject,
      Body: [{ ContentType: 'HTML', Content: html }],
    },
  };
  const r = await fetch(EE_SEND_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-ElasticEmail-ApiKey': cfg.EE_API_KEY },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`EE ${r.status}`);
}

// ── Public-page HTML ────────────────────────────────────────────────────────
function respondPage({ fb, responses, token, responder }) {
  const thread = (responses || []).map(r =>
    `<div style="border-top:1px solid #eef2f7;padding:10px 0"><div style="font-size:12px;color:#6c757d">${escHtml(r.responder_email)} &middot; ${escHtml(String(r.created_at).slice(0,16).replace('T',' '))}</div><div style="white-space:pre-wrap;font-size:14px;margin-top:3px">${escHtml(r.body)}</div></div>`
  ).join('');
  const resolved = fb.resolved
    ? `<div style="background:#e7f6ec;color:#16a34a;border-radius:8px;padding:8px 12px;font-size:13px;margin:10px 0">Resolved${fb.solution ? ': ' + escHtml(fb.solution) : ''}</div>`
    : '';
  const inner = [
    `<div style="font-size:12px;color:#6c757d;text-transform:uppercase;letter-spacing:.5px">Feedback #${escHtml(String(fb.id))} &middot; ${escHtml(fb.feedback_type)}${fb.area ? ' &middot; ' + escHtml(fb.area) : ''}</div>`,
    `<div style="white-space:pre-wrap;font-size:15px;color:#0d1f3c;margin:8px 0 4px">${escHtml(fb.description)}</div>`,
    `<div style="font-size:12px;color:#9aa4b2">from ${escHtml(fb.user_email)}</div>`,
    resolved,
    thread ? `<div style="margin-top:14px"><div style="font-size:12px;font-weight:600;color:#475467">Responses</div>${thread}</div>` : '',
    `<form method="POST" action="/feedback/respond" style="margin-top:18px">`,
    `<input type="hidden" name="t" value="${escHtml(token)}">`,
    `<label style="display:block;font-size:13px;color:#475467;margin-bottom:6px">Your response (as ${escHtml(responder)})</label>`,
    `<textarea name="body" required rows="5" style="width:100%;box-sizing:border-box;border:1.5px solid #e5e9f0;border-radius:10px;padding:11px;font-family:inherit;font-size:14px" placeholder="Type your response..."></textarea>`,
    `<button type="submit" style="margin-top:12px;background:#e07c24;color:#fff;border:none;cursor:pointer;font-family:inherit;font-weight:600;font-size:14px;padding:11px 22px;border-radius:8px">Submit response</button>`,
    `</form>`,
  ].join('');
  return pageShell(`Respond to feedback #${fb.id}`, inner);
}

function pageShell(title, inner) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">`
    + `<meta name="viewport" content="width=device-width,initial-scale=1">`
    + `<title>${escHtml(title)} &middot; Ventilator Beta</title>`
    + `<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700&display=swap" rel="stylesheet">`
    + `<style>body{margin:0;background:#fff;font-family:'Montserrat','Helvetica Neue',Helvetica,Arial,sans-serif;font-weight:300;color:#003055;font-size:16px;line-height:24px;-webkit-font-smoothing:antialiased}`
    + `.wrap{max-width:640px;margin:48px auto;padding:0 20px}`
    + `.card{background:#fff;border:1px solid #e2e4e6;border-top:4px solid #57cef6;border-radius:5px;padding:32px;box-shadow:0 4px 12px rgba(0,48,85,.08)}`
    + `.hd{display:flex;align-items:center;gap:14px;margin:0 0 24px 0;padding-bottom:18px;border-bottom:1px solid #e2e4e6}`
    + `.hd img{height:44px;width:auto;display:block}`
    + `.hd-title{font-family:'Montserrat',sans-serif;font-size:14px;font-weight:600;color:#003055;text-transform:uppercase;letter-spacing:.12em;padding-left:14px;border-left:2px solid #57cef6;line-height:1.3}`
    + `p{font-size:15px;color:#003055;line-height:1.6;margin-bottom:12px;font-weight:300}`
    + `</style></head><body><div class="wrap"><div class="card"><div class="hd"><img src="https://connect.moffittcorp.com/static/logo" alt="Moffitt"><div class="hd-title">Natural Ventilator Selector<br>Beta</div></div>`
    + inner + `</div></div></body></html>`;
}

function escHtml(s) {
  return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

export default router;
