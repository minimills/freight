// Geoapify address autocomplete — sign up for a free key at
// https://www.geoapify.com/ (3,000 requests/day) and paste it below.
// Restrict the key to your domain in the Geoapify dashboard since it
// is exposed in client-side code.
const GEOAPIFY_API_KEY = "4c8fa23a870a41c2baf3b8021d3f0283";

// Hardcoded addresses. The select option values are indexes into these.
const PICKUP_ADDRESSES = [
  "Belfast Mini Mills Ltd. 1820 Garfield Road, Belfast. PE. C0A 1A0",
];
const DELIVERY_ADDRESSES = [
  "Belfast Mini Mills Ltd. 1820 Garfield Road, Belfast. PE. C0A 1A0",
  "Belfast Mini Mills 627 Greek River Rd, Murray River, PE C0A 1W0",
];

// Shipment types that use bulk cargo (space + item count) instead of an
// itemized list of pieces.
const BULK_TYPES = ["FTL", "FCL"];

const el = {
  agentSelect: document.getElementById("agentSelect"),
  newAgentField: document.getElementById("newAgentField"),
  newAgentName: document.getElementById("newAgentName"),
  greeting: document.getElementById("greeting"),
  shipmentType: document.getElementById("shipmentType"),
  originState: document.getElementById("originState"),
  destinationState: document.getElementById("destinationState"),
  pickupType: document.getElementById("pickupType"),
  newPickupField: document.getElementById("newPickupField"),
  newPickupAddress: document.getElementById("newPickupAddress"),
  deliveryType: document.getElementById("deliveryType"),
  newDeliveryField: document.getElementById("newDeliveryField"),
  deliveryAddress: document.getElementById("deliveryAddress"),
  businessName: document.getElementById("businessName"),
  notABusiness: document.getElementById("notABusiness"),
  consigneeName: document.getElementById("consigneeName"),
  consigneePhone: document.getElementById("consigneePhone"),
  consigneeEmail: document.getElementById("consigneeEmail"),
  // Itemized cargo
  itemizedCargo: document.getElementById("itemizedCargo"),
  cargoItems: document.getElementById("cargoItems"),
  addCargoBtn: document.getElementById("addCargoBtn"),
  weightUnit: document.getElementById("weightUnit"),
  dimUnit: document.getElementById("dimUnit"),
  // Bulk cargo
  bulkCargo: document.getElementById("bulkCargo"),
  bulkCommodity: document.getElementById("bulkCommodity"),
  bulkItems: document.getElementById("bulkItems"),
  bulkSpace: document.getElementById("bulkSpace"),
  bulkSpaceUnit: document.getElementById("bulkSpaceUnit"),
  bulkWeight: document.getElementById("bulkWeight"),
  bulkWeightUnit: document.getElementById("bulkWeightUnit"),
  containerSizeField: document.getElementById("containerSizeField"),
  containerSize: document.getElementById("containerSize"),
  liftgateOrigin: document.getElementById("liftgateOrigin"),
  liftgateDestination: document.getElementById("liftgateDestination"),
};

function updateAgentVisibility() {
  el.newAgentField.hidden = el.agentSelect.value !== "new";
}
el.agentSelect.addEventListener("change", () => {
  updateAgentVisibility();
  render();
});

function updatePickupVisibility() {
  el.newPickupField.hidden = el.pickupType.value !== "new";
}
el.pickupType.addEventListener("change", () => {
  updatePickupVisibility();
  render();
});

function updateDeliveryVisibility() {
  el.newDeliveryField.hidden = el.deliveryType.value !== "new";
}
el.deliveryType.addEventListener("change", () => {
  updateDeliveryVisibility();
  render();
});

function updateBusinessVisibility() {
  // When "not a business" is ticked, the business-name line is dropped, so
  // grey the field out to make that clear.
  el.businessName.disabled = el.notABusiness.checked;
}
el.notABusiness.addEventListener("change", () => {
  updateBusinessVisibility();
  render();
});

function isBulk() {
  return BULK_TYPES.includes(el.shipmentType.value);
}

function updateCargoMode() {
  const bulk = isBulk();
  el.itemizedCargo.hidden = bulk;
  el.bulkCargo.hidden = !bulk;
  // Container size is only relevant to FCL (containerised ocean freight).
  el.containerSizeField.hidden = el.shipmentType.value !== "FCL";
}
el.shipmentType.addEventListener("change", () => {
  updateCargoMode();
  render();
});

