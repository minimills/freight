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
// NOTE: every monetary column below is stored in CAD. USD invoices are
// converted using exchangeRate before saving; enteredCurrency records what was
// originally typed in.
var HEADERS = [
  "timestamp",
  "shipDate",
  "customerName",
  "quoteNumber",
  "invoiceNumber",
  "refNumber",
  "carrier",
  "subContractor",
  "enteredCurrency",
  "exchangeRate",
  "freightType",
  "invoiceTotal",
  "cargoValue",
  "freight",
  "insurance",
  "brokerFees",
  "hourlyRate",
  "hours",
  "plywoodRate",
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

    // Map values by header NAME (not fixed order) so rows stay aligned even if
    // the column order changes or new keys are added over time. Any key the
    // sheet doesn't have a column for yet is appended as a new column.
    var headerRow = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    Object.keys(data).forEach(function (key) {
      if (headerRow.indexOf(key) === -1) {
        headerRow.push(key);
        sheet.getRange(1, headerRow.length).setValue(key);
      }
    });

    var row = headerRow.map(function (key) {
      return data[key] === undefined ? "" : data[key];
    });
    sheet.appendRow(row);

    return respond({ ok: true }, null);
  } catch (err) {
    return respond({ ok: false, error: String(err) }, null);
  }
}

// Returns every saved row as JSON so the Cost Breakdown page can list records
// and pre-fill the form to edit/print again. Supports JSONP via ?callback= so
// the browser can read it cross-origin (plain GET is blocked by CORS).
function doGet(e) {
  var callback = e && e.parameter ? e.parameter.callback : null;
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
    var records = [];
    if (sheet && sheet.getLastRow() > 1) {
      var values = sheet.getDataRange().getValues();
      var headers = values[0];
      for (var i = 1; i < values.length; i++) {
        var obj = {};
        for (var j = 0; j < headers.length; j++) {
          obj[headers[j]] = values[i][j];
        }
        obj._row = i + 1;
        records.push(obj);
      }
    }
    return respond({ ok: true, records: records }, callback);
  } catch (err) {
    return respond({ ok: false, error: String(err) }, callback);
  }
}

// Wraps a response as JSONP when a callback name is supplied, otherwise plain
// JSON.
function respond(obj, callback) {
  var json = JSON.stringify(obj);
  if (callback) {
    return ContentService
      .createTextOutput(callback + "(" + json + ")")
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService
    .createTextOutput(json)
    .setMimeType(ContentService.MimeType.JSON);
}
