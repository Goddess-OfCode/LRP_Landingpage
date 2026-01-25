// ====== CONFIG ======
const MAPBOX_TOKEN = "pk.eyJ1IjoibGliZXJ0eXJwMSIsImEiOiJjbWt0M2J3MXowdTRxM2RwdTVkd3RyaDl3In0.oU_BfLQyebSa1A8ppjHdqg"; // Set your Mapbox token here (required; free tier available).

// Per-square (100 sq ft) pricing ranges (adjust for your market)
const PRICING = {
  shingle: { low: 350, high: 650 },
  metal:   { low: 700, high: 1200 },
  tile:    { low: 900, high: 1600 }
};

const PITCH_FACTOR = { low: 1.08, medium: 1.16, steep: 1.25 };
const STORIES_MULT = { "1": 1.00, "2": 1.08, "3": 1.15 };
const COMPLEXITY_MULT = { simple: 1.00, average: 1.10, complex: 1.22 };

// ====== DOM ======
const stepEls = [...document.querySelectorAll(".step")];
const step1 = document.getElementById("step1");
const step2 = document.getElementById("step2");
const step3 = document.getElementById("step3");
const status1 = document.getElementById("status1");
const status2 = document.getElementById("status2");

const addressEl = document.getElementById("address");
const materialEl = document.getElementById("material");
const pitchEl = document.getElementById("pitch");
const storiesEl = document.getElementById("stories");
const complexityEl = document.getElementById("complexity");
const materialSelect = document.querySelector(".materialSelect");
const materialSelectCard = materialSelect?.closest(".formCard");
const materialTrigger = materialSelect?.querySelector(".materialSelect__trigger");
const materialTriggerImg = materialSelect?.querySelector(".materialSelect__triggerImg");
const materialTriggerText = materialSelect?.querySelector(".materialSelect__triggerText");
const materialMenu = materialSelect?.querySelector(".materialSelect__menu");
const materialOptions = materialSelect ? [...materialSelect.querySelectorAll(".materialSelect__option")] : [];

const nameEl = document.getElementById("name");
const phoneEl = document.getElementById("phone");
const emailEl = document.getElementById("email");

const toStep2Btn = document.getElementById("toStep2");
const backTo1Btn = document.getElementById("backTo1");
const leadForm = document.getElementById("leadForm");
const startOverBtn = document.getElementById("startOver");

function initMaterialSelect() {
  if (!materialEl || !materialSelect || !materialTrigger || !materialTriggerImg || !materialTriggerText || !materialMenu || !materialOptions.length) return;

  const setSelection = (option, emitChange = true) => {
    if (!option) return;
    const value = option.dataset.value;
    const optionImg = option.querySelector(".materialSelect__optionImg");
    const optionText = option.querySelector(".materialSelect__optionText");

    if (value) materialEl.value = value;
    if (optionImg) materialTriggerImg.src = optionImg.src;
    if (optionText) materialTriggerText.textContent = optionText.textContent;

    materialOptions.forEach((opt) => {
      opt.setAttribute("aria-selected", opt === option ? "true" : "false");
    });

    if (emitChange) materialEl.dispatchEvent(new Event("change", { bubbles: true }));
  };

  const closeMenu = () => {
    materialSelect.classList.remove("materialSelect--open");
    materialTrigger.setAttribute("aria-expanded", "false");
    materialSelectCard?.classList.remove("formCard--open");
  };

  const openMenu = () => {
    materialSelect.classList.add("materialSelect--open");
    materialTrigger.setAttribute("aria-expanded", "true");
    materialSelectCard?.classList.add("formCard--open");
  };

  const initial = materialOptions.find((option) => option.dataset.value === materialEl.value) || materialOptions[0];
  setSelection(initial, false);

  materialTrigger.addEventListener("click", () => {
    if (materialSelect.classList.contains("materialSelect--open")) {
      closeMenu();
    } else {
      openMenu();
    }
  });

  materialOptions.forEach((option) => {
    option.addEventListener("click", () => {
      setSelection(option);
      closeMenu();
      materialTrigger.focus();
    });
  });

  materialEl.addEventListener("change", () => {
    const match = materialOptions.find((option) => option.dataset.value === materialEl.value);
    if (match) setSelection(match, false);
  });

  document.addEventListener("click", (event) => {
    if (!materialSelect.contains(event.target)) closeMenu();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeMenu();
  });
}

initMaterialSelect();

function setStep(n){
  stepEls.forEach(el => el.classList.toggle("active", el.dataset.step === String(n)));
  step1.hidden = n !== 1;
  step2.hidden = n !== 2;
  step3.hidden = n !== 3;
}

function setStatus(el, msg){ el.textContent = msg || ""; }

function formatMoney(n){ return Math.round(n).toLocaleString("en-US"); }

// Basic email/phone checks (not perfect, but better than nothing)
function looksLikeEmail(s){ return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s); }
function looksLikePhone(s){ return s.replace(/\D/g,"").length >= 10; }

// Mercator projection area (ballpark)
function polygonAreaMeters(coords){
  const R = 6378137;
  const pts = coords.map(([lon, lat]) => {
    const x = (lon * Math.PI / 180) * R;
    const y = Math.log(Math.tan((Math.PI/4) + (lat * Math.PI/360))) * R;
    return [x,y];
  });
  let area = 0;
  for (let i=0; i<pts.length; i++){
    const [x1,y1] = pts[i];
    const [x2,y2] = pts[(i+1)%pts.length];
    area += (x1*y2 - x2*y1);
  }
  return Math.abs(area)/2;
}