// ---- Itemized cargo rows ----
function makeCargoItem() {
  const row = document.createElement("div");
  row.className = "cargo-item";
  row.innerHTML = `
    <div class="field"><label>Qty</label><input type="number" class="ci-qty" min="0" step="1" placeholder="0"></div>
    <div class="field"><label>Packaging</label><input type="text" class="ci-pkg" placeholder="crates"></div>
    <div class="field"><label>Description</label><input type="text" class="ci-desc" placeholder="commodity"></div>
    <div class="field"><label>Weight</label><input type="number" class="ci-weight" min="0" step="any" placeholder="0"></div>
    <div class="field"><label>L</label><input type="number" class="ci-l" min="0" step="any" placeholder="0"></div>
    <div class="field"><label>W</label><input type="number" class="ci-w" min="0" step="any" placeholder="0"></div>
    <div class="field"><label>H</label><input type="number" class="ci-h" min="0" step="any" placeholder="0"></div>
    <button type="button" class="ci-remove" title="Remove item">×</button>
  `;
  row.querySelector(".ci-remove").addEventListener("click", () => {
    // Always keep at least one row.
    if (el.cargoItems.children.length > 1) {
      row.remove();
    } else {
      row.querySelectorAll("input").forEach((i) => (i.value = ""));
    }
    render();
  });
  return row;
}

el.addCargoBtn.addEventListener("click", () => {
  el.cargoItems.appendChild(makeCargoItem());
  render();
});

// Delegated input handler so dynamically added rows update the email too.
el.cargoItems.addEventListener("input", render);

function cargoItemsData() {
  return Array.from(el.cargoItems.querySelectorAll(".cargo-item")).map((row) => ({
    qty: row.querySelector(".ci-qty").value.trim(),
    pkg: row.querySelector(".ci-pkg").value.trim(),
    desc: row.querySelector(".ci-desc").value.trim(),
    weight: row.querySelector(".ci-weight").value.trim(),
    l: row.querySelector(".ci-l").value.trim(),
    w: row.querySelector(".ci-w").value.trim(),
    h: row.querySelector(".ci-h").value.trim(),
  }));
}

function agentFirstName() {
  const name = el.agentSelect.value === "new" ? el.newAgentName.value.trim() : el.agentSelect.value;
  return name.split(" ")[0] || "there";
}

function pickupAddress() {
  if (el.pickupType.value === "new") return el.newPickupAddress.value.trim();
  return PICKUP_ADDRESSES[Number(el.pickupType.value)] || "";
}

function deliveryAddress() {
  if (el.deliveryType.value === "new") return el.deliveryAddress.value.trim();
  return DELIVERY_ADDRESSES[Number(el.deliveryType.value)] || "";
}

function deliveryBlock() {
  const addr = deliveryAddress();
  if (el.notABusiness.checked) {
    // No business — address sits right after the label, no extra line.
    return `Delivery: ${addr}`;
  }
  // Business — keep the business name (blank if not typed) on the label line
  // and drop the address to its own line just below it.
  return `Delivery: ${el.businessName.value.trim()}\n${addr}`;
}

function buildSubject() {
  const shipmentType = el.shipmentType.value;
  const origin = el.originState.value.trim();
  const destination = el.destinationState.value.trim();
  return `Belfast Mini Mills | ${shipmentType} - ${origin} to ${destination}`;
}

