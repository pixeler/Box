/**
 * Strips files from the packaged Electron app that ship by default but are
 * never read at runtime. The Chromium licence bundle alone is ~10 MB of HTML.
 */
const fs = require('node:fs');
const path = require('node:path');

const KEEP_LOCALES = new Set(['en-US.pak', 'en_US.pak', 'fa.pak']);

const DROP_FILES = [
  'LICENSES.chromium.html',
  'LICENSES.electron.html',
  'version',
  'resources/default_app.asar',
];

function removeIfExists(file) {
  try {
    fs.rmSync(file, { force: true });
    return true;
  } catch {
    return false;
  }
}

module.exports = async function afterPack(context) {
  const dir = context.appOutDir;
  let removed = 0;

  for (const name of DROP_FILES) {
    if (removeIfExists(path.join(dir, name))) removed += 1;
  }

  const locales = path.join(dir, 'locales');
  if (fs.existsSync(locales)) {
    for (const file of fs.readdirSync(locales)) {
      if (KEEP_LOCALES.has(file)) continue;
      removeIfExists(path.join(locales, file));
      removed += 1;
    }
  }

  // eslint-disable-next-line no-console
  console.log(`afterPack: removed ${removed} unused file(s) from ${path.basename(dir)}`);
};
