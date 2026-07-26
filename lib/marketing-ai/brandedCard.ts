export type BrandedCardFormat = "square" | "story";

export type BrandedCardBranding = {
  salonName: string;
  barberName?: string;
  logoUrl: string | null;
  bookingUrl?: string;
};

export type BrandedCardInput = BrandedCardBranding & {
  title: string;
  content: string;
  callToAction: string;
  format?: BrandedCardFormat;
};

const FORMATS: Record<
  BrandedCardFormat,
  { width: number; height: number; label: string }
> = {
  square: { width: 1080, height: 1080, label: "1080×1080" },
  story: { width: 1080, height: 1920, label: "1080×1920" },
};

export function getBrandedCardFormatMeta(format: BrandedCardFormat) {
  return FORMATS[format];
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  const words = text.replace(/\s+/g, " ").trim().split(" ");
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = word;
      if (lines.length >= maxLines) break;
    } else {
      current = test;
    }
  }

  if (current && lines.length < maxLines) {
    lines.push(current);
  }

  if (lines.length === maxLines && words.length > lines.join(" ").split(" ").length) {
    const last = lines[maxLines - 1];
    lines[maxLines - 1] = `${last.replace(/\.*$/, "")}…`;
  }

  return lines;
}

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function shortenCta(callToAction: string, bookingUrl?: string): string {
  const cleaned = callToAction
    .replace(bookingUrl || "", "")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/:\s*$/, "")
    .trim();

  if (cleaned.length > 0 && cleaned.length < 60) return cleaned;
  return "Programează-te online";
}

