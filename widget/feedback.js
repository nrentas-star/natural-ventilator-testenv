(function () {
  // ── Styles ──────────────────────────────────────────────────────────────────
  const style = document.createElement('style');
  style.textContent = `
    #moff-fb-btn{position:fixed;bottom:22px;right:22px;z-index:9999;background:#00589a;color:#fff;border:none;border-radius:999px;padding:10px 18px;font-size:14px;font-weight:700;cursor:pointer;box-shadow:0 4px 14px rgba(0,88,154,.35)}
    #moff-fb-btn:hover{background:#004f8a}
    #moff-fb-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:10000;align-items:center;justify-content:center}
    #moff-fb-overlay.open{display:flex}
    #moff-fb-modal{background:#fff;border-radius:14px;padding:28px;width:min(92vw,480px);box-shadow:0 20px 60px rgba(0,0,0,.25);font-family:system-ui,sans-serif}
    #moff-fb-modal h3{margin:0 0 16px;font-size:17px;color:#00589a}
    #moff-fb-modal label{display:block;font-size:13px;color:#555;margin:12px 0 4px}
    #moff-fb-modal input,#moff-fb-modal select,#moff-fb-modal textarea{width:100%;box-sizing:border-box;padding:9px 11px;border:1px solid #c5cfdd;border-radius:8px;font-size:14px;font-family:inherit}
    #moff-fb-modal textarea{height:100px;resize:vertical}
    .moff-fb-row{display:flex;gap:10px;margin-top:16px}
    #moff-fb-submit{flex:1;background:#00589a;color:#fff;border:none;border-radius:8px;padding:10px;font-weight:700;cursor:pointer;font-size:14px}
    #moff-fb-submit:hover{background:#004f8a}
    #moff-fb-cancel{background:#f0f4f9;color:#333;border:1px solid #c5cfdd;border-radius:8px;padding:10px 16px;cursor:pointer;font-size:14px}
    #moff-fb-status{font-size:13px;margin-top:10px;min-height:18px;color:#2e7d32}
  `;
  document.head.appendChild(style);

  // ── Button ───────────────────────────────────────────────────────────────────
  const btn = document.createElement('button');
  btn.id = 'moff-fb-btn';
  btn.textContent = '💬 Feedback';
  document.body.appendChild(btn);

  // ── Modal ────────────────────────────────────────────────────────────────────
  const overlay = document.createElement('div');
  overlay.id = 'moff-fb-overlay';
  overlay.innerHTML = `
    <div id="moff-fb-modal">
      <h3>Submit Feedback</h3>
      <label>Your Name</label>
      <input id="moff-name" type="text" placeholder="e.g. Lisandri Neziraj"/>
      <label>Type</label>
      <select id="moff-type">
        <option value="bug">🐛 Bug</option>
        <option value="suggestion">💡 Suggestion</option>
        <option value="question">❓ Question</option>
        <option value="general">📝 General Note</option>
      </select>
      <label>Description</label>
      <textarea id="moff-desc" placeholder="Describe what you found or what you'd like to see..."></textarea>
      <div class="moff-fb-row">
        <button id="moff-fb-submit">Submit</button>
        <button id="moff-fb-cancel">Cancel</button>
      </div>
      <div id="moff-fb-status"></div>
    </div>
  `;
  document.body.appendChild(overlay);

  // ── Capture current form state ────────────────────────────────────────────
  function captureFormState() {
    const state = {};
    const getVal = id => { const el = document.getElementById(id); return el ? el.value : null; };
    const getChecked = name => { const el = document.querySelector(`input[name="${name}"]:checked`); return el ? el.value : null; };
    state.method      = getChecked('method');
    state.heat        = getVal('heat');
    state.cfm         = getVal('cfm');
    state.dt          = getVal('dt');
    state.ht          = getVal('ht');
    state.ventType    = getChecked('ventType');
    state.ventWidth   = getChecked('moffittWPreset');
    state.ventQty     = getChecked('nexhPreset');
    state.louverType  = getChecked('inletTypeToggle');
    state.louverSize  = getVal('louverSize');
    state.louverUnit  = getChecked('louverUnit');
    state.results = {
      ventLen:    document.getElementById('r_ventLen')    ? document.getElementById('r_ventLen').textContent.trim()    : null,
      ventVel:    document.getElementById('r_vout')       ? document.getElementById('r_vout').textContent.trim()       : null,
      louverQty:  document.getElementById('r_louversNeed')? document.getElementById('r_louversNeed').textContent.trim(): null,
      louverVel:  document.getElementById('r_louverVel')  ? document.getElementById('r_louverVel').textContent.trim()  : null,
    };
    return state;
  }

  // ── Events ────────────────────────────────────────────────────────────────
  btn.addEventListener('click', () => overlay.classList.add('open'));
  document.getElementById('moff-fb-cancel').addEventListener('click', () => overlay.classList.remove('open'));
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.classList.remove('open'); });

  document.getElementById('moff-fb-submit').addEventListener('click', async () => {
    const status = document.getElementById('moff-fb-status');
    const desc = document.getElementById('moff-desc').value.trim();
    if (!desc) { status.style.color = '#c62828'; status.textContent = 'Please enter a description.'; return; }

    status.style.color = '#555';
    status.textContent = 'Sending...';

    try {
      const res = await fetch('/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:      document.getElementById('moff-name').value.trim() || 'Anonymous',
          type:      document.getElementById('moff-type').value,
          description: desc,
          formState: captureFormState()
        })
      });
      if (res.ok) {
        status.style.color = '#2e7d32';
        status.textContent = '✓ Submitted — thank you!';
        document.getElementById('moff-desc').value = '';
        setTimeout(() => overlay.classList.remove('open'), 1400);
      } else {
        status.style.color = '#c62828';
        status.textContent = 'Server error. Try again.';
      }
    } catch {
      status.style.color = '#c62828';
      status.textContent = 'Could not reach server. Check connection.';
    }
  });
})();
