// ImageGrid.jsx
import React, { useEffect, useRef } from "react";
import Muuri from "muuri";

const ImageGrid = ({
  images = [],
  reorderMode = false,
  setModalIndex,
  // tweak these to control columns + spacing
  columns = { xl: 6, lg: 5, md: 4, sm: 3, xs: 2 },
  gap = 8, // gap in px between images (horizontal space between items)
  storageKey = "pixpick-order",
  multiSelectMode = false,      // NEW
  selectedImages = new Set(),   // NEW
  toggleSelectImage = () => {}, // NEW
}) => {
  const tag = "[ImageGrid]";
  const gridRef = useRef(null);
  const muuriRef = useRef(null);
  const mountedRef = useRef(true);

  // wait for images to settle
  const waitForImages = (container) => {
    const imgs = Array.from(container.querySelectorAll("img"));
    if (!imgs.length) return Promise.resolve();
    return Promise.all(
      imgs.map((img) =>
        img.complete
          ? Promise.resolve()
          : new Promise((res) => {
              const onFinish = () => {
                img.removeEventListener("load", onFinish);
                img.removeEventListener("error", onFinish);
                res();
              };
              img.addEventListener("load", onFinish);
              img.addEventListener("error", onFinish);
            })
      )
    );
  };

  // Utility: create Muuri with given dragEnabled flag
  const createMuuri = (dragEnabled = false) => {
    if (!gridRef.current) {
      console.warn(`${tag} createMuuri: no gridRef`);
      return null;
    }
    console.debug(`${tag} createMuuri: dragEnabled=${dragEnabled}`);
    const inst = new Muuri(gridRef.current, {
      dragEnabled,
      layout: { fillGaps: true },
      // we rely on full-drag here, but you can add handle if desired:
      // dragStartPredicate: { handle: ".drag-handle" }
    });

    // ensure it recalculates on window resize (helps responsive widths)
    const onResize = () => {
      try {
        inst.refreshItems().layout();
      } catch (e) {
        console.warn(`${tag} resize layout failed`, e);
      }
    };
    window.addEventListener("resize", onResize);
    // attach cleanup reference for later removal
    inst.__pixpick_onResize = onResize;

    return inst;
  };

  // Create initial muuri (or refresh)
  useEffect(() => {
    mountedRef.current = true;

    const init = async () => {
      if (!gridRef.current) return;
      console.debug(`${tag} init: waiting images...`);
      await waitForImages(gridRef.current);
      if (!mountedRef.current) return;

      if (!muuriRef.current) {
        muuriRef.current = createMuuri(reorderMode);
        console.debug(`${tag} init: created muuri`, !!muuriRef.current);
        // restore saved order safely using Muuri Items
        try {
          const saved = localStorage.getItem(storageKey);
          if (saved) {
            const ids = JSON.parse(saved);
            const items = muuriRef.current.getItems();
            const idToItem = new Map(items.map(it => [it.getElement().dataset.id, it]));
            const orderedItems = ids.map(id => idToItem.get(String(id))).filter(Boolean);
            if (orderedItems.length) {
              muuriRef.current.sort(orderedItems);
              console.debug(`${tag} init: restored saved order (${orderedItems.length})`);
            }
          }
        } catch (e) {
          console.warn(`${tag} init restore error:`, e);
        }

        try {
          muuriRef.current.refreshItems().layout();
          console.debug(`${tag} initial refresh/layout OK`);
        } catch (e) {
          console.warn(`${tag} initial layout failed:`, e);
        }
      } else {
        try {
          muuriRef.current.refreshItems().layout();
        } catch (e) {
          console.warn(`${tag} refresh failed`, e);
        }
      }
      document.body.classList.add("images-loaded");
    };

    init();

    return () => {
      mountedRef.current = false;
      try {
        if (muuriRef.current) {
          // remove resize listener
          const fn = muuriRef.current.__pixpick_onResize;
          if (fn) window.removeEventListener("resize", fn);
          muuriRef.current.destroy();
          muuriRef.current = null;
        }
      } catch (e) {
        console.warn(`${tag} destroy error`, e);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [images]); // re-run if images array identity changes

  // Recreate Muuri when reorderMode changes (safe restore)
  useEffect(() => {
    if (!gridRef.current) return;

    // if muuri not created yet, create with current flag and return
    if (!muuriRef.current) {
      muuriRef.current = createMuuri(reorderMode);
      try { muuriRef.current.refreshItems().layout(); } catch (e) { /* ignore */ }
      return;
    }

    try {
      // save current order (ids)
      const currentIds = muuriRef.current.getItems().map(it => it.getElement().dataset.id);
      console.debug(`${tag} reorder toggle: saving order`, currentIds);

      // destroy current instance (and remove resize listener)
      const onResizeFn = muuriRef.current.__pixpick_onResize;
      if (onResizeFn) window.removeEventListener("resize", onResizeFn);
      muuriRef.current.destroy();
      muuriRef.current = null;
      console.debug(`${tag} reorder toggle: destroyed old instance`);

      // create new one with updated dragEnabled
      muuriRef.current = createMuuri(reorderMode);
      // restore order using Muuri Item objects
      const items = muuriRef.current.getItems();
      const idToItem = new Map(items.map(it => [it.getElement().dataset.id, it]));
      const orderedItems = currentIds.map(id => idToItem.get(String(id))).filter(Boolean);
      if (orderedItems.length) {
        muuriRef.current.sort(orderedItems);
        console.debug(`${tag} reorder toggle: restored order after recreate`);
      } else {
        console.debug(`${tag} reorder toggle: no items to restore`);
      }
      muuriRef.current.refreshItems().layout();
    } catch (e) {
      console.warn(`${tag} recreate on reorderMode failed:`, e);
      // fallback: create at least
      if (!muuriRef.current) {
        muuriRef.current = createMuuri(reorderMode);
        try { muuriRef.current.refreshItems().layout(); } catch (err) { /* ignore */ }
      }
    }
  }, [reorderMode]);
  

  // ---- STABLE CSS: use margin = gap/2 so horizontal gutter math becomes simple ----
  // item margin = gap/2 -> per-item horizontal margin contribution = gap (left+right sum)
  // item width = (100% - columns * gap) / columns
  const g = Number(gap);
  const colXL = columns.xl ?? 6;
  const colLG = columns.lg ?? 5;
  const colMD = columns.md ?? 4;
  const colSM = columns.sm ?? 3;
  const colXS = columns.xs ?? 2;

  return (
    <>
      <style>{`
      
.muuri-item:not(.muuri-item-dragging):hover .muuri-content > img {
  cursor: pointer;
  transform: scale(1.04);
  transition: transform 0.3s ease-out;
  z-index: 10;
}
        /* Scoped muuri styles (important: avoid global collisions) */
        .muuri-wrapper { width:100%; }
        .muuri-scroll { width:100%; }

        .muuri-grid { position: relative; width: 100%; opacity: 1; transition: opacity .25s ease; }
        .muuri-item { position: absolute; margin: ${g / 2}px; z-index: 1; box-sizing: border-box; }

        /* width formula: each item contributes gap px of margins in total,
           so total horizontal used by margins = columns * gap.
           width per item = (100% - columns * gap) / columns */
        @media (min-width: 1100px) {
          .muuri-item { width: calc((100% - (${colXL} * ${g}px)) / ${colXL}); }
        }
        @media (min-width: 992px) and (max-width: 1099px) {
          .muuri-item { width: calc((100% - (${colLG} * ${g}px)) / ${colLG}); }
        }
        @media (min-width: 768px) and (max-width: 991px) {
          .muuri-item { width: calc((100% - (${colMD} * ${g}px)) / ${colMD}); }
        }
        @media (min-width: 480px) and (max-width: 767px) {
          .muuri-item { width: calc((100% - (${colSM} * ${g}px)) / ${colSM}); }
        }
        @media (max-width: 479px) {
          .muuri-item { width: calc((100% - (${colXS} * ${g}px)) / ${colXS}); }
        }

        .muuri-content { position: relative; width: 100%; height: 100%; }
        .muuri-content > img { display:block; width:100%; height:auto; border-radius:8px; user-select:none; -webkit-user-drag:none; }

        /* keep dragging visuals */
        .muuri-item.muuri-item-hidden { z-index:0; }
        .muuri-item.muuri-item-releasing { z-index:2; }
        .muuri-item.muuri-item-dragging { z-index:3; transform-origin:center; }
        .image.jiggle{
        /* Reorder / jiggle visuals */
animation: jiggle 0.9s ease-in-out infinite;
  transform-origin: 50% 50%;
        }
      `}</style>

      <div className="muuri-wrapper">
      <div className="muuri-scroll">
        <div className="muuri-grid" ref={gridRef}>
          {images.map((img, i) => {
            const isSelected = selectedImages.has(img.id);

            return (
              <div
                className="muuri-item"
                key={img.id ?? i}
                data-id={String(img.id ?? i)}
                style={{  cursor: multiSelectMode ? "pointer" : "auto" }}
                onClick={(e) => {
                  if (reorderMode) return;
                  if (multiSelectMode) {
                    e.stopPropagation();
                    toggleSelectImage(img.id);
                    return;
                  }
                  setModalIndex?.(i);
                }}
              >
                <div className="muuri-content">
                  <img
                    src={img.src}
                    alt={img.alt ?? `image-${i}`}
                    draggable={false}
                    style={{ boxShadow: "4px 4px 5px rgba(0,0,0,0.5)" }}
                    className={`image ${reorderMode ? "jiggle" : ""}`}
                  />
                </div>

                {/* checkbox overlay */}
                {multiSelectMode && (
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleSelectImage(img.id);
                    }}
                    style={{
                      position: "absolute",
                      top: 8,
                      right: 8,
                      width: 28,
                      height: 28,
                      borderRadius: 6,
                      display: "grid",
                      placeItems: "center",
                      background: isSelected
                        ? "linear-gradient(90deg,#1B99BF,#2B5FA8)"
                        : "rgba(255,255,255,0.9)",
                      color: isSelected ? "#fff" : "#0b6b7a",
                      boxShadow: "0 4px 10px rgba(2,6,10,0.12)",
                      border: isSelected ? "none" : "1px solid rgba(0,0,0,0.08)",
                      zIndex: 5, // ensure above image
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelectImage(img.id)}
                      style={{ width: 16, height: 16, cursor: "pointer" }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
    </>
  );
};

export default ImageGrid;
