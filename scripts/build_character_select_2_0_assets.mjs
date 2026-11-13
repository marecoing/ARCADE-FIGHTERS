import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

// Minimal pure-Node PNG reader & writer (RGBA 8-bit)
function readPng(filePath) {
  const buf = fs.readFileSync(filePath);
  let offset = 8;
  let width = 0;
  let height = 0;
  let colorType = 0;
  const idatChunks = [];

  while (offset < buf.length) {
    const len = buf.readUInt32BE(offset);
    const type = buf.toString('ascii', offset + 4, offset + 8);
    const data = buf.subarray(offset + 8, offset + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      colorType = data[9];
    } else if (type === 'IDAT') {
      idatChunks.push(data);
    }
    offset += 12 + len;
  }

  const raw = zlib.inflateSync(Buffer.concat(idatChunks));
  const bpp = colorType === 6 ? 4 : 3;
  const stride = width * bpp;
  const pixels = Buffer.alloc(width * height * 4);
  let prevRow = Buffer.alloc(stride);

  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const row = Buffer.from(
      raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1))
    );
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? row[i - bpp] : 0;
      const b = prevRow[i];
      const c = i >= bpp ? prevRow[i - bpp] : 0;
      if (filter === 1) row[i] = (row[i] + a) & 255;
      else if (filter === 2) row[i] = (row[i] + b) & 255;
      else if (filter === 3) row[i] = (row[i] + ((a + b) >> 1)) & 255;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        const pr = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
        row[i] = (row[i] + pr) & 255;
      }
    }
    prevRow = row;
    for (let x = 0; x < width; x++) {
      const si = x * bpp;
      const di = (y * width + x) * 4;
      pixels[di] = row[si];
      pixels[di + 1] = row[si + 1];
      pixels[di + 2] = row[si + 2];
      pixels[di + 3] = bpp === 4 ? row[si + 3] : 255;
    }
  }

  return { width, height, pixels };
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
  }
  return (c ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  const combined = Buffer.concat([typeBuf, data]);
  crcBuf.writeUInt32BE(crc32(combined), 0);
  return Buffer.concat([lenBuf, combined, crcBuf]);
}

function writePng(filePath, width, height, pixels) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const stride = width * 4;
  const raw = Buffer.alloc(height * (stride + 1));
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter 0
    pixels.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  const compressed = zlib.deflateSync(raw, { level: 6 });
  const out = Buffer.concat([
    signature,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', compressed),
    makeChunk('IEND', Buffer.alloc(0)),
  ]);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, out);
}

function getPixel(img, x, y) {
  const cx = Math.max(0, Math.min(img.width - 1, x));
  const cy = Math.max(0, Math.min(img.height - 1, y));
  const idx = (cy * img.width + cx) * 4;
  return [
    img.pixels[idx],
    img.pixels[idx + 1],
    img.pixels[idx + 2],
    img.pixels[idx + 3],
  ];
}

function setPixel(img, x, y, r, g, b, a = 255) {
  if (x < 0 || x >= img.width || y < 0 || y >= img.height) return;
  const idx = (y * img.width + x) * 4;
  img.pixels[idx] = r;
  img.pixels[idx + 1] = g;
  img.pixels[idx + 2] = b;
  img.pixels[idx + 3] = a;
}

function cropImage(img, x0, y0, w, h) {
  const out = { width: w, height: h, pixels: Buffer.alloc(w * h * 4) };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const [r, g, b, a] = getPixel(img, x0 + x, y0 + y);
      setPixel(out, x, y, r, g, b, a);
    }
  }
  return out;
}

const refImg = readPng('public/assets/ui/character-select-reference.png');

// 1. Crop the 6 portrait cards from the 3x2 grid (269x290 for row 0, 269x309 for row 1)
const row0Y = 230;
const row0H = 290; // 230..519
const row1Y = 529;
const row1H = 309; // 529..837

const col0X = 442;
const col1X = 717;
const col2X = 992;
const cardW = 269;

