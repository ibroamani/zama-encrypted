let encryptedData, iv, salt;
let selectedFilters = [];
let imageBitmap;

const fileInput = document.getElementById("fileInput");
const preview = document.getElementById("preview");
const toEncrypt = document.getElementById("toEncrypt");
const step1 = document.getElementById("step1");
const step2 = document.getElementById("step2");
const step3 = document.getElementById("step3");
const encryptBtn = document.getElementById("encryptBtn");
const toDecrypt = document.getElementById("toDecrypt");
const decryptBtn = document.getElementById("decryptBtn");
const progress = document.getElementById("progress");
const decryptStatus = document.getElementById("decryptStatus");
const canvas = document.getElementById("canvas");
const restartBtn = document.getElementById("restart");

fileInput.addEventListener("change", e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    preview.src = ev.target.result;
    preview.classList.remove("hidden");
    toEncrypt.classList.remove("hidden");
  };
  reader.readAsDataURL(file);
});

toEncrypt.addEventListener("click", () => {
  step1.classList.remove("active");
  step1.classList.add("hidden");
  step2.classList.add("active");
});

encryptBtn.addEventListener("click", async () => {
  const password = document.getElementById("password").value;
  if (!password || !preview.src) {
    alert("Please upload an image and set a password.");
    return;
  }

  selectedFilters = Array.from(document.querySelectorAll(".filters input:checked")).map(c => c.value);
  progress.style.width = "0%";

  // simulate progress
  let percent = 0;
  const interval = setInterval(() => {
    percent += 10;
    progress.style.width = percent + "%";
    if (percent >= 100) {
      clearInterval(interval);
    }
  }, 150);

  // actual encryption
  const res = await fetch(preview.src);
  const blob = await res.blob();
  const buf = await blob.arrayBuffer();
  salt = crypto.getRandomValues(new Uint8Array(16));
  iv = crypto.getRandomValues(new Uint8Array(12));

  const key = await deriveKey(password, salt);
  encryptedData = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, buf);

  toDecrypt.classList.remove("hidden");
});

toDecrypt.addEventListener("click", () => {
  step2.classList.remove("active");
  step2.classList.add("hidden");
  step3.classList.add("active");
});

decryptBtn.addEventListener("click", async () => {
  const password = document.getElementById("decryptPassword").value;
  if (!password) return;
  progress.style.width = "0%";
  decryptStatus.textContent = "";
  let percent = 0;
  const interval = setInterval(() => {
    percent += 20;
    progress.style.width = percent + "%";
    if (percent >= 100) clearInterval(interval);
  }, 150);

  try {
    const key = await deriveKey(password, salt);
    const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, encryptedData);
    const blob = new Blob([decrypted]);
    const imgURL = URL.createObjectURL(blob);
    imageBitmap = await createImageBitmap(blob);
    applyFilters(imageBitmap, selectedFilters);
    decryptStatus.textContent = "✅ Decryption successful";
    restartBtn.classList.remove("hidden");
  } catch {
    decryptStatus.textContent = "❌ Access denied";
  }
});

restartBtn.addEventListener("click", () => location.reload());

async function deriveKey(password, salt) {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

// Draw and apply filters
function applyFilters(img, filters) {
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0);

  if (filters.includes("bw")) {
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < data.data.length; i += 4) {
      const avg = (data.data[i] + data.data[i + 1] + data.data[i + 2]) / 3;
      data.data[i] = data.data[i + 1] = data.data[i + 2] = avg;
    }
    ctx.putImageData(data, 0, 0);
  }

  if (filters.includes("blur")) ctx.filter = "blur(5px)";
  if (filters.includes("rotate")) ctx.rotate((10 * Math.PI) / 180);

  if (filters.includes("fisheye")) fisheye(ctx, canvas.width, canvas.height);

  canvas.classList.remove("hidden");
}

function fisheye(ctx, w, h) {
  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;
  const temp = new Uint8ClampedArray(data);
  const centerX = w / 2,
    centerY = h / 2,
    radius = Math.min(w, h) / 2;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = x - centerX;
      const dy = y - centerY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < radius) {
        const r = dist / radius;
        const theta = Math.atan2(dy, dx);
        const rn = r * r; // soft bubble
        const sx = Math.floor(centerX + rn * radius * Math.cos(theta));
        const sy = Math.floor(centerY + rn * radius * Math.sin(theta));
        const srcPos = (sy * w + sx) * 4;
        const dstPos = (y * w + x) * 4;
        data[dstPos] = temp[srcPos];
        data[dstPos + 1] = temp[srcPos + 1];
        data[dstPos + 2] = temp[srcPos + 2];
      }
    }
  }
  ctx.putImageData(imgData, 0, 0);
}