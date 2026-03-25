# Court Reservation Bot

Node.js/Puppeteer automation for Club Automation court reservation flows.

## 🚀 Overview

This script logs into `https://rippner.clubautomation.com`, navigates to “Reserve a Court”, sets the booking criteria, searches for available times, and targets the first available slot.

- Uses real browser (non-headless by default).
- Works with modern Chrome.
- Saves debugging HTML at each stage.
- Runs on Windows / Linux / Mac with Node 16+.

## 🗂️ Project Files

- `index.js` — main Puppeteer automation script
- `credentials.json` — username/password/user id
- `cookies.json` — optional browser cookies storage
- `package.json` — npm metadata
- `src/` — helper modules (not required for this script path)

## ⚙️ Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create `credentials.json`:
   ```json
   {
     "USERNAME": "yourUsername",
     "PASSWORD": "yourPassword",
     "UserID": "123456"
   }
   ```

3. (Optional) Adjust target date:
   - `index.js` defaults `date` to tomorrow.
   - Can be hardcoded or input-controlled.

## ▶️ Run

```bash
node index.js
```

- Headful browser opens.
- Login executes.
- Navigates to reserve page.
- Selects:
  - component `Tennis`
  - club `South Austin Tennis Center`
  - court `All Courts`
  - host `credentials.UserID`
  - date tomorrow
  - interval `90 min`
  - time from/to values
- Clicks Search and captures result.


## 🔧 Known Issues

- May require manual wait for UI readiness if slow network.
- Works better with dev tools open due to timing race; script now has improved waits.
- If “reserve-court-search” click appears to miss, verify selectors and states.

## 🛡️ Improvements

- Add retry loop around date/time state assertions.
- Use precise Ajax response detection (`/event/reserve-court-new` etc.)
- Add robust error handling and exit codes:
  - network / navigation timeouts
  - DOM state mismatches
  - date not accepted
- Add environment config via `.env` and `dotenv`.

## 🧪 Testing

No formal tests yet. Manual:
- Run and verify `debug-results.html` contains available slots / messages.
- Confirm actual 1st available slot click shows confirmation popup.

## ℹ️ Support

If search button fails:
- ensure `button[name="reserve-court-search"]` is visible
- the date input is set to future
- AJAX search request is seen in DevTools network
- output of `debug-results.html` shows form and times table.
