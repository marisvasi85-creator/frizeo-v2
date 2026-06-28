import { ImageResponse } from "next/og";
import { OpenGraphCard } from "@/lib/site/brandMark";

export const alt = "Frizeo — programări online pentru frizerii și saloane";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(<OpenGraphCard />, size);
}
