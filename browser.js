/**
 * Browser Setup & Initialization
 */
export async function initBrowser(isLambda) {
  let browser;
  
  if (isLambda) {
    const { default: chromium } = await import("@sparticuz/chromium");
    const { default: puppeteer } = await import("puppeteer-core");  
    chromium.setGraphicsMode = false; 

    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless, // Use the package's default (true)
      ignoreHTTPSErrors: true,
    });
  } else {
    const { default: puppeteer } = await import("puppeteer");
    browser = await puppeteer.launch({
      headless: false,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
  }
  
  return browser;
}

export async function setupPage(browser) {
  const page = await browser.newPage();
  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
    "AppleWebKit/537.36 (KHTML, like Gecko) " +
    "Chrome/122.0.0.0 Safari/537.36"
  );
  return page;
}
