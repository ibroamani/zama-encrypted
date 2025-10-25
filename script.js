// script.js - browser encryption demo using Web Crypto API (PBKDF2 + AES-GCM)
// - No server. All runs locally in the browser.
// - For demo: stores ciphertext & parameters in memory only (not persisted unless you change).

/* helper conversions */
function bufToBase64(buffer){
  return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}
function base64ToBuf(b64){
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i=0;i<bin.length;i++) arr[i] = bin.charCodeAt(i);
  return arr.buffer;
}
function bufToHex(buffer){
  return Array.from(new Uint8Array(buffer)).map(b=>b.toString(16).padStart(2,'0')).join('');
}

// DOM
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const previewWrap = document.getElementById('previewWrap');
const filePreview = document.getElementById('filePreview');
const toStep2 = document.getElementById('toStep2');

const step1 = document.getElementById('step1');
const step2 = document.getElementById('step2');
const step3 = document.getElementById('step3');

const passwordEl = document.getElementById('password');
const passwordConfirmEl = document.getElementById('passwordConfirm');
const startEncrypt = document.getElementById('startEncrypt');
const backTo1 = document.getElementById('backTo1');

const encProgressSection = document.getElementById('encProgressSection');
const encProgress = document.getElementById('encProgress');
const encProgressText = document.getElementById('encProgressText');

const decryptPassword = document.getElementById('decryptPassword');
const tryDecrypt = document.getElementById('tryDecrypt');
const backTo2 = document.getElementById('backTo2');

const decryptResult = document.getElementById('decryptResult');
const decryptStatus = document.getElementById('decryptStatus');
const decryptedImage = document.getElementById('decryptedImage');
const cipherPreview = document.getElementById('cipherPreview');

const topProgress = document.getElementById('topProgress');

// state storage (in-memory)
let originalFile = null;
let originalArrayBuffer = null;
let encryptedPackage = null; // {cipherBase64, ivBase64, saltBase64, algo, tagLength}
let currentStep = 1;

// drag & drop UX
dropZone.addEventListener('click', ()=> fileInput.click());
dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.style.transform='translateY(-4px)' });
dropZone.addEventListener('dragleave', ()=> dropZone.style.transform='');
dropZone.addEventListener('drop', e => {
  e.preventDefault(); dropZone.style.transform='';
  const f = e.dataTransfer.files[0];
  if (f) handleFile(f);
});
fileInput.addEventListener('change', e=> {
  if (e.target.files[0]) handleFile(e.target.files[0]);
});

function handleFile(file){
  if (!file.type.startsWith('image/')) { alert('Please upload an image file.'); return; }
  originalFile = file;
  const reader = new FileReader();
  reader.onload = (ev) => {
    originalArrayBuffer = ev.target.result;
    filePreview.src = URL.createObjectURL(file);
    previewWrap.classList.remove('hidden');
    toStep2.disabled = false;
  };
  reader.readAsArrayBuffer(file);
}

/* navigation */
toStep2.addEventListener('click', () => goToStep(2));
backTo1.addEventListener('click', () => goToStep(1));
backTo2.addEventListener('click', () => goToStep(2));

function goToStep(n){
  currentStep = n;
  step1.classList.toggle('active', n===1);
  step2.classList.toggle('active', n===2);
  step3.classList.toggle('active', n===3);
  updateTopProgress();
}

/* enable encrypt button only if password match and file exists */
passwordEl.addEventListener('input', validatePasswords);
passwordConfirmEl.addEventListener('input', validatePasswords);
function validatePasswords(){
  const p = passwordEl.value, c = passwordConfirmEl.value;
  startEncrypt.disabled = !(p && c && p === c && originalArrayBuffer);
}

