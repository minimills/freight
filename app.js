const RATES = { CAD: 65, USD: 50 };

// Google Sheets logging. Deploy the Apps Script in google-apps-script.gs as a
// Web App ("Anyone" access) and paste its /exec URL below to enable "Save Data".
// While blank, the Save Data button shows setup instructions instead.
const SHEETS_WEBAPP_URL = "https://script.google.com/macros/s/AKfycby2vI9bjOGSOsNSMsDPt1hcQaVZy2KEVDgGZ1WYiZTPqpLRTbJSpir0IqOJLY4uv-zfMQ/exec";

const ids = [
  "currency", "invoiceTotal", "freightType", "exchangeRate", "shipDate", "customerName", "quoteNumber",
  "invoiceNumber", "refNumber", "carrier", "carrierNew", "subContractor", "cargoValue", "freight",
  "insurance", "brokerFees", "hourlyRate", "hours", "plywoodRate", "plywoodSheets", "margin",
];
const el = Object.fromEntries(ids.map((id) => [id, document.getElementById(id)]));
el.carrierNewField = document.getElementById("carrierNewField");
el.subContractorField = document.getElementById("subContractorField");

// Safe arithmetic evaluator (+, -, *, /, parentheses) — no eval/Function.
function evaluateExpression(expr) {
  const tokens = expr.match(/\d+\.?\d*|\.\d+|[+\-*/()]/g);
  if (!tokens || tokens.join("") !== expr.replace(/\s+/g, "")) return null;

  let pos = 0;
  const peek = () => tokens[pos];
  const next = () => tokens[pos++];

  function parseExpr() {
    let value = parseTerm();
    while (peek() === "+" || peek() === "-") {
      const op = next();
      const rhs = parseTerm();
      value = op === "+" ? value + rhs : value - rhs;
    }
    return value;
  }

  function parseTerm() {
    let value = parseFactor();
    while (peek() === "*" || peek() === "/") {
      const op = next();
      const rhs = parseFactor();
      value = op === "*" ? value * rhs : value / rhs;
    }
    return value;
  }

  function parseFactor() {
    if (peek() === "(") {
      next();
      const value = parseExpr();
      if (peek() !== ")") throw new Error("Mismatched parentheses");
      next();
      return value;
    }
    if (peek() === "-") {
      next();
      return -parseFactor();
    }
    const token = next();
    if (token === undefined || Number.isNaN(Number(token))) throw new Error("Invalid token");
    return Number(token);
  }

  try {
    const result = parseExpr();
    if (pos !== tokens.length || !Number.isFinite(result)) return null;
    return result;
  } catch {
    return null;
  }
}

function num(input) {
  if (input === el.invoiceTotal) {
    const result = evaluateExpression(input.value.trim());
    return result === null ? 0 : result;
  }
  return parseFloat(input.value) || 0;
}

function formatCurrency(value, currency) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(value);
}

function calculateInsurance(cargoValue, freight) {
  const insuredValue = (cargoValue + freight) * 1.1;
  return Math.max(insuredValue * 0.005, 50);
}

function currentCarrierName() {
  return el.carrier.value === "new" ? el.carrierNew.value.trim() : el.carrier.value;
}

function isLivingston() {
  return currentCarrierName() === "Livingston";
}

// Insurance is auto-calculated only for Livingston; every other carrier is a
// manual entry, so we never overwrite what the user typed.
function updateInsurance() {
  if (!isLivingston()) return;
  const cargoValue = parseFloat(el.cargoValue.value) || 0;
  const freight = parseFloat(el.freight.value) || 0;
  el.insurance.value = calculateInsurance(cargoValue, freight).toFixed(2);
}

// Shows/hides the "add new carrier" and Livingston-only sub-contractor fields.
function updateCarrierUI() {
  el.carrierNewField.hidden = el.carrier.value !== "new";
  el.subContractorField.hidden = !isLivingston();
}

