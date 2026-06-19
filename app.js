const RATES = { CAD: 65, USD: 50 };

const ids = [
  "currency", "invoiceTotal", "cargoValue", "freight", "insurance",
  "brokerFees", "hours", "plywoodSheets", "margin",
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
  const freightChargeable = freightSubtotal * (1 + marginPct / 100);

  const invoiceTotal = num(el.invoiceTotal);
  const diff = invoiceTotal - breakdownTotal;

  document.getElementById("handlingRateLabel").textContent = `$${rate}/unit`;

  const set = (id, val) => (document.getElementById(id).textContent = formatCurrency(val, currency));
  set("r-cargoValue", cargoValue);
  set("r-freight", freight);
  set("r-insurance", insurance);
  set("r-brokerFees", brokerFees);
  set("r-handling", handling);
  set("r-subtotal", subtotal);
  set("r-freightSubtotal", freightSubtotal);
  set("r-breakdownTotal", breakdownTotal);
  set("r-freightChargeable", freightChargeable);
  set("r-diff", diff);
  document.getElementById("r-marginPct").textContent = marginPct;

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

el.invoiceTotal.addEventListener("input", updateInvoiceHint);
ids.forEach((id) => el[id].addEventListener("input", calculate));
updateInsurance();
updateInvoiceHint();
calculate();