/* real encryption: PBKDF2 -> AES-GCM */
startEncrypt.addEventListener('click', async () => {
  const password = passwordEl.value;
  if (!password) return;
  encProgressSection.classList.remove('hidden');
  encProgress.style.width = '0%';
  encProgressText.textContent = 'Preparing encryption...';
  startEncrypt.disabled = true;

  // stage 1: derive key (progress simulated)
  await simulateProgressTo(25, 'Deriving key from password...');
  // derive key
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    {name: 'PBKDF2'},
    false,
    ['deriveKey']
  );

  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 200_000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt','decrypt']
  );

  await simulateProgressTo(55, 'Encrypting file data...');

  // encrypt the originalArrayBuffer
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipherBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv, tagLength: 128 },
    key,
    originalArrayBuffer
  );

  await simulateProgressTo(90, 'Finalizing...');

  // package and show
  encryptedPackage = {
    cipherBase64: bufToBase64(cipherBuffer),
    ivBase64: bufToBase64(iv.buffer),
    saltBase64: bufToBase64(salt.buffer),
    algo: 'AES-GCM',
    tagLength: 128,
    iterations: 200000
  };

  // hide progress, show step3
  encProgress.style.width = '100%';
  encProgressText.textContent = 'Encryption complete';
  setTimeout(()=> {
    encProgressSection.classList.add('hidden');
    finalizeAfterEncrypt();
  }, 700);
});

async function simulateProgressTo(target, text){
  // smooth incremental simulation
  let current = parseFloat(encProgress.style.width) || 0;
  while(current < target){
    current += Math.random()*6 + 2;
    if (current > target) current = target;
    encProgress.style.width = Math.floor(current)+'%';
    encProgressText.textContent = text + ' ' + Math.floor(current) + '%';
    await new Promise(r=>setTimeout(r, Math.random()*160 + 80));
  }
}

function finalizeAfterEncrypt(){
  // move to step 3
  goToStep(3);
  topProgress.style.width = '100%';

  // show cipher preview (short)
  cipherPreview.textContent = encryptedPackage.cipherBase64.slice(0,240) + '...';
  decryptResult.classList.remove('hidden');
  decryptedImage.classList.add('hidden');
  decryptStatus.textContent = 'Encrypted package ready. Enter password to decrypt.';
  tryDecrypt.disabled = false;
  decryptPassword.value = '';
  updateTopProgress();
}

/* decrypt */
tryDecrypt.addEventListener('click', async () => {
  const pw = decryptPassword.value;
  if (!pw) return;
  tryDecrypt.disabled = true;
  decryptStatus.textContent = 'Attempting decryption...';
  // derive key with stored salt & iterations
  const saltBuf = base64ToBuf(encryptedPackage.saltBase64);
  const ivBuf = base64ToBuf(encryptedPackage.ivBase64);
  const cipherBuf = base64ToBuf(encryptedPackage.cipherBase64);

  const keyMaterial = await crypto.subtle.importKey('raw', new TextEncoder().encode(pw), {name:'PBKDF2'},false,['deriveKey']);
  const key = await crypto.subtle.deriveKey({
    name:'PBKDF2', salt: saltBuf, iterations: encryptedPackage.iterations, hash:'SHA-256'
  }, keyMaterial, {name:'AES-GCM', length:256}, true, ['decrypt']);

  try {
    const plainBuf = await crypto.subtle.decrypt({name:'AES-GCM', iv: new Uint8Array(ivBuf)}, key, cipherBuf);
    // success: show image
    const blob = new Blob([plainBuf], {type: originalFile.type || 'image/*'});
    const url = URL.createObjectURL(blob);
    decryptedImage.src = url;
    decryptedImage.classList.remove('hidden');
    decryptStatus.textContent = '✅ Decryption successful — image restored.';
    cipherPreview.textContent = 'Ciphertext (truncated): ' + encryptedPackage.cipherBase64.slice(0,240) + '...';
  } catch (e) {
    decryptStatus.textContent = '❌ Decryption failed — wrong password or corrupted data.';
    decryptedImage.classList.add('hidden');
  } finally {
    tryDecrypt.disabled = false;
  }
});

/* small enabling/disabling for decrypt button */
decryptPassword.addEventListener('input', ()=> {
  tryDecrypt.disabled = !decryptPassword.value;
});

/* set initial progress */
function updateTopProgress(){
  const w = currentStep===1 ? 33 : currentStep===2 ? 66 : 100;
  topProgress.style.width = w + '%';
}

/* initialize */
goToStep(1);
updateTopProgress();