async function geocodeAddress(address){
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?limit=1&access_token=${MAPBOX_TOKEN}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Geocoding failed. Check Mapbox token.");
  const data = await res.json();
  if (!data.features?.length) throw new Error("Address not found.");
  const [lon, lat] = data.features[0].center;
  return { lon, lat };
}

async function fetchBuildingFootprint(lon, lat){
  const query = `
    [out:json][timeout:25];
    (
      way(around:60,${lat},${lon})["building"];
      relation(around:60,${lat},${lon})["building"];
    );
    out geom;
  `.trim();

  const res = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
    body: "data=" + encodeURIComponent(query)
  });

  if (!res.ok) throw new Error("Footprint lookup failed. Try again.");
  const data = await res.json();
  if (!data.elements?.length) return null;

  let best = null, bestArea = 0;

  for (const el of data.elements){
    const geom = el.geometry;
    if (!geom || geom.length < 3) continue;
    const coords = geom.map(p => [p.lon, p.lat]);
    const areaM = polygonAreaMeters(coords);
    if (areaM > bestArea){
      bestArea = areaM;
      best = coords;
    }
  }

  if (!best) return null;
  return { areaM2: bestArea };
}

function computeEstimate({ footprintSqft, pitch, material, stories, complexity }){
  const pitchFactor = PITCH_FACTOR[pitch] ?? 1.16;
  const storiesMult = STORIES_MULT[stories] ?? 1.0;
  const complexityMult = COMPLEXITY_MULT[complexity] ?? 1.0;

  const roofSqft = footprintSqft * pitchFactor;

  const wasteFactor = 1.10;
  const squares = (roofSqft / 100) * wasteFactor;

  const price = PRICING[material] ?? PRICING.shingle;

  const low = squares * price.low * storiesMult * complexityMult;
  const high = squares * price.high * storiesMult * complexityMult;

  return { roofSqft, squares, low, high };
}

// ====== FLOW ======
toStep2Btn.addEventListener("click", () => {
  const addr = addressEl.value.trim();
  if (!addr){
    setStatus(status1, "Enter an address to continue.");
    return;
  }
  setStatus(status1, "");
  setStep(2);
  nameEl.focus();
});

backTo1Btn.addEventListener("click", () => {
  setStatus(status2, "");
  setStep(1);
});

startOverBtn.addEventListener("click", () => {
  setStatus(status1, "");
  setStatus(status2, "");
  setStep(1);
  stepEls[0].scrollIntoView({behavior:"smooth", block:"start"});
});

// --- Formspree submit handler (replaces getEstimateBtn.addEventListener("click"... ) ---


leadForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const address = addressEl.value.trim();
  const name = nameEl.value.trim();
  const phone = phoneEl.value.trim();
  const email = emailEl.value.trim();

  if (!MAPBOX_TOKEN || String(MAPBOX_TOKEN).trim() === "") {
    setStatus(status2, "Paste your Mapbox token into MAPBOX_TOKEN in testjava.js.");
    return;
  }
  if (!address) {
    setStatus(status2, "Missing address. Go back and enter an address.");
    return;
  }
  if (!name) {
    setStatus(status2, "Enter your name.");
    return;
  }
  if (!looksLikePhone(phone)) {
    setStatus(status2, "Enter a valid phone number.");
    return;
  }
  if (!looksLikeEmail(email)) {
    setStatus(status2, "Enter a valid email address.");
    return;
  }

  try {
    setStatus(status2, "Calculating estimate…");

    const { lon, lat } = await geocodeAddress(address);

    setStatus(status2, "Pulling roof footprint…");
    const footprint = await fetchBuildingFootprint(lon, lat);

    if (!footprint) {
      setStatus(status2, "No building footprint found for this address. Try a nearby address or call for a fast estimate.");
      return;
    }

    const footprintSqft = footprint.areaM2 * 10.7639;

    const est = computeEstimate({
      footprintSqft,
      pitch: pitchEl.value,
      material: materialEl.value,
      stories: storiesEl.value,
      complexity: complexityEl.value
    });

    // Show results on-page
    document.getElementById("areaSqft").textContent = Math.round(est.roofSqft).toLocaleString("en-US");
    document.getElementById("squares").textContent = est.squares.toFixed(1);
    document.getElementById("low").textContent = formatMoney(est.low);
    document.getElementById("high").textContent = formatMoney(est.high);

    // Populate hidden Formspree fields (these must exist in your form)
    document.getElementById("fs_address").value = address;
    document.getElementById("fs_material").value = materialEl.value;
    document.getElementById("fs_pitch").value = pitchEl.value;
    document.getElementById("fs_stories").value = storiesEl.value;
    document.getElementById("fs_complexity").value = complexityEl.value;

    document.getElementById("fs_area_sqft").value = String(Math.round(est.roofSqft));
    document.getElementById("fs_squares").value = String(est.squares.toFixed(1));
    document.getElementById("fs_low").value = String(Math.round(est.low));
    document.getElementById("fs_high").value = String(Math.round(est.high));

    // Submit to Formspree without leaving the page
    const formData = new FormData(leadForm);

    const resp = await fetch(leadForm.action, {
      method: "POST",
      body: formData,
      headers: { "Accept": "application/json" }
    });

    if (!resp.ok) {
      throw new Error("Form submit failed. Please try again.");
    }

    setStatus(status2, "");
    setStep(3);
    step3.scrollIntoView({ behavior: "smooth", block: "start" });

    // OPTIONAL: redirect to thank-you page for Pixel tracking (uncomment if desired)
    // window.location.href = "thank-you.html";

  } catch (err) {
    setStatus(status2, err.message || "Something went wrong.");
  }
});



// start at step 1
setStep(1);
