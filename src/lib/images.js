// centralised photos
export const PLACEHOLDERS = {
  profile: '/profile_placeholder.png',
  generic: '/placeholder.png', //just example
  boardEmpty: '/do-nothing.png',
};

// simple img-with-fallback helper (optional convenience)
export function setImgFallback(el, fallback = PLACEHOLDERS.generic) {
  if (!el) return;
  el.onerror = null;
  el.src = fallback;
}