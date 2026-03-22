/**
 * src/services/authService.js
 * Handles Club Automation login and CSRF token scraping.
 */

const cheerio = require("cheerio");
const logger = require("../utils/logger");

/**
 * Logs in to Club Automation. Mutates the httpClient's cookie jar.
 * @param {import("axios").AxiosInstance} client
 * @param {{ username: string, password: string }} credentials
 */
async function login(client, credentials) {
  logger.info("Fetching login page...");
  const loginPage = await client.get("/login");
  const $ = cheerio.load(loginPage.data);

  const hiddenToken =
    $('input[name="_token"]').val() ||
    $('input[name="csrf_token"]').val() ||
    $('input[name="token"]').val() ||
    null;

  logger.debug("Login page hidden token found", {
    found: !!hiddenToken,
    preview: hiddenToken?.slice(0, 12),
  });

  const payload = new URLSearchParams({
    username: credentials.username,
    password: credentials.password,
    ...(hiddenToken ? { _token: hiddenToken } : {}),
  });

  const res = await client.post("/login", payload.toString(), {
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Referer: `${client.defaults.baseURL}/login`,
    },
  });

  const $post = cheerio.load(res.data);
  const loggedIn =
    $post('a[href*="logout"]').length > 0 ||
    $post('a[href*="sign-out"]').length > 0 ||
    (res.request?.path && res.request.path !== "/login");

  if (!loggedIn) {
    throw new Error(
      "Login failed — check your credentials or the page may have changed structure."
    );
  }

  logger.info("Logged in successfully.");
}

/**
 * Fetches the reserve-court-new page and scrapes a fresh CSRF token.
 * Must be called after login() on every single run.
 * @param {import("axios").AxiosInstance} client
 * @returns {Promise<string>} csrfToken
 */
async function fetchCsrfToken(client) {
  logger.info("Fetching fresh CSRF token from reserve-court-new...");

  const res = await client.get("/event/reserve-court-new", {
    headers: { Referer: `${client.defaults.baseURL}/` },
  });

  const $ = cheerio.load(res.data);

  const csrfToken =
    $("#event_member_token_reserve_court").val() ||
    $('input[name="event_member_token_reserve_court"]').val() ||
    $('input[name="_token"]').val() ||
    null;

  if (!csrfToken) {
    const hiddenFields = [];
    $('input[type="hidden"]').each((_, el) =>
      hiddenFields.push({
        name: $(el).attr("name"),
        id: $(el).attr("id"),
        value: $(el).val()?.slice(0, 20),
      })
    );
    logger.warn("CSRF token not found. All hidden fields:", { hiddenFields });
    throw new Error(
      "CSRF token not found on reserve-court-new page. Check hidden fields in logs."
    );
  }

  logger.info("CSRF token scraped successfully.", {
    preview: csrfToken.slice(0, 12) + "...",
  });
  return csrfToken;
}

module.exports = { login, fetchCsrfToken };