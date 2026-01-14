// Utilities
const $ = (sel) => document.querySelector(sel);

function setYear() {
  const yearEl = $("#year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();
}

 // Form Submission
    document.getElementById("quoteForm").addEventListener("submit", async function (e) {
      const statusEl = document.getElementById("formStatus");
      const addressInput = document.getElementById("address");
      const manualAddressVisible = document.getElementById("manualAddress").style.display === "block";

      if (!addressInput.disabled && !addressSelected && !manualAddressVisible) {
        e.preventDefault();
        alert("Please select a valid address from the suggestions.");
        return;
      }

      e.preventDefault();

      const formData = Object.fromEntries(new FormData(this).entries());
      statusEl.className = "formStatus";
      statusEl.textContent = "";

      try {
        const response = await fetch("https://formspree.io/f/xqearbyz", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData)
        });

        if (response.ok) {
          statusEl.className = "formStatus formStatus--ok";
          statusEl.textContent = "Your request has been sent successfully.";
          this.reset();
        } else {
          throw new Error();
        }
      } catch {
        statusEl.className = "formStatus formStatus--bad";
        statusEl.textContent = "Something went wrong. Please try again.";
      }
    });
 

  
  setTimeout(() => {
    if (typeof google === "undefined") {
      document.getElementById("manualAddress").style.display = "block";
      document.getElementById("address").disabled = true;
      alert("Address verification unavailable. Please enter your address manually.");
    }
  }, 3000);


  let autocomplete;
  let addressSelected = false;

  function initAutocomplete() {
    const addressInput = document.getElementById("address");

    autocomplete = new google.maps.places.Autocomplete(addressInput, {
      types: ["address"],
      componentRestrictions: { country: "us" },
      fields: ["formatted_address", "geometry"]
    });

    autocomplete.addListener("place_changed", () => {
      const place = autocomplete.getPlace();

      if (!place.geometry) {
        addressSelected = false;
        return;
      }

      // Force Google-selected address
      addressInput.value = place.formatted_address;
      document.getElementById("lat").value = place.geometry.location.lat();
      document.getElementById("lng").value = place.geometry.location.lng();

      addressSelected = true;
    });

    // If user types but doesn’t select
    addressInput.addEventListener("input", () => {
      addressSelected = false;
      document.getElementById("lat").value = "";
      document.getElementById("lng").value = "";
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

// Before/After slider
function initBeforeAfter() {
  const slider = $("#baSlider");
  const beforeLayer = $("#beforeLayer");
  const handle = $("#baHandle");

  if (!slider || !beforeLayer || !handle) return;

  const update = (val) => {
    const pct = Math.max(0, Math.min(100, Number(val)));
    beforeLayer.style.width = pct + "%";
    handle.style.left = pct + "%";
  };

  slider.addEventListener("input", (e) => update(e.target.value));
  update(slider.value);
}

// Init
setYear();
initMobileMenu();
initBeforeAfter();
