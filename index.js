/**
 * Tennis Court Reservation Bot
 * Main entry point
 */
import { USERNAME, PASSWORD, USER_ID, IS_LAMBDA, TELEGRAM_TOKEN, TELEGRAM_CHAT_ID, validate } from "./config.js";
import { getTomorrow, formatDate, isWeekday, addDays } from "./utils.js";
import { sendTelegram } from "./telegram.js";
import { initBrowser, setupPage } from "./browser.js";
import {
  login,
  navigateToReservation,
  fillSearchForm,
  searchCourts,
  getEarliestSlot,
  confirmReservation,
  cancelReservation,
} from "./reservation.js";
import { pathToFileURL } from "node:url";

export const main = async () => {
  validate();

  let searchDate = getTomorrow();
  const maxRetries = 2;
  let attempt = 0;
  let reservationSuccessful = false;

  const browser = await initBrowser(IS_LAMBDA);
  const page = await setupPage(browser);

  try {
    // Login
    console.log("Logging in...");
    await login(page, USERNAME, PASSWORD);

    // Retry loop
    while (attempt < maxRetries && !reservationSuccessful) {
      attempt++;
      const date = formatDate(searchDate);
      console.log(`\n[Attempt ${attempt}/${maxRetries}] Searching for courts on ${date}...`);

      // Navigate & Fill form
      if (attempt === 1) {
        await navigateToReservation(page);
      } else {
        await navigateToReservation(page);
      }

      const dayIsWeekday = isWeekday(searchDate);
      await fillSearchForm(page, USER_ID, date, dayIsWeekday);

      // Search
      const courtsAvailable = await searchCourts(page);

      if (!courtsAvailable) {
        console.log(`❌ No courts available on ${date}`);
        await sendTelegram(
          `❌ No courts available on ${date}`,
          TELEGRAM_TOKEN,
          TELEGRAM_CHAT_ID
        );
        searchDate = addDays(searchDate, 1);
        continue;
      }

      console.log("✅ Courts available! Attempting to reserve...");
      const earlySlot = await getEarliestSlot(page);
      console.log("Clicking " + earlySlot.time + "...");

      // Confirm
      const confirmed = await confirmReservation(page, date, earlySlot.time);

      if (confirmed) {
        console.log(`✅ Court reserved on ${date} at South Austin Tennis Center for ${earlySlot.time}`);
        await sendTelegram(
          `✅ Court reserved on ${date} at South Austin Tennis Center for ${earlySlot.time}`,
          TELEGRAM_TOKEN,
          TELEGRAM_CHAT_ID
        );
        reservationSuccessful = true;
      } else {
        console.error(`❌ Failed to confirm reservation details on  + ${date}`);
        await sendTelegram(
          `❌ Failed to confirm reservation details on " + ${date}`,
          TELEGRAM_TOKEN,
          TELEGRAM_CHAT_ID
        );
        await cancelReservation(page);
        searchDate = addDays(searchDate, 1);
      }
    }

    if (!reservationSuccessful && attempt >= maxRetries) {
      console.error(`⚠️  Could not find courts after checking ${maxRetries} consecutive days`);
    }
    return { reservationSuccessful, attempts: attempt };
  } finally {
    await browser.close();
  }
}
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
  main().catch(function(err) {
    console.error("❌ Unexpected error: " + err.message);
    // process.exit(1);
  });
}
