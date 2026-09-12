import assert from 'node:assert/strict';
import {
  calcPlayCountThresholdMs,
  parseMpdPlaytime,
  parseStickerPlayCounts,
  observePlaySession,
  PLAY_COUNT_MIN_MS
} from '/tmp/lpip-playstats-build/mpd-stats.mjs';

console.log('=== PlayStats Unit Tests (transpiled from src/main/mpd.ts) ===');

// --- Test 1: 计数阈值 max(30s, 50%) ---
assert.equal(calcPlayCountThresholdMs(0), PLAY_COUNT_MIN_MS, '时长 0 回退 30s');
assert.equal(calcPlayCountThresholdMs(-5), PLAY_COUNT_MIN_MS, '负时长回退 30s');
assert.equal(calcPlayCountThresholdMs(NaN), PLAY_COUNT_MIN_MS, 'NaN 回退 30s');
assert.equal(calcPlayCountThresholdMs(Infinity), PLAY_COUNT_MIN_MS, 'Infinity 回退 30s');
assert.equal(calcPlayCountThresholdMs(10), 30000, '10s 短曲托底 30s');
assert.equal(calcPlayCountThresholdMs(60), 30000, '60s 取 max(30s,30s)');
assert.equal(calcPlayCountThresholdMs(61), 30500, '61s 取 50%=30.5s');
assert.equal(calcPlayCountThresholdMs(300), 150000, '300s 取 50%=150s');
console.log('✓ 1. calcPlayCountThresholdMs passed');

// --- Test 2: stats.playtime 解析与容错 ---
assert.equal(
  parseMpdPlaytime('uptime: 49774\nplaytime: 5779\nartists: 238\nsongs: 436\ndb_playtime: 110586\nOK\n'),
  5779
);
assert.equal(parseMpdPlaytime('artists: 1\nOK\n'), 0, '缺 playtime 回退 0');
assert.equal(parseMpdPlaytime(''), 0, '空串回退 0');
assert.equal(parseMpdPlaytime('PLAYTIME: 100\n'), 100, '大小写不敏感');
console.log('✓ 2. parseMpdPlaytime passed');

// --- Test 3: sticker find 解析 ---
const findRaw =
  'OK MPD 0.24.0\n' +
  'file: music_1/A.flac\nsticker: playCount=3\n' +
  'file: music_1/B.flac\nsticker: playCount=12\n' +
  'file: music_1/C.flac\nsticker: playCount=0\n' +
  'file: music_1/D.flac\nsticker: playCount=abc\n' +
  'file: music_1/E.flac\nsticker: playCount=7\nfile: music_1/E.flac\nsticker: playCount=9\n' +
  'OK\n';
const counts = parseStickerPlayCounts(findRaw);
assert.equal(counts.size, 3, '0/非法计数跳过, E 取最后一次');
assert.equal(counts.get('music_1/B.flac'), 12);
assert.equal(counts.get('music_1/E.flac'), 9);
assert.equal(counts.get('music_1/A.flac'), 3);
assert.equal(parseStickerPlayCounts('OK\n').size, 0, '空结果 0 条');
assert.equal(parseStickerPlayCounts('ACK [50@0] {sticker} no such sticker\n').size, 0, 'ACK 容错');
console.log('✓ 3. parseStickerPlayCounts passed');

// --- Test 4: observePlaySession 状态机 ---
const mkStatus = (state, file, duration = 300, currentTime = 0) => ({
  state,
  currentSong: file ? { file, duration } : null,
  currentTime
});
const fired = [];
const onCount = (f) => { fired.push(f); };

