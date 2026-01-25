// Utilities
const $ = (sel) => document.querySelector(sel);

function setYear() {
  const yearEl = $("#year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();
}

const preferredDateInput = document.getElementById("preferredDate");
const preferredTimeInput = document.getElementById("preferredTime");
const timezoneInput = document.getElementById("timezone");

if (preferredDateInput) {
  preferredDateInput.min = new Date().toISOString().split("T")[0];
}

const quoteForm = document.getElementById("quoteForm");

if (quoteForm) {
  quoteForm.addEventListener("submit", async function (e) {
    const statusEl = document.getElementById("formStatus");
    const addressInput = document.getElementById("address");
    const manualAddressEl = document.getElementById("manualAddress");
    const manualAddressVisible = manualAddressEl ? manualAddressEl.style.display === "block" : false;

    if (addressInput && !addressInput.disabled && !addressSelected && !manualAddressVisible) {
      e.preventDefault();
      alert("Please select a valid address from the suggestions.");
      return;
    }

    if (!this.checkValidity()) {
      e.preventDefault();
      this.reportValidity();
      return;
    }

    if (preferredDateInput && preferredTimeInput) {
      const selectedDate = preferredDateInput.value;
      const selectedTime = preferredTimeInput.value;
      const selectedDateTime = new Date(`${selectedDate}T${selectedTime}`);

      if (Number.isNaN(selectedDateTime.getTime()) || selectedDateTime.getTime() < Date.now()) {
        e.preventDefault();
        if (statusEl) {
          statusEl.className = "formStatus formStatus--bad";
          statusEl.textContent = "Please choose a future date and time.";
        }
        return;
      }
    }

    e.preventDefault();

    if (timezoneInput) {
      timezoneInput.value = Intl.DateTimeFormat().resolvedOptions().timeZone || "Local";
    }

    const formData = Object.fromEntries(new FormData(this).entries());
    if (statusEl) {
      statusEl.className = "formStatus";
      statusEl.textContent = "";
    }

    try {
      const response = await fetch("https://formspree.io/f/xqearbyz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        if (statusEl) {
          statusEl.className = "formStatus formStatus--ok";
          statusEl.textContent = "Your request has been sent successfully.";
        }
        this.reset();
      } else {
        throw new Error();
      }
    } catch {
      if (statusEl) {
        statusEl.className = "formStatus formStatus--bad";
        statusEl.textContent = "Something went wrong. Please try again.";
      }
    }
  });

  setTimeout(() => {
    if (typeof google === "undefined") {
      const manualAddressEl = document.getElementById("manualAddress");
      const addressInput = document.getElementById("address");
      if (manualAddressEl && addressInput) {
        manualAddressEl.style.display = "block";
        addressInput.disabled = true;
        alert("Address verification unavailable. Please enter your address manually.");
      }
    }
  }, 3000);
}

let autocomplete;
let addressSelected = false;

function initAutocomplete() {
  const addressInput = document.getElementById("address");
  if (!addressInput || !window.google?.maps?.places) return;

  autocomplete = new google.maps.places.Autocomplete(addressInput, {
    types: ["address"],
    componentRestrictions: { country: "us" },
    fields: ["formatted_address", "geometry"]
  });

  const latEl = document.getElementById("lat");
  const lngEl = document.getElementById("lng");

  autocomplete.addListener("place_changed", () => {
    const place = autocomplete.getPlace();

    if (!place.geometry) {
      addressSelected = false;
      return;
    }

    addressInput.value = place.formatted_address;
    if (latEl) latEl.value = place.geometry.location.lat();
    if (lngEl) lngEl.value = place.geometry.location.lng();

    addressSelected = true;
  });

  addressInput.addEventListener("input", () => {
    addressSelected = false;
    if (latEl) latEl.value = "";
    if (lngEl) lngEl.value = "";
  });
}

// Mobile menu toggle
function initMobileMenu() {
  const header = $("#header");
  const btn = $("#hamburger");
  const menu = $("#mobileMenu");

  if (!header || !btn || !menu) return;

  btn.addEventListener("click", () => {
    const isOpen = header.classList.toggle("header--open");
    btn.setAttribute("aria-expanded", String(isOpen));
    menu.setAttribute("aria-hidden", String(!isOpen));
  });

  // Close on link click
  menu.addEventListener("click", (e) => {
    const target = e.target;
    if (target && target.matches("a")) {
      header.classList.remove("header--open");
      btn.setAttribute("aria-expanded", "false");
      menu.setAttribute("aria-hidden", "true");
    }
  });
}

function initHeroVideoAudio() {
  const video = document.querySelector(".videoCard__media");
  const muteBtn = document.querySelector(".videoCard__mute");

  if (!video || !muteBtn) return;

  const syncMuteState = () => {
    const isMuted = video.muted || video.volume === 0;
    muteBtn.textContent = isMuted ? "Unmute" : "Mute";
    muteBtn.setAttribute("aria-label", isMuted ? "Unmute video" : "Mute video");
  };

  const playWithAudioFallback = () => {
    video.muted = false;
    video.removeAttribute("muted");

    const playPromise = video.play();
    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch(() => {
        video.muted = true;
        video.setAttribute("muted", "");
        const mutedPromise = video.play();
        if (mutedPromise && typeof mutedPromise.catch === "function") {
          mutedPromise.catch(() => {});
        }
        syncMuteState();
      });
    }
  };

  muteBtn.addEventListener("click", () => {
    const isMuted = video.muted || video.volume === 0;

    if (isMuted) {
      video.muted = false;
      video.removeAttribute("muted");
      if (video.volume === 0) video.volume = 1;
    } else {
      video.muted = true;
      video.setAttribute("muted", "");
    }

    const playPromise = video.play();
    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch(() => {});
    }

    syncMuteState();
  });

  video.addEventListener("volumechange", syncMuteState);
  video.addEventListener("play", syncMuteState);

  playWithAudioFallback();
  syncMuteState();
}

// Init
setYear();
initMobileMenu();
initHeroVideoAudio();
