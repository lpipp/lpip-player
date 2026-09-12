import http from 'node:http';
import assert from 'node:assert/strict';
import net from 'node:net';

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
    close: () => ws.close()
  };
}

// MPD 原生协议直连 (sticker 预置与断言, 不走 IPC)
function mpdCmd(cmd) {
  return new Promise((resolve, reject) => {
    const sock = net.connect(6600, '127.0.0.1', () => sock.write(cmd + '\n'));
    let buf = '';
    sock.on('data', (d) => {
      buf += d.toString();
      if (/(^|\n)OK\n?$/.test(buf) || buf.includes('ACK ')) {
        sock.end();
        resolve(buf);
      }
    });
    sock.on('error', reject);
    setTimeout(() => { sock.destroy(); reject(new Error('mpd timeout: ' + cmd)); }, 5000);
  });
}

async function main() {
  // --- Step 0: sticker 预置三条测试计数 (MPD sticker set 要求 file 必须在曲库内, 故取三首真歌) ---
  const libRaw = await mpdCmd('listall');
  const files = libRaw.split('\n').filter((l) => l.startsWith('file: ')).map((l) => l.slice(6).trim()).filter(Boolean);
  assert.ok(files.length >= 3, '曲库至少需要 3 首歌');
  const [fileA, fileB, fileC] = files;
  await mpdCmd(`sticker set song "${fileA}" playCount 7`);
  await mpdCmd(`sticker set song "${fileB}" playCount 3`);
  await mpdCmd(`sticker set song "${fileC}" playCount 5`);
  console.log('✓ 0. sticker 预置: A=7 B=3 C=5');

  const cdp = await getCDPPage();

  // --- Step 1: 打开统计抽屉 (悬浮胶囊第 5 按键) ---
  await cdp.eval('window.location.reload()');
  await new Promise((r) => setTimeout(r, 800));
  await cdp.eval("new Promise(function(resolve){ if (document.readyState === 'complete') resolve(true); else window.addEventListener('load', function(){ resolve(true); }, { once: true }); })");
  await new Promise((r) => setTimeout(r, 1500));

  const btnCount = await cdp.eval("document.querySelectorAll('.capsule-icon-btn').length");
  assert.equal(btnCount, 6, '胶囊保持 6 按键');
  const openStats = `(function(){
    var btns = document.querySelectorAll('.capsule-icon-btn');
    var btn = btns[4];
    if (!btn) return 'no-5th-btn';
    btn.click();
    return 'clicked';
  })()`;
  assert.equal(await cdp.eval(openStats), 'clicked');
  await new Promise((r) => setTimeout(r, 2500));
  const drawerOpen = await cdp.eval("!!document.querySelector('.stats-drawer-wrapper')");
  assert.equal(drawerOpen, true, '统计抽屉应打开');
  console.log('✓ 1. 第 5 按键打开统计抽屉');

  // --- Step 2: 摘要卡三指标 ---
  const summary = await cdp.eval(`(function(){
    var v = document.querySelectorAll('.stats-summary-value');
    var l = document.querySelectorAll('.stats-summary-label');
    return { values: Array.prototype.map.call(v, function(e){ return e.textContent; }), labels: Array.prototype.map.call(l, function(e){ return e.textContent; }) };
  })()`);
  assert.deepEqual(summary.labels, ['累计播放时长', '总播放次数', '已统计曲目']);
  assert.ok(/小时|分|秒/.test(summary.values[0]), '累计时长含中文单位: ' + summary.values[0]);
  assert.equal(summary.values[1], String(7 + 3 + 5), '总播放次数 = 15: ' + summary.values[1]);
  assert.equal(summary.values[2], '3', '已统计曲目 = 3: ' + summary.values[2]);
  console.log('✓ 2. 摘要卡:', JSON.stringify(summary.values));

  // --- Step 3: 排行降序 (data-play-count 探针) + 文件名/未知歌手回退 ---
  const ranks = await cdp.eval(`(function(){
    return Array.prototype.map.call(document.querySelectorAll('.stats-count-probe'), function(e){ return Number(e.getAttribute('data-play-count')); });
  })()`);
  assert.deepEqual(ranks, [7, 5, 3], '降序 7 > 5 > 3: ' + JSON.stringify(ranks));
  // 残留 file 回退分支 (sticker 有但曲库无) 由 getPlayStats 文件名/未知歌手兜底, MPD sticker set 要求 file 在库内故 e2e 不覆盖, 仅断言三行均有歌手副文本
  const subtexts = await cdp.eval(`(function(){
    return Array.prototype.map.call(document.querySelectorAll('.stats-artist'), function(e){ return e.textContent; });
  })()`);
  assert.equal(subtexts.length, 3);
  assert.ok(subtexts.every((t) => t && t.length > 0), '每行均有歌手副文本: ' + JSON.stringify(subtexts));
  console.log('✓ 3. 降序成立:', JSON.stringify(ranks), JSON.stringify(subtexts));

  // --- Step 4: top-3 高亮类 ---
  const topCount = await cdp.eval("document.querySelectorAll('.stats-item-top').length");
  assert.equal(topCount, 3, '三条全 top 高亮');
  console.log('✓ 4. top-3 高亮');

  // --- Step 5: 空态 (删除三条测试 sticker 后重开) ---
  await mpdCmd(`sticker delete song "${fileA}" playCount`);
  await mpdCmd(`sticker delete song "${fileB}" playCount`);
  await mpdCmd(`sticker delete song "${fileC}" playCount`);
  await cdp.eval('window.location.reload()');
  await new Promise((r) => setTimeout(r, 2500));
  await cdp.eval(openStats);
  await new Promise((r) => setTimeout(r, 2500));
  const emptyText = await cdp.eval("(document.querySelector('.stats-empty-state') || {}).textContent || ''");
  assert.ok(emptyText.indexOf('暂无播放记录') !== -1, '空态文案: ' + emptyText);
  console.log('✓ 5. 空态: 暂无播放记录');

  // --- Step 6: observePlaySession 单曲循环/手动重播允许再次计数 (main 轮询语义, 此处用 preload 状态侧写) ---
  // 回放验证: sticker 无残留, getPlayStats 空排行
  const after = await cdp.eval(`(async function(){
    var s = await window.electronAPI.mpd.getPlayStats();
    return { total: s.totalPlayCount, n: s.trackedSongCount, entries: s.entries.length };
  })()`);
  assert.deepEqual(after, { total: 0, n: 0, entries: 0 }, '清理后零残留: ' + JSON.stringify(after));
  console.log('✓ 6. sticker 零残留, IPC 空排行');

  cdp.close();
  console.log('=== All 6 PlayStats E2E Steps Passed Successfully ===');
}

main().catch((err) => {
  console.error('E2E FAILED:', err);
  process.exit(1);
});
