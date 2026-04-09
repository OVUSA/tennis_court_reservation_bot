/**
 * Uses real Chrome to log in — works on Node 16.
 */
// Try to load from environment variables first, then fall back to credentials.json for local dev
let credentials = {};

if (process.env.USERNAME && process.env.PASSWORD && process.env.USER_ID) {
  // AWS environment or local env vars set
  credentials = {
    USERNAME: process.env.USERNAME,
    PASSWORD: process.env.PASSWORD,
    USER_ID: process.env.USER_ID,
  };
} else {
  // Fall back to JSON file for local development
  try {
    credentials = await import("./credentials.json", { assert: { type: "json" } });
  } catch (e) {
    console.warn("credentials.json not found and env vars not set. Will fail at credential check.");
  }
}

const fs = await import("node:fs");

const USERNAME = credentials.USERNAME ?? credentials.username;
const PASSWORD = credentials.PASSWORD ?? credentials.password;
const USER_ID = credentials.UserID ?? credentials.userId;

const getTomorrow = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d;
};

const formatDate = (d) => {
  return (
    String(d.getMonth() + 1).padStart(2, "0") + "/" +
    String(d.getDate()).padStart(2, "0") + "/" +
    d.getFullYear()
  );
};
async function sendTelegram(message) {
  const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
  const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
  
  if (!TELEGRAM_TOKEN || !TELEGRAM_CHAT_ID) {
    console.warn("Telegram env vars not set, skipping notification");
    return;
  }

  const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
  const params = {
    chat_id: TELEGRAM_CHAT_ID,
    text: message,
    parse_mode: "HTML"
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
    const data = await response.json();
    if (!data.ok) console.error("Telegram Error:", data.description);
  } catch (e) {
    console.error("Failed to send Telegram message:", e);
  }
}

const isWeekday = (date) => {
  const parsedDate = date instanceof Date ? date : new Date(date);
  const day = parsedDate.getDay();
  return day >= 1 && day <= 5;
};

const addDays = (d, days) => {
  const result = new Date(d);
  result.setDate(result.getDate() + days);
  return result;
};

