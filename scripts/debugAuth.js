#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { loadConfig } = require("../src/utils/ConfigLoader");
const {
  buildContextOptions,
  buildLaunchOptions,
  createBrowserType,
  formatAuthSummary,
} = require("../src/browser/BrowserRuntime");

function parseArgs(argv) {
  const result = { authIndex: 0, saveArtifacts: true };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--auth-index") {
      result.authIndex = Number(argv[i + 1]);
      i++;
    } else if (argv[i] === "--no-artifacts") {
      result.saveArtifacts = false;
    }
  }
  if (!Number.isInteger(result.authIndex) || result.authIndex < 0) {
    throw new Error("--auth-index must be a non-negative integer");
  }
  return result;
}

function summarizePageDiagnostics({ url, title, bodyText, signInCount, inputCount }) {
  const normalized = String(bodyText || "").replace(/\s+/g, " ");
  const unsafeBrowserRejected = /browser or app may not be secure|Couldn.t sign you in/i.test(normalized);
  const loginRequired = signInCount > 0 || /accounts\.google\.com|ServiceLogin|signin/i.test(url || "") || unsafeBrowserRejected;
  return {
    inputCount,
    loginRequired,
    signInCount,
    title,
    unsafeBrowserRejected,
    url,
  };
}

function isLoggedInGeminiState(summary) {
  return !summary.loginRequired && !summary.unsafeBrowserRejected && summary.inputCount > 0;
}

async function run() {
  const args = parseArgs(process.argv.slice(2));
  const config = loadConfig();
  const authPath = path.join(config.authDir, `auth-${args.authIndex}.json`);

  if (!fs.existsSync(authPath)) {
    throw new Error(`Auth file not found: ${authPath}`);
  }

  const storageState = JSON.parse(fs.readFileSync(authPath, "utf-8"));
  console.log(`[debugAuth] ${formatAuthSummary(args.authIndex, storageState)}`);
  console.log(`[debugAuth] browserEngine=${config.browserEngine} executablePath=${config.browserExecutablePath || "(default)"} proxy=${config.browserProxy || "(none)"}`);

  const browserType = createBrowserType(config);
  const browser = await browserType.launch(buildLaunchOptions(config));

  try {
    const context = await browser.newContext(buildContextOptions(config, storageState));
    if (config.browserInitScript) {
      await context.addInitScript(config.browserInitScript);
    }

    const page = await context.newPage();
    const failedResponses = [];
    page.on("response", (response) => {
      if (response.status() >= 400) {
        failedResponses.push(`${response.status()} ${response.url().slice(0, 160)}`);
      }
    });

    await page.goto(config.geminiWebUrl, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.waitForTimeout(config.authStateWaitMs);

    const bodyText = await page.locator("body").innerText({ timeout: 5000 }).catch((err) => `BODY_READ_ERROR ${err.message}`);
    const diagnostics = summarizePageDiagnostics({
      bodyText,
      inputCount: await page.locator("rich-textarea div[contenteditable='true'], div[contenteditable='true'], textarea").count().catch(() => 0),
      signInCount: (await page.locator("text=Sign in").count().catch(() => 0)) + (await page.locator("text=登录").count().catch(() => 0)),
      title: await page.title().catch(() => ""),
      url: page.url(),
    });

    console.log(`[debugAuth] diagnostics=${JSON.stringify(diagnostics)}`);
    console.log(`[debugAuth] loggedIn=${isLoggedInGeminiState(diagnostics)}`);
    if (failedResponses.length > 0) {
      console.log(`[debugAuth] failedResponses=${JSON.stringify(failedResponses.slice(0, 20))}`);
    }

    if (args.saveArtifacts) {
      await fs.promises.mkdir("debug", { recursive: true });
      const prefix = `debug/auth-${args.authIndex}-${config.browserEngine}`;
      await page.screenshot({ path: `${prefix}.png`, fullPage: true }).catch(() => {});
      await fs.promises.writeFile(`${prefix}.html`, await page.content().catch((err) => err.message), "utf-8");
      console.log(`[debugAuth] artifacts=${prefix}.png ${prefix}.html`);
    }

    await context.close().catch(() => {});
  } finally {
    await browser.close().catch(() => {});
  }
}

if (require.main === module) {
  run().catch((err) => {
    console.error(`[debugAuth] ERROR ${err.stack || err.message}`);
    process.exit(1);
  });
}

module.exports = {
  isLoggedInGeminiState,
  parseArgs,
  summarizePageDiagnostics,
};
