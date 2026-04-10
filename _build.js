#!/usr/bin/env node
// PineSoft Website i18n Build Script
// Generates static HTML pages for each language from templates + translations.
// Zero dependencies — vanilla Node.js only.
//
// Usage: node _build.js

const fs = require('fs');
const path = require('path');

const SITE_DIR = __dirname;
const TEMPLATES_DIR = path.join(SITE_DIR, '_templates');
const PARTIALS_DIR = path.join(TEMPLATES_DIR, '_partials');
const I18N_DIR = path.join(SITE_DIR, '_i18n');
const SITE_URL = 'https://pinesoft.dev';

// Discover languages from _i18n/*.json
const languages = fs.readdirSync(I18N_DIR)
  .filter(f => f.endsWith('.json'))
  .map(f => f.replace('.json', ''));

if (languages.length === 0) {
  console.error('No language files found in _i18n/');
  process.exit(1);
}

console.log(`Languages: ${languages.join(', ')}`);

// Load all translations
const translations = {};
for (const lang of languages) {
  translations[lang] = JSON.parse(
    fs.readFileSync(path.join(I18N_DIR, `${lang}.json`), 'utf8')
  );
}

// Load partials
const partials = {};
if (fs.existsSync(PARTIALS_DIR)) {
  for (const file of fs.readdirSync(PARTIALS_DIR)) {
    if (file.endsWith('.html')) {
      const name = file.replace('.html', '');
      partials[name] = fs.readFileSync(path.join(PARTIALS_DIR, file), 'utf8');
    }
  }
}
console.log(`Partials: ${Object.keys(partials).join(', ')}`);

// Find all template files (excluding _partials)
function findTemplates(dir, base) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('_')) continue;
    const fullPath = path.join(dir, entry.name);
    const relPath = path.join(base, entry.name);
    if (entry.isDirectory()) {
      results.push(...findTemplates(fullPath, relPath));
    } else if (entry.name.endsWith('.html')) {
      results.push(relPath);
    }
  }
  return results;
}

const templates = findTemplates(TEMPLATES_DIR, '');
console.log(`Templates: ${templates.length} files`);

// Generate hreflang block for a given page path
function generateHreflang(pagePath) {
  const lines = languages.map(lang =>
    `  <link rel="alternate" hreflang="${lang}" href="${SITE_URL}/${lang}/${pagePath}">`
  );
  lines.push(`  <link rel="alternate" hreflang="x-default" href="${SITE_URL}/en/${pagePath}">`);
  return lines.join('\n');
}

// Generate language switcher HTML — Horatio pages get extra content languages
const CORE_LANGS = ['en', 'it', 'es', 'fr', 'de', 'pt', 'ru', 'pl', 'nl', 'sv', 'tr', 'zh', 'hi', 'ar', 'ja', 'ko'];
const HORATIO_LANGS = ['en', 'it', 'la', 'es', 'fr', 'de', 'pt', 'el', 'ru', 'pl', 'nl', 'sv', 'tr', 'ka', 'mt', 'he', 'zh', 'hi', 'ar', 'ja', 'ko'];
const HORATIO_ONLY_LANGS = new Set(['la', 'el', 'ka', 'mt', 'he']);

function generateLangSwitcher(pagePath, currentLang) {
  const isHoratio = pagePath.startsWith('reading/horatio');
  const order = isHoratio ? HORATIO_LANGS : CORE_LANGS;
  const sorted = order.filter(l => languages.includes(l));
  return sorted.map(lang => {
    const cls = lang === currentLang ? ' class="active"' : '';
    return `<a href="/${lang}/${pagePath}"${cls}>${lang.toUpperCase()}</a>`;
  }).join(' ');
}

// Resolve a translation key like "nav.games" from nested object
function resolve(obj, key) {
  return key.split('.').reduce((o, k) => (o && o[k] !== undefined) ? o[k] : null, obj);
}

