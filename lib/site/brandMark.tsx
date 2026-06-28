type BrandMarkProps = {
  size: number;
  fontSize: number;
  letter?: string;
};

export function BrandMark({
  size,
  fontSize,
  letter = "F",
}: BrandMarkProps) {
  return (
    <div
      style={{
        width: size,
        height: size,
        background: "#0B0B0C",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "white",
        fontSize,
        fontWeight: 600,
        fontFamily:
          'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
        letterSpacing: "-0.04em",
      }}
    >
      {letter}
    </div>
  );
}

export function OpenGraphCard() {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        background: "#0B0B0C",
        color: "white",
        padding: "72px 80px",
        fontFamily:
          'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
      }}
    >
      <div
        style={{
          fontSize: 88,
          fontWeight: 600,
          letterSpacing: "-0.04em",
          marginBottom: 24,
        }}
      >
        Frizeo
      </div>
      <div
        style={{
          fontSize: 36,
          lineHeight: 1.35,
          color: "rgba(255,255,255,0.78)",
          maxWidth: 900,
        }}
      >
        Programări online pentru frizerii și saloane
      </div>
      <div
        style={{
          marginTop: 40,
          fontSize: 24,
          color: "rgba(255,255,255,0.55)",
        }}
      >
        Link personal · Calendar · Email & SMS automate
      </div>
    </div>
  );
}
