/**
 * UX Engine - Universal Vision & Chaos Simulator for Web Applications
 * Combines Playwright (Physical Mouse/Keyboard Simulation),
 * Built-in Chaos Monkey (Gremlins-style clicker/typer/toucher),
 * and Console/Network Error Harvester.
 */

const fs = require('fs');
const path = require('path');

// Safe module resolver for Playwright
let playwright;
try {
  playwright = require('playwright');
} catch (e1) {
  try {
    const localPlaywright = path.join(process.cwd(), 'node_modules', 'playwright');
    playwright = require(localPlaywright);
  } catch (e2) {
    console.error('[UX-Engine Fatal] Could not resolve "playwright". Please ensure playwright is installed in your project.');
    process.exit(1);
  }
}

const { chromium } = playwright;

// Parse CLI arguments
const args = process.argv.slice(2);
function getArg(key, defaultValue) {
  const idx = args.indexOf(`--${key}`);
  if (idx !== -1 && idx + 1 < args.length) return args[idx + 1];
  const prefix = `--${key}=`;
  const match = args.find(a => a.startsWith(prefix));
  if (match) return match.slice(prefix.length);
  return defaultValue;
}

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
UX-Engine: Universal Vision & Chaos Testing CLI
Usage:
  node ux-engine.js [options]