const mostasaRaw = cropImage(refImg, col0X, row0Y, cardW, row0H);
const braianCard = cropImage(refImg, col1X, row0Y, cardW, row0H);
const ragCard = cropImage(refImg, col2X, row0Y, cardW, row0H);
const patovaCard = cropImage(refImg, col0X, row1Y, cardW, row1H);
const jennyCard = cropImage(refImg, col1X, row1Y, cardW, row1H);
const alienCard = cropImage(refImg, col2X, row1Y, cardW, row1H);

// Clean Braian's left 9px border using Rag's clean left silver border (since Mostasa's P1 glow slightly touched Braian's left edge)
for (let y = 0; y < row0H; y++) {
  for (let x = 0; x < 9; x++) {
    const [rr, rg, rb, ra] = getPixel(ragCard, x, y);
    setPixel(braianCard, x, y, rr, rg, rb, ra);
  }
}

// Clean Mostasa's unselected card using Rag's clean silver metallic frame:
for (let y = 0; y < row0H; y++) {
  for (let x = 0; x < cardW; x++) {
    const isOuterBorder =
      x < 14 ||
      x >= cardW - 14 ||
      y < 12 ||
      y >= row0H - 12 ||
      (y >= 210 && (x < 18 || x >= cardW - 18)) ||
      (x + y < 26) ||
      (cardW - 1 - x + y < 26) ||
      (x + (row0H - 1 - y) < 26) ||
      (cardW - 1 - x + (row0H - 1 - y) < 26);

    if (isOuterBorder) {
      const [rr, rg, rb, ra] = getPixel(ragCard, x, y);
      setPixel(mostasaRaw, x, y, rr, rg, rb, ra);
      continue;
    }

    // Top-left P1 badge removal (local x: 12..94, y: 10..44)
    if (x >= 12 && x <= 94 && y >= 10 && y <= 44) {
      const sampleX = Math.min(58, Math.max(16, x));
      const sampleY = 48 + ((y * 3 + x) % 7);
      const [sr, sg, sb] = getPixel(mostasaRaw, sampleX, sampleY);
      const boost = Math.max(0, (44 - y) * 1.25);
      setPixel(
        mostasaRaw,
        x,
        y,
        Math.min(220, Math.round(sr + boost * 1.6)),
        Math.min(82, Math.round(sg + boost * 0.38)),
        Math.min(36, Math.round(sb + 4)),
        255
      );
    }
  }
}

// Also clean Patova's top metallic border (local y: 0..10) using Jenny's top metallic border
for (let y = 0; y < 10; y++) {
  for (let x = 0; x < cardW; x++) {
    const [jr, jg, jb, ja] = getPixel(jennyCard, x, y);
    setPixel(patovaCard, x, y, jr, jg, jb, ja);
  }
}

writePng('public/assets/ui/portraits/mostasa.png', cardW, row0H, mostasaRaw.pixels);
writePng('public/assets/ui/portraits/braian.png', cardW, row0H, braianCard.pixels);
writePng('public/assets/ui/portraits/rag.png', cardW, row0H, ragCard.pixels);
writePng('public/assets/ui/portraits/patova.png', cardW, row1H, patovaCard.pixels);
writePng('public/assets/ui/portraits/jenny.png', cardW, row1H, jennyCard.pixels);
writePng('public/assets/ui/portraits/alien.png', cardW, row1H, alienCard.pixels);

console.log('Saved 6 clean portrait cards to public/assets/ui/portraits/*.png');

// 2. Build public/assets/ui/character-select-clean-bg.png (1672 x 941)
const cleanBg = {
  width: refImg.width,
  height: refImg.height,
  pixels: Buffer.from(refImg.pixels),
};