function cargoText() {
  if (isBulk()) {
    const lines = [`Cargo: ${el.bulkCommodity.value.trim()}`];
    const items = el.bulkItems.value.trim();
    const space = el.bulkSpace.value.trim();
    const weight = el.bulkWeight.value.trim();
    if (items) lines.push(`Total items: ${items}`);
    if (space) lines.push(`Total space: ${space} ${el.bulkSpaceUnit.value}`);
    if (weight) lines.push(`Weight: ${weight} ${el.bulkWeightUnit.value}`);
    if (el.shipmentType.value === "FCL") {
      lines.push(`Container size required: ${el.containerSize.value}`);
    }
    return lines.join("\n");
  }

  const weightUnit = el.weightUnit.value;
  const dimUnit = el.dimUnit.value;
  const lines = ["Cargo:"];
  cargoItemsData().forEach((item) => {
    const hasDims = item.l || item.w || item.h;
    if (!item.qty && !item.pkg && !item.desc && !item.weight && !hasDims) return;

    let line = "-";
    const qtyPkg = [item.qty, item.pkg].filter(Boolean).join(" ");
    if (qtyPkg) line += ` ${qtyPkg}`;
    if (item.desc) line += `${qtyPkg ? " of" : ""} ${item.desc}`;
    if (item.weight) line += ` — ${item.weight} ${weightUnit}`;
    if (hasDims) {
      line += ` — ${item.l || 0} x ${item.w || 0} x ${item.h || 0} ${dimUnit}`;
    }
    lines.push(line);
  });
  return lines.join("\n");
}

function buildBody() {
  const greeting = el.greeting.value;
  const shipmentType = el.shipmentType.value;
  const destination = el.destinationState.value.trim();

  return `${greeting} ${agentFirstName()},

Can you please provide us a quote for an ${shipmentType} to ${destination}.

Pick up: ${pickupAddress()}

${deliveryBlock()}

Consignee name: ${el.consigneeName.value.trim()}
Consignee Phone: ${el.consigneePhone.value.trim()}
Consignee Email: ${el.consigneeEmail.value.trim()}

${cargoText()}

Lift-gate at origin: ${el.liftgateOrigin.value}
Lift-gate at destination: ${el.liftgateDestination.value}`;
}

function render() {
  document.getElementById("emailSubject").textContent = buildSubject();
  document.getElementById("emailBody").textContent = buildBody();
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

function flashCopied(btn) {
  btn.classList.add("copied");
  setTimeout(() => btn.classList.remove("copied"), 1200);
}

document.getElementById("copySubjectBtn").addEventListener("click", async (e) => {
  try {
    await copyText(document.getElementById("emailSubject").textContent);
    flashCopied(e.currentTarget);
  } catch {
    e.currentTarget.title = "Copy failed — copy manually";
  }
});

document.getElementById("copyBodyBtn").addEventListener("click", async (e) => {
  try {
    await copyText(document.getElementById("emailBody").textContent);
    flashCopied(e.currentTarget);
  } catch {
    e.currentTarget.title = "Copy failed — copy manually";
  }
});

document.querySelectorAll("input, select, textarea").forEach((node) => node.addEventListener("input", render));

// ---- Geoapify address autocomplete ----
// Attaches a lightweight dropdown of suggestions to an input. Falls back
// to a plain text field (still fully usable) when no API key is set.
function attachAutocomplete(input) {
  if (!GEOAPIFY_API_KEY) return;

  const list = document.createElement("ul");
  list.className = "autocomplete-list";
  input.parentNode.appendChild(list);

  let debounce;
  let controller;

  function close() {
    list.innerHTML = "";
    list.classList.remove("open");
  }

  input.addEventListener("input", () => {
    const text = input.value.trim();
    clearTimeout(debounce);
    if (text.length < 3) {
      close();
      return;
    }
    debounce = setTimeout(async () => {
      if (controller) controller.abort();
      controller = new AbortController();
      const url = `https://api.geoapify.com/v1/geocode/autocomplete?text=${encodeURIComponent(text)}&format=json&limit=5&apiKey=${GEOAPIFY_API_KEY}`;
      try {
        const res = await fetch(url, { signal: controller.signal });
        const data = await res.json();
        list.innerHTML = "";
        (data.results || []).forEach((r) => {
          const li = document.createElement("li");
          li.textContent = r.formatted;
          li.addEventListener("mousedown", (e) => {
            e.preventDefault();
            input.value = r.formatted;
            close();
            render();
          });
          list.appendChild(li);
        });
        list.classList.toggle("open", list.children.length > 0);
      } catch {
        // Network error or aborted request — ignore.
      }
    }, 300);
  });

  input.addEventListener("blur", () => setTimeout(close, 150));
}

attachAutocomplete(el.newPickupAddress);
attachAutocomplete(el.deliveryAddress);

el.cargoItems.appendChild(makeCargoItem());
updateAgentVisibility();
updatePickupVisibility();
updateDeliveryVisibility();
updateBusinessVisibility();
updateCargoMode();
render();
