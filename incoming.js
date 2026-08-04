// Incoming shipment tracker. Shares the same Google Apps Script Web App as the
// Cost Breakdown page but writes/reads a separate "Incoming" tab.
const SHEETS_WEBAPP_URL = "https://script.google.com/macros/s/AKfycbyDYZkHAYHIokbP_InluJFrraj8W5SWFJRBzrDdkGicKDeTJfDqfaUV-GH8-ufNSHH26Q/exec";
const SHEET_TAB = "Incoming";

const ids = [
  "currency", "exchangeRate", "freightType", "incoterms", "dateReceived", "supplierName",
  "invoiceNumber", "refNumber", "shippingCompany", "cargoValue", "freight",
  "insurance", "brokerFees", "taxes",
];
const el = Object.fromEntries(ids.map((id) => [id, document.getElementById(id)]));

function num(input) {
  return parseFloat(input.value) || 0;
}

function formatCurrency(value, currency) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(value);
}

// Same insurance formula as the Cost Breakdown page: $0.50 per $100 of insured
// value ((cargo + freight) + 10%), minimum $50.
function calculateInsurance(cargoValue, freight) {
  const insuredValue = (cargoValue + freight) * 1.1;
  return Math.max(insuredValue * 0.005, 50);
}

function updateInsurance() {
  el.insurance.value = calculateInsurance(num(el.cargoValue), num(el.freight)).toFixed(2);
}

function calculate() {
  const currency = el.currency.value;
  const cargoValue = num(el.cargoValue);
  const freight = num(el.freight);
  const insurance = num(el.insurance);
  const brokerFees = num(el.brokerFees);
  const taxes = num(el.taxes);
  const subtotal = cargoValue + freight + insurance + brokerFees + taxes;

  const set = (id, val) => {
    const node = document.getElementById(id);
    node.textContent = formatCurrency(val, currency);
    node.dataset.raw = val.toFixed(2);
  };
  set("r-cargoValue", cargoValue);
  set("r-freight", freight);
  set("r-insurance", insurance);
  set("r-brokerFees", brokerFees);
  set("r-taxes", taxes);
  set("r-subtotal", subtotal);
}

const brokerFeesFlat = document.getElementById("brokerFeesFlat");
brokerFeesFlat.addEventListener("change", () => {
  el.brokerFees.value = brokerFeesFlat.checked ? "180" : "";
  calculate();
});

[el.cargoValue, el.freight].forEach((input) =>
  input.addEventListener("input", () => {
    updateInsurance();
    calculate();
  })
);

const exchangeRateField = document.getElementById("exchangeRateField");
function updateExchangeRateVisibility() {
  exchangeRateField.hidden = el.currency.value !== "USD";
}
el.currency.addEventListener("change", () => {
  updateExchangeRateVisibility();
  calculate();
});

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

const DEFAULTS = {
  currency: "CAD",
  exchangeRate: "1.35",
  freightType: "LTL",
  incoterms: "EXW",
  dateReceived: "",
  supplierName: "",
  invoiceNumber: "",
  refNumber: "",
  shippingCompany: "",
  cargoValue: "",
  freight: "",
  insurance: "",
  brokerFees: "",
  taxes: "",
};

document.getElementById("clearBtn").addEventListener("click", () => {
  ids.forEach((id) => (el[id].value = DEFAULTS[id]));
  brokerFeesFlat.checked = false;
  updateExchangeRateVisibility();
  updateInsurance();
  calculate();
  setEditingRow(null);
});

// ---- Print (4x6) ----
function buildPrintHTML() {
  const currency = el.currency.value;
  const freightType = el.freightType.value;
  const get = (id) => document.getElementById(id).textContent;

  let cadLine = "";
  if (currency === "USD") {
    const exchangeRate = parseFloat(el.exchangeRate.value) || 0;
    const cadTotal = (parseFloat(document.getElementById("r-subtotal").dataset.raw) || 0) * exchangeRate;
    cadLine = `<div class="p-row p-fx"><strong>${currency}</strong> | ${formatCurrency(cadTotal, "CAD")} total</div>`;
  }

  const refLines = [
    ["Date Received", el.dateReceived.value],
    ["Supplier", el.supplierName.value.trim()],
    ["Invoice #", el.invoiceNumber.value.trim()],
    ["Ref #", el.refNumber.value.trim()],
    ["Shipping Co.", el.shippingCompany.value.trim()],
    ["Incoterms", el.incoterms.value],
  ]
    .filter(([, value]) => value)
    .map(([label, value]) => `<div class="p-row p-sub">${label}: ${value}</div>`)
    .join("");

  return `
    <div class="p-title">Incoming — ${freightType}</div>
    ${cadLine}
    ${refLines}
    <hr>
    <div class="p-row">Cargo - ${get("r-cargoValue")}</div>
    <div class="p-row">Freight - ${get("r-freight")}</div>
    <div class="p-row">Insurance - ${get("r-insurance")}</div>
    <div class="p-row">Broker - ${get("r-brokerFees")}</div>
    <div class="p-row">Taxes - ${get("r-taxes")}</div>
    <hr>
    <div class="p-row p-bold">Total Breakdown Cost - ${get("r-subtotal")}</div>
  `;
}