// 2a. Stamp the cleaned Mostasa, Braian, and Patova cards into cleanBg, and clean the red outer glow around Cell 0 (x: 425..725, y: 215..528)
for (let y = 215; y <= 528; y++) {
  for (let x = 425; x <= 725; x++) {
    if (x >= col0X && x < col0X + cardW && y >= row0Y && y < row0Y + row0H) {
      const [mr, mg, mb, ma] = getPixel(mostasaRaw, x - col0X, y - row0Y);
      setPixel(cleanBg, x, y, mr, mg, mb, ma);
    } else if (x >= col1X && x < col1X + 9 && y >= row0Y && y < row0Y + row0H) {
      const [br, bg, bb, ba] = getPixel(braianCard, x - col1X, y - row0Y);
      setPixel(cleanBg, x, y, br, bg, bb, ba);
    } else {
      const [r, g, b] = getPixel(cleanBg, x, y);
      // Only clean warm red/orange/yellow P1 glow pixels (where R > B - 20 or (R > 120 && G > 80 && B < 150))
      if (r > b - 20 || (r > 90 && g > 50 && b < 140)) {
        const [br, bg, bb] = getPixel(refImg, Math.min(1255, x + 275), Math.max(225, y));
        if (bb > br + 25) {
          setPixel(cleanBg, x, y, br, bg, bb, 255);
        } else {
          setPixel(cleanBg, x, y, 12, 12, 102, 255);
        }
      }
    }
  }
}

for (let y = 0; y < 10; y++) {
  for (let x = 0; x < cardW; x++) {
    const [pr, pg, pb, pa] = getPixel(patovaCard, x, y);
    setPixel(cleanBg, col0X + x, row1Y + y, pr, pg, pb, pa);
  }
}

// 2b. Clean the Left Full-Body Showcase & Nameplate Zone using a Feathered Foreground Mask
// Detect foreground pixels of Mostasa + "MOSTASA / THE MAST TURBADOUR" banner inside x: 6..435, y: 50..663
const maskW = 440;
const maskH = 670;
const fgMask = new Uint8Array(maskW * maskH);

for (let y = 52; y <= 663; y++) {
  for (let x = 8; x <= 435; x++) {
    // Protect the top-center logo and "SELECCIÓN DE PERSONAJES" metallic bar
    if (x >= 430 && y <= 165) continue;
    if (x >= 412 && y >= 165 && y <= 228) continue;

    const [r, g, b] = getPixel(refImg, x, y);

    // A pixel is part of the original electric blue/violet sky or halftone portrait if B dominates R and G
    // and it's not inside the core silhouette of Mostasa's pants/boots/torso or the lower nameplate.
    const isCoreTorsoOrPants =
      (x >= 95 && x <= 375 && y >= 150 && y <= 565) ||
      (x >= 16 && x <= 425 && y >= 565 && y <= 662);

    const isElectricBlueSky =
      b > r + 34 &&
      b > g + 20 &&
      b >= 72 &&
      !isCoreTorsoOrPants;

    if (!isElectricBlueSky) {
      fgMask[y * maskW + x] = 1;
    }
  }
}

// Compute distance/feathered weight (dilate by 6px, feather over 10px) so there are zero harsh edges
const weightMap = new Float32Array(maskW * maskH);
const dilateR = 12;
for (let y = 50; y <= 664; y++) {
  for (let x = 4; x <= 436; x++) {
    if (x >= 430 && y <= 165) continue;
    if (x >= 414 && y >= 165 && y <= 228) continue;

    if (fgMask[y * maskW + x] === 1) {
      weightMap[y * maskW + x] = 1;
      continue;
    }
    let minDistSq = 9999;
    for (let dy = -dilateR; dy <= dilateR; dy += 2) {
      const ny = y + dy;
      if (ny < 50 || ny >= maskH) continue;
      for (let dx = -dilateR; dx <= dilateR; dx += 2) {
        const nx = x + dx;
        if (nx < 4 || nx >= maskW) continue;
        if (fgMask[ny * maskW + nx] === 1) {
          const d2 = dx * dx + dy * dy;
          if (d2 < minDistSq) minDistSq = d2;
        }
      }
    }
    if (minDistSq <= dilateR * dilateR) {
      const d = Math.sqrt(minDistSq);
      weightMap[y * maskW + x] = Math.max(0, Math.min(1, 1 - (d - 3) / (dilateR - 3)));
    }
  }
}

