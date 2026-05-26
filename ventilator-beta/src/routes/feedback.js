import { Router } from 'express';
import { requireAuth, requireVentilatorBeta } from '../auth/middleware.js';
import { insertFeedback } from '../db.js';
import { cfg } from '../config.js';

const router = Router();
const EE_SEND_URL = 'https://api.elasticemail.com/v4/emails/transactional';

const AREAS = ['Heat Load','Airflow','Validation','Vent Type','Louver','Results','PDF Export','Feedback Widget','General'];

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

async function sendAlert({ id, user_email, type, area, description }) {
  const subject = `[Ventilator Beta] New ${type}${area ? ' (' + area + ')' : ''} from ${user_email}`;
  const html = [
    '<div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px">',
    `<h3 style="margin:0 0 16px;color:#0d1f3c">New Feedback #${id}</h3>`,
    `<table style="width:100%;border-collapse:collapse;font-size:14px">`,
    `<tr><td style="padding:8px 0;color:#6c757d;width:120px">From</td><td>${escHtml(user_email)}</td></tr>`,
    `<tr><td style="padding:8px 0;color:#6c757d">Type</td><td>${escHtml(type)}</td></tr>`,
    `<tr><td style="padding:8px 0;color:#6c757d">Area</td><td>${escHtml(area || '—')}</td></tr>`,
    `<tr><td style="padding:8px 0;color:#6c757d;vertical-align:top">Details</td>`,
    `<td style="padding:8px 0;white-space:pre-wrap">${escHtml(description)}</td></tr>`,
    '</table>',
    '<p style="margin:16px 0 0;font-size:13px;color:#6c757d">',
    'View all feedback in connect.moffittcorp.com/admin/users</p></div>',
  ].join('');

  const body = {
    Recipients: { To: cfg.FEEDBACK_NOTIFY },
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

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

export default router;
