import assert from 'node:assert/strict';
import {
  parseFontItemConfig,
  parseTypographyConfig,
  sanitizeFontFamily,
  DEFAULT_TYPOGRAPHY_CONFIG
} from './src/types/config.ts';

console.log('=== Typography Unit & Schema Tests ===');

// Test 1: Null, undefined, empty object fallback
assert.deepEqual(parseTypographyConfig(null), DEFAULT_TYPOGRAPHY_CONFIG);
assert.deepEqual(parseTypographyConfig(undefined), DEFAULT_TYPOGRAPHY_CONFIG);
assert.deepEqual(parseTypographyConfig({}), DEFAULT_TYPOGRAPHY_CONFIG);
assert.deepEqual(parseTypographyConfig("not an object"), DEFAULT_TYPOGRAPHY_CONFIG);
assert.deepEqual(parseTypographyConfig(123), DEFAULT_TYPOGRAPHY_CONFIG);
console.log('✓ 1. Null/undefined/primitive fallback passed');

// Test 2: Partial updates
const partial = {
  ui: { fontSize: 16 }
};
const parsedPartial = parseTypographyConfig(partial);
assert.equal(parsedPartial.ui.fontSize, 16);
assert.equal(parsedPartial.ui.fontFamily, DEFAULT_TYPOGRAPHY_CONFIG.ui.fontFamily);
assert.deepEqual(parsedPartial.hint, DEFAULT_TYPOGRAPHY_CONFIG.hint);
assert.deepEqual(parsedPartial.lyrics, DEFAULT_TYPOGRAPHY_CONFIG.lyrics);
console.log('✓ 2. Partial updates with default fallback passed');

// Test 3: Boundary clamping
// UI: 11 ~ 20
assert.equal(parseTypographyConfig({ ui: { fontSize: 5 } }).ui.fontSize, 11);
assert.equal(parseTypographyConfig({ ui: { fontSize: 100 } }).ui.fontSize, 20);
assert.equal(parseTypographyConfig({ ui: { fontSize: 15.6 } }).ui.fontSize, 16);
// Hint: 9 ~ 16
assert.equal(parseTypographyConfig({ hint: { fontSize: 2 } }).hint.fontSize, 9);
assert.equal(parseTypographyConfig({ hint: { fontSize: 50 } }).hint.fontSize, 16);
// Lyrics Body: 14 ~ 36
assert.equal(parseTypographyConfig({ lyrics: { body: { fontSize: 10 } } }).lyrics.body.fontSize, 14);
assert.equal(parseTypographyConfig({ lyrics: { body: { fontSize: 100 } } }).lyrics.body.fontSize, 36);
// Lyrics Translation: 10 ~ 22
assert.equal(parseTypographyConfig({ lyrics: { translation: { fontSize: 5 } } }).lyrics.translation.fontSize, 10);
assert.equal(parseTypographyConfig({ lyrics: { translation: { fontSize: 40 } } }).lyrics.translation.fontSize, 22);
console.log('✓ 3. Boundary clamping passed');

// Test 4: Extreme / Malicious numbers: NaN, Infinity, -Infinity
assert.equal(parseTypographyConfig({ ui: { fontSize: NaN } }).ui.fontSize, 13);
assert.equal(parseTypographyConfig({ ui: { fontSize: Infinity } }).ui.fontSize, 13);
assert.equal(parseTypographyConfig({ ui: { fontSize: -Infinity } }).ui.fontSize, 13);
console.log('✓ 4. NaN and Infinity handling passed');

// Test 5: Legacy flat lyrics configuration backward compatibility (including string numbers with units)
const flatLyrics = {
  lyrics: {
    fontFamily: 'CustomLegacyLyricsFont',
    fontSize: 24
  }
};
const parsedFlat = parseTypographyConfig(flatLyrics);
assert.equal(parsedFlat.lyrics.body.fontFamily, 'CustomLegacyLyricsFont');
assert.equal(parsedFlat.lyrics.body.fontSize, 24);
assert.equal(parsedFlat.lyrics.translation.fontFamily, DEFAULT_TYPOGRAPHY_CONFIG.lyrics.translation.fontFamily);

const flatStringWithBody = {
  lyrics: {
    fontFamily: 'CustomLegacyLyricsFont',
    fontSize: '28px',
    body: { fontFamily: 'OverriddenBodyFont' }
  }
};
const parsedFlatString = parseTypographyConfig(flatStringWithBody);
assert.equal(parsedFlatString.lyrics.body.fontFamily, 'OverriddenBodyFont');
assert.equal(parsedFlatString.lyrics.body.fontSize, 28);
console.log('✓ 5. Legacy flat lyrics backward compatibility passed');

// Test 6: String numbers and CSS units parsing
assert.equal(parseFontItemConfig({ fontSize: "16" }, DEFAULT_TYPOGRAPHY_CONFIG.ui, 11, 20).fontSize, 16);
assert.equal(parseFontItemConfig({ fontSize: "16px" }, DEFAULT_TYPOGRAPHY_CONFIG.ui, 11, 20).fontSize, 16);
assert.equal(parseFontItemConfig({ fontSize: "invalid" }, DEFAULT_TYPOGRAPHY_CONFIG.ui, 11, 20).fontSize, 13);
console.log('✓ 6. String numbers and units handling passed');

