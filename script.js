const FORMATS = {
  banner: {
    name: "Banner Ad",
    w: 640, h: 100,
    format: "JPEG", maxKB: 200,
    safeArea: {top:0, bottom:0, left:48, right:40},
    notes: [
      ["Dimensions","640 × 100 px"],
      ["Format","JPG"],
      ["Max size","200 KB"],
      ["Safe area","48px left / 40px right — keep logo, text, watermarks out of these margins"]
    ]
  },
  logo: {
    name: "Brand Logo",
    w: 120, h: 120,
    format: "JPEG", maxKB: 50,
    safeArea: null,
    notes: [
      ["Used in","CTA, Carousel & Takeover ads"],
      ["Dimensions","120 × 120 px (1:1)"],
      ["Format","JPEG"],
      ["Max size","50 KB"]
    ]
  },
  carousel: {
    name: "Carousel Card",
    w: 440, h: 440,
    format: "JPEG", maxKB: 150,
    safeArea: null,
    notes: [
      ["Dimensions","440 × 440 px"],
      ["Format","JPEG"],
      ["Max size","150 KB per card"],
      ["Cards needed","4–6 per carousel"],
      ["Rule","No brand logo/watermark or CTA text on the creative itself"]
    ]
  },
  takeover: {
    name: "Takeover Poster",
    w: 970, h: 250,
    format: "JPEG", maxKB: 200,
    safeArea: null,
    notes: [
      ["Dimensions","970 × 250 px"],
      ["Format","JPEG"],
      ["Max size","200 KB"],
      ["Rule","Utilize 100% of the ad space, no contained background"]
    ]
  }
};

let currentFormat = null;
let img = new Image();
let imgLoaded = false;
let natW = 0, natH = 0;
let zoom = 1;
let offX = 0, offY = 0;
let shellW = 0, shellH = 0;
let baseScale = 1;
let mode = 'manual';
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

const formatButtonsEl = document.getElementById('formatButtons');
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const cropArea = document.getElementById('cropArea');
const cropShell = document.getElementById('cropShell');
const cropImg = document.getElementById('cropImg');
const cropImgBg = document.getElementById('cropImgBg');
const zoomSlider = document.getElementById('zoomSlider');
const zoomRow = document.getElementById('zoomRow');
const modeToggle = document.getElementById('modeToggle');
const modeHint = document.getElementById('modeHint');
const specTitle = document.getElementById('specTitle');
const specList = document.getElementById('specList');
const downloadBtn = document.getElementById('downloadBtn');
const resetBtn = document.getElementById('resetBtn');
const safeToggle = document.getElementById('safeToggle');
const qualityRow = document.getElementById('qualityRow');
const sizeVal = document.getElementById('sizeVal');
const statusBanner = document.getElementById('statusBanner');
const fileInfo = document.getElementById('fileInfo');
const copyLinkBtn = document.getElementById('copyLinkBtn');
const shareBtn = document.getElementById('shareBtn');

