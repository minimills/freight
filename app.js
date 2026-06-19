const RATES = { CAD: 65, USD: 50 };

const ids = [
  "currency", "invoiceTotal", "cargoValue", "freight", "insurance",
  "brokerFees", "hours", "plywoodSheets", "margin",
];
const el = Object.fromEntries(ids.map((id) => [id, document.getElementById(id)]));

const num = (input) => parseFloat(input.value) || 0;

function formatCurrency(value, currency) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(value);
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
  const marginAmt = subtotal * (marginPct / 100);
  const breakdownTotal = subtotal + marginAmt;

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
  set("r-marginAmt", marginAmt);
  set("r-breakdownTotal", breakdownTotal);
  set("r-diff", diff);
  document.getElementById("r-marginPct").textContent = marginPct;

  const diffRow = document.getElementById("r-diffRow");
  diffRow.classList.toggle("positive", diff >= 0);
  diffRow.classList.toggle("negative", diff < 0);
}

ids.forEach((id) => el[id].addEventListener("input", calculate));
calculate();