let s = observePlaySession(null, mkStatus('stop', null), 1000, onCount);
assert.equal(s, null, 'stop 无会话');
s = observePlaySession(s, mkStatus('pause', null), 1500, onCount);
assert.equal(s, null, 'pause 无歌无会话');
// 新歌开始
s = observePlaySession(s, mkStatus('play', 'music_1/X.flac'), 2000, onCount);
assert.deepEqual(s, { file: 'music_1/X.flac', accumulatedMs: 0, counted: false, lastTickMs: 2000, prevElapsed: 0 });
assert.equal(fired.length, 0);
// 推进 20s (未达 300s 曲的 150s 阈值, 不计数)
s = observePlaySession(s, mkStatus('play', 'music_1/X.flac'), 22000, onCount);
assert.equal(s.accumulatedMs, 20000);
assert.equal(s.counted, false);
assert.equal(fired.length, 0);
// 暂停冻结: 暂停 10s 不累计
s = observePlaySession(s, mkStatus('pause', 'music_1/X.flac'), 32000, onCount);
assert.equal(s.accumulatedMs, 20000, '暂停不累计');
assert.equal(s.lastTickMs, null, '暂停置 lastTick null');
assert.equal(fired.length, 0);
// 恢复推进 (从 lastTick null 重新计时, 无回跳)
s = observePlaySession(s, mkStatus('play', 'music_1/X.flac'), 42000, onCount);
assert.equal(s.accumulatedMs, 20000, '恢复首轮 delta=0');
s = observePlaySession(s, mkStatus('play', 'music_1/X.flac'), 172000, onCount);
assert.equal(s.accumulatedMs, 150000, '累计达 50% 阈值');
assert.equal(s.counted, true);
assert.deepEqual(fired, ['music_1/X.flac'], '达标触发一次');
// 达标后继续播不再触发
s = observePlaySession(s, mkStatus('play', 'music_1/X.flac'), 200000, onCount);
assert.equal(fired.length, 1, '同一会话仅计一次');
// 短曲 10s: 阈值托底 30s
s = observePlaySession(null, mkStatus('play', 'music_1/Y.flac', 10), 300000, onCount);
s = observePlaySession(s, mkStatus('play', 'music_1/Y.flac', 10), 329000, onCount);
assert.equal(s.counted, false, '29s 未达 30s 托底');
s = observePlaySession(s, mkStatus('play', 'music_1/Y.flac', 10), 330000, onCount);
assert.equal(s.counted, true, '30s 达标');
assert.deepEqual(fired, ['music_1/X.flac', 'music_1/Y.flac']);
// 切歌重置 (未达标旧会话直接丢弃)
s = observePlaySession(s, mkStatus('play', 'music_1/Z.flac'), 340000, onCount);
assert.deepEqual(s, { file: 'music_1/Z.flac', accumulatedMs: 0, counted: false, lastTickMs: 340000, prevElapsed: 0 });
// stop 清空
s = observePlaySession(s, mkStatus('stop', null), 350000, onCount);
assert.equal(s, null);
assert.equal(fired.length, 2, '未达标切歌/stop 不补计数');
console.log('✓ 4. observePlaySession state machine passed');
// --- Test 5: 同文件重播判定 (大幅回退视为曲目重起) ---
// 已 counted 会话 + elapsed 从大值回到开头 (<10s): 重置累计并允许再次计数
s = observePlaySession(null, mkStatus('play', 'music_1/R.flac', 300, 250), 400000, onCount);
s = observePlaySession(s, mkStatus('play', 'music_1/R.flac', 300, 251), 430000, onCount);
assert.equal(s.accumulatedMs, 30000);
s = observePlaySession(s, mkStatus('play', 'music_1/R.flac', 300, 1), 430500, onCount);
assert.equal(s.accumulatedMs, 500, '重播重置后仅累计本轮 delta');
assert.equal(s.counted, false, '重播重置 counted');
assert.equal(s.prevElapsed, 1);
assert.equal(fired.length, 2, '重置本身不误触发');
// 小幅回退 (100s→97s): 普通 seek, 不清零不清 counted
s = observePlaySession(null, mkStatus('play', 'music_1/S.flac', 300, 100), 500000, onCount);
s = observePlaySession(s, mkStatus('play', 'music_1/S.flac', 300, 101), 501000, onCount);
assert.equal(s.accumulatedMs, 1000);
s = observePlaySession(s, mkStatus('play', 'music_1/S.flac', 300, 97), 502000, onCount);
assert.equal(s.accumulatedMs, 2000, '小幅回退不清零');
// 前进 seek (10s→120s): 不清零
s = observePlaySession(null, mkStatus('play', 'music_1/T.flac', 300, 10), 600000, onCount);
s = observePlaySession(s, mkStatus('play', 'music_1/T.flac', 300, 11), 601000, onCount);
assert.equal(s.accumulatedMs, 1000);
s = observePlaySession(s, mkStatus('play', 'music_1/T.flac', 300, 120), 602000, onCount);
assert.equal(s.accumulatedMs, 2000, '前进 seek 不清零');
console.log('✓ 5. observePlaySession replay/seek passed');

console.log('=== All 5 PlayStats Unit Groups Passed Successfully ===');
