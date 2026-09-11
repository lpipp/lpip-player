import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';

async function getCDPPage() {
  const tabs = await new Promise((resolve, reject) => {
    http.get('http://127.0.0.1:9222/json/list', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });
  const page = tabs.find(t => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let msgId = 1;
  const pending = new Map();
  ws.onmessage = (evt) => {
    const msg = JSON.parse(evt.data);
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    }
  };
  await new Promise(r => ws.onopen = r);
  return {
    ws,
    eval: (expr) => new Promise((resolve, reject) => {
      const id = msgId++;
      pending.set(id, (msg) => {
        if (msg.error) reject(msg.error);
        else resolve(msg.result?.result?.value);
      });
      ws.send(JSON.stringify({
        id,
        method: 'Runtime.evaluate',
        params: { expression: expr, returnByValue: true, awaitPromise: true }
      }));
    }),
    close: () => ws.close()
  };
}

async function main() {
  const cdp = await getCDPPage();
  const configHome = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
  const configPath = path.join(configHome, 'lpip-player', 'config.json');

  console.log('=== Step 0: Ensure Running Page Reflects Latest Build ===');
  await cdp.eval(`window.location.reload()`);
  await new Promise(r => setTimeout(r, 600));
  await cdp.eval(`new Promise((resolve) => {
    if (document.readyState === 'complete') resolve(true);
    else window.addEventListener('load', () => resolve(true), { once: true });
  })`);

  console.log('=== Step 1: Open Settings Drawer & Verify Level 1 Typography Card ===');
  await cdp.eval(`(() => {
    const aside = document.querySelector('aside.sidebar-capsule');
    const btns = Array.from(document.querySelectorAll('.capsule-icon-btn'));
    if (!aside?.classList.contains('expanded') && btns[5]) btns[5].click();
    const backBtn = document.querySelector('.settings-back-btn');
    if (backBtn) backBtn.click();
  })()`);
  await new Promise(r => setTimeout(r, 400));

  const overview = await cdp.eval(`(() => {
    const cards = Array.from(document.querySelectorAll('.settings-category-card'));
    const typoCard = cards.find(c => c.textContent.includes('字体与字形'));
    return {
      cardCount: cards.length,
      hasTypoCard: !!typoCard,
      desc: typoCard?.querySelector('.settings-card-desc')?.textContent
    };
  })()`);
  console.log('Overview state:', overview);
  assert.equal(overview.hasTypoCard, true);

  console.log('=== Step 2: Smooth Drill-Down into Level 2 Detail View ===');
  await cdp.eval(`(() => {
    const cards = Array.from(document.querySelectorAll('.settings-category-card'));
    const typoCard = cards.find(c => c.textContent.includes('字体与字形'));
    typoCard?.click();
  })()`);
  await new Promise(r => setTimeout(r, 400));

  const detail = await cdp.eval(`(() => {
    return {
      heroTitle: document.querySelector('.settings-hero-title')?.textContent,
      heroDesc: document.querySelector('.settings-hero-desc')?.textContent,
      hasResetBtn: !!document.querySelector('.settings-reset-btn'),
      hasBackBtn: !!document.querySelector('.settings-back-btn'),
      groups: Array.from(document.querySelectorAll('.settings-group-title')).map(el => el.textContent),
      pillsCount: document.querySelectorAll('.liquid-font-pill').length,
      inputsCount: document.querySelectorAll('.liquid-text-input').length,
      slidersCount: document.querySelectorAll('input[type="range"]').length
    };
  })()`);
  console.log('Detail state:', detail);
  assert.equal(detail.heroTitle, '字体与字形');
  assert.equal(detail.hasResetBtn, true);
  assert.equal(detail.hasBackBtn, true);
  assert.equal(detail.pillsCount >= 14, true);
  assert.equal(detail.inputsCount, 4);
  assert.equal(detail.slidersCount, 4);

  console.log('=== Step 3: Preset Pill Selection & Synchronous CSS Mutation ===');
  const pillResult = await cdp.eval(`(() => {
    const pills = Array.from(document.querySelectorAll('.liquid-font-pill'));
    const interPill = pills.find(p => p.textContent.trim() === '现代黑体');
    if (!interPill) return { error: 'Pill not found' };
    interPill.click();
    return {
      clicked: true,
      domVar: document.documentElement.style.getPropertyValue('--font-family-ui')
    };
  })()`);
  console.log('Pill select result:', pillResult);
  assert.equal(pillResult.clicked, true);
  assert.match(pillResult.domVar, /Inter/);

  console.log('=== Step 4: Rapid Multi-Slider Adjustments (Race Condition Safety) ===');
  const multiSliderResult = await cdp.eval(`(() => {
    const sliders = Array.from(document.querySelectorAll('input[type="range"]'));
    const uiSlider = sliders[0];
    const hintSlider = sliders[1];
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;

    // Consecutive rapid adjustments on two sliders in the same event frame
    nativeInputValueSetter.call(uiSlider, '16');
    uiSlider.dispatchEvent(new Event('input', { bubbles: true }));
    uiSlider.dispatchEvent(new Event('change', { bubbles: true }));

    nativeInputValueSetter.call(hintSlider, '12');
    hintSlider.dispatchEvent(new Event('input', { bubbles: true }));
    hintSlider.dispatchEvent(new Event('change', { bubbles: true }));

    return {
      uiVar: document.documentElement.style.getPropertyValue('--font-size-ui'),
      hintVar: document.documentElement.style.getPropertyValue('--font-size-hint')
    };
  })()`);
  console.log('Multi-slider result:', multiSliderResult);
  assert.equal(multiSliderResult.uiVar, '16px');
  assert.equal(multiSliderResult.hintVar, '12px');

  console.log('=== Step 5: Debounced Atomic Persistence on Disk ===');
  await new Promise(r => setTimeout(r, 700));
  const parsedDisk = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  console.log('Persisted UI & hint config on disk:', { ui: parsedDisk.typography?.ui, hint: parsedDisk.typography?.hint });
  assert.equal(parsedDisk.typography?.ui?.fontSize, 16);
  assert.equal(parsedDisk.typography?.hint?.fontSize, 12);

  console.log('=== Step 6: Text Input with Trailing Semicolon & Unmatched Quotes ===');
  const typingResult = await cdp.eval(`(() => {
    const inputs = Array.from(document.querySelectorAll('.liquid-text-input'));
    const uiInput = inputs[0];
    const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    nativeSetter.call(uiInput, "'JetBrains Mono;");
    uiInput.dispatchEvent(new Event('input', { bubbles: true }));
    uiInput.dispatchEvent(new Event('change', { bubbles: true }));
    uiInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true, cancelable: true }));
    return {
      typed: uiInput.value,
      domVar: document.documentElement.style.getPropertyValue('--font-family-ui')
    };
  })()`);
  console.log('Typing with semicolon/unclosed quote:', typingResult);
  assert.equal(typingResult.domVar, "'JetBrains Mono'");

  await new Promise(r => setTimeout(r, 700));
  const parsedDiskTyping = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  console.log('Persisted sanitized font on disk:', parsedDiskTyping.typography?.ui);
  assert.equal(parsedDiskTyping.typography?.ui?.fontFamily, "'JetBrains Mono'");

  console.log('=== Step 7: Text Input Enter Key Blur & Empty Revert Verification ===');
  const emptyBlurResult = await cdp.eval(`(async () => {
    const inputs = Array.from(document.querySelectorAll('.liquid-text-input'));
    const uiInput = inputs[0];
    uiInput.focus();
    const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    nativeSetter.call(uiInput, '    ');
    uiInput.dispatchEvent(new Event('input', { bubbles: true }));
    uiInput.dispatchEvent(new Event('blur', { bubbles: true }));
    await new Promise(r => setTimeout(r, 100));
    return {
      inputValAfterBlur: uiInput.value,
      domVar: document.documentElement.style.getPropertyValue('--font-family-ui')
    };
  })()`);
  console.log('Empty blur result:', emptyBlurResult);
  // Must revert to the previous valid font 'JetBrains Mono' instead of remaining blank spaces
  assert.equal(emptyBlurResult.inputValAfterBlur, "'JetBrains Mono'");
  assert.equal(emptyBlurResult.domVar, "'JetBrains Mono'");

  console.log('=== Step 7b: Focused Text Input Escape Key Revert to Baseline Font ===');
  const escapeRevertResult = await cdp.eval(`(async () => {
    const inputs = Array.from(document.querySelectorAll('.liquid-text-input'));
    const uiInput = inputs[0];
    uiInput.focus();
    const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    nativeSetter.call(uiInput, 'TempCancelFont');
    uiInput.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise(r => setTimeout(r, 50));
    const valWhileTyping = uiInput.value;

    // Dispatch Escape key directly on the focused input
    const escEvent = new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true, cancelable: true });
    uiInput.dispatchEvent(escEvent);
    await new Promise(r => setTimeout(r, 150));

    const isLevel2 = Boolean(document.querySelector('.settings-hero-header'));
    return {
      valWhileTyping,
      inputValAfterEscape: uiInput.value,
      domVar: document.documentElement.style.getPropertyValue('--font-family-ui'),
      isLevel2
    };
  })()`);
  console.log('Escape revert result:', escapeRevertResult);
  assert.equal(escapeRevertResult.valWhileTyping, 'TempCancelFont');
  assert.equal(escapeRevertResult.inputValAfterEscape, "'JetBrains Mono'");
  assert.equal(escapeRevertResult.domVar, "'JetBrains Mono'");
  assert.equal(escapeRevertResult.isLevel2, true);

  console.log('=== Step 8: Esc Key Drill-Up Navigation ===');
  await cdp.eval(`(() => {
    const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    window.dispatchEvent(event);
  })()`);
  await new Promise(r => setTimeout(r, 400));
  const backOverview = await cdp.eval(`(() => {
    const cards = Array.from(document.querySelectorAll('.settings-category-card'));
    const typoCard = cards.find(c => c.textContent.includes('字体与字形'));
    return {
      isOverview: cards.length > 0,
      desc: typoCard?.querySelector('.settings-card-desc')?.textContent
    };
  })()`);
  console.log('Back overview result:', backOverview);
  assert.equal(backOverview.isOverview, true);

  console.log('=== Step 9: Reset to Default Configuration ===');
  await cdp.eval(`(() => {
    const cards = Array.from(document.querySelectorAll('.settings-category-card'));
    const typoCard = cards.find(c => c.textContent.includes('字体与字形'));
    typoCard?.click();
  })()`);
  await new Promise(r => setTimeout(r, 400));

  const resetResult = await cdp.eval(`(() => {
    const resetBtn = document.querySelector('.settings-reset-btn');
    if (!resetBtn) return { error: 'No reset button' };
    resetBtn.click();
    return {
      clicked: true,
      uiFontVar: document.documentElement.style.getPropertyValue('--font-family-ui'),
      uiSizeVar: document.documentElement.style.getPropertyValue('--font-size-ui'),
      hintSizeVar: document.documentElement.style.getPropertyValue('--font-size-hint'),
      lyricsBodySizeVar: document.documentElement.style.getPropertyValue('--font-size-lyrics-body'),
      lyricsSizeVar: document.documentElement.style.getPropertyValue('--font-size-lyrics')
    };
  })()`);
  console.log('Reset result:', resetResult);
  assert.equal(resetResult.clicked, true);
  assert.match(resetResult.uiFontVar, /system-ui/);
  assert.equal(resetResult.uiSizeVar, '13px');
  assert.equal(resetResult.hintSizeVar, '12px');
  assert.equal(resetResult.lyricsBodySizeVar, '18px');
  assert.equal(resetResult.lyricsSizeVar, '18px');

  await new Promise(r => setTimeout(r, 700));
  const parsedDiskReset = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  console.log('Persisted UI config after reset:', parsedDiskReset.typography?.ui);
  assert.match(parsedDiskReset.typography?.ui?.fontFamily, /system-ui/);
  assert.equal(parsedDiskReset.typography?.ui?.fontSize, 13);
  assert.equal(parsedDiskReset.typography?.hint?.fontSize, 12);

  console.log('=== Step 10: Multi-Control Hint & Lyrics Empty Blur & Escape Verification ===');
  // Ensure sidebar is expanded (Step 8 Escape may have collapsed it)
  await cdp.eval(`(() => {
    const aside = document.querySelector('aside.sidebar-capsule');
    const btns = Array.from(document.querySelectorAll('.capsule-icon-btn'));
    if (aside && !aside.classList.contains('expanded') && btns[5]) btns[5].click();
  })()`);
  await new Promise(r => setTimeout(r, 400));

  // 10a: Hint input empty blur
  const hintBlurResult = await cdp.eval(`(async () => {
    const inputs = Array.from(document.querySelectorAll('.liquid-text-input'));
    const hintInput = inputs[1]; // Hint font input
    hintInput.focus();
    const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    nativeSetter.call(hintInput, "'Cascadia Code;");
    hintInput.dispatchEvent(new Event('input', { bubbles: true }));
    hintInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true, cancelable: true }));

    // Empty blur test on hintInput
    hintInput.focus();
    nativeSetter.call(hintInput, '     ');
    hintInput.dispatchEvent(new Event('input', { bubbles: true }));
    hintInput.dispatchEvent(new Event('blur', { bubbles: true }));
    await new Promise(r => setTimeout(r, 100));

    return {
      hintValAfterBlur: hintInput.value,
      domVar: document.documentElement.style.getPropertyValue('--font-family-hint')
    };
  })()`);
  console.log('Hint blur result:', hintBlurResult);
  assert.equal(hintBlurResult.hintValAfterBlur, "'Cascadia Code'");
  assert.equal(hintBlurResult.domVar, "'Cascadia Code'");

  // 10b: Lyrics body Escape cancellation test
  const lyricsEscResult = await cdp.eval(`(async () => {
    const inputs = Array.from(document.querySelectorAll('.liquid-text-input'));
    const lyricsBodyInput = inputs[2]; // Lyrics body font input
    lyricsBodyInput.focus();
    const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    nativeSetter.call(lyricsBodyInput, 'TempLyricsCancelFont');
    lyricsBodyInput.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise(r => setTimeout(r, 50));

    const escEvent = new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true, cancelable: true });
    lyricsBodyInput.dispatchEvent(escEvent);
    await new Promise(r => setTimeout(r, 150));

    const isLevel2 = Boolean(document.querySelector('.settings-hero-header'));
    return {
      valAfterEsc: lyricsBodyInput.value,
      domVar: document.documentElement.style.getPropertyValue('--font-family-lyrics-body'),
      isLevel2
    };
  })()`);
  console.log('Lyrics Escape result:', lyricsEscResult);
  assert.notEqual(lyricsEscResult.valAfterEsc, 'TempLyricsCancelFont');
  assert.notEqual(lyricsEscResult.domVar, 'TempLyricsCancelFont');
  assert.equal(lyricsEscResult.isLevel2, true);

  // Clean up: Reset back to default
  await cdp.eval(`(() => {
    const resetBtn = document.querySelector('.settings-reset-btn');
    resetBtn?.click();
  })()`);
  await new Promise(r => setTimeout(r, 400));

  await verifyMin12Floor(cdp);

  await verifySettingsLinkage(cdp);

  // 联动验证后复位，保持用户配置干净
  await cdp.eval(`(() => {
    document.querySelector('.settings-reset-btn')?.click();
  })()`);
  await new Promise(r => setTimeout(r, 700));

  cdp.close();
  console.log('=== All E2E Tests Completed Successfully ===');
}

// Step 11: 全局最小 12px 托底 (低 PPI 可读性铁律)
// 扫描悬浮面板六组件 computed font-size，任一文本节点渲染值不得 < 12px
async function verifyMin12Floor(cdp) {
  console.log('=== Step 11: Global 12px Minimum Floor (Low-PPI Legibility) ===');
  const result = await cdp.eval(`(() => {
    const scope = document.querySelector('aside.sidebar-capsule') || document.body;
    const walker = document.createTreeWalker(scope, NodeFilter.SHOW_ELEMENT);
    const bad = [];
    let el = walker.nextNode();
    while (el) {
      const cs = getComputedStyle(el);
      // 仅检查真实文本节点宿主：有直接文本子节点且非隐藏元素
      const hasText = Array.from(el.childNodes).some(
        n => n.nodeType === Node.TEXT_NODE && n.textContent.trim().length > 0
      );
      if (hasText && cs.visibility !== 'hidden' && cs.display !== 'none') {
        const px = parseFloat(cs.fontSize);
        if (Number.isFinite(px) && px < 12 - 1e-6) {
          bad.push(el.className?.toString?.().slice(0, 60) + ' = ' + cs.fontSize);
          if (bad.length >= 10) break;
        }
      }
      el = walker.nextNode();
    }
    return { badCount: bad.length, bad };
  })()`);
  console.log('Min-12 floor scan:', result);
  assert.equal(result.badCount, 0);
}

// Step 12: 设置↔界面联动 (分层映射: ui/hint 滑条驱动全部文字同步缩放)
// 验收: ui 13→18 时正文/标题行 computed 同步放大; hint 12→16 时徽标/副行同步放大;
// 回到 ui 13/hint 12 后全部文字恢复基线; 全程 <12px=0
async function verifySettingsLinkage(cdp) {
  console.log('=== Step 12: Settings-to-UI Linkage (Layered Mapping) ===');
  const result = await cdp.eval(`(async () => {
    const sliders = Array.from(document.querySelectorAll('input[type="range"]'));
    const uiSlider = sliders[0];
    const hintSlider = sliders[1];
    const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    const fire = (el, v) => {
      set.call(el, String(v));
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    };
    const cs = (sel) => {
      const el = document.querySelector(sel);
      return el ? parseFloat(getComputedStyle(el).fontSize) : NaN;
    };
    // 基线快照 (ui=13/hint=12): 设置页自身 ui 层标签 + hint 层滑条数值 + 分组标题
    const base = {
      settingsLabel: cs('.settings-control-label'),
      hintValue: cs('.liquid-slider-value'),
      groupTitle: cs('.settings-group-title')
    };
    // 放大: ui 18 / hint 16
    fire(uiSlider, 18);
    fire(hintSlider, 16);
    await new Promise(r => setTimeout(r, 600));
    const grown = {
      settingsLabel: cs('.settings-control-label'),
      hintValue: cs('.liquid-slider-value'),
      groupTitle: cs('.settings-group-title'),
      uiVar: document.documentElement.style.getPropertyValue('--font-size-ui'),
      hintVar: document.documentElement.style.getPropertyValue('--font-size-hint')
    };
    // 恢复基线
    fire(uiSlider, 13);
    fire(hintSlider, 12);
    await new Promise(r => setTimeout(r, 600));
    const restored = {
      settingsLabel: cs('.settings-control-label'),
      hintValue: cs('.liquid-slider-value'),
      groupTitle: cs('.settings-group-title')
    };
    // 全量 <12px 扫描
    const walker = document.createTreeWalker(document.querySelector('aside.sidebar-capsule') || document.body, NodeFilter.SHOW_ELEMENT);
    const bad = [];
    let el = walker.nextNode();
    while (el) {
      const hasText = Array.from(el.childNodes).some(n => n.nodeType === Node.TEXT_NODE && n.textContent.trim().length > 0);
      if (hasText) {
        const st = getComputedStyle(el);
        if (st.visibility !== 'hidden' && st.display !== 'none') {
          const px = parseFloat(st.fontSize);
          if (Number.isFinite(px) && px < 12 - 1e-6) { bad.push(el.className?.toString?.().slice(0, 50) + ' = ' + st.fontSize); if (bad.length >= 10) break; }
        }
      }
      el = walker.nextNode();
    }
    return { base, grown, restored, badCount: bad.length, bad };
  })()`);
  console.log('Linkage result:', result);
  assert.equal(result.grown.uiVar, '18px');
  assert.equal(result.grown.hintVar, '16px');
  assert.ok(result.grown.settingsLabel > result.base.settingsLabel, '设置页自身 ui 标签应随 ui 滑条放大');
  assert.ok(result.grown.hintValue > result.base.hintValue, '设置页滑条数值(hint 层)应随 hint 滑条放大');
  assert.ok(result.grown.groupTitle >= result.base.groupTitle, '设置页分组标题应随 ui 滑条联动');
  assert.equal(result.restored.settingsLabel, result.base.settingsLabel);
  assert.equal(result.restored.hintValue, result.base.hintValue);
  assert.equal(result.badCount, 0);
}

main().catch((err) => {
  console.error('E2E Test Failed:', err);
  process.exit(1);
});