for (let y = 50; y <= 664; y++) {
  for (let x = 4; x <= 436; x++) {
    const w = weightMap[y * maskW + x];
    if (w <= 0.001) continue;

    const [r, g, b] = getPixel(refImg, x, y);
    const normY = (y - 50) / (664 - 50);
    const dotPhase =
      ((Math.floor(x / 3) + Math.floor(y / 3)) % 2 === 0 ? 1 : -1) * 3;

    const radialGlow = Math.max(
      0,
      1 - Math.hypot((x - 220) / 220, (y - 320) / 310)
    );
    const floorBand = Math.exp(-Math.pow((y - 568) / 18, 2));
    const horizCenter = Math.max(0, 1 - Math.abs(x - 220) / 210);

    const baseR = Math.round(
      11 + radialGlow * 22 + floorBand * horizCenter * 34 + dotPhase * 0.4
    );
    const baseG = Math.round(
      12 + radialGlow * 28 + floorBand * horizCenter * 22 + dotPhase * 0.5
    );
    const baseB = Math.round(
      88 +
        radialGlow * 76 +
        (1 - normY) * 26 +
        floorBand * horizCenter * 46 +
        dotPhase
    );

    const outR = Math.round(r * (1 - w) + baseR * w);
    const outG = Math.round(g * (1 - w) + baseG * w);
    const outB = Math.round(b * (1 - w) + baseB * w);

    setPixel(
      cleanBg,
      x,
      y,
      Math.max(0, Math.min(255, outR)),
      Math.max(0, Math.min(255, outG)),
      Math.max(0, Math.min(255, outB)),
      255
    );
  }
}

// 2c. Clean the interior of the Bottom-Left Stats Panel (x: 33..412, y: 676..844)
// Preserve the outer metallic frame (x: 24..421, y: 665..856) and the 5 metallic row divider lines,
// while clearing the baked-in text, yellow bars, and numbers so CharacterStats renders dynamically inside it.
const rowDividerYs = [683, 716, 749, 783, 816, 843];
for (let y = 676; y <= 844; y++) {
  const isDivider = rowDividerYs.some((dy) => Math.abs(y - dy) <= 1);
  for (let x = 33; x <= 412; x++) {
    if (isDivider) {
      setPixel(cleanBg, x, y, 52, 48, 92, 255);
    } else {
      const grad = ((y - 676) % 33) / 33;
      const r = Math.round(8 + grad * 8);
      const g = Math.round(8 + grad * 6);
      const b = Math.round(34 + grad * 22);
      setPixel(cleanBg, x, y, r, g, b, 255);
    }
  }
}

// 2d. Clean the dynamic text zone inside the Right "CARACTERÍSTICAS" Panel (x: 1300..1644, y: 294..648)
// Preserve:
// - Outer metallic frame (x: 1280..1664, y: 192..907)
// - Top "CARACTERÍSTICAS" metallic banner (y: 192..292)
// - Bottom comic burst "M" emblem (y: 650..900)
for (let y = 294; y <= 648; y++) {
  for (let x = 1300; x <= 1644; x++) {
    // Sample the authentic dark navy textured interior from the clean left margin of the panel (x: 1301..1312)
    const dot = ((x + y) % 4 === 0 ? 3 : 0);
    const r = 11 + dot;
    const g = 14 + dot;
    const b = 60 + dot * 2;
    setPixel(cleanBg, x, y, r, g, b, 255);
  }
}

writePng(
  'public/assets/ui/character-select-clean-bg.png',
  cleanBg.width,
  cleanBg.height,
  cleanBg.pixels
);
console.log('Saved clean background plate to public/assets/ui/character-select-clean-bg.png');
