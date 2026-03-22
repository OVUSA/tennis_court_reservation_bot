/**
 * src/utils/logger.js
 * Structured JSON logger. Output goes to CloudWatch in Lambda, stdout locally.
 */
 
const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };
const CURRENT_LEVEL = LEVELS[process.env.LOG_LEVEL?.toLowerCase()] ?? LEVELS.info;
 
function log(level, message, meta = {}) {
  if (LEVELS[level] < CURRENT_LEVEL) return;
 
  const entry = {
    timestamp: new Date().toISOString(),
    level: level.toUpperCase(),
    message,
    ...(Object.keys(meta).length ? { meta } : {}),
  };
 
  const output = JSON.stringify(entry);
  if (level === "error") console.error(output);
  else if (level === "warn") console.warn(output);
  else console.log(output);
}
 
module.exports = {
  debug: (msg, meta) => log("debug", msg, meta),
  info:  (msg, meta) => log("info",  msg, meta),
  warn:  (msg, meta) => log("warn",  msg, meta),
  error: (msg, meta) => log("error", msg, meta),
};
 