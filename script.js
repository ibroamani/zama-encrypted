let imageData = null;
let encryptedData = null;
let iv = null;
let key = null;
let selectedFilters = [];

const fileInput = document.getElementById("fileInput");
const preview = document.getElementById("preview");
const next1 = document.getElementById("next1");
const next2 = document.getElementById("next2");
const encryptBtn = document.getElementById("encryptBtn");
const decryptBtn = document.getElementById("decryptBtn");
const restart = document.getElementById("restart");
const applyFilter = document.getElementById("applyFilter");

fileInput.addEventListener("change", (e) => {
  const file = e.target.files[0];
  const reader = new FileReader();
  reader.onload = () => {
    preview.src = reader.result;
    preview.classList.remove("hidden");
    next1.classList.remove("hidden");
    imageData = reader.result;
  };
  reader.readAsDataURL(file);
});

next1.addEventListener("click", () => showStep(2));
next2.addEventListener("click", () => showStep(3));
restart.addEventListener("click", () => window.location.reload());

// Handle filter selection
applyFilter.addEventListener("click", () => {
  selectedFilters = Array.from(document.querySelectorAll(".filters input:checked")).map(
    (i) => i.value
  );
  alert("✅ Filters selected: " + (selectedFilters.join(", ") || "None"));
});

// Encryption process
encryptBtn.addEventListener("click", async () => {
  const password = document.getElementById("password").value.trim();
  if (!password || !imageData) {
    alert("Please upload an image and enter a password first.");
    return;
  }

  const progress = document.getElementById("progress");
  let percent = 0;
  const interval = setInterval(() => {
    percent += 5;
    progress.style.width = percent + "%";
    if (percent >= 100) clearInterval(interval);
  }, 80);

  const enc = new TextEncoder();
  const pwKey = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveKey"]);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  key = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
    pwKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );

  iv = crypto.getRandomValues(new Uint8Array(12));
  const data = enc.encode(imageData);
  encryptedData = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, data);

  setTimeout(() => {
    alert("✅ Encryption complete!");
    next2.classList.remove("hidden");
  }, 1300);
});

// Decryption
decryptBtn.addEventListener("click", async () => {
  const password = document.getElementById("decryptPassword").value.trim();
  const dec = new TextDecoder();
  const status = document.getElementById("decryptStatus");

  try {
    const enc = new TextEncoder();
    const pwKey = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveKey"]);
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const dKey = await crypto.subtle.deriveKey(
      { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
      pwKey,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"]
    );

    const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, encryptedData);
    const decryptedText = dec.decode(decrypted);

    const decryptedPreview = document.getElementById("decryptedPreview");
    decryptedPreview.src = decryptedText;

    // Apply selected filters visually
    let filterStyle = "";
    if (selectedFilters.includes("blur")) filterStyle += "blur(4px) ";
    if (selectedFilters.includes("bw")) filterStyle += "grayscale(100%) ";
    if (selectedFilters.includes("rotate")) decryptedPreview.style.transform = "rotate(15deg)";
    if (selectedFilters.includes("fisheye")) filterStyle += "contrast(140%) saturate(120%) ";
    decryptedPreview.style.filter = filterStyle;

    decryptedPreview.classList.remove("hidden");
    status.textContent = "✅ Decryption successful!";
    restart.classList.remove("hidden");
  } catch {
    status.textContent = "❌ Wrong password. Access denied.";
  }
});

function showStep(n) {
  document.querySelectorAll(".step").forEach((s) => s.classList.remove("active"));
  document.getElementById("step" + n).classList.add("active");
}