function calculate() {
  const currency = el.currency.value;

  const cargoValue = num(el.cargoValue);
  const freight = num(el.freight);
  const insurance = num(el.insurance);
  const brokerFees = num(el.brokerFees);
  const handling = num(el.hours) * num(el.hourlyRate) + num(el.plywoodSheets) * num(el.plywoodRate);
  const marginPct = num(el.margin);

  const subtotal = cargoValue + freight + insurance + brokerFees + handling;
  const freightSubtotal = subtotal - cargoValue;
  const breakdownTotal = subtotal;
  const totalIncome = breakdownTotal * (1 + marginPct / 100);
  const freightChargeable = freightSubtotal * (1 + marginPct / 100);

  const invoiceTotal = num(el.invoiceTotal);
  const diff = invoiceTotal - breakdownTotal;

  const set = (id, val) => {
    const node = document.getElementById(id);
    node.textContent = formatCurrency(val, currency);
    node.dataset.raw = val.toFixed(2);
  };
  set("r-cargoValue", cargoValue);
  set("r-freight", freight);
  set("r-insurance", insurance);
  set("r-brokerFees", brokerFees);
  set("r-handling", handling);
  set("r-subtotal", subtotal);
  set("r-freightSubtotal", freightSubtotal);
  set("r-breakdownTotal", breakdownTotal);
  set("r-totalIncome", totalIncome);
  set("r-freightChargeable", freightChargeable);
  set("r-diff", diff);
  document.getElementById("r-marginPct").textContent = marginPct;
  document.getElementById("r-marginPct2").textContent = marginPct;

  const diffRow = document.getElementById("r-diffRow");
  diffRow.classList.toggle("positive", diff >= 0);
  diffRow.classList.toggle("negative", diff < 0);
}

function updateInvoiceHint() {
  const raw = el.invoiceTotal.value.trim();
  const hint = document.getElementById("invoiceTotalHint");
  const isExpression = /[+\-*/]/.test(raw.slice(1));

  if (!raw || !isExpression) {
    hint.textContent = "";
    hint.classList.remove("error");
    return;
  }

  const result = evaluateExpression(raw);
  if (result === null) {
    hint.textContent = "Invalid expression";
    hint.classList.add("error");
  } else {
    hint.textContent = `= ${formatCurrency(result, el.currency.value)}`;
    hint.classList.remove("error");
  }
}

const brokerFeesFlat = document.getElementById("brokerFeesFlat");
brokerFeesFlat.addEventListener("change", () => {
  el.brokerFees.value = brokerFeesFlat.checked ? "180" : "";
  calculate();
});

const marginButtons = document.querySelectorAll(".margin-btn");
marginButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    el.margin.value = btn.dataset.value;
    marginButtons.forEach((b) => b.classList.toggle("active", b === btn));
    calculate();
  });
});
el.margin.addEventListener("input", () => {
  marginButtons.forEach((b) => b.classList.toggle("active", b.dataset.value === el.margin.value));
});

[el.cargoValue, el.freight].forEach((input) =>
  input.addEventListener("input", () => {
    updateInsurance();
    calculate();
  })
);

function copyText(text) {
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(text);
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  try {
    document.execCommand("copy");
  } finally {
    document.body.removeChild(textarea);
  }
  return Promise.resolve();
}

document.querySelectorAll(".copy-btn").forEach((btn) => {
  btn.addEventListener("click", async () => {
    const target = document.getElementById(btn.dataset.copyTarget);
    try {
      await copyText(target.dataset.raw ?? target.textContent.trim());
      btn.classList.add("copied");
      setTimeout(() => btn.classList.remove("copied"), 1200);
    } catch {
      btn.title = "Copy failed — copy manually";
    }
  });
});

const exchangeRateField = document.getElementById("exchangeRateField");
function updateExchangeRateVisibility() {
  exchangeRateField.hidden = el.currency.value !== "USD";
}

// Handling rates default to the currency's standard rate; changing currency
// resets them (the user can still override afterwards).
function applyCurrencyRateDefaults() {
  el.hourlyRate.value = RATES[el.currency.value];
  el.plywoodRate.value = RATES[el.currency.value];
}

el.currency.addEventListener("change", () => {
  updateExchangeRateVisibility();
  applyCurrencyRateDefaults();
  calculate();
});

el.carrier.addEventListener("change", () => {
  updateCarrierUI();
  updateInsurance();
  calculate();
});
el.carrierNew.addEventListener("input", () => {
  updateCarrierUI();
  updateInsurance();
  calculate();
});

const DEFAULTS = {
  currency: "CAD",
  invoiceTotal: "",
  freightType: "LTL",
  exchangeRate: "1.35",
  shipDate: "",
  customerName: "",
  quoteNumber: "",
  invoiceNumber: "",
  refNumber: "",
  carrier: "Livingston",
  carrierNew: "",
  subContractor: "",
  cargoValue: "",
  freight: "",
  insurance: "",
  brokerFees: "",
  hourlyRate: String(RATES.CAD),
  hours: "",
  plywoodRate: String(RATES.CAD),
  plywoodSheets: "",
  margin: "",
};

document.getElementById("clearBtn").addEventListener("click", () => {
  ids.forEach((id) => (el[id].value = DEFAULTS[id]));
  brokerFeesFlat.checked = false;
  marginButtons.forEach((b) => b.classList.remove("active"));
  updateExchangeRateVisibility();
  updateCarrierUI();
  updateInsurance();
  updateInvoiceHint();
  calculate();
  setEditingRow(null);
});

