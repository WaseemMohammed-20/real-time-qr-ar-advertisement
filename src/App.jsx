import { useState, useCallback, useMemo } from "react";
import QRScanner from "./components/QRScanner";
import ARExperience from "./components/ARExperience";
import "./App.css";

const isYouTubeUrl = (value) => {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    return host.includes("youtube.com") || host.includes("youtu.be");
  } catch {
    return false;
  }
};

const isVideoUrl = (value) => {
  try {
    const url = new URL(value);
    const type = url.pathname.toLowerCase();
    return /\.(mp4|webm|ogg|mov|m4v)(\?.*)?$/i.test(type);
  } catch {
    return false;
  }
};

const isImageUrl = (value) => {
  try {
    const url = new URL(value);
    const type = url.pathname.toLowerCase();
    return /\.(png|jpg|jpeg|gif|webp|svg)(\?.*)?$/i.test(type);
  } catch {
    return false;
  }
};

const getYouTubeEmbedUrl = (value) => {
  try {
    const url = new URL(value);
    if (url.hostname.includes("youtu.be")) {
      const id = url.pathname.replace("/", "");
      return `https://www.youtube.com/embed/${id}`;
    }

    const videoId = url.searchParams.get("v");
    if (videoId) {
      return `https://www.youtube.com/embed/${videoId}`;
    }
  } catch {
    // Ignore invalid YouTube URL.
  }

  return "";
};

const detectQrContent = (rawText) => {
  const value = (rawText || "").trim();

  if (!value) {
    return {
      type: "unknown",
      data: "",
      label: "Unknown Content",
    };
  }

  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === "object") {
      return {
        type: "json",
        data: parsed,
        label: "Structured Content",
      };
    }
  } catch {
    // Ignore JSON parsing errors.
  }

  if (/^https?:\/\//i.test(value)) {
    if (isVideoUrl(value)) {
      return { type: "video", data: value, label: "Video Content" };
    }

    if (isImageUrl(value)) {
      return { type: "image", data: value, label: "Image Content" };
    }

    if (isYouTubeUrl(value)) {
      return { type: "youtube", data: getYouTubeEmbedUrl(value), label: "YouTube Video" };
    }

    return { type: "website", data: value, label: "Website" };
  }

  if (value.includes("\n") || value.length > 120) {
    return { type: "text", data: value, label: "Text Content" };
  }

  return { type: "text", data: value, label: "Text Content" };
};

const getDisplayContent = (contentInfo) => {
  if (!contentInfo || !contentInfo.type || contentInfo.type === "unknown") {
    return { kind: "video", src: "/videos/ad.mp4", label: "Advertisement" };
  }

  if (contentInfo.type === "video") {
    return { kind: "video", src: contentInfo.data, label: contentInfo.label || "Video" };
  }

  if (contentInfo.type === "image") {
    return { kind: "image", src: contentInfo.data, label: contentInfo.label || "Image" };
  }

  if (contentInfo.type === "text") {
    return { kind: "text", text: contentInfo.data, label: contentInfo.label || "Text" };
  }

  return { kind: "video", src: "/videos/ad.mp4", label: "Advertisement Content" };
};

function App() {
  const [screen, setScreen] = useState("home");
  const [qrData, setQrData] = useState("");
  const [contentInfo, setContentInfo] = useState({
    type: "unknown",
    data: "",
    label: "Unknown Content",
  });

  const content = useMemo(() => detectQrContent(qrData), [qrData]);
  const displayContent = useMemo(() => getDisplayContent(content), [content]);

  const handleScanSuccess = useCallback((decodedText) => {
    console.log("QR detected:", decodedText);
    const detected = detectQrContent(decodedText);
    setQrData(decodedText);
    setContentInfo(detected);
    setScreen("activating");

    setTimeout(() => {
      setScreen("ar");
    }, 1100);
  }, []);

  const startExperience = () => {
    setQrData("");
    setContentInfo({ type: "unknown", data: "", label: "Unknown Content" });
    setScreen("scanner");
  };

  const scanAgain = () => {
    setQrData("");
    setContentInfo({ type: "unknown", data: "", label: "Unknown Content" });
    setScreen("scanner");
  };

  const goHome = () => {
    setQrData("");
    setContentInfo({ type: "unknown", data: "", label: "Unknown Content" });
    setScreen("home");
  };

  const openFallback = () => {
    setScreen("fallback");
  };

  return (
    <main className="app">
      {screen === "home" && (
        <section className="hero">
          <p className="badge">QR TRIGGERED AR EXPERIENCE</p>

          <h1>
            Bring Paper
            <span> Advertisements to Life.</span>
          </h1>

          <p className="description">
            Scan a QR code and watch an advertisement come to life.
          </p>

          <button className="start-button" onClick={startExperience}>
            Start Experience
          </button>
        </section>
      )}

      {screen === "scanner" && (
        <section className="scanner-screen">
          <div className="scanner-header">
            <p className="badge">SCANNING</p>
            <h2>Point Your Camera at the QR Code</h2>
          </div>

          <div className="camera-container">
            <div className="scanner-ui">
              <div className="scan-line"></div>
              <span className="scanner-corner corner-tl"></span>
              <span className="scanner-corner corner-tr"></span>
              <span className="scanner-corner corner-bl"></span>
              <span className="scanner-corner corner-br"></span>
            </div>

            <QRScanner onScanSuccess={handleScanSuccess} />
          </div>

          <p className="description">Scan the QR code to activate the advertisement.</p>

          <button className="back-button" onClick={goHome}>
            ← Back to Home
          </button>
        </section>
      )}

      {screen === "activating" && (
        <section className="scanner-screen">
          <div className="scanner-header">
            <p className="badge">AR ACTIVATING</p>
            <h2>Preparing Your Experience...</h2>
          </div>

          <div className="camera-container">
            <div className="activation-screen">
              <div className="activation-ring"></div>
              <h3>QR DETECTED ✓</h3>
              <p>Starting AR tracking...</p>
            </div>
          </div>
        </section>
      )}

      {screen === "ar" && (
        <ARExperience
          content={displayContent}
          onClose={scanAgain}
          onBackHome={goHome}
          onFallback={openFallback}
        />
      )}

      {screen === "fallback" && (
        <ARExperience
          content={displayContent}
          forceFallback
          onClose={scanAgain}
          onBackHome={goHome}
          onFallback={openFallback}
        />
      )}

      {screen === "error" && (
        <section className="scanner-screen">
          <div className="scanner-header">
            <p className="badge">ERROR</p>
            <h2>AR Experience Unavailable</h2>
          </div>

          <div className="camera-container">
            <div className="activation-screen">
              <div className="activation-ring"></div>
              <h3>Something went wrong</h3>
              <p>Please go back home and retry.</p>
            </div>
          </div>

          <button className="back-button" onClick={goHome}>← Back to Home</button>
        </section>
      )}
    </main>
  );
}

export default App;