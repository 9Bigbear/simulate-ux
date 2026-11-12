/**
 * UX Engine - Universal Vision, Anti-Bot Stealth & Chaos Simulator for Web Applications
 * Features:
 * 1. Anti-Bot / Anti-Detection Stealth (Bypasses Cloudflare, navigator.webdriver, automation flags)
 * 2. Uses Real Installed Chrome when available
 * 3. Auto-detects local proxy (e.g. 127.0.0.1:12450)
 * 4. Captures High-res retina screenshots & Console/Network errors
 * 5. Built-in Chaos Monkey (Gremlins-style rapid clicker/scroller/typer)
 */

const fs = require('fs');
const path = require('path');
const net = require('net');

// Check local real Chrome installation
function getRealChromePath() {
  const chromePaths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
  ];
  for (const p of chromePaths) {
    if (fs.existsSync(p)) return p;
  }
  return undefined;
}

// Check if a proxy port is open
async function checkProxyAvailable(host, port) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(500);
    socket.on('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.on('error', () => {
      resolve(false);
    });
    socket.connect(port, host);
  });
}
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
UX-Engine: Stealth Vision & Chaos Testing CLI
Usage:
  node ux-engine.js [options]

Options:
  --url=<url>            Target URL to test (default: http://localhost:3000)
  --mode=<mode>          inspect | chaos | full (default: full)
  --duration=<seconds>   Chaos monkey duration in seconds (default: 8)
  --headless=<bool>      Run headless or open window (default: true)
  --proxy=<proxy_url>    Optional proxy server (auto-detects 127.0.0.1:12450 if available)
  --stealth=<bool>       Enable anti-bot fingerpint evasion (default: true)
  --viewport=<WxH>       Viewport dimensions (default: 1440x900)
  --outputDir=<path>     Directory to save screenshots & json report
`);
  process.exit(0);
}

const targetUrl = getArg('url', 'http://localhost:3000');
const mode = getArg('mode', 'full'); // inspect | chaos | full
const durationSec = parseInt(getArg('duration', '8'), 10);
// Default to headed mode (headless: false) so user can visually see Chrome opening and interacting
const isHeadless = getArg('headless', 'false') === 'true';
const outputDir = path.resolve(getArg('outputDir', path.join(process.cwd(), '.ux-reports', `run-${Date.now()}`)));
const [vpWidth, vpHeight] = (getArg('viewport', '1440x900')).split('x').map(n => parseInt(n, 10));
const stealthEnabled = getArg('stealth', 'true') !== 'false';
let proxyConfig = getArg('proxy', null);

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

  // Auto-detect proxy for non-localhost targets
  const isLocalHost = targetUrl.includes('localhost') || targetUrl.includes('127.0.0.1');
  if (!proxyConfig && !isLocalHost) {
    const hasProxy12450 = await checkProxyAvailable('127.0.0.1', 12450);
    if (hasProxy12450) {
      proxyConfig = 'http://127.0.0.1:12450';
      console.log(`[UX-Engine Stealth] Auto-detected active local proxy: ${proxyConfig}`);
    }
  }

  const realChrome = getRealChromePath();
  console.log(`[UX-Engine] Launching browser... (Headless: ${isHeadless}, Real Chrome: ${Boolean(realChrome)})`);

  // Stealth launch arguments: strips automation signals
  const launchArgs = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-blink-features=AutomationControlled',
    '--disable-infobars',
    '--disable-features=IsolateOrigins,site-per-process',
    '--window-size=' + vpWidth + ',' + vpHeight
  ];

  const launchOptions = {
    headless: isHeadless,
    args: launchArgs,
    ignoreDefaultArgs: ['--enable-automation'] // CRITICAL: remove the automation banner flag
  };

  if (realChrome) {
    launchOptions.executablePath = realChrome;
  }

  if (proxyConfig) {
    launchOptions.proxy = { server: proxyConfig };
  }

  const browser = await chromium.launch(launchOptions);

  const context = await browser.newContext({
    viewport: { width: vpWidth, height: vpHeight },
    deviceScaleFactor: 2,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
    locale: 'zh-CN',
    timezoneId: 'Asia/Shanghai'
  });

  // Inject Stealth scripts to erase navigator.webdriver and match real human browser environment
  if (stealthEnabled) {
    await context.addInitScript(() => {
      // 1. Wipe navigator.webdriver
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined
      });

      // 2. Mock chrome object
      window.chrome = {
        app: { isInstalled: false },
        runtime: {},
        loadTimes: function() {},
        csi: function() {}
      };

      // 3. Mock languages and plugins
      Object.defineProperty(navigator, 'languages', {
        get: () => ['zh-CN', 'zh', 'en-US', 'en']
      });

      Object.defineProperty(navigator, 'plugins', {
        get: () => [
          { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer' },
          { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai' },
          { name: 'Native Client', filename: 'internal-nacl-plugin' }
        ]
      });

      // 4. Overwrite permissions query
      const originalQuery = window.navigator.permissions?.query;
      if (originalQuery) {
        window.navigator.permissions.query = (parameters) => (
          parameters.name === 'notifications' ?
            Promise.resolve({ state: Notification.permission }) :
            originalQuery(parameters)
        );
      }
    });
  }

  const page = await context.newPage();

  // Attach error monitors
  page.on('console', msg => {
    if (msg.type() === 'error') {
      const text = msg.text();
      report.consoleErrors.push({ text, location: msg.location() });
      console.warn(`[Page Console Error] ${text.slice(0, 140)}`);
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
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 35000 });
    await page.waitForTimeout(2000);
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

      // Smooth scroll test
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
                const sampleTexts = ['123', '!@#$%', 'boundary_test_text', '   '];
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
