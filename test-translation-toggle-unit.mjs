import assert from 'node:assert/strict';
import { parseTypographyConfig, DEFAULT_TYPOGRAPHY_CONFIG } from './src/types/config.ts';

console.log('=== Translation Toggle Unit Tests ===');

// 1. 缺省回退: 无键/空对象一律 true, 老用户无感 (不写盘)
assert.equal(parseTypographyConfig(null).lyrics.showTranslation, true);
assert.equal(parseTypographyConfig({}).lyrics.showTranslation, true);
assert.equal(parseTypographyConfig({ lyrics: {} }).lyrics.showTranslation, true);
assert.equal(parseTypographyConfig({ lyrics: { body: { fontSize: 20 } } }).lyrics.showTranslation, true);
assert.equal(parseTypographyConfig({ typography: { lyrics: {} } }).lyrics.showTranslation, true);
console.log('✓ 1. missing key defaults to true');

// 2. 显式布尔直通
assert.equal(parseTypographyConfig({ lyrics: { showTranslation: false } }).lyrics.showTranslation, false);
assert.equal(parseTypographyConfig({ lyrics: { showTranslation: true } }).lyrics.showTranslation, true);
console.log('✓ 2. explicit boolean passthrough');

// 3. 非布尔脏值回退 true (字符串 "false" 也不误关)
assert.equal(parseTypographyConfig({ lyrics: { showTranslation: 'false' } }).lyrics.showTranslation, true);
assert.equal(parseTypographyConfig({ lyrics: { showTranslation: 0 } }).lyrics.showTranslation, true);
assert.equal(parseTypographyConfig({ lyrics: { showTranslation: null } }).lyrics.showTranslation, true);
console.log('✓ 3. non-boolean dirty values fall back to true');

// 4. 开关不影响已有三路字体解析 (正文/翻译/包装别名)
const mixed = parseTypographyConfig({ lyrics: { showTranslation: false, body: { fontSize: 22 }, translation: { fontSize: 15 } } });
assert.equal(mixed.lyrics.body.fontSize, 22);
assert.equal(mixed.lyrics.translation.fontSize, 15);
assert.equal(mixed.lyrics.showTranslation, false);
const flat = parseTypographyConfig({ lyrics: { fontFamily: 'LegacyFont', fontSize: 24 } });
assert.equal(flat.lyrics.body.fontFamily, 'LegacyFont');
assert.equal(flat.lyrics.showTranslation, true);
assert.deepEqual(parseTypographyConfig({}).lyrics.body, DEFAULT_TYPOGRAPHY_CONFIG.lyrics.body);
console.log('✓ 4. coexist with body/translation/flat-legacy parsing');

console.log('=== All 4 Translation Toggle Tests Passed ===');
