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

Delivery: ${deliveryAddress()}

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

updateAgentVisibility();
updatePickupVisibility();
updateDeliveryVisibility();
render();
