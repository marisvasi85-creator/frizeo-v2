import { ImageResponse } from "next/og";
import { BrandMark } from "@/lib/site/brandMark";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    <BrandMark size={32} fontSize={20} />,
    size
  );
}
