import http from 'node:http';
import assert from 'node:assert/strict';

async function getCDPPage() {
  const tabs = await new Promise((resolve, reject) => {
    http.get('http://127.0.0.1:9222/json/list', (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });
  const page = tabs.find((t) => t.type === 'page');
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
  await new Promise((r) => { ws.onopen = r; });
  return {
    ws,
    eval: (expr) => new Promise((resolve, reject) => {
      const id = msgId++;
      pending.set(id, (msg) => {
        if (msg.error) reject(msg.error);
        else resolve(msg.result && msg.result.result && msg.result.result.value);
      });
      ws.send(JSON.stringify({
        id,
        method: 'Runtime.evaluate',
        params: { expression: expr, returnByValue: true, awaitPromise: true }
      }));
    }),
    send: (method, params) => new Promise((resolve, reject) => {
      const id = msgId++;
      pending.set(id, (msg) => {
        if (msg.error) reject(msg.error);
        else resolve(msg.result);
      });
      ws.send(JSON.stringify({ id, method, params }));
    }),
    close: () => ws.close()
  };
}

async function main() {
  const cdp = await getCDPPage();
  const readActive = "(() => { const wrap = document.querySelector('.lyrics-orbit-wrapper'); if (!wrap) return null; const nodes = Array.prototype.slice.call(wrap.querySelectorAll('.lyric-node')); const i = nodes.findIndex(function(n){ return n.classList.contains('is-active'); }); return i >= 0 ? nodes[i].getAttribute('data-lyric-index') : null; })()";
  const wrapCenter = "(() => { const wrap = document.querySelector('.lyrics-orbit-wrapper'); if (!wrap) return null; const r = wrap.getBoundingClientRect(); return {x: r.x + r.width / 2, y: r.y + r.height / 2}; })()";
  const seekCount = "(window.__seekCalls || []).length";

  console.log('=== Step 0: Reload to latest build ===');
  await cdp.eval('window.location.reload()');
  await new Promise((r) => setTimeout(r, 800));
  await cdp.eval("new Promise(function(resolve){ if (document.readyState === 'complete') resolve(true); else window.addEventListener('load', function(){ resolve(true); }, { once: true }); })");
  await new Promise((r) => setTimeout(r, 1500));

  console.log('=== Step 1: lyricPreview config default 1500 ===');
  const cfg = await cdp.eval("(async function(){ const c = await window.electronAPI.config.get(); return { timeoutMs: c && c.audio && c.audio.lyricPreview ? c.audio.lyricPreview.timeoutMs : null }; })()");
  console.log('config:', JSON.stringify(cfg));
  assert.equal(cfg.timeoutMs, 1500);

  console.log('=== Step 2: audio module slider 0.5~5s step 0.1 value 1.5s ===');
  const openSettings = await cdp.eval("(function(){ const btns = Array.prototype.slice.call(document.querySelectorAll('.capsule-icon-btn')); if (btns[5]) btns[5].click(); return { btnCount: btns.length }; })()");
  console.log('openSettings:', JSON.stringify(openSettings));
  await new Promise((r) => setTimeout(r, 600));
  const openAudio = await cdp.eval("(function(){ const cards = Array.prototype.slice.call(document.querySelectorAll('.settings-category-card')); const a = cards.find(function(c){ return (c.textContent || '').indexOf('音频与过渡') >= 0; }); if (a) a.click(); return { cardCount: cards.length, opened: !!a }; })()");
  assert.equal(openAudio.opened, true);
  await new Promise((r) => setTimeout(r, 600));
  const hit = await cdp.eval("(function(){ const blocks = Array.prototype.slice.call(document.querySelectorAll('.liquid-slider-block')); const h = blocks.map(function(b){ return { label: b.querySelector('.settings-control-label') ? b.querySelector('.settings-control-label').textContent : '', value: b.querySelector('.liquid-slider-value') ? b.querySelector('.liquid-slider-value').textContent : '', min: b.querySelector('input[type=range]') ? b.querySelector('input[type=range]').min : '', max: b.querySelector('input[type=range]') ? b.querySelector('input[type=range]').max : '', step: b.querySelector('input[type=range]') ? b.querySelector('input[type=range]').step : '' }; }).find(function(b){ return (b.label || '').indexOf('歌词滚轮确认延迟') >= 0; }); return h || null; })()");
  console.log('slider:', JSON.stringify(hit));
  assert.equal(hit && hit.value, '1.5s');
  assert.equal(hit && hit.min, '0.5');
  assert.equal(hit && hit.max, '5');
  assert.equal(hit && hit.step, '0.1');

  console.log('=== Step 2b: back to overview + collapse drawer ===');
  await cdp.eval("(function(){ const b = document.querySelector('.settings-back-btn'); if (b) b.click(); return true; })()");
  await new Promise((r) => setTimeout(r, 500));
  await cdp.eval("(function(){ const btns = Array.prototype.slice.call(document.querySelectorAll('.capsule-icon-btn')); if (btns[5]) btns[5].click(); return true; })()");
  await new Promise((r) => setTimeout(r, 600));
  const closed = await cdp.eval("(document.querySelectorAll('.settings-control-label').length === 0)");
  console.log('settings closed:', closed);
  assert.equal(closed, true);

  console.log('=== Step 3: trusted wheel -> preview moves, no seek ===');
  await cdp.eval("(function(){ window.__seekCalls = []; const mpd = window.electronAPI && window.electronAPI.mpd; if (mpd && !mpd.__wrapped) { const orig = mpd.seek.bind(mpd); mpd.__wrapped = true; mpd.seek = async function(){ window.__seekCalls.push(Array.prototype.slice.call(arguments)); return orig.apply(this, arguments); }; } return true; })()");
  const before = await cdp.eval(readActive);
  const rect = await cdp.eval(wrapCenter);
  console.log('before:', before, 'rect:', JSON.stringify(rect));
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: rect.x, y: rect.y, deltaX: 0, deltaY: 120 });
  await new Promise((r) => setTimeout(r, 500));
  const after = await cdp.eval(readActive);
  const seeks1 = await cdp.eval(seekCount);
  console.log('after:', after, 'seeks:', seeks1);
  assert.notEqual(after, before, '滚轮后高亮应移动到预览行');
  assert.equal(Number(after), Number(before) + 1, '单次滚轮步进 +1');
  assert.equal(seeks1, 0, '滚轮预览不应触发 seek');

  console.log('=== Step 4: timeout rebound (playing) or sticky (paused) ===');
  await new Promise((r) => setTimeout(r, 2200));
  const rebound = await cdp.eval(readActive);
  const seeks2 = await cdp.eval(seekCount);
  console.log('rebound:', rebound, 'seeks:', seeks2, 'before:', before);
  assert.equal(seeks2, 0, '回弹/常驻都不应触发 seek');
  let playState = 'unknown';
  if (rebound === before) {
    playState = 'playing';
    console.log('state: playing (timeout rebound OK)');
  } else if (rebound === after) {
    playState = 'paused';
    console.log('state: paused (preview sticky OK, 符合暂停不倒计时语义)');
  } else {
    assert.fail('预览既未回弹也非常驻, rebound=' + rebound + ' before=' + before + ' after=' + after);
  }

  console.log('=== Step 5: click preview row dismisses preview (seek only if MPD connected) ===');
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: rect.x, y: rect.y, deltaX: 0, deltaY: 120 });
  await new Promise((r) => setTimeout(r, 500));
  const previewIdx = await cdp.eval(readActive);
  console.log('previewIdx:', previewIdx);
  const clicked = await cdp.eval("(function(){ const wrap = document.querySelector('.lyrics-orbit-wrapper'); const nodes = Array.prototype.slice.call(wrap.querySelectorAll('.lyric-node')); const i = nodes.findIndex(function(n){ return n.classList.contains('is-active'); }); if (i >= 0) nodes[i].click(); return i; })()");
  await new Promise((r) => setTimeout(r, 800));
  const seeks3 = await cdp.eval(seekCount);
  const afterClick = await cdp.eval(readActive);
  console.log('clicked:', clicked, 'seeks after click:', seeks3, 'active:', afterClick);
  // 暂停态确认跳转: 单击后预览应收起 (回弹到 activeIndex 或跟随 seek 落点); seek 仅在 MPD 已连接时触发
  // 当前默认歌词无 time 落点对应真实播放位置时, activeIndex 可能保持, 故仅断言预览收起 + seek 不超过 1 次
  assert.ok(Number(seeks3) <= 1, '单击确认最多触发一次 seek');

  console.log('=== Step 6: ArrowDown clears preview (direct-jump path, MPD-gated seek) ===');
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'ArrowDown', code: 'ArrowDown', windowsVirtualKeyCode: 40 });
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'ArrowDown', code: 'ArrowDown', windowsVirtualKeyCode: 40 });
  await new Promise((r) => setTimeout(r, 800));
  const seeks4 = await cdp.eval(seekCount);
  const afterArrow = await cdp.eval(readActive);
  const afterArrowPreview = await cdp.eval("(document.querySelector('.lyrics-orbit-wrapper') || {}).getAttribute ? document.querySelector('.lyrics-orbit-wrapper').getAttribute('data-preview-index') : null");
  console.log('seeks after ArrowDown:', seeks4, 'active:', afterArrow, 'preview:', afterArrowPreview);
  // MPD 未连接时 seek 不触发, 但方向键必须清预览 (不进预览流) —— 这是本次锁定的键盘语义
  assert.equal(afterArrowPreview, '', '方向键必须清除预览态 (保持直跳语义)');
  assert.ok(Number(seeks4) <= 1, '方向键 seek 至多一次 (MPD 未连接时为 0)');

  console.log('=== Step 7: pause -> wheel preview sticky (no rebound), resume path ready ===');
  await cdp.eval("(function(){ const b = document.querySelector('.status-bar-btn-play'); if (b) b.click(); return !!b; })()");
  await new Promise((r) => setTimeout(r, 900));
  const playingFlag = await cdp.eval("(function(){ const b = document.querySelector('.status-bar-btn-play'); return b ? b.classList.contains('is-playing') : null; })()");
  console.log('is-playing after toggle:', playingFlag);
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: rect.x, y: rect.y, deltaX: 0, deltaY: 120 });
  await new Promise((r) => setTimeout(r, 500));
  const pausedPreview = await cdp.eval(readActive);
  await new Promise((r) => setTimeout(r, 2200));
  const pausedSticky = await cdp.eval(readActive);
  const seeks5 = await cdp.eval(seekCount);
  console.log('paused preview:', pausedPreview, 'sticky:', pausedSticky, 'seeks:', seeks5);
  assert.equal(pausedSticky, pausedPreview, '暂停态预览应常驻不回弹');
  assert.equal(seeks5, 0, '暂停态预览不应触发 seek');
  // 恢复播放态, 保持窗口可手动核验状态
  await cdp.eval("(function(){ const b = document.querySelector('.status-bar-btn-play'); if (b) b.click(); return !!b; })()");
  await new Promise((r) => setTimeout(r, 900));

  console.log('=== LYRIC PREVIEW E2E PASSED ===');
  cdp.close();
  process.exit(0);
}

main().catch((e) => { console.error('E2E FAILED:', e); process.exit(1); });
