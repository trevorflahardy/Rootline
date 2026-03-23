import { ImageResponse } from "next/og";

export const runtime = "edge";

export const alt = "Rootline - Map Your Family Story";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #2d5a3d 0%, #3a7250 40%, #4a8a62 100%)",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        {/* Decorative circles */}
        <div
          style={{
            position: "absolute",
            top: "-60px",
            right: "-60px",
            width: "300px",
            height: "300px",
            borderRadius: "50%",
            background: "rgba(255,255,255,0.06)",
            display: "flex",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: "-80px",
            left: "-40px",
            width: "250px",
            height: "250px",
            borderRadius: "50%",
            background: "rgba(255,255,255,0.04)",
            display: "flex",
          }}
        />

        {/* Tree icon representation */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "8px",
            marginBottom: "32px",
          }}
        >
          <div
            style={{
              display: "flex",
              gap: "12px",
            }}
          >
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "50%",
                background: "rgba(255,255,255,0.2)",
                border: "2px solid rgba(255,255,255,0.3)",
                display: "flex",
              }}
            />
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "50%",
                background: "rgba(255,255,255,0.2)",
                border: "2px solid rgba(255,255,255,0.3)",
                display: "flex",
              }}
            />
          </div>
          <div
            style={{
              width: "2px",
              height: "16px",
              background: "rgba(255,255,255,0.3)",
              display: "flex",
            }}
          />
          <div
            style={{
              display: "flex",
              gap: "24px",
            }}
          >
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "50%",
                background: "rgba(255,255,255,0.15)",
                border: "2px solid rgba(255,255,255,0.25)",
                display: "flex",
              }}
            />
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "50%",
                background: "rgba(255,255,255,0.15)",
                border: "2px solid rgba(255,255,255,0.25)",
                display: "flex",
              }}
            />
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "50%",
                background: "rgba(255,255,255,0.15)",
                border: "2px solid rgba(255,255,255,0.25)",
                display: "flex",
              }}
            />
          </div>
        </div>

        <div
          style={{
            fontSize: "64px",
            fontWeight: 800,
            color: "white",
            letterSpacing: "-2px",
            display: "flex",
          }}
        >
          Rootline
        </div>
        <div
          style={{
            fontSize: "28px",
            color: "rgba(255,255,255,0.8)",
            marginTop: "12px",
            display: "flex",
          }}
        >
          Map Your Family Story
        </div>
        <div
          style={{
            fontSize: "18px",
            color: "rgba(255,255,255,0.55)",
            marginTop: "24px",
            display: "flex",
          }}
        >
          Build, explore, and preserve your family tree together
        </div>
      </div>
    ),
    { ...size },
  );
}
