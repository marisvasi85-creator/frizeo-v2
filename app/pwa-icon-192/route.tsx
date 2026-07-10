import { ImageResponse } from "next/og";
import { BrandMark } from "@/lib/site/brandMark";

export const runtime = "edge";

export async function GET() {
  return new ImageResponse(<BrandMark size={192} fontSize={120} />, {
    width: 192,
    height: 192,
  });
}
