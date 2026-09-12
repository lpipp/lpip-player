import assert from 'node:assert/strict';
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

console.log('ALL LYRIC MERGE UNIT TESTS PASS (7/7)');