const printArea = document.getElementById("printArea");
document.getElementById("printBtn").addEventListener("click", () => {
  calculate();
  printArea.innerHTML = buildPrintHTML();
  window.print();
});

// ---- Save / Update to Google Sheets ----
// Monetary values are stored in CAD; USD entries are converted first.
function collectRowData() {
  calculate();
  const currency = el.currency.value;
  const rate = currency === "USD" ? (parseFloat(el.exchangeRate.value) || 0) : 1;
  const cad = (id) => (parseFloat(document.getElementById(id).dataset.raw) || 0) * rate;
  return {
    timestamp: new Date().toISOString(),
    dateReceived: el.dateReceived.value,
    supplierName: el.supplierName.value.trim(),
    invoiceNumber: el.invoiceNumber.value.trim(),
    refNumber: el.refNumber.value.trim(),
    shippingCompany: el.shippingCompany.value.trim(),
    incoterms: el.incoterms.value,
    enteredCurrency: currency,
    exchangeRate: currency === "USD" ? rate : "",
    freightType: el.freightType.value,
    cargoValue: cad("r-cargoValue"),
    freight: cad("r-freight"),
    insurance: cad("r-insurance"),
    brokerFees: cad("r-brokerFees"),
    taxes: cad("r-taxes"),
    subtotal: cad("r-subtotal"),
    _sheet: SHEET_TAB,
  };
}

const saveBtn = document.getElementById("saveBtn");
const updateBtn = document.getElementById("updateBtn");
const saveStatus = document.getElementById("saveStatus");

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
  return fetch(SHEETS_WEBAPP_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(data),
  });
}

saveBtn.addEventListener("click", async () => {
  if (!SHEETS_WEBAPP_URL) {
    showStatus("Not connected — set SHEETS_WEBAPP_URL in incoming.js first.", "error");
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

// ---- Load saved records ----
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

function jsonp(url) {
  return new Promise((resolve, reject) => {
    const cb = "__incomingCb" + Date.now();
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
    return [r.supplierName, r.refNumber, r.invoiceNumber, r.shippingCompany]
      .some((v) => String(v || "").toLowerCase().includes(q));
  });
  loadList.innerHTML = "";
  if (!matches.length) {
    loadList.innerHTML = '<p class="load-empty">No matching records.</p>';
    return;
  }
  matches.slice().reverse().forEach((r) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "load-item";
    const money = formatCurrency(parseFloat(r.subtotal) || 0, "CAD");
    const subBits = [
      r.dateReceived,
      r.refNumber ? "Ref " + r.refNumber : "",
      r.invoiceNumber ? "Inv " + r.invoiceNumber : "",
      money,
    ].filter(Boolean).map(escapeHtml).join(" · ");
    item.innerHTML =
      `<span class="load-item-main">${escapeHtml(r.supplierName || "—")} · ${escapeHtml(r.freightType || "")}</span>` +
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
  el.currency.value = "CAD";
  el.exchangeRate.value = DEFAULTS.exchangeRate;
  el.dateReceived.value = val(r.dateReceived);
  el.supplierName.value = val(r.supplierName);
  el.invoiceNumber.value = val(r.invoiceNumber);
  el.refNumber.value = val(r.refNumber);
  el.shippingCompany.value = val(r.shippingCompany);
  el.incoterms.value = val(r.incoterms) || "EXW";
  el.freightType.value = val(r.freightType) || "LTL";
  el.cargoValue.value = val(r.cargoValue);
  el.freight.value = val(r.freight);
  el.insurance.value = val(r.insurance);
  el.brokerFees.value = val(r.brokerFees);
  el.taxes.value = val(r.taxes);
  brokerFeesFlat.checked = false;
  updateExchangeRateVisibility();
  calculate();
  setEditingRow(r._row, r);
  showStatus(
    `Loaded ${r.supplierName || "record"}${r.invoiceNumber ? " (Inv " + r.invoiceNumber + ")" : ""} — review, then Print or Update.`,
    "ok"
  );
}

function openLoad() {
  loadModal.hidden = false;
  loadSearch.value = "";
  loadList.innerHTML = "";
  if (!SHEETS_WEBAPP_URL) {
    setLoadStatus("Not connected — set SHEETS_WEBAPP_URL in incoming.js first.", "error");
    return;
  }
  setLoadStatus("Loading…", "");
  jsonp(SHEETS_WEBAPP_URL + "?sheet=" + encodeURIComponent(SHEET_TAB))
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

ids.forEach((id) => el[id].addEventListener("input", calculate));
updateExchangeRateVisibility();
updateInsurance();
calculate();
