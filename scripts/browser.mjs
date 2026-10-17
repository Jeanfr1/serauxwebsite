// Chromium for the node scripts: $CHROME_PATH, else the newest Playwright download.
import { readdirSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright-core';

export function chromePath() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const base = join(homedir(), 'Library/Caches/ms-playwright');
  const dirs = existsSync(base) ? readdirSync(base).filter((d) => /^chromium-\d+$/.test(d)).sort() : [];
  for (const d of dirs.reverse()) {
    const p = join(base, d, 'chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing');
    const q = join(base, d, 'chrome-mac/Chromium.app/Contents/MacOS/Chromium');
    if (existsSync(p)) return p;
    if (existsSync(q)) return q;
  }
  return chromium.executablePath();
}

export const launch = (opts = {}) => chromium.launch({ executablePath: chromePath(), ...opts });
