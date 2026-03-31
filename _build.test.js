#!/usr/bin/env node
// Tests for _build.js — PineSoft i18n build system
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const SITE_DIR = __dirname;
let passed = 0;
let failed = 0;

function assert(condition, msg) {
  if (condition) { passed++; console.log(`  OK: ${msg}`); }
  else { failed++; console.error(`  FAIL: ${msg}`); }
}

// Run build first
console.log('Running _build.js...');
const buildOutput = execSync('node _build.js', { cwd: SITE_DIR, encoding: 'utf8' });
console.log(buildOutput);

// --- Test 1: All language directories created ---
console.log('\n=== Language directories ===');
const langs = ['de', 'en', 'es', 'fr', 'it', 'ja', 'ko', 'pt', 'zh'];
for (const lang of langs) {
  assert(fs.existsSync(path.join(SITE_DIR, lang)), `/${lang}/ exists`);
}

// --- Test 2: Each language has 11 pages ---
console.log('\n=== Page count per language ===');
function countHtml(dir) {
  let count = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) count += countHtml(full);
    else if (entry.name === 'index.html') count++;
  }
  return count;
}
for (const lang of langs) {
  const count = countHtml(path.join(SITE_DIR, lang));
  assert(count === 11, `/${lang}/ has ${count}/11 pages`);
}

// --- Test 3: HTML lang attribute matches language ---
console.log('\n=== HTML lang attribute ===');
for (const lang of langs) {
  const html = fs.readFileSync(path.join(SITE_DIR, lang, 'index.html'), 'utf8');
  assert(html.includes(`<html lang="${lang}"`), `/${lang}/index.html has lang="${lang}"`);
}

// --- Test 4: Hreflang tags present ---
console.log('\n=== Hreflang tags ===');
const enHome = fs.readFileSync(path.join(SITE_DIR, 'en', 'index.html'), 'utf8');
assert(enHome.includes('hreflang="en"'), 'en homepage has hreflang="en"');
assert(enHome.includes('hreflang="it"'), 'en homepage has hreflang="it"');
assert(enHome.includes('hreflang="x-default"'), 'en homepage has x-default');

// --- Test 5: Language switcher present ---
console.log('\n=== Language switcher ===');
assert(enHome.includes('class="lang-switcher"'), 'en homepage has lang-switcher');
assert(enHome.includes('class="active">EN</a>'), 'EN is active on en homepage');
const itHome = fs.readFileSync(path.join(SITE_DIR, 'it', 'index.html'), 'utf8');
assert(itHome.includes('class="active">IT</a>'), 'IT is active on it homepage');

// --- Test 6: Translation keys resolved (no {{key}} remaining) ---
console.log('\n=== No unresolved placeholders ===');
const enGames = fs.readFileSync(path.join(SITE_DIR, 'en', 'games', 'index.html'), 'utf8');
const unresolvedEn = enGames.match(/\{\{[a-zA-Z0-9_.]+\}\}/g) || [];
assert(unresolvedEn.length === 0, `en/games/ has ${unresolvedEn.length} unresolved keys`);

// --- Test 7: Translations differ from English ---
console.log('\n=== Translations differ ===');
const itTitle = itHome.match(/<title>([^<]+)<\/title>/)?.[1];
const enTitle = enHome.match(/<title>([^<]+)<\/title>/)?.[1];
assert(itTitle !== enTitle, `IT title "${itTitle}" differs from EN "${enTitle}"`);

// --- Test 8: Root index.html has language detection ---
console.log('\n=== Root redirect ===');
const rootHtml = fs.readFileSync(path.join(SITE_DIR, 'index.html'), 'utf8');
assert(rootHtml.includes('navigator.language'), 'root has navigator.language detection');
assert(rootHtml.includes('url=/en/'), 'root has fallback to /en/');

// --- Test 9: Old paths are redirects ---
console.log('\n=== Old path redirects ===');
const oldPaths = ['games', 'tools', 'reading', 'privacy-policy'];
for (const p of oldPaths) {
  const html = fs.readFileSync(path.join(SITE_DIR, p, 'index.html'), 'utf8');
  assert(html.includes('navigator.language'), `/${p}/ has language detection redirect`);
}

// --- Test 10: Nav links use language prefix ---
console.log('\n=== Nav links prefixed ===');
assert(enHome.includes('href="/en/games/"'), 'en nav links to /en/games/');
assert(itHome.includes('href="/it/games/"'), 'it nav links to /it/games/');

// --- Summary ---
console.log(`\n${'='.repeat(40)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
