/**
 * Belfast Mini Mills — Freight Cost Breakdown logger.
 *
 * This Google Apps Script receives a saved breakdown from the Cost Breakdown
 * page and appends it as a row to a Google Sheet. Each save becomes one row;
 * sum/filter the columns in Sheets to produce the figures the insurance broker
 * asks for each June (ocean/air vs inland volumes, CIF + 10% valuation, etc.).
 *
 * ──────────────────── SETUP (one time, ~5 minutes) ────────────────────
 * 1. Create a Google Sheet (e.g. "Freight Data"). Note its tab name; the
 *    default first tab is "Sheet1" (see SHEET_NAME below).
 * 2. In the Sheet: Extensions ▸ Apps Script.
 * 3. Delete any sample code, paste THIS entire file, and Save.
 * 4. Click Deploy ▸ New deployment ▸ gear icon ▸ "Web app".
 *      - Description: anything (e.g. "Freight logger")
 *      - Execute as:  Me (your account)
 *      - Who has access:  Anyone
 *    Click Deploy, then Authorize access and allow the permissions.
 * 5. Copy the "Web app" URL (ends in /exec).
 * 6. Paste that URL into SHEETS_WEBAPP_URL in app.js, then commit/push.
 *
 * To CHANGE the script later you must Deploy ▸ Manage deployments ▸ edit the
 * existing deployment and pick a new version (otherwise the URL keeps the old
 * code). The /exec URL stays the same.
 * ───────────────────────────────────────────────────────────────────────
 */

// Tab name to write to. Change if your tab isn't called "Sheet1".
var SHEET_NAME = "Sheet1";

// Column order. The first save also writes these as a header row. Keep this in
// sync with the keys sent by collectRowData() in app.js.
var HEADERS = [
  "timestamp",
  "customerName",
  "quoteNumber",
  "invoiceNumber",
  "livingstonRef",
  "currency",
  "exchangeRate",
  "freightType",
  "invoiceTotal",
  "cargoValue",
  "freight",
  "insurance",
  "brokerFees",
  "hours",
  "plywoodSheets",
  "handling",
  "marginPct",
  "subtotal",
  "freightSubtotal",
  "breakdownTotal",
  "totalIncome",
  "freightChargeable",
  "diff",
];

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);

    // Write the header row the first time the sheet is used.
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(HEADERS);
    }

    var row = HEADERS.map(function (key) {
      return data[key] === undefined ? "" : data[key];
    });
    sheet.appendRow(row);

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// Lets you open the /exec URL in a browser to confirm the deployment is live.
function doGet() {
  return ContentService.createTextOutput("Freight logger is running.");
}
