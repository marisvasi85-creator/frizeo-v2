import QRCode from "qrcode";

export async function renderBookingQrToBlob(
  bookingUrl: string,
  size = 1024,
): Promise<Blob> {
  const dataUrl = await QRCode.toDataURL(bookingUrl, {
    errorCorrectionLevel: "M",
    margin: 2,
    width: size,
    color: {
      dark: "#0B0B0C",
      light: "#FFFFFF",
    },
  });

  const res = await fetch(dataUrl);
  return res.blob();
}

export function downloadQrPng(blob: Blob, salonName: string) {
  const slug = salonName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 30);

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `qr-programari-${slug || "salon"}.png`;
  anchor.click();
  URL.revokeObjectURL(url);
}