function handlingBreakdownText() {
  const hours = num(el.hours);
  const sheets = num(el.plywoodSheets);
  const parts = [];
  if (hours) parts.push(`${hours} hrs × $${num(el.hourlyRate)}`);
  if (sheets) parts.push(`${sheets} sheets × $${num(el.plywoodRate)}`);
  return parts.join(" + ") || "—";
}

function buildPrintHTML() {
  const currency = el.currency.value;
  const freightType = el.freightType.value;
  const marginPct = num(el.margin);
  const invoiceTotal = num(el.invoiceTotal);

  const get = (id) => document.getElementById(id).textContent;

  let cadLine = "";
  if (currency === "USD") {
    const exchangeRate = parseFloat(el.exchangeRate.value) || 0;
    const cadValue = invoiceTotal * exchangeRate;
    cadLine = `<div class="p-row p-fx"><strong>${currency}</strong> | ${formatCurrency(cadValue, "CAD")}</div>`;
  }

  const refLines = [
    ["Ship Date", el.shipDate.value],
    ["Customer", el.customerName.value.trim()],
    ["Quote #", el.quoteNumber.value.trim()],
    ["Invoice #", el.invoiceNumber.value.trim()],
    ["Ref #", el.refNumber.value.trim()],
    ["Carrier", currentCarrierName()],
    ["Sub-contractor", isLivingston() ? el.subContractor.value.trim() : ""],
  ]
    .filter(([, value]) => value)
    .map(([label, value]) => `<div class="p-row p-sub">${label}: ${value}</div>`)
    .join("");

  return `
    <div class="p-title">${freightType}</div>
    ${cadLine}
    ${refLines}
    <div class="p-row p-bold">Total Amount on Invoice - ${formatCurrency(invoiceTotal, currency)}</div>
    <hr>
    <div class="p-row">Cargo - ${get("r-cargoValue")}</div>
    <div class="p-row">Freight - ${get("r-freight")}</div>
    <div class="p-row">Insurance - ${get("r-insurance")}</div>
    <div class="p-row">Broker - ${get("r-brokerFees")}</div>
    <div class="p-row">Handling - ${get("r-handling")}</div>
    <div class="p-row p-sub">(${handlingBreakdownText()})</div>
    <div class="p-row">Margin - ${marginPct}%</div>
    <hr>
    <div class="p-row p-bold">Total Breakdown Cost - ${get("r-breakdownTotal")}</div>
    <hr>
    <div class="p-row">Subtotal - ${get("r-subtotal")}</div>
    <div class="p-row">Freight Subtotal - ${get("r-freightSubtotal")}</div>
    <hr>
    <div class="p-row p-bold">Total Income - ${get("r-totalIncome")}</div>
    <hr>
    <div class="p-row p-bold">Difference (Invoice − Breakdown Cost)</div>
    <div class="p-row">${document.getElementById("r-diff").dataset.raw >= 0 ? "Profit" : "Loss"} ${get("r-diff")}</div>
  `;
}

const printArea = document.getElementById("printArea");

document.getElementById("printBtn").addEventListener("click", () => {
  calculate();
  printArea.innerHTML = buildPrintHTML();
  window.print();
});

// ---- Save Data to Google Sheets ----
// Reads the current inputs + computed results into one flat row object whose
// keys become the sheet's column headers (the Apps Script appends by header).
function collectRowData() {
  calculate();
  const currency = el.currency.value;
  // All monetary values are stored in CAD. When the invoice is entered in USD,
  // multiply money amounts by the exchange rate before saving. Non-money fields
  // (hours, sheets, margin %) are left as-is.
  const rate = currency === "USD" ? (parseFloat(el.exchangeRate.value) || 0) : 1;
  const cad = (id) => (parseFloat(document.getElementById(id).dataset.raw) || 0) * rate;
  return {
    timestamp: new Date().toISOString(),
    shipDate: el.shipDate.value,
    customerName: el.customerName.value.trim(),
    quoteNumber: el.quoteNumber.value.trim(),
    invoiceNumber: el.invoiceNumber.value.trim(),
    refNumber: el.refNumber.value.trim(),
    carrier: currentCarrierName(),
    subContractor: isLivingston() ? el.subContractor.value.trim() : "",
    enteredCurrency: currency,
    exchangeRate: currency === "USD" ? rate : "",
    freightType: el.freightType.value,
    invoiceTotal: num(el.invoiceTotal) * rate,
    cargoValue: cad("r-cargoValue"),
    freight: cad("r-freight"),
    insurance: cad("r-insurance"),
    brokerFees: cad("r-brokerFees"),
    hourlyRate: num(el.hourlyRate) * rate,
    hours: num(el.hours),
    plywoodRate: num(el.plywoodRate) * rate,
    plywoodSheets: num(el.plywoodSheets),
    handling: cad("r-handling"),
    marginPct: num(el.margin),
    subtotal: cad("r-subtotal"),
    freightSubtotal: cad("r-freightSubtotal"),
    breakdownTotal: cad("r-breakdownTotal"),
    totalIncome: cad("r-totalIncome"),
    freightChargeable: cad("r-freightChargeable"),
    diff: cad("r-diff"),
  };
}

