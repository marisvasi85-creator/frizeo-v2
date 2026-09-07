import { writeFileSync } from "node:fs";
import { createElement } from "react";
import { ImageResponse } from "next/og.js";

const SIZE = 32;
const FONT_SIZE = 20;

const mark = createElement(
  "div",
  {
    style: {
      width: SIZE,
      height: SIZE,
      background: "#0B0B0C",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: "white",
      fontSize: FONT_SIZE,
      fontWeight: 600,
      fontFamily:
        'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
      letterSpacing: "-0.04em",
    },
  },
  "F",
);

const response = new ImageResponse(mark, { width: SIZE, height: SIZE });
const bytes = Buffer.from(await response.arrayBuffer());
writeFileSync(new URL("../app/icon.png", import.meta.url), bytes);
console.log(`wrote app/icon.png (${bytes.length} bytes)`);
