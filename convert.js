// All length math goes through meters; all weight math goes through grams.
const LENGTH_TO_M = { mm: 0.001, cm: 0.01, m: 1, in: 0.0254, ft: 0.3048 };
const WEIGHT_TO_G = { g: 1, kg: 1000, lb: 453.59237 };

const LENGTH_UNITS = [
  { key: "mm", label: "Millimeters (mm)" },
  { key: "cm", label: "Centimeters (cm)" },
  { key: "m", label: "Meters (m)" },
  { key: "in", label: "Inches (in)" },
  { key: "ft", label: "Feet (ft)" },
];

const WEIGHT_UNITS = [
  { key: "g", label: "Grams (g)" },
  { key: "kg", label: "Kilograms (kg)" },
  { key: "lb", label: "Pounds (lb)" },
];

function formatNumber(value) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 4 }).format(value);
}

function resultRow(label, value, rawValue) {
  return `
    <div class="result-row">
      <span>${label}</span>
      <span class="value-with-copy">
        <span class="copy-value" data-raw="${rawValue}">${formatNumber(value)}</span>
        <button type="button" class="copy-btn" title="Copy value">⧉</button>
      </span>
    </div>
  `;
}

function renderLength() {
  const value = parseFloat(document.getElementById("lengthValue").value) || 0;
  const unit = document.getElementById("lengthUnit").value;
  const meters = value * LENGTH_TO_M[unit];

  const html = LENGTH_UNITS.map((u) => {
    const converted = meters / LENGTH_TO_M[u.key];
    return resultRow(u.label, converted, converted);
  }).join("");

  document.getElementById("lengthResults").innerHTML = html;
}

function renderDimensions() {
  const length = parseFloat(document.getElementById("dimLength").value) || 0;
  const width = parseFloat(document.getElementById("dimWidth").value) || 0;
  const height = parseFloat(document.getElementById("dimHeight").value) || 0;

  const lengthUnit = document.getElementById("dimLengthUnit").value;
  const widthUnit = document.getElementById("dimWidthUnit").value;
  const heightUnit = document.getElementById("dimHeightUnit").value;

  const lengthM = length * LENGTH_TO_M[lengthUnit];
  const widthM = width * LENGTH_TO_M[widthUnit];
  const heightM = height * LENGTH_TO_M[heightUnit];

  const areaM2 = lengthM * widthM;
  const volumeM3 = lengthM * widthM * heightM;

  const M2_TO_FT2 = 10.7639104167;
  const M3_TO_FT3 = 35.3146667215;

  const areaFt2 = areaM2 * M2_TO_FT2;
  const volumeFt3 = volumeM3 * M3_TO_FT3;

  const html = [
    resultRow("Area (m²)", areaM2, areaM2),
    resultRow("Area (ft²)", areaFt2, areaFt2),
    resultRow("Volume (m³)", volumeM3, volumeM3),
    resultRow("Volume (ft³)", volumeFt3, volumeFt3),
  ].join("");

  document.getElementById("dimResults").innerHTML = html;
}

function renderWeight() {
  const value = parseFloat(document.getElementById("weightValue").value) || 0;
  const unit = document.getElementById("weightUnit").value;
  const grams = value * WEIGHT_TO_G[unit];

  const html = WEIGHT_UNITS.map((u) => {
    const converted = grams / WEIGHT_TO_G[u.key];
    return resultRow(u.label, converted, converted);
  }).join("");

  document.getElementById("weightResults").innerHTML = html;
}

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

function attachCopyHandlers(container) {
  container.addEventListener("click", async (event) => {
    const btn = event.target.closest(".copy-btn");
    if (!btn) return;
    const valueEl = btn.previousElementSibling;
    try {
      await copyText(valueEl.dataset.raw);
      btn.classList.add("copied");
      setTimeout(() => btn.classList.remove("copied"), 1200);
    } catch {
      btn.title = "Copy failed — copy manually";
    }
  });
}

["lengthResults", "dimResults", "weightResults"].forEach((id) =>
  attachCopyHandlers(document.getElementById(id))
);

function renderAll() {
  renderLength();
  renderDimensions();
  renderWeight();
}

document.querySelectorAll("input, select").forEach((el) => el.addEventListener("input", renderAll));
renderAll();
