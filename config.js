/**
 * Configuration & Credentials Loading
 */
let credentials = {};

if (process.env.USERNAME && process.env.PASSWORD && process.env.USER_ID) {
  credentials = {
    username: process.env.USERNAME,
    password: process.env.PASSWORD,
    userId: process.env.USER_ID,
  };
} else {
  try {
    const imported = await import("./credentials.json", { assert: { type: "json" } });
    credentials = imported.default || imported;
  } catch (e) {
    console.warn("credentials.json not found and env vars not set.");
  }
}

export const USERNAME = credentials.USERNAME ?? credentials.username;
export const PASSWORD = credentials.PASSWORD ?? credentials.password;
export const USER_ID = credentials.USER_ID ?? credentials.userId;
export const IS_LAMBDA = !!process.env.AWS_LAMBDA_FUNCTION_NAME;
export const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
export const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

export function validate() {
  if (!USERNAME || !PASSWORD || !USER_ID) {
    throw new Error("Missing credentials. Expected username/password/userId in credentials.json or env vars");
  }
}