// Replace all {{key}} placeholders with translation values
function replaceKeys(html, lang, pagePath) {
  const t = translations[lang];

  // Replace partials first: {{> name}}
  html = html.replace(/\{\{>\s*(\S+)\s*\}\}/g, (match, name) => {
    return partials[name] || match;
  });

  // Replace special variables
  // nav_lang: for Horatio-only languages, nav links point to English
  const navLang = HORATIO_ONLY_LANGS.has(lang) ? 'en' : lang;
  html = html.replace(/\{\{nav_lang\}\}/g, navLang);
  html = html.replace(/\{\{lang\}\}/g, lang);
  html = html.replace(/\{\{path\}\}/g, pagePath);
  html = html.replace(/\{\{hreflang\}\}/g, generateHreflang(pagePath));
  html = html.replace(/\{\{lang_switcher\}\}/g, generateLangSwitcher(pagePath, lang));

  // Replace translation keys: {{key.subkey}}
  html = html.replace(/\{\{([a-zA-Z0-9_.]+)\}\}/g, (match, key) => {
    const val = resolve(t, key);
    if (val === null) {
      console.warn(`  MISS: {{${key}}} in ${lang}/${pagePath}`);
      // Fall back to English
      const enVal = resolve(translations['en'], key);
      return enVal !== null ? enVal : match;
    }
    return val;
  });

  // Set html lang attribute
  html = html.replace(/<html lang="[^"]*"/, `<html lang="${lang}"`);

  return html;
}

// Build all pages
let generated = 0;
for (const templatePath of templates) {
  const templateContent = fs.readFileSync(
    path.join(TEMPLATES_DIR, templatePath), 'utf8'
  );

  // Page path relative to lang dir (e.g., "games/" or "tools/soundscope/privacy-policy/")
  const pagePath = path.dirname(templatePath).replace(/\\/g, '/');
  const pageDir = pagePath === '.' ? '' : pagePath + '/';

  for (const lang of languages) {
    const html = replaceKeys(templateContent, lang, pageDir);
    const outDir = path.join(SITE_DIR, lang, pagePath === '.' ? '' : pagePath);
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'index.html'), html, 'utf8');
    generated++;
  }
}

// Generate root index.html with language detection
const rootHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PineSoft — Mobile Apps &amp; Gyroscope Games</title>
  <meta http-equiv="refresh" content="3;url=/en/">
  <link rel="icon" type="image/svg+xml" href="/images/pinesoft_logo.svg">
${generateHreflang('')}
</head>
<body>
  <script>
    (function() {
      var supported = ${JSON.stringify(languages)};
      var userLang = (navigator.language || navigator.userLanguage || 'en').toLowerCase().split('-')[0];
      var target = supported.indexOf(userLang) !== -1 ? userLang : 'en';
      window.location.replace('/' + target + '/');
    })();
  </script>
  <p>Redirecting to <a href="/en/">English</a>...</p>
</body>
</html>`;

fs.writeFileSync(path.join(SITE_DIR, 'index.html'), rootHtml, 'utf8');

// Generate language-detection redirects for old paths (non-lang-prefixed)
// These replace the old static pages so old URLs still work
function generateRedirect(pagePath) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="refresh" content="3;url=/en/${pagePath}">
  <link rel="canonical" href="https://pinesoft.dev/en/${pagePath}">
  <title>Redirecting</title>
</head>
<body>
  <script>
    (function() {
      var supported = ${JSON.stringify(languages)};
      var userLang = (navigator.language || navigator.userLanguage || 'en').toLowerCase().split('-')[0];
      var target = supported.indexOf(userLang) !== -1 ? userLang : 'en';
      window.location.replace('/' + target + '/${pagePath}');
    })();
  </script>
  <p>Redirecting to <a href="/en/${pagePath}">English</a>...</p>
</body>
</html>`;
}

let redirects = 0;
for (const templatePath of templates) {
  const pagePath = path.dirname(templatePath).replace(/\\/g, '/');
  const pageDir = pagePath === '.' ? '' : pagePath + '/';
  // Skip root (already handled above)
  if (pagePath === '.') continue;
  const outDir = path.join(SITE_DIR, pagePath);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'index.html'), generateRedirect(pageDir), 'utf8');
  redirects++;
}

// Also generate redirects for direct app paths (soundscope/, gyro-2048/, horatio/)
const directRedirects = {
  'soundscope': 'tools/soundscope/',
  'gyro-2048': 'games/gyro-2048/',
  'horatio': 'reading/horatio/',
  'soundscope/privacy-policy': 'tools/soundscope/privacy-policy/',
  'gyro-2048/privacy-policy': 'games/gyro-2048/privacy-policy/',
  'horatio/privacy-policy': 'reading/horatio/privacy-policy/'
};

for (const [slug, target] of Object.entries(directRedirects)) {
  const outDir = path.join(SITE_DIR, slug);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'index.html'), generateRedirect(target), 'utf8');
  redirects++;
}

console.log(`\nGenerated ${generated} pages (${templates.length} templates × ${languages.length} languages)`);
console.log(`Generated ${redirects} redirects for old paths`);
console.log('Root index.html updated with language detection');