// Test 7: Sanitization of trailing semicolons, unclosed quotes, !important, comments, backslashes, CSS declaration prefixes, and trailing commas
const injectionConfig = {
  ui: { fontFamily: 'font-family: JetBrains Mono;' },
  hint: { fontFamily: "'Fira Code" },
  lyrics: {
    body: { fontFamily: '"Cascadia Code' },
    translation: { fontFamily: 'sans-serif; } * { display: none !important; }' }
  }
};
const parsedInjection = parseTypographyConfig(injectionConfig);
assert.equal(parsedInjection.ui.fontFamily, 'JetBrains Mono');
assert.equal(parsedInjection.hint.fontFamily, "'Fira Code'");
assert.equal(parsedInjection.lyrics.body.fontFamily, '"Cascadia Code"');
assert.equal(parsedInjection.lyrics.translation.fontFamily, 'sans-serif * display: none');

// Additional sanitization tests
assert.equal(sanitizeFontFamily('Arial, sans-serif !important', 'fallback'), 'Arial, sans-serif');
assert.equal(sanitizeFontFamily('/* comment */ Inter', 'fallback'), 'Inter');
assert.equal(sanitizeFontFamily('Fira Code\\3b color: red', 'fallback'), 'Fira Code3b color: red');
assert.equal(sanitizeFontFamily('Inter\\', 'fallback'), 'Inter');
assert.equal(sanitizeFontFamily('Inter,', 'fallback'), 'Inter');
assert.equal(sanitizeFontFamily(',Inter, Roboto, ,', 'fallback'), 'Inter, Roboto');
assert.equal(sanitizeFontFamily('<script>alert("xss")</script>', 'fallback'), 'scriptalert("xss")/script');
assert.equal(sanitizeFontFamily('""', 'fallback'), 'fallback');
assert.equal(sanitizeFontFamily("''", 'fallback'), 'fallback');
assert.equal(sanitizeFontFamily('"   "', 'fallback'), 'fallback');
assert.equal(sanitizeFontFamily("'', \"\"", 'fallback'), 'fallback');
assert.equal(sanitizeFontFamily('\x00\x08Inter\x1b', 'fallback'), 'Inter');
assert.equal(sanitizeFontFamily('null', 'fallback'), 'fallback');
assert.equal(sanitizeFontFamily('undefined', 'fallback'), 'fallback');
assert.equal(sanitizeFontFamily('  NULL  ', 'fallback'), 'fallback');
assert.equal(sanitizeFontFamily('UNDEFINED', 'fallback'), 'fallback');
console.log('✓ 7. Font family sanitization and injection prevention passed');

// Test 8: Whitespace-only and empty strings fallback (including empty quotes)
const emptyFonts = {
  ui: { fontFamily: '   ' },
  hint: { fontFamily: '""' },
  lyrics: {
    body: { fontFamily: '\t\n ' },
    translation: { fontFamily: "''" }
  }
};
const parsedEmpty = parseTypographyConfig(emptyFonts);
assert.equal(parsedEmpty.ui.fontFamily, DEFAULT_TYPOGRAPHY_CONFIG.ui.fontFamily);
assert.equal(parsedEmpty.hint.fontFamily, DEFAULT_TYPOGRAPHY_CONFIG.hint.fontFamily);
assert.equal(parsedEmpty.lyrics.body.fontFamily, DEFAULT_TYPOGRAPHY_CONFIG.lyrics.body.fontFamily);
assert.equal(parsedEmpty.lyrics.translation.fontFamily, DEFAULT_TYPOGRAPHY_CONFIG.lyrics.translation.fontFamily);
console.log('✓ 8. Empty and whitespace-only font fallback passed');

// Test 9: Top-level wrapper objects (typography / font)
const wrappedTypo = {
  typography: {
    ui: { fontSize: 17 }
  }
};
assert.equal(parseTypographyConfig(wrappedTypo).ui.fontSize, 17);

const wrappedFont = {
  font: {
    ui: { fontSize: 19 }
  }
};
assert.equal(parseTypographyConfig(wrappedFont).ui.fontSize, 19);
console.log('✓ 9. Top-level wrapper objects (typography / font) passed');

// Test 10: Deep partial font merging with alias
const fontAliasPartial = {
  font: {
    ui: { fontFamily: 'JetBrains Mono' },
    lyrics: { body: { fontSize: 22 } }
  }
};
const parsedFontAlias = parseTypographyConfig(fontAliasPartial);
assert.equal(parsedFontAlias.ui.fontFamily, 'JetBrains Mono');
assert.equal(parsedFontAlias.lyrics.body.fontSize, 22);
console.log('✓ 10. Deep partial font alias parsing passed');

console.log('=== All 10 Unit Tests Passed Successfully ===');