modeToggle.addEventListener('click', e => {
  const btn = e.target.closest('.mode-btn');
  if(!btn) return;
  mode = btn.dataset.mode;
  [...modeToggle.children].forEach(b => {
    const active = b === btn;
    b.classList.toggle('active', active);
    b.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
  zoomRow.style.display = mode === 'manual' ? 'flex' : 'none';
  modeHint.textContent = mode === 'manual'
    ? 'Drag inside the frame to reposition, use the slider to fill edge-to-edge.'
    : 'Image is centered automatically at full quality — nothing is cropped or zoomed. Extra space is softly filled so the frame stays full-bleed.';
  if(imgLoaded && currentFormat) setupShell();
});

function updateStatus(message, type = 'info'){
  statusBanner.textContent = message;
  statusBanner.classList.toggle('error', type === 'error');
  statusBanner.classList.toggle('success', type === 'success');
}

function buildFormatButtons(){
  formatButtonsEl.innerHTML = '';
  Object.entries(FORMATS).forEach(([key, f]) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'fmt-btn';
    btn.dataset.key = key;
    btn.setAttribute('aria-pressed', 'false');
    btn.innerHTML = `<div class="fmt-name">${f.name}</div><div class="fmt-dims">${f.w}&times;${f.h}px &middot; ${f.maxKB}KB cap</div>`;
    btn.addEventListener('click', () => selectFormat(key));
    formatButtonsEl.appendChild(btn);
  });
  selectFormat('banner');
}

function selectFormat(key){
  currentFormat = key;
  [...formatButtonsEl.children].forEach(b => b.classList.toggle('active', b.dataset.key === key));
  [...formatButtonsEl.children].forEach(b => b.setAttribute('aria-pressed', b.dataset.key === key ? 'true' : 'false'));
  const f = FORMATS[key];
  specTitle.textContent = f.name;
  specList.innerHTML = f.notes.map(([k,v]) => `<li><b>${k}:</b> ${v}</li>`).join('');
  safeToggle.parentElement.style.display = f.safeArea ? 'flex' : 'none';
  if(imgLoaded){
    setupShell();
    downloadBtn.disabled = false;
    downloadBtn.textContent = `Download ${f.w}×${f.h} ${f.format}`;
  }
}

function isValidImage(file){
  return file.type.startsWith('image/') && ['image/jpeg','image/png','image/webp'].includes(file.type);
}

dropZone.addEventListener('click', () => fileInput.click());
dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.style.borderColor = 'var(--accent-2)'; });
dropZone.addEventListener('dragleave', () => { dropZone.style.borderColor = 'var(--line)'; });
dropZone.addEventListener('drop', e => {
  e.preventDefault();
  dropZone.style.borderColor = 'var(--line)';
  if(e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
});
fileInput.addEventListener('change', e => {
  if(e.target.files[0]) handleFile(e.target.files[0]);
});

function handleFile(file){
  if(!isValidImage(file)){
    updateStatus('Only JPEG, PNG, and WEBP images are supported.', 'error');
    return;
  }
  if(file.size > MAX_FILE_SIZE){
    updateStatus('Please choose an image smaller than 10 MB.', 'error');
    return;
  }

  const reader = new FileReader();
  reader.onload = ev => {
    img = new Image();
    img.onload = () => {
      natW = img.naturalWidth;
      natH = img.naturalHeight;
      imgLoaded = true;
      cropImg.src = ev.target.result;
      cropImgBg.src = ev.target.result;
      dropZone.style.display = 'none';
      cropArea.style.display = 'flex';
      cropArea.setAttribute('aria-hidden', 'false');
      resetBtn.hidden = false;
      fileInfo.hidden = false;
      fileInfo.innerHTML = `<strong>Image file:</strong> ${file.name}<br><strong>Original size:</strong> ${Math.round(file.size/1024)} KB<br><strong>Dimensions:</strong> ${natW} × ${natH} px`;
      updateStatus('Image loaded. Choose a format and download your resized creative.', 'success');
      selectFormat(currentFormat || 'banner');
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
}

function setupShell(){
  const f = FORMATS[currentFormat];
  const maxDisplayW = Math.min(560, cropShellParentWidth());
  let dispScale = Math.min(maxDisplayW / f.w, 3);
  if(f.w * dispScale > 640) dispScale = 640 / f.w;
  shellW = Math.round(f.w * dispScale);
  shellH = Math.round(f.h * dispScale);
  cropShell.style.width = `${shellW}px`;
  cropShell.style.height = `${shellH}px`;

  if(mode === 'manual'){
    cropImgBg.style.display = 'none';
    cropImg.style.filter = 'none';
    cropImg.style.pointerEvents = 'auto';
    const coverScale = Math.max(shellW / natW, shellH / natH);
    baseScale = coverScale;
    zoom = 1;
    zoomSlider.value = 100;
    applyImageTransform(true);
  } else {
    cropImgBg.style.display = 'block';
    const bgScale = Math.max(shellW / natW, shellH / natH) * 1.08;
    const bgW = natW * bgScale, bgH = natH * bgScale;
    cropImgBg.style.width = `${bgW}px`;
    cropImgBg.style.height = `${bgH}px`;
    cropImgBg.style.transform = `translate(${(shellW-bgW)/2}px, ${(shellH-bgH)/2}px)`;

    const containScale = Math.min(shellW / natW, shellH / natH);
    const fgW = natW * containScale, fgH = natH * containScale;
    cropImg.style.width = `${fgW}px`;
    cropImg.style.height = `${fgH}px`;
    cropImg.style.transform = `translate(${(shellW-fgW)/2}px, ${(shellH-fgH)/2}px)`;
  }
  renderSafeOverlay();
}

function cropShellParentWidth(){
  const panel = document.querySelector('.canvas-panel');
  return panel ? panel.clientWidth - 40 : 560;
}

function applyImageTransform(center){
  const scale = baseScale * zoom;
  const dispW = natW * scale;
  const dispH = natH * scale;
  if(center){
    offX = (shellW - dispW) / 2;
    offY = (shellH - dispH) / 2;
  }
  clampOffset(dispW, dispH);
  cropImg.style.width = `${dispW}px`;
  cropImg.style.height = `${dispH}px`;
  cropImg.style.transform = `translate(${offX}px, ${offY}px)`;
}

function clampOffset(dispW, dispH){
  const minX = shellW - dispW;
  const minY = shellH - dispH;
  offX = Math.min(0, Math.max(minX, offX));
  offY = Math.min(0, Math.max(minY, offY));
}

zoomSlider.addEventListener('input', () => {
  const oldScale = baseScale * zoom;
  zoom = zoomSlider.value / 100;
  const newScale = baseScale * zoom;
  const cx = shellW / 2;
  const cy = shellH / 2;
  const imgCx = (cx - offX) / oldScale;
  const imgCy = (cy - offY) / oldScale;
  offX = cx - imgCx * newScale;
  offY = cy - imgCy * newScale;
  applyImageTransform(false);
});

let dragging = false, startX = 0, startY = 0, startOffX = 0, startOffY = 0;
function dragStart(x,y){
  if(mode !== 'manual') return;
  dragging = true;
  startX = x; startY = y;
  startOffX = offX; startOffY = offY;
  cropShell.classList.add('dragging');
}
function dragMove(x,y){
  if(!dragging) return;
  offX = startOffX + (x - startX);
  offY = startOffY + (y - startY);
  const scale = baseScale * zoom;
  clampOffset(natW * scale, natH * scale);
  cropImg.style.transform = `translate(${offX}px, ${offY}px)`;
}
function dragEnd(){ dragging = false; cropShell.classList.remove('dragging'); }

cropShell.addEventListener('mousedown', e => dragStart(e.clientX, e.clientY));
window.addEventListener('mousemove', e => dragMove(e.clientX, e.clientY));
window.addEventListener('mouseup', dragEnd);
cropShell.addEventListener('touchstart', e => { const t = e.touches[0]; dragStart(t.clientX, t.clientY); }, {passive:true});
cropShell.addEventListener('touchmove', e => { const t = e.touches[0]; dragMove(t.clientX, t.clientY); }, {passive:true});
cropShell.addEventListener('touchend', dragEnd);

function renderSafeOverlay(){
  let overlay = cropShell.querySelector('.safe-overlay');
  if(overlay) overlay.remove();
  const f = FORMATS[currentFormat];
  if(!f.safeArea || !safeToggle.checked) return;
  const scale = shellW / f.w;
  const {left,right} = f.safeArea;
  overlay = document.createElement('div');
  overlay.className = 'safe-overlay';
  overlay.innerHTML = `
    <div style="position:absolute;left:0;top:0;width:${left*scale}px;height:100%;background:rgba(255,93,59,.28);border-right:1px dashed var(--accent);"></div>
    <div style="position:absolute;right:0;top:0;width:${right*scale}px;height:100%;background:rgba(255,93,59,.28);border-left:1px dashed var(--accent);"></div>
  `;
  cropShell.appendChild(overlay);
}

safeToggle.addEventListener('change', renderSafeOverlay);

resetBtn.addEventListener('click', () => {
  imgLoaded = false;
  cropArea.style.display = 'none';
  cropArea.setAttribute('aria-hidden', 'true');
  dropZone.style.display = 'block';
  resetBtn.hidden = true;
  downloadBtn.disabled = true;
  downloadBtn.textContent = 'Upload an image first';
  fileInput.value = '';
  fileInfo.hidden = true;
  fileInfo.innerHTML = '';
  qualityRow.hidden = true;
  updateStatus('Upload another image when you are ready.');
});

window.addEventListener('resize', () => { if(imgLoaded && currentFormat) setupShell(); });

downloadBtn.addEventListener('click', () => {
  if(!imgLoaded || !currentFormat) return;
  const f = FORMATS[currentFormat];
  const canvas = document.createElement('canvas');
  canvas.width = f.w;
  canvas.height = f.h;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  if(mode === 'manual'){
    const scale = baseScale * zoom;
    const sx = -offX / scale;
    const sy = -offY / scale;
    const sw = shellW / scale;
    const sh = shellH / scale;
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, f.w, f.h);
  } else {
    const bgScale = Math.max(f.w / natW, f.h / natH) * 1.08;
    const bgW = natW * bgScale, bgH = natH * bgScale;
    ctx.save();
    ctx.filter = 'blur(14px) brightness(0.55) saturate(1.1)';
    ctx.drawImage(img, (f.w - bgW) / 2, (f.h - bgH) / 2, bgW, bgH);
    ctx.restore();

    const containScale = Math.min(f.w / natW, f.h / natH);
    const fgW = natW * containScale, fgH = natH * containScale;
    ctx.drawImage(img, (f.w - fgW) / 2, (f.h - fgH) / 2, fgW, fgH);
  }

  exportWithSizeCap(canvas, f);
});

function exportWithSizeCap(canvas, f){
  let quality = 0.97;
  let dataUrl = canvas.toDataURL('image/jpeg', quality);
  let bytes = Math.round((dataUrl.length - 22) * 3/4);
  const capBytes = f.maxKB * 1024;

  let attempts = 0;
  while(bytes > capBytes && quality > 0.6 && attempts < 10){
    quality -= 0.03;
    dataUrl = canvas.toDataURL('image/jpeg', quality);
    bytes = Math.round((dataUrl.length - 22) * 3/4);
    attempts++;
  }

  qualityRow.hidden = false;
  const kb = (bytes/1024).toFixed(0);
  const qLabel = quality >= 0.95 ? 'full quality' : `quality ${(quality*100).toFixed(0)}%`;
  sizeVal.textContent = `${kb} KB (${qLabel})`;
  sizeVal.className = 'val ' + (bytes <= capBytes ? 'ok' : 'over');
  updateStatus(bytes <= capBytes ? 'Ready to download. The output meets the file cap.' : 'Download ready, but the file is slightly over the cap.', bytes <= capBytes ? 'success' : 'error');

  const link = document.createElement('a');
  link.download = `fence_${currentFormat}_${mode}_${f.w}x${f.h}.jpg`;
  link.href = dataUrl;

  if(isIos){
    updateStatus('iPhone does not support direct image downloads from this page. The image will open in a new tab so you can save it manually.','info');
    window.open(dataUrl, '_blank');
  } else {
    link.click();
  }
}

function copyPageLink(){
  const url = window.location.href;
  const copy = text => navigator.clipboard?.writeText(text) || new Promise((resolve, reject) => {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'absolute';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand('copy');
      resolve();
    } catch (err) {
      reject(err);
    } finally {
      document.body.removeChild(textarea);
    }
  });

  copy(url)
    .then(() => {
      updateStatus('Page link copied to clipboard. Share it with your team.','success');
      copyLinkBtn.textContent = 'Link copied!';
      setTimeout(() => { copyLinkBtn.textContent = 'Copy page link'; }, 2000);
    })
    .catch(() => {
      updateStatus('Unable to copy the link. Please use your browser address bar.', 'error');
    });
}

function promptNativeShare(){
  if(!navigator.share){
    updateStatus('Native share is not available in this browser. Copy the link instead.','error');
    return;
  }

  navigator.share({
    title: 'Fence Creative Resizer',
    text: 'Resize Fence ad creatives to exact specs with this tool.',
    url: window.location.href
  }).catch(err => {
    if(err?.name !== 'AbortError'){
      updateStatus('Share failed. Copy the link and try again.','error');
    }
  });
}

copyLinkBtn.addEventListener('click', copyPageLink);
shareBtn.addEventListener('click', promptNativeShare);

if(!navigator.share){
  shareBtn.disabled = true;
  shareBtn.style.opacity = '0.64';
  shareBtn.style.cursor = 'not-allowed';
}

buildFormatButtons();
