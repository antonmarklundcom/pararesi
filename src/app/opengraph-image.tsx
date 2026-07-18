import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "flex-start",
          padding: "80px",
          background: "linear-gradient(135deg, #0b1730 0%, #0a1f16 100%)",
          color: "#ffffff",
        }}
      >
        <div style={{ fontSize: 28, color: "#4a9b70", fontWeight: 600, letterSpacing: 2 }}>
          PARAGUAY RESIDENCY GUIDE
        </div>
        <div style={{ fontSize: 64, fontWeight: 700, marginTop: 24, lineHeight: 1.1, maxWidth: 900 }}>
          A clear, step-by-step path to Paraguay residency.
        </div>
      </div>
    ),
    { ...size },
  );
}
