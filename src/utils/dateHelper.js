/**
 * src/utils/dateHelper.js
 * Date utilities for generating target booking dates.
 */
 
/**
 * Returns a date string in MM/DD/YYYY format.
 * @param {number} daysAhead - how many days from today
 * @returns {string}
 */
function getFutureDate(daysAhead = 1) {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${mm}/${dd}/${yyyy}`;
}
 
/**
 * Parses --date flag from process.argv, or returns a date N days ahead.
 * @param {number} daysAhead
 * @returns {string} MM/DD/YYYY
 */
function resolveDateArg(daysAhead = 1) {
  const args = process.argv.slice(2);
  const idx = args.indexOf("--date");
  if (idx !== -1 && args[idx + 1]) return args[idx + 1];
  return getFutureDate(daysAhead);
}
 
module.exports = { getFutureDate, resolveDateArg };