import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";

function QRScanner({ onScanSuccess }) {
  const mountRef = useRef(null);
  const readerRef = useRef(null);
  const streamRef = useRef(null);
  const videoRef = useRef(null);
  const [cameraError, setCameraError] = useState("");
  const [isStarting, setIsStarting] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const stopReader = async () => {
      try {
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
        }

        if (videoRef.current) {
          videoRef.current.pause();
          videoRef.current.srcObject = null;
          if (videoRef.current.parentNode) {
            videoRef.current.parentNode.removeChild(videoRef.current);
          }
          videoRef.current = null;
        }

        if (readerRef.current) {
          readerRef.current.reset();
        }
      } catch (error) {
        console.log("Scanner cleanup complete");
      } finally {
        readerRef.current = null;
      }
    };

    const startScanner = async () => {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        if (!cancelled) {
          setCameraError("This browser does not support camera access.");
          setIsStarting(false);
        }
        return;
      }

      if (!window.isSecureContext && !["localhost", "127.0.0.1"].includes(window.location.hostname)) {
        if (!cancelled) {
          setCameraError("Camera access requires HTTPS or localhost. Please use a secure connection and allow camera permission.");
          setIsStarting(false);
        }
        return;
      }

      try {
        const reader = new BrowserMultiFormatReader();
        readerRef.current = reader;

        const videoElement = document.createElement("video");
        videoElement.playsInline = true;
        videoElement.muted = true;
        videoElement.autoplay = true;
        videoElement.setAttribute("playsinline", "true");
        videoElement.style.width = "100%";
        videoElement.style.height = "100%";
        videoElement.style.objectFit = "cover";
        videoElement.style.borderRadius = "25px";
        videoElement.style.background = "#000";
        videoRef.current = videoElement;

        const parent = mountRef.current;
        if (!parent) return;

        if (!parent.contains(videoElement)) {
          parent.appendChild(videoElement);
        }

        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter((device) => device.kind === "videoinput");

        if (!videoDevices.length) {
          if (!cancelled) {
            setCameraError("No camera device was found. Please use a real phone or webcam and allow camera access.");
          }
          return;
        }

        const preferredDevice = videoDevices.find((device) => /rear|environment|back/i.test(device.label)) || videoDevices[0];

        const stream = await navigator.mediaDevices.getUserMedia({
          video: preferredDevice
            ? { deviceId: { exact: preferredDevice.deviceId }, facingMode: { ideal: "environment" } }
            : { facingMode: { ideal: "environment" } },
          audio: false,
        }).catch(async () => {
          return navigator.mediaDevices.getUserMedia({
            video: preferredDevice
              ? { deviceId: { exact: preferredDevice.deviceId }, facingMode: "user" }
              : { facingMode: "user" },
            audio: false,
          });
        }).catch(async () => {
          return navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });
        });

        streamRef.current = stream;
        videoElement.srcObject = stream;
        await videoElement.play();

        await reader.decodeFromVideoElement(videoElement, (result, error) => {
          if (cancelled) return;

          if (result) {
            const scannedText = result.getText();
            onScanSuccess(scannedText);
          }

          if (error && !(error.name === "NotFoundException")) {
            console.warn("QR scan frame error:", error);
          }
        });
      } catch (error) {
        console.error("QR scanner start failed:", error);

        if (!cancelled) {
          const message =
            error && error.name === "NotAllowedError"
              ? "Camera permission was blocked. Please allow camera access and try again."
              : error && error.name === "NotFoundError"
                ? "No camera device was found. Please use a real phone or webcam."
                : "Camera permission is required to scan the QR code. Please allow access and try again.";

          setCameraError(message);
        }
      } finally {
        if (!cancelled) {
          setIsStarting(false);
        }
      }
    };

    const timer = setTimeout(() => {
      startScanner();
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      stopReader();
    };
  }, [onScanSuccess]);

  if (cameraError) {
    const retryCamera = () => {
      window.location.reload();
    };

    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          padding: "24px",
          color: "#fff",
          background: "#090909",
        }}
      >
        <div>
          <h3 style={{ marginBottom: "12px" }}>Camera Access Needed</h3>
          <p style={{ color: "#aaa", lineHeight: 1.6, marginBottom: "16px" }}>{cameraError}</p>
          <p style={{ color: "#d4d4d4", fontSize: 14, lineHeight: 1.5, marginBottom: "18px" }}>
            On iPhone Chrome, use a secure HTTPS page and allow camera permission in the browser settings.
          </p>
          <button
            type="button"
            onClick={retryCamera}
            style={{
              background: "#ff4d4d",
              color: "#fff",
              border: "none",
              borderRadius: "999px",
              padding: "10px 18px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Retry Camera
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="qr-wrapper">
      <div ref={mountRef} className="qr-reader">
        {isStarting && (
          <div className="camera-loading">
            <div className="loading-spinner" />
            <p>Starting camera...</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default QRScanner;