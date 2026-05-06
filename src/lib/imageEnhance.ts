/**
 * Otimização local de imagem de produto via Canvas (sem IA).
 *
 * Aplica:
 *  - Redimensionamento proporcional (máx 1600px no maior lado)
 *  - Recorte para reduzir bordas vazias (auto-crop por luminância)
 *  - Centralização em canvas quadrado com fundo branco
 *  - Ajuste suave de brilho/contraste
 *  - Leve sharpen via convolução 3x3
 *  - Exportação em JPEG de alta qualidade
 */

const TARGET_SIZE = 1200;
const MAX_INPUT_DIM = 1600;

export async function enhanceProductImage(file: File): Promise<File> {
  const img = await loadImage(file);

  // 1) Reduz para no máximo MAX_INPUT_DIM no maior lado (mantendo proporção)
  const scale = Math.min(1, MAX_INPUT_DIM / Math.max(img.width, img.height));
  const w0 = Math.round(img.width * scale);
  const h0 = Math.round(img.height * scale);
  const c0 = document.createElement("canvas");
  c0.width = w0;
  c0.height = h0;
  const ctx0 = c0.getContext("2d", { willReadFrequently: true })!;
  ctx0.imageSmoothingEnabled = true;
  ctx0.imageSmoothingQuality = "high";
  ctx0.drawImage(img, 0, 0, w0, h0);

  // 2) Auto-crop: remove margens praticamente brancas/uniformes
  const cropped = autoCropWhitespace(ctx0, w0, h0);

  // 3) Compor em canvas quadrado branco TARGET_SIZE x TARGET_SIZE
  const square = document.createElement("canvas");
  square.width = TARGET_SIZE;
  square.height = TARGET_SIZE;
  const sctx = square.getContext("2d", { willReadFrequently: true })!;
  sctx.fillStyle = "#ffffff";
  sctx.fillRect(0, 0, TARGET_SIZE, TARGET_SIZE);

  const padding = 0.92; // 8% de respiro
  const fit = Math.min(
    (TARGET_SIZE * padding) / cropped.width,
    (TARGET_SIZE * padding) / cropped.height,
  );
  const dw = Math.round(cropped.width * fit);
  const dh = Math.round(cropped.height * fit);
  const dx = Math.round((TARGET_SIZE - dw) / 2);
  const dy = Math.round((TARGET_SIZE - dh) / 2);
  sctx.imageSmoothingEnabled = true;
  sctx.imageSmoothingQuality = "high";
  sctx.drawImage(cropped.canvas, 0, 0, cropped.width, cropped.height, dx, dy, dw, dh);

  // 4) Brilho/contraste suaves + sharpen
  const imageData = sctx.getImageData(0, 0, TARGET_SIZE, TARGET_SIZE);
  applyBrightnessContrast(imageData, 6, 12); // +brilho leve, +contraste leve
  sctx.putImageData(imageData, 0, 0);
  applySharpen(sctx, TARGET_SIZE, TARGET_SIZE, 0.35);

  // 5) Exporta como JPEG alta qualidade
  const blob = await new Promise<Blob | null>((resolve) =>
    square.toBlob(resolve, "image/jpeg", 0.92),
  );
  if (!blob) throw new Error("Falha ao gerar imagem otimizada");

  const baseName = (file.name.replace(/\.[^.]+$/, "") || "produto").slice(0, 60);
  const optimized = new File([blob], `${baseName}-otimizada.jpg`, {
    type: "image/jpeg",
    lastModified: Date.now(),
  });
  return optimized;
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Não foi possível ler a imagem"));
    };
    img.src = url;
  });
}

function autoCropWhitespace(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
): { canvas: HTMLCanvasElement; width: number; height: number } {
  const data = ctx.getImageData(0, 0, w, h);
  const px = data.data;
  // Considera "fundo" pixels claros e baixa saturação
  const isBg = (i: number) => {
    const r = px[i],
      g = px[i + 1],
      b = px[i + 2],
      a = px[i + 3];
    if (a < 8) return true;
    const max = Math.max(r, g, b),
      min = Math.min(r, g, b);
    const lum = (r + g + b) / 3;
    return lum > 240 && max - min < 12;
  };

  let top = 0,
    bottom = h - 1,
    left = 0,
    right = w - 1;
  outerTop: for (; top < h; top++) {
    for (let x = 0; x < w; x++) if (!isBg((top * w + x) * 4)) break outerTop;
  }
  outerBottom: for (; bottom > top; bottom--) {
    for (let x = 0; x < w; x++) if (!isBg((bottom * w + x) * 4)) break outerBottom;
  }
  outerLeft: for (; left < w; left++) {
    for (let y = top; y <= bottom; y++) if (!isBg((y * w + left) * 4)) break outerLeft;
  }
  outerRight: for (; right > left; right--) {
    for (let y = top; y <= bottom; y++) if (!isBg((y * w + right) * 4)) break outerRight;
  }

  const cw = Math.max(1, right - left + 1);
  const ch = Math.max(1, bottom - top + 1);
  // Se quase nada foi cortado, devolve o canvas original
  if (cw > w * 0.95 && ch > h * 0.95) {
    const same = document.createElement("canvas");
    same.width = w;
    same.height = h;
    same.getContext("2d")!.drawImage(ctx.canvas, 0, 0);
    return { canvas: same, width: w, height: h };
  }
  const out = document.createElement("canvas");
  out.width = cw;
  out.height = ch;
  out.getContext("2d")!.drawImage(ctx.canvas, left, top, cw, ch, 0, 0, cw, ch);
  return { canvas: out, width: cw, height: ch };
}

function applyBrightnessContrast(imageData: ImageData, brightness: number, contrast: number) {
  const d = imageData.data;
  const c = contrast / 100 + 1;
  const intercept = 128 * (1 - c) + brightness;
  for (let i = 0; i < d.length; i += 4) {
    d[i] = clamp(d[i] * c + intercept);
    d[i + 1] = clamp(d[i + 1] * c + intercept);
    d[i + 2] = clamp(d[i + 2] * c + intercept);
  }
}

function clamp(v: number) {
  return v < 0 ? 0 : v > 255 ? 255 : v;
}

function applySharpen(ctx: CanvasRenderingContext2D, w: number, h: number, amount: number) {
  const src = ctx.getImageData(0, 0, w, h);
  const dst = ctx.createImageData(w, h);
  const s = src.data,
    d = dst.data;
  const a = amount;
  // Kernel: centro = 1+4a, vizinhos = -a
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = (y * w + x) * 4;
      for (let c = 0; c < 3; c++) {
        const v =
          s[i + c] * (1 + 4 * a) -
          (s[i - 4 + c] + s[i + 4 + c] + s[i - w * 4 + c] + s[i + w * 4 + c]) * a;
        d[i + c] = clamp(v);
      }
      d[i + 3] = s[i + 3];
    }
  }
  // Bordas: copia
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) {
        const i = (y * w + x) * 4;
        d[i] = s[i];
        d[i + 1] = s[i + 1];
        d[i + 2] = s[i + 2];
        d[i + 3] = s[i + 3];
      }
    }
  }
  ctx.putImageData(dst, 0, 0);
}