Options:
  --url=<url>            Target URL to test (default: http://localhost:3000)
  --mode=<mode>          inspect | chaos | full (default: full)
  --duration=<seconds>   Chaos monkey duration in seconds (default: 8)
  --headless=<bool>      Run headless or open window (default: true)
  --viewport=<WxH>       Viewport dimensions (default: 1440x900)
  --outputDir=<path>     Directory to save screenshots & json report
`);
  process.exit(0);
}

const targetUrl = getArg('url', 'http://localhost:3000');
const mode = getArg('mode', 'full'); // inspect | chaos | full
const durationSec = parseInt(getArg('duration', '8'), 10);
const isHeadless = getArg('headless', 'true') !== 'false';
const outputDir = path.resolve(getArg('outputDir', path.join(process.cwd(), '.ux-reports', `run-${Date.now()}`)));
const [vpWidth, vpHeight] = (getArg('viewport', '1440x900')).split('x').map(n => parseInt(n, 10));

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

async function runUXAudit() {
  const report = {
    targetUrl,
    mode,
    timestamp: new Date().toISOString(),
    viewport: { width: vpWidth, height: vpHeight },
    consoleErrors: [],
    pageErrors: [],
    failedRequests: [],
    screenshots: [],
    chaosMetrics: {
      clicks: 0,
      touches: 0,
      inputs: 0,
      scrolls: 0,
      errorsCaught: 0
    },
    performanceTiming: {},
    summary: ''
  };

  console.log(`[UX-Engine] Launching browser (Headless: ${isHeadless}, Viewport: ${vpWidth}x${vpHeight})...`);
  const browser = await chromium.launch({
    headless: isHeadless,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: vpWidth, height: vpHeight },
    deviceScaleFactor: 2
  });

  const page = await context.newPage();

  // Attach error monitors
  page.on('console', msg => {
    if (msg.type() === 'error') {
      const text = msg.text();
      report.consoleErrors.push({ text, location: msg.location() });
      console.warn(`[Page Console Error] ${text.slice(0, 120)}`);
    }
  });

  page.on('pageerror', error => {
    report.pageErrors.push(error.message || String(error));
    console.error(`[Uncaught Page Error] ${error.message}`);
  });

  page.on('requestfailed', request => {
    report.failedRequests.push({
      url: request.url(),
      method: request.method(),
      failure: request.failure()?.errorText
    });
  });

  try {
    console.log(`[UX-Engine] Navigating to ${targetUrl}...`);
    const t0 = Date.now();
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(1500);
    report.performanceTiming.domContentLoadedMs = Date.now() - t0;

    // 1. Initial Visual Inspection (First Impression)
    console.log(`[UX-Engine] Capturing initial baseline screenshot...`);
    const initialShot = path.join(outputDir, '01_initial_impression.png');
    await page.screenshot({ path: initialShot, fullPage: false });
    report.screenshots.push({ name: 'initial_impression', path: initialShot });

    // 2. Interactive Navigation / Normal Journey inspection
    if (mode === 'full' || mode === 'inspect') {
      console.log(`[UX-Engine] Simulating human-like browsing & hover gestures...`);
      await page.mouse.move(vpWidth / 3, vpHeight / 3);
      await page.waitForTimeout(300);
      await page.mouse.move((vpWidth * 2) / 3, (vpHeight * 2) / 3, { steps: 15 });
      await page.waitForTimeout(500);

      // Scroll test
      await page.evaluate(() => window.scrollBy({ top: 350, behavior: 'smooth' }));
      await page.waitForTimeout(800);
      await page.evaluate(() => window.scrollBy({ top: -350, behavior: 'smooth' }));
      await page.waitForTimeout(500);

      const interactiveShot = path.join(outputDir, '02_after_navigation.png');
      await page.screenshot({ path: interactiveShot, fullPage: false });
      report.screenshots.push({ name: 'after_navigation', path: interactiveShot });
    }

    // 3. Chaos Stress Testing (Monkey Testing)
    if (mode === 'full' || mode === 'chaos') {
      console.log(`[UX-Engine] Initiating Chaos Monkey test (${durationSec}s duration)...`);

      const chaosResults = await page.evaluate(async (duration) => {
        return new Promise((resolve) => {
          let clickCount = 0;
          let scrollCount = 0;
          let inputCount = 0;
          let errCount = 0;
          const endTime = Date.now() + duration;

          const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

          const getRandomElement = () => {
            const all = Array.from(document.querySelectorAll('button, a, input, [role="button"], canvas, svg, div'));
            const visible = all.filter(el => {
              const rect = el.getBoundingClientRect();
              return rect.width > 5 && rect.height > 5 && rect.top >= 0 && rect.bottom <= window.innerHeight;
            });
            return visible[rand(0, visible.length - 1)] || document.body;
          };

          const interval = setInterval(() => {
            if (Date.now() >= endTime) {
              clearInterval(interval);
              resolve({ clickCount, scrollCount, inputCount, errCount });
              return;
            }

            try {
              const actionType = rand(1, 4);
              const target = getRandomElement();
              const rect = target.getBoundingClientRect();

              if (actionType === 1 || actionType === 2) {
                const evt = new MouseEvent('click', {
                  bubbles: true,
                  cancelable: true,
                  clientX: rand(rect.left, rect.right || window.innerWidth),
                  clientY: rand(rect.top, rect.bottom || window.innerHeight)
                });
                target.dispatchEvent(evt);
                clickCount++;
              } else if (actionType === 3) {
                window.scrollBy(rand(-100, 100), rand(-150, 150));
                scrollCount++;
              } else if (actionType === 4 && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
                const sampleTexts = ['123', '!@#$%', 'very_long_test_string_boundary_overflow_xxxxxxxxx', '   '];
                target.value = sampleTexts[rand(0, sampleTexts.length - 1)];
                target.dispatchEvent(new Event('input', { bubbles: true }));
                inputCount++;
              }
            } catch (err) {
              errCount++;
            }
          }, 35);
        });
      }, durationSec * 1000);

      report.chaosMetrics = chaosResults;
      console.log(`[UX-Engine] Chaos completed: ${chaosResults.clickCount} clicks, ${chaosResults.scrollCount} scrolls, ${chaosResults.inputCount} inputs.`);

      await page.waitForTimeout(1000);
      const chaosShot = path.join(outputDir, '03_after_chaos_test.png');
      await page.screenshot({ path: chaosShot, fullPage: false });
      report.screenshots.push({ name: 'after_chaos_test', path: chaosShot });
    }

    const isAlive = await page.evaluate(() => document.body && document.body.clientWidth > 0);
    report.isPageAlive = isAlive;

  } catch (err) {
    report.executionError = err.message || String(err);
    console.error(`[UX-Engine Execution Error]`, err);
  } finally {
    const reportPath = path.join(outputDir, 'ux-report-data.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
    console.log(`[UX-Engine] Audit data written to ${reportPath}`);
    await browser.close();
  }

  return report;
}

runUXAudit().then(() => {
  console.log('[UX-Engine] Complete.');
  process.exit(0);
}).catch(err => {
  console.error('[UX-Engine Fatal]', err);
  process.exit(1);
});