async function main() {

let searchDate = getTomorrow();
const maxRetries = 2;
let attempt = 0;
let reservationSuccessful = false;

if (!USERNAME || !PASSWORD || !USER_ID) {
  throw new Error("Missing credentials. Expected username/password/userId in credentials.json");
}

const IS_LAMBDA = !!process.env.AWS_LAMBDA_FUNCTION_NAME;

let browser;
if (IS_LAMBDA) {
  const { default: chromium } = await import("@sparticuz/chromium");
  const { default: puppeteer } = await import("puppeteer-core");
  browser = await puppeteer.launch({
    args:           chromium.args,
    executablePath: await chromium.executablePath(),
    headless:       true,
  });
} else {
    const { default: puppeteer } = await import("puppeteer");
    browser = await puppeteer.launch({
    headless: false,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
}

  const page = await browser.newPage();
  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
    "AppleWebKit/537.36 (KHTML, like Gecko) " +
    "Chrome/122.0.0.0 Safari/537.36"
  );

  // STEP 1 — open the login page
  await page.goto("https://rippner.clubautomation.com", {
    waitUntil: "networkidle2",
  });

  // STEP 2 — fill in the form
  await page.type('input[name="login"]', USERNAME, { delay: 50 });
  await page.type('input[name="password"]', PASSWORD, { delay: 50 });

  // STEP 3 — click Login button
  await Promise.all([
    page.waitForNavigation({ waitUntil: "networkidle2", timeout: 15000 }),
    page.click('button[type="submit"]'),
  ]);

  // STEP 4 — check where we landed
  const finalUrl = page.url();
  if (!finalUrl.includes("/member") || finalUrl.includes("/login")) {
    console.error("Login failed — still on login page");
    await browser.close();
    return;
  }
  // STEP 5 — save session cookies
  // These cookies are what proves we are logged in
  // We will load them into axios for all future requests
  const cookies = await page.cookies();
  
  // ── RETRY LOOP: Try multiple dates if courts not available ────────
  while (attempt < maxRetries && !reservationSuccessful) {
    attempt++;
    const date = formatDate(searchDate);
    console.log(`\n[Attempt ${attempt}/${maxRetries}] Searching for courts on ${date}...`);
    
    // STEP 7 — click "Reserve a Court" link
    if (attempt > 1) {
      // On retry, need to navigate back to reserve court page
      await Promise.all([
        page.waitForNavigation({ waitUntil: "networkidle2", timeout: 15000 }),
        page.click('#menu_reserve_a_court'),
      ]);
    } else {
      // First attempt
      await Promise.all([
        page.waitForNavigation({ waitUntil: "networkidle2", timeout: 15000 }),
        page.click('#menu_reserve_a_court'),
      ]);
    }


  // ── STEP 7: Fill the search form ────────────────────────────────
 
  await page.select('select[name="component"]', await page.$eval(
    'select[name="component"] option',
    opts => [...document.querySelectorAll('select[name="component"] option')]
      .find(o => o.text.includes("Tennis"))?.value || "-1"
  ));
 
  // Location = South Austin Tennis Center (value="1")
  console.log("Selecting location: South Austin Tennis Center");
  await page.select('select[name="club"]', "1");
 
  // Court = All Courts (value="-1")
  console.log("Selecting court: All Courts");
  await page.select('select[name="court"]', "-1");
 
  await page.select('select[name="host"]', String(USER_ID));
 
  console.log("Setting date: " + date);
  await page.$eval("input[name='date']", (el, d) => {
    el.value = "";    // clear first
    el.value = d;
    el.dispatchEvent(new Event("input",  { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    el.dispatchEvent(new Event("blur",   { bubbles: true }));
    if (window.jQuery) window.jQuery(el).val(d).trigger("change");
  }, date);

  console.log("Setting interval: 60 Min");
  await page.evaluate(() => { document.querySelector("#interval-60").click(); });

  const isSearchDayWeekday = isWeekday(searchDate);
  const timeFrom = isSearchDayWeekday ? "10" : "18";
  const timeTo = isSearchDayWeekday ? "12" : "21";
  console.log(`Date check: ${date} is ${isSearchDayWeekday ? "weekday" : "weekend"}`);


  const selectedTimes = await page.evaluate((from, to) => {
    const applyValue = (selector, value) => {
      const el = document.querySelector(selector);
      if (!el) return { found: false, value: null };

      el.value = value;
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));

      if (window.jQuery) {
        window.jQuery(el).val(value).trigger("change").trigger("chosen:updated");
      }

      return { found: true, value: el.value };
    };

    return {
      from: applyValue("#timeFrom", from),
      to: applyValue("#timeTo", to),
    };
  }, timeFrom, timeTo);

  if (!selectedTimes.from.found || !selectedTimes.to.found) {
    throw new Error("Failed to locate time selectors in reservation form");
  }

  console.log(`Time window set to ${selectedTimes.from.value} - ${selectedTimes.to.value}`);

 
  // ── STEP 7: Click Search ─────────────────────────────────────────

  console.log("STEP 7 — Clicking Search");
  await Promise.all([
    page.waitForResponse(
      (res) => res.url().includes("reserve-court-new") && res.request().method() === "POST",
      { timeout: 20000 }
    ),
    page.evaluate(() => { document.querySelector("#reserve-court-search").click(); }),
  ]);

  await page.waitForFunction(() => {
    const noTimesContainer = document.querySelector(".r-line.available-not-text, .court-not-available-text");
    const timesTable = document.querySelector("#times-to-reserve");
    const hasBookableLink = !!(timesTable && timesTable.querySelector("a"));
    const placeholderText = (document.querySelector(".times-to-reserve-container")?.textContent || "").trim();
    const isStillPlaceholder = placeholderText.includes("Click \"Search\" to populate reservation times.");
    return !!noTimesContainer || hasBookableLink || !isStillPlaceholder;
  }, { timeout: 20000 });

  console.log("Search submitted, waiting for results...");


  // ── STEP 8: Read results ─────────────────────────────────────────
  const resultsHtml = await page.content();
  // await page.screenshot({ path: 'search-after-click.png' });
 // fs.writeFileSync("debug-results.html", resultsHtml, "utf8");

  const noAvailableTimesFound = await page.evaluate(() => {
    const bodyText = document.body?.innerText || "";
    if (bodyText.includes("No available times based on your search criteria.")) return true;

    const container = document.querySelector(".r-line.available-not-text, .court-not-available-text");
    const text = container?.textContent || "";
    return text.includes("No available times based on your search criteria.");
  });

  if (noAvailableTimesFound || resultsHtml.includes("No available times based on your search criteria.")) {
    const msg = `❌ No courts available on ${date}`;
    console.log(msg);
    // Don't return — try next day
    searchDate = addDays(searchDate, 1);
    continue;
  }
  console.log("✅ Courts available! Attempting to reserve...");
  const earliestSlot = await page.evaluate(() => {
  const table = document.querySelector("#times-to-reserve");
  if (!table) return null;

  const firstLink = table.querySelector("a");
  if (!firstLink) return null;

    return {
      time: firstLink.innerText.trim(),   // e.g. "11:00am"
    };
    
  });
  console.log("Clicking " + earliestSlot.time + "...");
    await page.evaluate(() => {
    const table    = document.querySelector("#times-to-reserve");
    const firstLink = table.querySelector("a");
    firstLink.click();
});

  const confirmation = await page.evaluate((expectedDate, expectedLocation, expectedTime) => {
    const bodyText = document.body?.innerText || "";
    return {
      hasDate: bodyText.includes(expectedDate),
      hasLocation: bodyText.includes(expectedLocation),
      hasTime: expectedTime ? bodyText.includes(expectedTime) : false,
    };
  }, date, "South Austin Tennis Center", earliestSlot?.time || "");

  if (confirmation.hasDate && confirmation.hasLocation && confirmation.hasTime) {
    await page.evaluate(() => {
      const confirmAndReserve = document.querySelector("#confirm");
      if (confirmAndReserve) confirmAndReserve.click();
    });
    console.log(`✅ Court reserved on ${date} at South Austin Tennis Center for ${earliestSlot.time}`);
    await sendTelegram(`✅ Court reserved on ${date} at South Austin Tennis Center for ${earliestSlot.time}`);
    reservationSuccessful = true;
  } else {
    console.error("❌ Failed to confirm reservation details on " + date);
    await page.evaluate(() => {
      const confirmAndCancel = document.querySelector("#cancel");
      if (confirmAndCancel) confirmAndCancel.click();
    });
    // Try next day
    searchDate = addDays(searchDate, 1);
  }

  } // End of retry while loop

  if (!reservationSuccessful && attempt >= maxRetries) {
    console.error(`⚠️  Could not find courts after checking ${maxRetries} consecutive days`);
  }

 // await browser.close();
}

main().catch(function(err) {
  console.error("❌ Unexpected error: " + err.message);
 // process.exit(1);
});
