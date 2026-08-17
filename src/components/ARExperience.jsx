import { useEffect, useRef, useState } from "react";

const loadScript = (src) =>
  new Promise((resolve, reject) => {
    const existingScript = document.querySelector(`script[src="${src}"]`);

    if (existingScript) {
      if (existingScript.dataset.loaded === "true") {
        resolve();
        return;
      }

      existingScript.addEventListener("load", () => resolve(), { once: true });
      existingScript.addEventListener("error", () => reject(new Error(`Failed to load script: ${src}`)), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => {
      script.dataset.loaded = "true";
      resolve();
    };
    script.onerror = () => {
      reject(new Error(`Failed to load script: ${src}`));
    };

    document.head.appendChild(script);
  });

function ARExperience({ content, onClose, onBackHome, onFallback, forceFallback = false }) {
  const containerRef = useRef(null);
  const mindarRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [status, setStatus] = useState("Starting AR Camera...");
  const [trackingAvailable, setTrackingAvailable] = useState(true);
  const [isFallback, setIsFallback] = useState(forceFallback);
  const [targetFound, setTargetFound] = useState(false);

  useEffect(() => {
    let isMounted = true;
    let fallbackTimer = null;
    let cleanupDone = false;

    const stopStream = () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }

      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.srcObject = null;
      }
    };

    const cleanupMindAR = async () => {
      try {
        if (mindarRef.current) {
          const activeMindar = mindarRef.current;

          if (activeMindar.renderer && activeMindar.renderer.setAnimationLoop) {
            activeMindar.renderer.setAnimationLoop(null);
          }

          if (activeMindar.stop) {
            await activeMindar.stop();
          }
        }
      } catch (error) {
        console.warn("MindAR cleanup warning:", error);
      } finally {
        mindarRef.current = null;
      }
    };

    const fallbackMode = () => {
      stopStream();
      setIsFallback(true);
      setStatus(content?.kind === "video" ? "AR video live in fallback mode" : "Fallback mode active");

      const startFallbackStream = async () => {
        try {
          if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            setStatus("Camera unavailable in this browser");
            return;
          }

          const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: "environment" } },
            audio: false,
          });

          if (!isMounted) {
            stream.getTracks().forEach((track) => track.stop());
            return;
          }

          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.play().catch(() => {});
          }
        } catch (error) {
          console.error("Fallback camera failed:", error);
          setStatus("Live camera fallback unavailable");
        }
      };

      startFallbackStream();
    };

    const startMindAR = async () => {
      if (forceFallback) {
        fallbackMode();
        return;
      }

      try {
        if (!containerRef.current) {
          return;
        }

        setStatus("Loading AR tracker...");

        await loadScript("https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js");
        await loadScript("https://cdn.jsdelivr.net/npm/mind-ar@1.2.5/dist/mindar-image-three.prod.js");

        if (!isMounted) {
          return;
        }

        const { MindARThree, THREE } = window;

        if (!MindARThree || !THREE) {
          throw new Error("MindAR or Three.js could not be loaded.");
        }

        const container = containerRef.current;
        const mindarThree = new MindARThree({
          container,
          imageTargetSrc: "/targets/targets.mind",
          uiLoading: "no",
          uiScanning: "no",
          uiError: "no",
        });

        mindarRef.current = mindarThree;

        const { renderer, scene, camera, arController } = mindarThree;
        const anchor = mindarThree.addAnchor(0);

        const adWidth = 1.3;
        const adHeight = 1.0;
        const adGroup = new THREE.Group();
        const background = new THREE.Mesh(
          new THREE.PlaneGeometry(adWidth, adHeight),
          new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.92 })
        );
        background.position.z = 0.01;
        adGroup.add(background);

        const frame = new THREE.LineSegments(
          new THREE.EdgesGeometry(new THREE.BoxGeometry(adWidth + 0.06, adHeight + 0.06, 0.04)),
          new THREE.LineBasicMaterial({ color: 0xff4d4d, transparent: true, opacity: 0.95 })
        );
        frame.position.z = 0.02;
        adGroup.add(frame);

        if (content?.kind === "video" && content.src) {
          const video = document.createElement("video");
          video.src = content.src;
          video.muted = true;
          video.loop = true;
          video.playsInline = true;
          video.autoplay = true;
          video.crossOrigin = "anonymous";
          video.load();

          const texture = new THREE.VideoTexture(video);
          texture.colorSpace = THREE.SRGBColorSpace;
          const videoPlane = new THREE.Mesh(
            new THREE.PlaneGeometry(adWidth * 0.92, adHeight * 0.82),
            new THREE.MeshBasicMaterial({ map: texture, transparent: true })
          );
          videoPlane.position.z = 0.05;
          adGroup.add(videoPlane);
          video.play().catch(() => {});
        } else if (content?.kind === "image" && content.src) {
          const textureLoader = new THREE.TextureLoader();
          const texture = await textureLoader.loadAsync(content.src);
          texture.colorSpace = THREE.SRGBColorSpace;
          const imagePlane = new THREE.Mesh(
            new THREE.PlaneGeometry(adWidth * 0.92, adHeight * 0.82),
            new THREE.MeshBasicMaterial({ map: texture, transparent: true })
          );
          imagePlane.position.z = 0.05;
          adGroup.add(imagePlane);
        } else {
          const labelTexture = document.createElement("canvas");
          const labelCtx = labelTexture.getContext("2d");
          labelTexture.width = 1024;
          labelTexture.height = 720;

          labelCtx.fillStyle = "#000000";
          labelCtx.fillRect(0, 0, labelTexture.width, labelTexture.height);
          labelCtx.fillStyle = "#ffffff";
          labelCtx.font = "bold 54px sans-serif";
          labelCtx.fillText("ADVERTISEMENT", 120, 250);
          labelCtx.font = "38px sans-serif";
          labelCtx.fillStyle = "#ff4d4d";
          labelCtx.fillText(content?.label || "QR DETECTED", 120, 340);
          labelCtx.fillStyle = "#d9d9d9";
          labelCtx.fillText((content?.text || content?.src || "Poster content"), 120, 430, 760);

          const labelTextureMap = new THREE.CanvasTexture(labelTexture);
          const infoPlane = new THREE.Mesh(
            new THREE.PlaneGeometry(adWidth * 0.92, adHeight * 0.82),
            new THREE.MeshBasicMaterial({ map: labelTextureMap, transparent: true })
          );
          infoPlane.position.z = 0.05;
          adGroup.add(infoPlane);
        }

        adGroup.visible = false;
        anchor.group.add(adGroup);

        anchor.onTargetFound = () => {
          adGroup.visible = true;
          setTargetFound(true);
          setStatus("Poster tracked — ad live");
        };

        anchor.onTargetLost = () => {
          adGroup.visible = false;
          setTargetFound(false);
          setStatus("Tracking lost — keep the poster in frame");
        };

        renderer.setSize(container.clientWidth || 1, container.clientHeight || 1);
        renderer.setClearColor(0x000000, 0);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

        await mindarThree.start();

        if (!isMounted) {
          await cleanupMindAR();
          return;
        }

        setTrackingAvailable(true);
        setStatus("Point your camera at the poster");

        arController.onTargetFound = () => {
          adGroup.visible = true;
          setTargetFound(true);
          setStatus(content?.kind === "video" ? "AR video playing on poster" : "Poster tracked — ad live");
        };

        arController.onTargetLost = () => {
          adGroup.visible = false;
          setTargetFound(false);
          setStatus("Tracking lost — keep the poster in frame");
        };

        renderer.setAnimationLoop(() => {
          renderer.render(scene, camera);
        });
      } catch (error) {
        console.error("MindAR initialization failed:", error);
        if (isMounted) {
          setTrackingAvailable(false);
          setIsFallback(true);
          if (onFallback) onFallback();
          fallbackMode();
        }
      }
    };

    startMindAR();

    return () => {
      isMounted = false;
      cleanupDone = true;
      if (fallbackTimer) clearTimeout(fallbackTimer);
      stopStream();
      cleanupMindAR();
      if (containerRef.current) {
        containerRef.current.innerHTML = "";
      }
    };
  }, [content, forceFallback, onFallback]);

  return (
    <div className="ar-experience" ref={containerRef}>
      <div className="ar-overlay-topbar">
        <div className="live-pill"><span className="live-dot"></span> LIVE</div>
        <button className="close-ad-button" onClick={onClose}>✕</button>
      </div>

      <div className="ar-content-area">
        {!isFallback && <div className="tracking-badge">{trackingAvailable ? "QR DETECTED" : "TRACKING UNAVAILABLE"}</div>}
        {isFallback && <div className="tracking-badge">FALLBACK AR MODE</div>}

        <div className="ar-frame-box" aria-label="AR advertisement frame">
          <span className="ar-corner top-left"></span>
          <span className="ar-corner top-right"></span>
          <span className="ar-corner bottom-left"></span>
          <span className="ar-corner bottom-right"></span>

          <div className="ar-label">{content?.label || "ADVERTISEMENT"}</div>

          {isFallback && (
            <div className="fallback-camera-wrap">
              <video ref={videoRef} autoPlay playsInline muted className="fallback-video" />
              <div className="fallback-ad" aria-label="Advertisement overlay">
                {content?.kind === "video" && content.src ? (
                  <video className="fallback-content-video" src={content.src} autoPlay muted loop playsInline controls={false} />
                ) : content?.kind === "image" && content.src ? (
                  <img className="fallback-content-image" src={content.src} alt="Advertisement" />
                ) : (
                  <div className="fallback-content-text">
                    {content?.text || "Advertisement Content Detected"}
                  </div>
                )}
              </div>
            </div>
          )}

          {!isFallback && !targetFound && (
            <div className="poster-wait-overlay" aria-live="polite">
              <div className="poster-hint-card">
                <div className="poster-hint-title">Poster Tracking</div>
                <div className="poster-hint-text">Point the camera at the printed poster to activate the AR ad.</div>
              </div>
            </div>
          )}

          <div className="ar-status-message">{status}</div>
        </div>
      </div>

      <div className="ar-bottom-actions">
        <button className="scan-again-button" onClick={onClose}>Scan Again</button>
        <button className="back-button" onClick={onBackHome}>Back to Home</button>
      </div>
    </div>
  );
}

export default ARExperience;