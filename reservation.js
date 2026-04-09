/**
 * Tennis Court Reservation Logic
 */

export async function login(page, username, password) {
  await page.goto("https://rippner.clubautomation.com", { waitUntil: "networkidle2" });
  await page.type('input[name="login"]', username, { delay: 50 });
  await page.type('input[name="password"]', password, { delay: 50 });
  
  await Promise.all([
    page.waitForNavigation({ waitUntil: "networkidle2", timeout: 15000 }),
    page.click('button[type="submit"]'),
  ]);
  
  const finalUrl = page.url();
  if (!finalUrl.includes("/member") || finalUrl.includes("/login")) {
    throw new Error("Login failed — still on login page");
  }
}

export async function navigateToReservation(page) {
  await Promise.all([
    page.waitForNavigation({ waitUntil: "networkidle2", timeout: 30000 }),
    page.click('#menu_reserve_a_court'),
  ]);
}

export async function fillSearchForm(page, userId, formattedDate, isWeekday) {
  // Select component
  await page.select('select[name="component"]', await page.$eval(
    'select[name="component"] option',
    opts => [...document.querySelectorAll('select[name="component"] option')]
      .find(o => o.text.includes("Tennis"))?.value || "-1"
  ));

  console.log("Selecting location: South Austin Tennis Center");
  await page.select('select[name="club"]', "1");

  console.log("Selecting court: All Courts");
  await page.select('select[name="court"]', "-1");

  await page.select('select[name="host"]', String(userId));

  // Set date
  console.log("Setting date: " + formattedDate);
  await page.$eval("input[name='date']", (el, d) => {
    el.value = "";
    el.value = d;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    el.dispatchEvent(new Event("blur", { bubbles: true }));
    if (window.jQuery) window.jQuery(el).val(d).trigger("change");
  }, formattedDate);

  // Set interval
  console.log("Setting interval: 60 Min");
  await page.evaluate(() => { document.querySelector("#interval-60").click(); });

  // Set time window
  const timeFrom = isWeekday ? "10" : "18";
  const timeTo = isWeekday ? "12" : "21";
  console.log(`Date check: ${formattedDate} is ${isWeekday ? "weekday" : "weekend"}`);

  const selectedTimes = await page.evaluate((from, to) => {
    const applyValue = (selector, value) => {
      const el = document.querySelector(selector);
      if (!el) return { found: false, value: null };
      el.value = value;
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      if (window.jQuery) window.jQuery(el).val(value).trigger("change").trigger("chosen:updated");
      return { found: true, value: el.value };
    };
    return { from: applyValue("#timeFrom", from), to: applyValue("#timeTo", to) };
  }, timeFrom, timeTo);

  if (!selectedTimes.from.found || !selectedTimes.to.found) {
    throw new Error("Failed to locate time selectors in reservation form");
  }

  console.log(`Time window set to ${selectedTimes.from.value} - ${selectedTimes.to.value}`);
}

export async function searchCourts(page) {

  console.log("Clicking Search, waiting for server response...");

  // Fire search and wait for the POST response to complete
  await Promise.all([
    page.waitForResponse(
      (res) => res.url().includes("reserve-court-new") && res.request().method() === "POST",
      { timeout: 30000 }
    ),
    page.evaluate(() => { document.querySelector("#reserve-court-search").click(); }),

  ]);

  // Wait until the DOM shows either actual bookable time slots OR the explicit "no times" message.
  // Only then is it safe to read results and decide whether to retry.
  // Wait 1 minute for the site to populate results
  console.log("Waiting 60 seconds for results to load...");
  await new Promise(resolve => setTimeout(resolve, 1500));

  // Now check what's in the DOM
  const hasTimeSlots = await page.evaluate(() => {
    return !!(document.querySelector("#times-to-reserve a"));
  });

  const hasNoTimesMessage = await page.evaluate(() => {
    return !!(
      document.querySelector(".r-line.available-not-text, .court-not-available-text") ||
      (document.body?.innerText || "").includes("No available times based on your search criteria.")
    );
  });

  console.log(`Search results: hasTimeSlots=${hasTimeSlots}, hasNoTimesMessage=${hasNoTimesMessage}`);
  return hasTimeSlots? true : hasNoTimesMessage ? false : null;
}

export async function getEarliestSlot(page) {
  await page.waitForSelector("#times-to-reserve td.td-blue a", { timeout: 15000 });

  const firstLink = await page.$("#times-to-reserve td.td-blue a");
  if (!firstLink) return null;

  const time = await page.evaluate((el) => (el.textContent || "").trim(), firstLink);

  // Click the same handle we just read (avoids re-query race)
    await new Promise((resolve) => setTimeout(resolve, 1500));

  await firstLink.click({ delay: 120 });

  // Give site time to render next step after slot click
  await new Promise((resolve) => setTimeout(resolve, 1500));

  return { time };
}

export async function confirmReservation(page, date, slotTime) {
  const confirmation = await page.evaluate((expectedDate, expectedLocation, expectedTime) => {
    const bodyText = document.body?.innerText || "";
    return {
      hasDate: bodyText.includes(expectedDate),
      hasLocation: bodyText.includes(expectedLocation),
      hasTime: expectedTime ? bodyText.includes(expectedTime) : false,
    };
  }, date, "South Austin Tennis Center", slotTime || "");

  if (!confirmation.hasDate || !confirmation.hasLocation || !confirmation.hasTime) {
    return false;
  }

  console.log("Confirmation details verified, waiting for Confirm button...");
  await page.waitForSelector("#confirm", { timeout: 10000 });
  
  await page.evaluate(() => {
    const btn = document.querySelector("#confirm");
    if (btn) btn.scrollIntoView({ behavior: "smooth", block: "center" });
  });
  
  await page.click("#confirm");
  console.log("Confirm button clicked, waiting for navigation...");
  
  await Promise.race([
    page.waitForNavigation({ timeout: 10000 }).catch(() => null),
  ]);

  return true;
}

export async function cancelReservation(page) {
  try {
    await page.waitForSelector("#cancel", { timeout: 3000 });
    await page.click("#cancel");
  } catch (e) {
    console.warn("Cancel button not found or already gone");
  }
}
