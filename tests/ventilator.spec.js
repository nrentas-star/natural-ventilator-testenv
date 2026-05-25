describe('Moffitt Natural Ventilator Selector', () => {

  beforeEach(async () => {
    await browser.url('/');
    await browser.waitUntil(
      async () => (await $('#calc').isExisting()),
      { timeout: 8000, timeoutMsg: 'App did not load' }
    );
  });

  // ── Heat Load Method ────────────────────────────────────────────────────────
  describe('Heat Load Method', () => {
    it('calculates vent length for valid inputs', async () => {
      await $('input[name="method"][value="heat"]').click();
      await $('#heat').setValue('500000');
      await $('#dt').setValue('10');
      await $('#ht').setValue('30');
      await $('#calc').click();
      const result = await $('#r_ventLen').getText();
      expect(result).not.toBe('');
      expect(result).toMatch(/\d+ ft/);
    });

    it('shows CFM in the airflow field after calculation', async () => {
      await $('input[name="method"][value="heat"]').click();
      await $('#heat').setValue('200000');
      await $('#dt').setValue('15');
      await $('#ht').setValue('25');
      await $('#calc').click();
      const cfm = await $('#cfm').getValue();
      expect(Number(cfm.replace(/,/g, ''))).toBeGreaterThan(0);
    });

    it('shows error when heat load is missing', async () => {
      await $('input[name="method"][value="heat"]').click();
      await $('#dt').setValue('10');
      await $('#calc').click();
      const msg = await $('#msg').getText();
      expect(msg).toContain('Heat Load');
    });
  });

  // ── Airflow Method ──────────────────────────────────────────────────────────
  describe('Airflow Method', () => {
    it('calculates vent length for valid CFM input', async () => {
      await $('input[name="method"][value="cfm"]').click();
      await $('#cfm').setValue('5000');
      await $('#dt').setValue('10');
      await $('#ht').setValue('30');
      await $('#calc').click();
      const result = await $('#r_ventLen').getText();
      expect(result).toMatch(/\d+ ft/);
    });

    it('shows error when CFM is missing', async () => {
      await $('input[name="method"][value="cfm"]').click();
      await $('#dt').setValue('10');
      await $('#calc').click();
      const msg = await $('#msg').getText();
      expect(msg).toContain('Airflow');
    });
  });

  // ── Validation ──────────────────────────────────────────────────────────────
  describe('Validation', () => {
    it('shows error when temperature rise is missing', async () => {
      await $('input[name="method"][value="heat"]').click();
      await $('#heat').setValue('100000');
      await $('#calc').click();
      const msg = await $('#msg').getText();
      expect(msg).toContain('temperature rise');
    });

    it('shows error when building height is zero', async () => {
      await $('input[name="method"][value="heat"]').click();
      await $('#heat').setValue('100000');
      await $('#dt').setValue('10');
      await $('#ht').setValue('0');
      await $('#calc').click();
      const msg = await $('#msg').getText();
      expect(msg).toContain('height');
    });

    it('shows vent velocity after valid calculation', async () => {
      await $('input[name="method"][value="heat"]').click();
      await $('#heat').setValue('300000');
      await $('#dt').setValue('12');
      await $('#ht').setValue('28');
      await $('#calc').click();
      const vel = await $('#r_vout').getText();
      expect(vel).toMatch(/\d+ fpm/);
    });

    it('shows louver quantity after valid calculation', async () => {
      await $('input[name="method"][value="heat"]').click();
      await $('#heat').setValue('300000');
      await $('#dt').setValue('12');
      await $('#ht').setValue('28');
      await $('#calc').click();
      const qty = await $('#r_louversNeed').getText();
      expect(qty).toMatch(/\d+ ea/);
    });
  });

  // ── Vent Type Toggle ────────────────────────────────────────────────────────
  describe('Vent Type Toggle', () => {
    it('shows MoffittVent throat size block by default', async () => {
      const block = await $('#moffittWidthBlock');
      expect(await block.isDisplayed()).toBe(true);
    });

    it('hides MoffittVent block and shows MatrixVent when switched', async () => {
      await $('input[name="ventType"][value="MatrixVent"]').click();
      expect(await $('#moffittWidthBlock').isDisplayed()).toBe(false);
      expect(await $('#matrixWidthBlock').isDisplayed()).toBe(true);
    });
  });

  // ── Louver Unit Toggle ──────────────────────────────────────────────────────
  describe('Louver Unit Toggle', () => {
    it('updates label to inches when toggled', async () => {
      await $('#luIn').click();
      const label = await $('#louverSizeLabel').getText();
      expect(label).toContain('in');
    });

    it('updates label back to feet when toggled back', async () => {
      await $('#luIn').click();
      await $('#luFt').click();
      const label = await $('#louverSizeLabel').getText();
      expect(label).toContain('ft');
    });
  });

  // ── Reset Form ──────────────────────────────────────────────────────────────
  describe('Reset', () => {
    it('clears results after reset', async () => {
      await $('input[name="method"][value="heat"]').click();
      await $('#heat').setValue('500000');
      await $('#dt').setValue('10');
      await $('#ht').setValue('30');
      await $('#calc').click();
      await $('#reset').click();
      const result = await $('#r_ventLen').getText();
      expect(result.trim()).toBe('');
    });

    it('clears heat input after reset', async () => {
      await $('#heat').setValue('999999');
      await $('#reset').click();
      const val = await $('#heat').getValue();
      expect(val).toBe('');
    });
  });

  // ── Design Comparison ───────────────────────────────────────────────────────
  describe('Design Comparison', () => {
    it('saves Design A and shows compare section', async () => {
      await $('input[name="method"][value="heat"]').click();
      await $('#heat').setValue('400000');
      await $('#dt').setValue('10');
      await $('#ht').setValue('30');
      await $('#calc').click();
      await $('#saveA').click();
      const section = await $('#compareSection');
      await browser.waitUntil(
        async () => (await section.isDisplayed()),
        { timeout: 4000, timeoutMsg: 'Compare section did not appear' }
      );
      expect(await section.isDisplayed()).toBe(true);
    });
  });

  // ── PDF Export ───────────────────────────────────────────────────────────────
  describe('PDF Export', () => {
    it('Export PDF button exists and is visible', async () => {
      const btn = await $('#exportPdf');
      expect(await btn.isExisting()).toBe(true);
      expect(await btn.isDisplayed()).toBe(true);
    });
  });

  // ── Feedback Widget ──────────────────────────────────────────────────────────
  describe('Feedback Widget', () => {
    it('feedback button is present on the page', async () => {
      const btn = await $('#moff-fb-btn');
      expect(await btn.isExisting()).toBe(true);
    });

    it('clicking feedback button opens the modal', async () => {
      await $('#moff-fb-btn').click();
      const overlay = await $('#moff-fb-overlay');
      await browser.waitUntil(
        async () => (await overlay.getAttribute('class')).includes('open'),
        { timeout: 3000 }
      );
      expect((await overlay.getAttribute('class'))).toContain('open');
    });
  });
});
