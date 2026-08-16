import { ImageResponse } from "next/og";
import { isAllowedPwaLogoUrl } from "@/lib/pwa/allowedIconLogo";
import { brandInitials } from "@/lib/pwa/brandInitials";
import { BrandMark } from "@/lib/site/brandMark";

export const runtime = "edge";

const ALLOWED_SIZES = new Set([180, 192, 512]);
const MAX_LOGO_BYTES = 2_000_000;

function parseSize(raw: string | null): number {
  const n = Number(raw);
  if (ALLOWED_SIZES.has(n)) return n;
  return 192;
}

function cacheHeaders() {
  return {
    "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
  };
}

function initialsIcon(size: number, label: string | null) {
  const initials = label?.trim() ? brandInitials(label) : "F";
  return new ImageResponse(<BrandMark size={size} letter={initials} />, {
    width: size,
    height: size,
    headers: cacheHeaders(),
  });
}

async function logoDataUrl(logo: string): Promise<string | null> {
  try {
    const res = await fetch(logo, {
      redirect: "error",
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;

    const contentType = (res.headers.get("content-type") || "")
      .split(";")[0]
      .trim()
      .toLowerCase();
    if (!contentType.startsWith("image/")) return null;

    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_LOGO_BYTES) {
      return null;
    }

    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }

    return `data:${contentType};base64,${btoa(binary)}`;
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const size = parseSize(searchParams.get("size"));
  const label = searchParams.get("label");
  const logo = searchParams.get("logo");

  if (logo && isAllowedPwaLogoUrl(logo)) {
    const dataUrl = await logoDataUrl(logo);
    if (dataUrl) {
      const pad = Math.round(size * 0.12);
      const inner = size - pad * 2;

      return new ImageResponse(
        (
          <div
            style={{
              width: size,
              height: size,
              background: "#FFFFFF",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {/* next/image is not supported inside ImageResponse */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={dataUrl}
              alt=""
              width={inner}
              height={inner}
              style={{
                width: inner,
                height: inner,
                objectFit: "contain",
              }}
            />
          </div>
        ),
        { width: size, height: size, headers: cacheHeaders() },
      );
    }
  }

  return initialsIcon(size, label);
}
