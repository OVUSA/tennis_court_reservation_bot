/**
 * Uses real Chrome to log in — works on Node 16.
 */

const puppeteer   = require("puppeteer");
const fs          = require("fs");
const credentials = require("./credentials.json");

const tomorrow = new Date();
tomorrow.setDate(tomorrow.getDate() + 1);
const date =
    String(tomorrow.getMonth() + 1).padStart(2, "0") + "/" +
    String(tomorrow.getDate()).padStart(2, "0") + "/" +
    tomorrow.getFullYear();

async function main() {

  const browser = await puppeteer.launch({
    headless: false,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

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
  await page.type('input[name="login"]',    credentials.USERNAME, { delay: 50 });
  await page.type('input[name="password"]', credentials.PASSWORD, { delay: 50 });

  // STEP 3 — click Login button
  await Promise.all([
    page.waitForNavigation({ waitUntil: "networkidle2", timeout: 15000 }),
    page.click('button[type="submit"]'),
  ]);

  // STEP 4 — check where we landed
  const finalUrl = page.url();
  if (!finalUrl.includes("/member") || finalUrl.includes("/login")) {
    console.error("Login failed — still on login page");
    fs.writeFileSync("debug-failed.html", await page.content(), "utf8");
    console.log("Saved debug-failed.html — open in browser to see error");
    await browser.close();
    return;
  }
  // STEP 5 — save session cookies
  // These cookies are what proves we are logged in
  // We will load them into axios for all future requests
  const cookies = await page.cookies();
  
  //fs.writeFileSync("cookies.json", JSON.stringify(cookies, null, 2));

  // STEP 6 — save dashboard HTML so we can inspect it
 // fs.writeFileSync("debug-member.html", await page.content(), "utf8");

// STEP 7 — click "Reserve a Court" link
    await Promise.all([
    page.waitForNavigation({ waitUntil: "networkidle2", timeout: 15000 }),
    page.click('#menu_reserve_a_court'),
    ]);

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
 
  // Host = Olya Velichko (value="57325")
  await page.select('select[name="host"]', credentials.UserID);
 
  // Clear the field first then type the date
  await page.$eval('input[name="date"]', (el, dateValue) => {
    el.value = dateValue;
    
    // Trigger standard JS events
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    
    // If jQuery is globally available on the window, trigger it natively
    if (window.jQuery) {
        window.jQuery(el).trigger('change');
    }
}, date);
 
    console.log("Selecting interval: 90 Min");
    await page.evaluate(() => {
    document.querySelector('#interval-90').click();
        });

//  console.log("Selecting time from: 6:00 PM");
  await page.select('select[name="timeFrom"]', "10");

 // console.log("Selecting time to: 9:00 PM");
  await page.select('select[name="timeTo"]', "14");
 
  // ── STEP 7: Click Search ─────────────────────────────────────────

console.log("Clicking Search...");
 
  await Promise.all([
    // Wait for the AJAX POST response from the server
    page.waitForResponse(
      res => res.url().includes("reserve-court-new") && res.request().method() === "POST",
      { timeout: 15000 }
    ),
    page.click('#reserve-court-search'),
  ]);
 
  // ── STEP 8: Read results ─────────────────────────────────────────
  const resultsHtml = await page.content();
  fs.writeFileSync("debug-results.html", resultsHtml, "utf8");
  console.log("✅ Results saved → debug-results.html");


  console.log("No courts available for this date/time");

 // await browser.close();
}

main().catch(function(err) {
  console.error("❌ Unexpected error: " + err.message);
  process.exit(1);
});