const saveBtn = document.getElementById("saveBtn");
const updateBtn = document.getElementById("updateBtn");
const saveStatus = document.getElementById("saveStatus");

// Sheet row of the record currently loaded for editing (null = new entry).
let currentRow = null;
let currentRecord = null;

function setEditingRow(row, record) {
  currentRow = row || null;
  currentRecord = record || null;
  updateBtn.hidden = !currentRow;
}

function showStatus(message, kind) {
  saveStatus.textContent = message;
  saveStatus.className = "save-status" + (kind ? " " + kind : "");
}

function postToSheet(data) {
  // Apps Script Web Apps don't return CORS headers, so we POST as a simple
  // request (text/plain avoids a preflight) and can't read the response.
  // A resolved fetch means the row was accepted by Google.
  return fetch(SHEETS_WEBAPP_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(data),
  });
}

saveBtn.addEventListener("click", async () => {
  if (!SHEETS_WEBAPP_URL) {
    showStatus("Not connected yet — paste your Google Apps Script Web App URL into SHEETS_WEBAPP_URL in app.js (see google-apps-script.gs for setup).", "error");
    return;
  }
  const data = collectRowData();
  saveBtn.disabled = true;
  showStatus("Saving…", "");
  try {
    await postToSheet(data);
    showStatus("Saved to Google Sheets ✓", "ok");
  } catch {
    showStatus("Save failed — check your connection and the Web App URL.", "error");
  } finally {
    saveBtn.disabled = false;
  }
});

updateBtn.addEventListener("click", async () => {
  if (!SHEETS_WEBAPP_URL || !currentRow) return;
  const data = collectRowData();
  // Overwrite the loaded row rather than appending. Preserve the original
  // created timestamp and stamp when it was last updated.
  data._updateRow = currentRow;
  if (currentRecord && currentRecord.timestamp) data.timestamp = currentRecord.timestamp;
  data.updatedAt = new Date().toISOString();
  updateBtn.disabled = true;
  showStatus("Updating…", "");
  try {
    await postToSheet(data);
    showStatus("Updated the saved record ✓", "ok");
  } catch {
    showStatus("Update failed — check your connection and the Web App URL.", "error");
  } finally {
    updateBtn.disabled = false;
  }
});

// ---- Load saved records from Google Sheets ----
const loadModal = document.getElementById("loadModal");
const loadList = document.getElementById("loadList");
const loadSearch = document.getElementById("loadSearch");
const loadStatus = document.getElementById("loadStatus");
let loadedRecords = [];

function setLoadStatus(message, kind) {
  loadStatus.textContent = message || "";
  loadStatus.className = "save-status" + (kind ? " " + kind : "");
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

// Reading from an Apps Script Web App cross-origin is blocked by CORS, so we
// use JSONP (a <script> tag with a callback) which isn't subject to it.
function jsonp(url) {
  return new Promise((resolve, reject) => {
    const cb = "__freightCb" + Date.now();
    const script = document.createElement("script");
    function cleanup() {
      delete window[cb];
      script.remove();
    }
    window[cb] = (data) => {
      cleanup();
      resolve(data);
    };
    script.onerror = () => {
      cleanup();
      reject(new Error("network"));
    };
    script.src = url + (url.includes("?") ? "&" : "?") + "callback=" + cb;
    document.body.appendChild(script);
  });
}

function renderLoadList() {
  const q = loadSearch.value.trim().toLowerCase();
  const matches = loadedRecords.filter((r) => {
    if (!q) return true;
    return [r.customerName, r.refNumber, r.invoiceNumber, r.quoteNumber, r.carrier]
      .some((v) => String(v || "").toLowerCase().includes(q));
  });
  loadList.innerHTML = "";
  if (!matches.length) {
    loadList.innerHTML = '<p class="load-empty">No matching records.</p>';
    return;
  }
  // Newest first.
  matches.slice().reverse().forEach((r) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "load-item";
    const money = formatCurrency(parseFloat(r.totalIncome) || 0, "CAD");
    const subBits = [
      r.shipDate,
      r.refNumber ? "Ref " + r.refNumber : "",
      r.invoiceNumber ? "Inv " + r.invoiceNumber : "",
      money,
    ].filter(Boolean).map(escapeHtml).join(" · ");
    item.innerHTML =
      `<span class="load-item-main">${escapeHtml(r.customerName || "—")} · ${escapeHtml(r.freightType || "")}</span>` +
      `<span class="load-item-sub">${subBits}</span>`;
    item.addEventListener("click", () => {
      prefillFromRecord(r);
      closeLoad();
    });
    loadList.appendChild(item);
  });
}

