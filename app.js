const RATES = { CAD: 65, USD: 50 };

// Google Sheets logging. Deploy the Apps Script in google-apps-script.gs as a
// Web App ("Anyone" access) and paste its /exec URL below to enable "Save Data".
// While blank, the Save Data button shows setup instructions instead.
const SHEETS_WEBAPP_URL = "https://script.google.com/macros/s/AKfycby2vI9bjOGSOsNSMsDPt1hcQaVZy2KEVDgGZ1WYiZTPqpLRTbJSpir0IqOJLY4uv-zfMQ/exec";

const ids = [
  "currency", "invoiceTotal", "freightType", "exchangeRate", "shipDate", "customerName", "quoteNumber",
  "invoiceNumber", "livingstonRef", "cargoValue", "freight",
  "insurance", "brokerFees", "hours", "plywoodSheets", "margin",
];
const el = Object.fromEntries(ids.map((id) => [id, document.getElementById(id)]));

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

function updateInsurance() {
  const cargoValue = parseFloat(el.cargoValue.value) || 0;
  const freight = parseFloat(el.freight.value) || 0;
  el.insurance.value = calculateInsurance(cargoValue, freight).toFixed(2);
}

function calculate() {
  const currency = el.currency.value;
  const rate = RATES[currency];

  const cargoValue = num(el.cargoValue);
  const freight = num(el.freight);
  const insurance = num(el.insurance);
  const brokerFees = num(el.brokerFees);
  const handling = num(el.hours) * rate + num(el.plywoodSheets) * rate;
  const marginPct = num(el.margin);

  const subtotal = cargoValue + freight + insurance + brokerFees + handling;
  const freightSubtotal = subtotal - cargoValue;
  const breakdownTotal = subtotal;
  const totalIncome = breakdownTotal * (1 + marginPct / 100);
  const freightChargeable = freightSubtotal * (1 + marginPct / 100);

  const invoiceTotal = num(el.invoiceTotal);
  const diff = invoiceTotal - breakdownTotal;

  document.getElementById("handlingRateLabel").textContent = `$${rate}/unit`;

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
el.currency.addEventListener("change", updateExchangeRateVisibility);

const DEFAULTS = {
  currency: "CAD",
  invoiceTotal: "",
  freightType: "LTL",
  exchangeRate: "1.35",
  shipDate: "",
  customerName: "",
  quoteNumber: "",
  invoiceNumber: "",
  livingstonRef: "",
  cargoValue: "",
  freight: "",
  insurance: "",
  brokerFees: "",
  hours: "",
  plywoodSheets: "",
  margin: "",
};

document.getElementById("clearBtn").addEventListener("click", () => {
  ids.forEach((id) => (el[id].value = DEFAULTS[id]));
  brokerFeesFlat.checked = false;
  marginButtons.forEach((b) => b.classList.remove("active"));
  updateExchangeRateVisibility();
  updateInsurance();
  updateInvoiceHint();
  calculate();
});

function handlingBreakdownText(rate) {
  const hours = num(el.hours);
  const sheets = num(el.plywoodSheets);
  const parts = [];
  if (hours) parts.push(`${hours} hrs × $${rate}`);
  if (sheets) parts.push(`${sheets} sheets × $${rate}`);
  return parts.join(" + ") || "—";
}

function buildPrintHTML() {
  const currency = el.currency.value;
  const rate = RATES[currency];
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
    ["Livingston Ref #", el.livingstonRef.value.trim()],
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
    <div class="p-row p-sub">(${handlingBreakdownText(rate)})</div>
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
    livingstonRef: el.livingstonRef.value.trim(),
    enteredCurrency: currency,
    exchangeRate: currency === "USD" ? rate : "",
    freightType: el.freightType.value,
    invoiceTotal: num(el.invoiceTotal) * rate,
    cargoValue: cad("r-cargoValue"),
    freight: cad("r-freight"),
    insurance: cad("r-insurance"),
    brokerFees: cad("r-brokerFees"),
    hours: num(el.hours),
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
const saveStatus = document.getElementById("saveStatus");

function showStatus(message, kind) {
  saveStatus.textContent = message;
  saveStatus.className = "save-status" + (kind ? " " + kind : "");
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
    // Apps Script Web Apps don't return CORS headers, so we POST as a simple
    // request (text/plain avoids a preflight) and can't read the response.
    // A resolved fetch means the row was accepted by Google.
    await fetch(SHEETS_WEBAPP_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(data),
    });
    showStatus("Saved to Google Sheets ✓", "ok");
  } catch {
    showStatus("Save failed — check your connection and the Web App URL.", "error");
  } finally {
    saveBtn.disabled = false;
  }
});

el.invoiceTotal.addEventListener("input", updateInvoiceHint);
ids.forEach((id) => el[id].addEventListener("input", calculate));
updateExchangeRateVisibility();
updateInsurance();
updateInvoiceHint();
calculate();
