/**
 * src/utils/httpClient.js
 * Builds a persistent cookie-aware axios client reused across all service calls.
 */
 
const axios = require("axios");
const { wrapper } = require("axios-cookiejar-support");
const { CookieJar } = require("tough-cookie");
 
function buildHttpClient(baseUrl) {
  const jar = new CookieJar();
  return wrapper(
    axios.create({
      jar,
      withCredentials: true,
      baseURL: baseUrl,
      timeout: 20000,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) " +
          "AppleWebKit/537.36 (KHTML, like Gecko) " +
          "Chrome/122.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
      maxRedirects: 10,
    })
  );
}
 
module.exports = { buildHttpClient };