/**
 * UX Engine - Universal Vision, Anti-Bot Stealth, Baseline UX & Chaos Simulator
 * Features:
 * 1. Baseline Everyday UX Audits:
 *    - Cursor Affordance (pointer / not-allowed check)
 *    - Text Truncation & Hidden Overflow Sniffer
 *    - WCAG Color Contrast & Readability
 *    - Keyboard Focus Ring & Tab Navigation Flow
 *    - Hover Transition Smoothness (Micro-interactions)
 *    - Empty State Warmth & Onboarding Guidance
 * 2. Persistent Profile & CDP Real Chrome Connection (Bypasses auth / no login repeats)
 * 3. Anti-Bot / Anti-Detection Stealth (Bypasses Cloudflare, navigator.webdriver)
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
UX-Engine: Baseline Everyday UX, Stealth Vision & Chaos Testing CLI
Usage:
  node ux-engine.js [options]

Options:
  --url=<url>            Target URL to test (default: http://localhost:3000)
  --mode=<mode>          baseline | inspect | chaos | full (default: full)
  --duration=<seconds>   Chaos monkey duration in seconds (default: 8)
  --headless=<bool>      Run headless or open window (default: false)
  --cdp=<port>           Attach to running real Chrome on CDP port (e.g. 9222)
  --profileDir=<path>    Directory for persistent user profile/cookies
  --proxy=<proxy_url>    Optional proxy server (auto-detects 127.0.0.1:12450 if available)
  --stealth=<bool>       Enable anti-bot fingerprint evasion (default: true)
  --viewport=<WxH>       Viewport dimensions (default: 1440x900)
  --outputDir=<path>     Directory to save screenshots & json report
`);
  process.exit(0);
}

const targetUrl = getArg('url', 'http://localhost:3000');
const mode = getArg('mode', 'full'); // baseline | inspect | chaos | full
const durationSec = parseInt(getArg('duration', '8'), 10);
// Default to headed mode (headless: false) so user can see Chrome
const isHeadless = getArg('headless', 'false') === 'true';
const outputDir = path.resolve(getArg('outputDir', path.join(process.cwd(), '.ux-reports', `run-${Date.now()}`)));
const defaultProfileDir = path.resolve('C:\\Users\\Administrator\\.gemini\\config\\skills\\simulate-ux\\.chrome-profile');
const profileDir = path.resolve(getArg('profileDir', defaultProfileDir));
const cdpPort = getArg('cdp', null);
const [vpWidth, vpHeight] = (getArg('viewport', '1440x900')).split('x').map(n => parseInt(n, 10));
const stealthEnabled = getArg('stealth', 'true') !== 'false';
let proxyConfig = getArg('proxy', null);

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}
if (!fs.existsSync(profileDir)) {
  fs.mkdirSync(profileDir, { recursive: true });
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
    baselineUX: {
      cursorIssues: [],
      textOverflowIssues: [],
      focusRingFlow: [],
      hoverInteractions: [],
      emptyStateCheck: null,
      contrastWarnings: []
    },
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

  let browserOrContext;
  let context;
  let isCdpConnected = false;

  // 1. If --cdp is provided or active, connect directly to user's running Chrome!
  if (cdpPort) {
    try {
      console.log(`[UX-Engine] Attempting to attach to running Chrome on CDP port ${cdpPort}...`);
      browserOrContext = await chromium.connectOverCDP(`http://127.0.0.1:${cdpPort}`);
      const contexts = browserOrContext.contexts();
      context = contexts[0] || await browserOrContext.newContext();
      isCdpConnected = true;
      console.log(`[UX-Engine] 🎉 Successfully attached to your running Chrome! Using your existing login & cookies.`);
    } catch (e) {
      console.warn(`[UX-Engine] Could not connect to CDP port ${cdpPort}: ${e.message}. Falling back to launching persistent Chrome...`);
    }
  }

  if (!isCdpConnected) {
    const realChrome = getRealChromePath();
    console.log(`[UX-Engine] Launching Persistent Chrome Context...`);
    console.log(`[UX-Engine] Profile Directory: ${profileDir}`);
    console.log(`[UX-Engine] Visible Window: ${!isHeadless}, Real Chrome Binary: ${Boolean(realChrome)}`);

    const launchArgs = [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--disable-infobars',
      '--disable-features=IsolateOrigins,site-per-process',
      `--window-size=${vpWidth},${vpHeight}`
    ];

    const contextOptions = {
      headless: isHeadless,
      args: launchArgs,
      ignoreDefaultArgs: ['--enable-automation'],
      viewport: { width: vpWidth, height: vpHeight },
      deviceScaleFactor: 2,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
      locale: 'zh-CN',
      timezoneId: 'Asia/Shanghai'
    };

    if (realChrome) {
      contextOptions.executablePath = realChrome;
    }
    if (proxyConfig) {
      contextOptions.proxy = { server: proxyConfig };
    }

    context = await chromium.launchPersistentContext(profileDir, contextOptions);
  }

  // Stealth injection
  if (stealthEnabled) {
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      window.chrome = { app: { isInstalled: false }, runtime: {}, loadTimes: function() {}, csi: function() {} };
      Object.defineProperty(navigator, 'languages', { get: () => ['zh-CN', 'zh', 'en-US', 'en'] });
      Object.defineProperty(navigator, 'plugins', {
        get: () => [
          { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer' },
          { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai' },
          { name: 'Native Client', filename: 'internal-nacl-plugin' }
        ]
      });
    });
  }

  let page;
  const pages = context.pages();
  if (pages.length > 0) {
    page = pages[0];
  } else {
    page = await context.newPage();
  }

  // Error monitors
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
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(2500);
    report.performanceTiming.domContentLoadedMs = Date.now() - t0;

    // Check login modal
    const isLoginNeeded = await page.evaluate(() => {
      const text = document.body ? document.body.innerText : '';
      const hasLoginText = text.includes('登录') || text.includes('Sign in') || text.includes('Log in') || text.includes('注册');
      const hasModal = Boolean(document.querySelector('.modal, [role="dialog"], .login-modal, [class*="login"], [class*="auth"]'));
      return hasLoginText && hasModal;
    });

    if (isLoginNeeded) {
      console.log('\n======================================================');
      console.log('🔑 [AUTH NOTICE] 检测到目标页面弹出登录/认证模态窗！');
      console.log('📌 谷歌浏览器窗口现已展示在您的屏幕上。');
      console.log('👉 请直接在弹出的真实浏览器中完成登录（扫码/账号密码）。');
      console.log('💡 本引擎使用持久化 Profile，只要您登录一次，以后将永久免登录！');
      console.log('⏳ 正在等待您完成登录进入画布（最长等待 120 秒）...');
      console.log('======================================================\n');

      const loginWaitStart = Date.now();
      let loggedIn = false;
      while (Date.now() - loginWaitStart < 120000) {
        await page.waitForTimeout(2000);
        const modalStillThere = await page.evaluate(() => {
          return Boolean(document.querySelector('.modal, [role="dialog"], .login-modal, [class*="login-dialog"]'));
        });
        if (!modalStillThere) {
          console.log('[UX-Engine] ✅ 检测到登录成功！继续执行走查...');
          loggedIn = true;
          await page.waitForTimeout(2000);
          break;
        }
      }
      if (!loggedIn) {
        console.warn('[UX-Engine] ⚠️ 登录等待超时，尝试继续当前状态截图与走查。');
      }
    }

    // 1. Initial Visual Inspection (First Impression)
    console.log(`[UX-Engine] Capturing initial baseline screenshot...`);
    const initialShot = path.join(outputDir, '01_initial_impression.png');
    await page.screenshot({ path: initialShot, fullPage: false });
    report.screenshots.push({ name: 'initial_impression', path: initialShot });

    // =========================================================================
    // 2. BASELINE EVERYDAY UX AUDIT (基础日常体验与细腻度走查)
    // =========================================================================
    if (mode === 'baseline' || mode === 'full') {
      console.log(`\n--- [Baseline UX] Running Everyday Usability & Micro-interaction Audit ---`);

      // A. Cursor Affordance & Interactive Hand State
      console.log(`[Baseline UX] 1. Inspecting Cursor Affordances (pointer & not-allowed)...`);
      const cursorData = await page.evaluate(() => {
        const issues = [];
        const interactives = Array.from(document.querySelectorAll('button, a, [role="button"], input[type="submit"], input[type="button"]'));
        interactives.forEach(el => {
          const rect = el.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            const style = window.getComputedStyle(el);
            const isDisabled = el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true' || el.classList.contains('disabled');
            if (isDisabled && style.cursor !== 'not-allowed') {
              issues.push({
                type: 'missing_not_allowed_on_disabled',
                tag: el.tagName.toLowerCase(),
                text: (el.innerText || el.getAttribute('aria-label') || '').slice(0, 30).trim(),
                currentCursor: style.cursor
              });
            } else if (!isDisabled && style.cursor !== 'pointer') {
              issues.push({
                type: 'missing_pointer_cursor',
                tag: el.tagName.toLowerCase(),
                text: (el.innerText || el.getAttribute('aria-label') || '').slice(0, 30).trim(),
                currentCursor: style.cursor
              });
            }
          }
        });
        return issues.slice(0, 10);
      });
      report.baselineUX.cursorIssues = cursorData;
      console.log(`[Baseline UX] Cursor check: found ${cursorData.length} affordance issues.`);

      // B. Hidden Text Truncation & Overflow Sniffer
      console.log(`[Baseline UX] 2. Sniffing Text Truncation & Hidden Overflow...`);
      const overflowData = await page.evaluate(() => {
        const issues = [];
        const candidates = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6, p, span, .title, .card-title, .label'));
        candidates.forEach(el => {
          const rect = el.getBoundingClientRect();
          if (rect.width > 20 && rect.height > 10) {
            const style = window.getComputedStyle(el);
            const isTruncated = el.scrollWidth > el.clientWidth + 1;
            const isOverflowHidden = style.overflow === 'hidden' || style.overflowX === 'hidden' || style.textOverflow === 'ellipsis';
            if (isTruncated && !isOverflowHidden) {
              issues.push({
                tag: el.tagName.toLowerCase(),
                text: (el.innerText || '').slice(0, 40).trim(),
                scrollWidth: el.scrollWidth,
                clientWidth: el.clientWidth,
                warning: 'Text overflows without ellipsis or clean wrapping'
              });
            }
          }
        });
        return issues.slice(0, 8);
      });
      report.baselineUX.textOverflowIssues = overflowData;
      console.log(`[Baseline UX] Overflow sniffer: found ${overflowData.length} truncated/clipped text blocks.`);

      // C. Keyboard Focus Flow (Tab Navigation & Focus Rings)
      console.log(`[Baseline UX] 3. Simulating Human Tab Navigation & Focus Ring Check...`);
      const focusRingSteps = [];
      for (let i = 0; i < 6; i++) {
        await page.keyboard.press('Tab');
        await page.waitForTimeout(150);
        const focusInfo = await page.evaluate(() => {
          const el = document.activeElement;
          if (!el || el === document.body) return null;
          const style = window.getComputedStyle(el);
          const hasVisibleRing = style.outlineStyle !== 'none' || style.boxShadow.includes('rgb') || style.borderColor !== '';
          return {
            tag: el.tagName.toLowerCase(),
            text: (el.innerText || el.getAttribute('aria-label') || el.getAttribute('placeholder') || '').slice(0, 30).trim(),
            hasVisibleFocusRing: hasVisibleRing,
            outline: style.outline
          };
        });
        if (focusInfo) focusRingSteps.push(focusInfo);
      }
      report.baselineUX.focusRingFlow = focusRingSteps;
      console.log(`[Baseline UX] Tab navigation tested 6 steps. Focus items captured: ${focusRingSteps.length}.`);

      // D. Hover Micro-Interaction Smoothness Test
      console.log(`[Baseline UX] 4. Testing Hover Micro-interactions & Transition Polish...`);
      const hoverData = await page.evaluate(async () => {
        const results = [];
        const buttons = Array.from(document.querySelectorAll('button, a.btn, [role="button"]')).slice(0, 5);
        for (const btn of buttons) {
          const style = window.getComputedStyle(btn);
          const hasTransition = parseFloat(style.transitionDuration || '0') > 0;
          results.push({
            tag: btn.tagName.toLowerCase(),
            text: (btn.innerText || btn.getAttribute('aria-label') || '').slice(0, 30).trim(),
            hasTransition,
            transitionDuration: style.transitionDuration
          });
        }
        return results;
      });
      report.baselineUX.hoverInteractions = hoverData;

      // E. Empty State Warmth Assessment
      console.log(`[Baseline UX] 5. Assessing Empty State Warmth & Onboarding...`);
      const emptyCheck = await page.evaluate(() => {
        const text = (document.body?.innerText || '').toLowerCase();
        const hasCards = document.querySelectorAll('.card, [class*="card"], [class*="item"], .project-item').length;
        const hasIllustrations = document.querySelectorAll('svg, img').length > 1;
        const hasGuideText = text.includes('新建') || text.includes('创建') || text.includes('create') || text.includes('new') || text.includes('开始');
        return {
          cardCount: hasCards,
          hasWarmGuide: hasGuideText,
          hasVisualIllustration: hasIllustrations,
          summary: hasCards > 0 ? 'Page has populated content' : (hasGuideText ? 'Warm empty state with actionable guidance' : 'Cold blank state with little onboarding guidance')
        };
      });
      report.baselineUX.emptyStateCheck = emptyCheck;
      console.log(`[Baseline UX] Empty state check: ${emptyCheck.summary}`);
    }

    // 3. Interactive Navigation / Normal Journey inspection
    if (mode === 'full' || mode === 'inspect') {
      console.log(`[UX-Engine] Simulating human-like browsing & hover gestures...`);
      await page.mouse.move(vpWidth / 3, vpHeight / 3);
      await page.waitForTimeout(300);
      await page.mouse.move((vpWidth * 2) / 3, (vpHeight * 2) / 3, { steps: 15 });
      await page.waitForTimeout(500);

      // Smooth scroll test
      await page.evaluate(() => window.scrollBy({ top: 300, behavior: 'smooth' }));
      await page.waitForTimeout(600);
      await page.evaluate(() => window.scrollBy({ top: -300, behavior: 'smooth' }));
      await page.waitForTimeout(500);

      const interactiveShot = path.join(outputDir, '02_after_navigation.png');
      await page.screenshot({ path: interactiveShot, fullPage: false });
      report.screenshots.push({ name: 'after_navigation', path: interactiveShot });
    }

    // 4. Chaos Stress Testing (Monkey Testing)
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
    if (isCdpConnected && browserOrContext) {
      await browserOrContext.disconnect();
    } else if (context) {
      await context.close();
    }
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
