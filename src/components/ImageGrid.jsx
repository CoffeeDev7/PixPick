// ImageGridMuuri.jsx
import React, { useEffect, useRef } from "react";

const ImageGridMuuri = ({ images = [], onImageClick }) => {
  const gridRef = useRef(null);
  const muuriRef = useRef(null);

  const waitForImages = (container) => {
    const imgs = Array.from(container.querySelectorAll("img"));
    if (!imgs.length) return Promise.resolve();
    const promises = imgs.map((img) => {
      if (img.complete) return Promise.resolve();
      return new Promise((res) => {
        const onFinish = () => {
          img.removeEventListener("load", onFinish);
          img.removeEventListener("error", onFinish);
          res();
        };
        img.addEventListener("load", onFinish);
        img.addEventListener("error", onFinish);
      });
    });
    return Promise.all(promises);
  };

  useEffect(() => {
    let mounted = true;
    let MuuriModule = null;
    if (typeof window === "undefined") return;

    const init = async () => {
      if (!gridRef.current) return;
      try {
        const mod = await import("muuri");
        MuuriModule = mod?.default ?? mod;
      } catch (err) {
        console.error("Failed to import Muuri:", err);
        return;
      }

      await waitForImages(gridRef.current);
      if (!mounted) return;

      if (!muuriRef.current) {
        muuriRef.current = new MuuriModule(gridRef.current, {
          dragEnabled: true,
          layout: { fillGaps: true },
        });
      } else {
        muuriRef.current.refreshItems().layout();
      }

      try {
        muuriRef.current.refreshItems().layout();
      } catch (e) {
        console.warn("Muuri layout error:", e);
      }

      document.body.classList.add("images-loaded");
      document.body.style.overflow = "";
    };

    init();

    return () => {
      mounted = false;
      try {
        if (muuriRef.current) {
          muuriRef.current.destroy();
          muuriRef.current = null;
        }
      } catch (e) {
        console.warn("Muuri destroy error:", e);
      }
    };
  }, [images]);

  return (
    <>
      <style>{`
        .muuri-grid {
          position: relative;
          width: 100%;
          opacity: 0;
          transition: opacity 0.45s ease 0s;
        }
        .images-loaded .muuri-grid { opacity: 1; }

        /* item spacing and box-sizing */
        .muuri-item {
          position: absolute;
          margin: 8px;
          z-index: 1;
          box-sizing: border-box;
        }

        /* ----- Simplified responsive widths ----- */
        /* Desktop: 6 columns */
        @media (min-width: 1200px) {
          .muuri-item { width: calc((100% - 16px*6) / 6); } /* rough gutters handled by margin */
        }

        /* Large tablet / small desktop: 5 columns */
        @media (min-width: 992px) and (max-width: 1199px) {
          .muuri-item { width: calc((100% - 16px*5) / 5); }
        }

        /* Tablet: 4 columns */
        @media (min-width: 768px) and (max-width: 991px) {
          .muuri-item { width: calc((100% - 16px*4) / 4); }
        }

        /* Small tablet / large phone: 3 columns */
        @media (min-width: 480px) and (max-width: 767px) {
          .muuri-item { width: calc((100% - 16px*3) / 3); }
        }

        /* Mobile: FORCE 2 columns for anything < 480px */
        @media (max-width: 479px) {
          .muuri-item { width: calc(50% - 16px); } /* 2 columns with margin accounting */
        }

        .muuri-content {
          position: relative;
          cursor: grab;
          width: 100%;
          height: 100%;
        }
        .muuri-content > img {
          display: block;
          width: 100%;
          height: auto;
          border-radius: 8px;
          user-select: none;
          -webkit-user-drag: none;
        }

        .muuri-item.muuri-item-hidden { z-index: 0; }
        .muuri-item.muuri-item-releasing { z-index: 2; }
        .muuri-item.muuri-item-dragging { z-index: 3; transform-origin: center; }

        .muuri-loading {
          position: fixed;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          pointer-events: none;
          z-index: 9999;
          transition: opacity 0.3s ease;
        }
        .images-loaded .muuri-loading { opacity: 0; }
      `}</style>

      <div className="muuri-loading">Loading images…</div>

      <div className="muuri-grid" ref={gridRef}>
        {images.map((img, i) => (
          <div className="muuri-item" key={img.id ?? i}>
            <div
              className="muuri-content"
              onClick={() => onImageClick?.(i)}
            >
              <img src={img.src} alt={img.alt ?? `image-${i}`} draggable={false} />
            </div>
          </div>
        ))}
      </div>
    </>
  );
};

export default ImageGridMuuri;
