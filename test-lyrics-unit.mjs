import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { parseLrc } from './src/main/lyrics.ts';

console.log('=== Lyrics LRC Bilingual Merge Unit Tests ===');

// Test 1: 相同时间戳两行 → 1 行, primary 为第 1 行、secondary 为第 2 行
const t1 = parseLrc('[00:12.00]Ubique, benigna lux spargitur\n[00:12.00]愿仁慈的光芒普照世间每一寸角落');
assert.equal(t1.length, 1);
assert.equal(t1[0].primary, 'Ubique, benigna lux spargitur');
assert.equal(t1[0].secondary, '愿仁慈的光芒普照世间每一寸角落');
assert.equal(t1[0].time, 12);
console.log('✓ 1. Same-timestamp pair merges to primary + secondary passed');

// Test 2: 同时间戳 3 行 → secondary 为“第2行 / 第3行”
const t2 = parseLrc('[00:12.00]Line one\n[00:12.00]第二行\n[00:12.00]第三行');
assert.equal(t2.length, 1);
assert.equal(t2[0].primary, 'Line one');
assert.equal(t2[0].secondary, '第二行 / 第三行');
console.log('✓ 2. Same-timestamp triple merges extras into one secondary passed');

// Test 3: 时间戳不同 → 各自独立成行、无 secondary
const t3 = parseLrc('[00:12.00]First\n[00:12.01]Second');
assert.equal(t3.length, 2);
assert.equal(t3[0].primary, 'First');
assert.equal(t3[0].secondary, undefined);
assert.equal(t3[1].primary, 'Second');
assert.equal(t3[1].secondary, undefined);
console.log('✓ 3. Different timestamps stay independent passed');

// Test 4: 乱序输入先排序后归并, 同时间戳组内保持文件先后
const t4 = parseLrc('[00:25.00]Cur non mittis lucem almam tuam?\n[00:12.00]Ubique, benigna lux spargitur\n[00:12.00]愿仁慈的光芒普照世间每一寸角落');
assert.equal(t4.length, 2);
assert.equal(t4[0].primary, 'Ubique, benigna lux spargitur');
assert.equal(t4[0].secondary, '愿仁慈的光芒普照世间每一寸角落');
assert.equal(t4[0].time, 12);
assert.equal(t4[1].primary, 'Cur non mittis lucem almam tuam?');
assert.equal(t4[1].secondary, undefined);
assert.equal(t4[1].time, 25);
console.log('✓ 4. Out-of-order sort then merge with file order preserved passed');

// Test 5: 空行 / 无文本时间戳行被忽略; 单行无 secondary
const t5 = parseLrc('\n[00:12.00]\n[00:12.00]Solo line\n\n[00:25.00]Next');
assert.equal(t5.length, 2);
assert.equal(t5[0].primary, 'Solo line');
assert.equal(t5[0].secondary, undefined);
assert.equal(t5[1].primary, 'Next');
console.log('✓ 5. Empty and textless timestamp lines ignored passed');

// Test 6: 归并后 id 按新行重编 (0-based 连续)
const t6 = parseLrc('[00:12.00]A\n[00:12.00]甲\n[00:25.00]B\n[00:38.00]C\n[00:38.00]丙');
assert.equal(t6.length, 3);
assert.deepEqual(t6.map((l) => l.id), [0, 1, 2]);
assert.equal(t6[0].secondary, '甲');
assert.equal(t6[2].secondary, '丙');
console.log('✓ 6. Merged ids re-indexed continuously passed');

// Test 7: 多时间戳共享同一行文本 (一行多 tag) 仍各自成行
const t7 = parseLrc('[00:12.00][00:25.00]Chorus');
assert.equal(t7.length, 2);
assert.equal(t7[0].primary, 'Chorus');
assert.equal(t7[1].primary, 'Chorus');
console.log('✓ 7. Multi-tag line expands to independent rows passed');

// Test 8: 行内双语 (同行原文 <U+2009> 译文) → primary + secondary
const t8 = parseLrc('[00:06.74]やがては海に出るから\u2009不久将重回大海');
assert.equal(t8.length, 1);
assert.equal(t8[0].primary, 'やがては海に出るから');
assert.equal(t8[0].secondary, '不久将重回大海');
console.log('✓ 8. Inline bilingual (thin-space) splits to primary + secondary passed');

// Test 9: 纯中文行内普通空格不断行 (无 THIN SPACE)
const t9 = parseLrc('[00:24.80]仍然没有 遇到 那位跟我绝配的恋人');
assert.equal(t9.length, 1);
assert.equal(t9[0].primary, '仍然没有 遇到 那位跟我绝配的恋人');
assert.equal(t9[0].secondary, undefined);
console.log('✓ 9. Pure-Chinese line with ASCII spaces stays single passed');

// Test 10: 日文行内普通空格 + THIN SPACE 纯原文侧不断行 (右侧无 CJK)
const t10 = parseLrc('[00:00.99]雪が溶ければ 川へと流れ\u2009flow');
assert.equal(t10.length, 1);
assert.equal(t10[0].secondary, undefined);
console.log('✓ 10. Non-CJK tail does not split passed');

// Test 11: 实曲 LYRICS 标签端到端 (Close Your Eyes): 全 64 行归并后译文落 secondary
const lrcRaw = execFileSync('metaflac', ['--show-tag=LYRICS', '/home/lpipwei/Music/music_4/Close Your Eyes - 彩音.flac']).toString('utf-8').replace(/^LYRICS=/, '');
const t11 = parseLrc(lrcRaw);
assert.equal(t11.length, 61);
const withSec = t11.filter((l) => l.secondary !== undefined);
assert.ok(withSec.length > 50, `expected >50 bilingual lines, got ${withSec.length}`);
const sample = t11.find((l) => l.time === 6.74);
assert.equal(sample?.primary, 'やがては海に出るから');
assert.equal(sample?.secondary, '不久将重回大海');
// 纯中文制作信息行保持单行
const credit = t11.find((l) => l.time === 0);
assert.equal(credit?.secondary, undefined);
console.log(`✓ 11. Real-song LYRICS end-to-end passed (${withSec.length}/61 lines have secondary)`);

console.log('ALL LYRIC MERGE UNIT TESTS PASS (11/11)');