function drawLogoFallback(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  salonName: string,
) {
  ctx.fillStyle = "rgba(255,255,255,0.12)";
  drawRoundedRect(ctx, x, y, size, size, 28);
  ctx.fill();

  const nominal = (salonName.trim()[0] || "F").toUpperCase();
  ctx.fillStyle = "#FFFFFF";
  ctx.font = `700 ${Math.round(size * 0.45)}px system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(nominal, x + size / 2, y + size / 2);
  ctx.textBaseline = "alphabetic";
}

async function drawLogo(
  ctx: CanvasRenderingContext2D,
  input: BrandedCardInput,
  logoX: number,
  logoY: number,
  logoSize: number,
) {
  if (input.logoUrl) {
    const logo = await loadImage(input.logoUrl);
    if (logo) {
      ctx.save();
      drawRoundedRect(ctx, logoX, logoY, logoSize, logoSize, 28);
      ctx.clip();
      ctx.drawImage(logo, logoX, logoY, logoSize, logoSize);
      ctx.restore();
      return;
    }
  }
  drawLogoFallback(ctx, logoX, logoY, logoSize, input.salonName);
}

async function renderSquareCard(input: BrandedCardInput): Promise<Blob> {
  const SIZE = FORMATS.square.width;
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas indisponibil");

  const gradient = ctx.createLinearGradient(0, 0, SIZE, SIZE);
  gradient.addColorStop(0, "#0B0B0C");
  gradient.addColorStop(0.55, "#15151A");
  gradient.addColorStop(1, "#1F1A14");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, SIZE, SIZE);

  ctx.fillStyle = "rgba(255,255,255,0.04)";
  drawRoundedRect(ctx, 60, 60, SIZE - 120, SIZE - 120, 40);
  ctx.fill();

  const logoSize = 140;
  const logoX = SIZE / 2 - logoSize / 2;
  const logoY = 120;
  await drawLogo(ctx, input, logoX, logoY, logoSize);

  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.font = "500 28px system-ui, -apple-system, Segoe UI, sans-serif";
  ctx.fillText(input.salonName.toUpperCase(), SIZE / 2, 310);

  if (input.barberName) {
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.font = "400 24px system-ui, -apple-system, Segoe UI, sans-serif";
    ctx.fillText(input.barberName, SIZE / 2, 348);
  }

  ctx.fillStyle = "#FFFFFF";
  ctx.font = "700 52px system-ui, -apple-system, Segoe UI, sans-serif";
  const titleLines = wrapText(ctx, input.title, SIZE - 160, 2);
  let y = 430;
  for (const line of titleLines) {
    ctx.fillText(line, SIZE / 2, y);
    y += 62;
  }

  ctx.fillStyle = "rgba(255,255,255,0.82)";
  ctx.font = "400 34px system-ui, -apple-system, Segoe UI, sans-serif";
  const bodyLines = wrapText(ctx, input.content, SIZE - 180, 4);
  y += 20;
  for (const line of bodyLines) {
    ctx.fillText(line, SIZE / 2, y);
    y += 48;
  }

  const ctaText = shortenCta(input.callToAction, input.bookingUrl);
  const ctaY = SIZE - 200;

  ctx.fillStyle = "#FFFFFF";
  drawRoundedRect(ctx, 120, ctaY, SIZE - 240, 88, 44);
  ctx.fill();

  ctx.fillStyle = "#0B0B0C";
  ctx.font = "700 34px system-ui, -apple-system, Segoe UI, sans-serif";
  ctx.fillText(ctaText, SIZE / 2, ctaY + 58);

  if (input.bookingUrl) {
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.font = "400 22px system-ui, -apple-system, Segoe UI, sans-serif";
    const urlDisplay = input.bookingUrl.replace(/^https?:\/\//, "");
    ctx.fillText(urlDisplay, SIZE / 2, SIZE - 72);
  }

  ctx.fillStyle = "rgba(255,255,255,0.2)";
  ctx.font = "500 20px system-ui, -apple-system, Segoe UI, sans-serif";
  ctx.fillText("Creat cu Frizeo Marketing AI", SIZE / 2, SIZE - 36);

  return blobFromCanvas(canvas);
}

async function renderStoryCard(input: BrandedCardInput): Promise<Blob> {
  const W = FORMATS.story.width;
  const H = FORMATS.story.height;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas indisponibil");

  const gradient = ctx.createLinearGradient(0, 0, W, H);
  gradient.addColorStop(0, "#0B0B0C");
  gradient.addColorStop(0.45, "#12141A");
  gradient.addColorStop(1, "#1A2433");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, W, H);

  // Soft glow
  const glow = ctx.createRadialGradient(W / 2, H * 0.28, 40, W / 2, H * 0.28, 420);
  glow.addColorStop(0, "rgba(31,111,235,0.22)");
  glow.addColorStop(1, "rgba(31,111,235,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = "rgba(255,255,255,0.04)";
  drawRoundedRect(ctx, 56, 80, W - 112, H - 160, 48);
  ctx.fill();

  const logoSize = 168;
  const logoX = W / 2 - logoSize / 2;
  const logoY = 160;
  await drawLogo(ctx, input, logoX, logoY, logoSize);

  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.font = "500 30px system-ui, -apple-system, Segoe UI, sans-serif";
  ctx.fillText(input.salonName.toUpperCase(), W / 2, 390);

  if (input.barberName) {
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.font = "400 26px system-ui, -apple-system, Segoe UI, sans-serif";
    ctx.fillText(input.barberName, W / 2, 432);
  }

  ctx.fillStyle = "#FFFFFF";
  ctx.font = "700 64px system-ui, -apple-system, Segoe UI, sans-serif";
  const titleLines = wrapText(ctx, input.title, W - 160, 3);
  let y = 560;
  for (const line of titleLines) {
    ctx.fillText(line, W / 2, y);
    y += 76;
  }

  ctx.fillStyle = "rgba(255,255,255,0.82)";
  ctx.font = "400 38px system-ui, -apple-system, Segoe UI, sans-serif";
  const bodyLines = wrapText(ctx, input.content, W - 180, 7);
  y += 36;
  for (const line of bodyLines) {
    ctx.fillText(line, W / 2, y);
    y += 54;
  }

  const ctaText = shortenCta(input.callToAction, input.bookingUrl);
  const ctaY = H - 360;

  ctx.fillStyle = "#FFFFFF";
  drawRoundedRect(ctx, 140, ctaY, W - 280, 100, 50);
  ctx.fill();

  ctx.fillStyle = "#0B0B0C";
  ctx.font = "700 36px system-ui, -apple-system, Segoe UI, sans-serif";
  ctx.fillText(ctaText, W / 2, ctaY + 64);

  if (input.bookingUrl) {
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.font = "400 26px system-ui, -apple-system, Segoe UI, sans-serif";
    const urlDisplay = input.bookingUrl.replace(/^https?:\/\//, "");
    ctx.fillText(urlDisplay, W / 2, H - 200);
  }

  ctx.fillStyle = "rgba(255,255,255,0.22)";
  ctx.font = "500 22px system-ui, -apple-system, Segoe UI, sans-serif";
  ctx.fillText("Creat cu Frizeo Marketing AI", W / 2, H - 140);

  return blobFromCanvas(canvas);
}

function blobFromCanvas(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Nu am putut genera imaginea"));
      },
      "image/png",
      1,
    );
  });
}

export async function renderBrandedCardToBlob(
  input: BrandedCardInput,
): Promise<Blob> {
  const format = input.format ?? "square";
  if (format === "story") return renderStoryCard(input);
  return renderSquareCard(input);
}

export function downloadBrandedCard(
  blob: Blob,
  salonName: string,
  format: BrandedCardFormat = "square",
) {
  const slug = salonName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 30);

  const date = new Date().toISOString().slice(0, 10);
  const suffix = format === "story" ? "story" : "post";
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `promo-${suffix}-${slug || "salon"}-${date}.png`;
  anchor.click();
  URL.revokeObjectURL(url);
}
