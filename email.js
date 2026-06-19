const STORAGE_KEY = "freightTool.ourAddress";

const el = {
  agentSelect: document.getElementById("agentSelect"),
  newAgentField: document.getElementById("newAgentField"),
  newAgentName: document.getElementById("newAgentName"),
  greeting: document.getElementById("greeting"),
  shipmentType: document.getElementById("shipmentType"),
  originState: document.getElementById("originState"),
  destinationState: document.getElementById("destinationState"),
  pickupType: document.getElementById("pickupType"),
  ourAddressField: document.getElementById("ourAddressField"),
  ourAddress: document.getElementById("ourAddress"),
  newPickupField: document.getElementById("newPickupField"),
  newPickupAddress: document.getElementById("newPickupAddress"),
  deliveryAddress: document.getElementById("deliveryAddress"),
  consigneeName: document.getElementById("consigneeName"),
  consigneePhone: document.getElementById("consigneePhone"),
  consigneeEmail: document.getElementById("consigneeEmail"),
  commodity: document.getElementById("commodity"),
  weightValue: document.getElementById("weightValue"),
  weightUnit: document.getElementById("weightUnit"),
  dimLength: document.getElementById("dimLength"),
  dimWidth: document.getElementById("dimWidth"),
  dimHeight: document.getElementById("dimHeight"),
  dimUnit: document.getElementById("dimUnit"),
  liftgateOrigin: document.getElementById("liftgateOrigin"),
  liftgateDestination: document.getElementById("liftgateDestination"),
};

el.ourAddress.value = localStorage.getItem(STORAGE_KEY) || "";
el.ourAddress.addEventListener("input", () => {
  localStorage.setItem(STORAGE_KEY, el.ourAddress.value);
  render();
});

function updateAgentVisibility() {
  el.newAgentField.hidden = el.agentSelect.value !== "new";
}
el.agentSelect.addEventListener("change", () => {
  updateAgentVisibility();
  render();
});

function updatePickupVisibility() {
  const isNew = el.pickupType.value === "new";
  el.ourAddressField.hidden = isNew;
  el.newPickupField.hidden = !isNew;
}
el.pickupType.addEventListener("change", () => {
  updatePickupVisibility();
  render();
});

function agentFirstName() {
  const name = el.agentSelect.value === "new" ? el.newAgentName.value.trim() : el.agentSelect.value;
  return name.split(" ")[0] || "there";
}

function pickupAddress() {
  return el.pickupType.value === "new" ? el.newPickupAddress.value.trim() : el.ourAddress.value.trim();
}

function buildSubject() {
  const shipmentType = el.shipmentType.value;
  const origin = el.originState.value.trim();
  const destination = el.destinationState.value.trim();
  return `Belfast Mini Mills | ${shipmentType} - ${origin} to ${destination}`;
}

function buildBody() {
  const greeting = el.greeting.value;
  const shipmentType = el.shipmentType.value;
  const destination = el.destinationState.value.trim();

  const weight = el.weightValue.value || "0";
  const weightUnit = el.weightUnit.value;
  const length = el.dimLength.value || "0";
  const width = el.dimWidth.value || "0";
  const height = el.dimHeight.value || "0";
  const dimUnit = el.dimUnit.value;

  return `${greeting} ${agentFirstName()},

Can you please provide us a quote for an ${shipmentType} to ${destination}.

Pick up: ${pickupAddress()}

Delivery: ${el.deliveryAddress.value.trim()}

Consignee name: ${el.consigneeName.value.trim()}
Consignee Phone: ${el.consigneePhone.value.trim()}
Consignee Email: ${el.consigneeEmail.value.trim()}

Commodity: ${el.commodity.value.trim()}
Weight: ${weight} ${weightUnit}
Dimensions: ${length} x ${width} x ${height} ${dimUnit}

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

updateAgentVisibility();
updatePickupVisibility();
render();