function prefillFromRecord(r) {
  const val = (v) => (v === undefined || v === null ? "" : String(v));
  // Saved amounts are all CAD, so load the form in CAD.
  el.currency.value = "CAD";
  el.exchangeRate.value = DEFAULTS.exchangeRate;
  el.shipDate.value = val(r.shipDate);
  el.customerName.value = val(r.customerName);
  el.quoteNumber.value = val(r.quoteNumber);
  el.invoiceNumber.value = val(r.invoiceNumber);
  el.refNumber.value = val(r.refNumber !== undefined && r.refNumber !== "" ? r.refNumber : r.livingstonRef);

  const carrier = val(r.carrier);
  const presets = Array.from(el.carrier.options).map((o) => o.value);
  if (carrier && presets.includes(carrier)) {
    el.carrier.value = carrier;
    el.carrierNew.value = "";
  } else if (carrier) {
    el.carrier.value = "new";
    el.carrierNew.value = carrier;
  } else {
    el.carrier.value = "Livingston";
    el.carrierNew.value = "";
  }
  el.subContractor.value = val(r.subContractor);
  el.freightType.value = val(r.freightType) || "LTL";
  el.hourlyRate.value = r.hourlyRate !== undefined && r.hourlyRate !== "" ? r.hourlyRate : RATES.CAD;
  el.plywoodRate.value = r.plywoodRate !== undefined && r.plywoodRate !== "" ? r.plywoodRate : RATES.CAD;
  el.invoiceTotal.value = val(r.invoiceTotal);
  el.cargoValue.value = val(r.cargoValue);
  el.freight.value = val(r.freight);
  el.insurance.value = val(r.insurance);
  el.brokerFees.value = val(r.brokerFees);
  el.hours.value = val(r.hours);
  el.plywoodSheets.value = val(r.plywoodSheets);
  el.margin.value = val(r.marginPct);

  brokerFeesFlat.checked = false;
  marginButtons.forEach((b) => b.classList.toggle("active", b.dataset.value === String(r.marginPct)));
  updateExchangeRateVisibility();
  updateCarrierUI();
  updateInvoiceHint();
  calculate();
  setEditingRow(r._row, r);
  showStatus(
    `Loaded ${r.customerName || "record"}${r.invoiceNumber ? " (Inv " + r.invoiceNumber + ")" : ""} — review, then Print or Update.`,
    "ok"
  );
}

function openLoad() {
  loadModal.hidden = false;
  loadSearch.value = "";
  loadList.innerHTML = "";
  if (!SHEETS_WEBAPP_URL) {
    setLoadStatus("Not connected — set SHEETS_WEBAPP_URL in app.js first.", "error");
    return;
  }
  setLoadStatus("Loading…", "");
  jsonp(SHEETS_WEBAPP_URL)
    .then((res) => {
      if (!res || !res.ok) {
        setLoadStatus("Could not read records from the sheet.", "error");
        return;
      }
      loadedRecords = res.records || [];
      if (!loadedRecords.length) {
        setLoadStatus("No saved records yet.", "");
        return;
      }
      setLoadStatus("", "");
      renderLoadList();
    })
    .catch(() => setLoadStatus("Failed to load — check the Web App URL and that it's deployed.", "error"));
}

function closeLoad() {
  loadModal.hidden = true;
}

document.getElementById("loadBtn").addEventListener("click", openLoad);
document.getElementById("loadCloseBtn").addEventListener("click", closeLoad);
loadModal.addEventListener("click", (e) => {
  if (e.target === loadModal) closeLoad();
});
loadSearch.addEventListener("input", renderLoadList);

el.invoiceTotal.addEventListener("input", updateInvoiceHint);
ids.forEach((id) => el[id].addEventListener("input", calculate));
updateExchangeRateVisibility();
updateCarrierUI();
updateInsurance();
updateInvoiceHint();
calculate();
