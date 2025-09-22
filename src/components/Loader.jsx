// Small loader component (place above the BoardPage return)
  export default function Loader({ visible, text = "Loading…" }) {
    if (!visible) return null;
    return (
      <>
        <style>{`
          /* loader overlay */
          .pp-loader-overlay {
            position: fixed;
            inset: 0;
            z-index: 1400; /* above most UI but below top-level toasts (adjust if needed) */
            display: flex;
            align-items: center;
            justify-content: center;
            background: rgba(6, 12, 16, 0.45); /* dim backdrop */
            -webkit-backdrop-filter: blur(4px);
            backdrop-filter: blur(4px);
            pointer-events: auto;
          }

          .pp-loader-card {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 12px;
            padding: 14px 18px;
            border-radius: 12px;
            background: linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02));
            box-shadow: 0 10px 30px rgba(2,6,23,0.6);
            color: white;
            min-width: 160px;
          }

          .pp-dots {
            display: inline-flex;
            gap: 8px;
            align-items: center;
            justify-content: center;
          }

          .pp-dot {
            width: 10px;
            height: 10px;
            border-radius: 50%;
            background: white;
            opacity: 0.95;
            transform: translateY(0);
            animation: pp-dot-bounce 900ms infinite ease-in-out;
          }
          .pp-dot:nth-child(1) { animation-delay: 0ms; transform-origin:center; }
          .pp-dot:nth-child(2) { animation-delay: 120ms; }
          .pp-dot:nth-child(3) { animation-delay: 240ms; }

          @keyframes pp-dot-bounce {
            0%   { transform: translateY(0); opacity: .45; }
            30%  { transform: translateY(-8px) scale(1.05); opacity: 1; }
            60%  { transform: translateY(0); opacity: .8; }
            100% { transform: translateY(0); opacity: .45; }
          }

          /* small responsive tweak so loader card is less wide on mobile */
          @media (max-width: 520px) {
            .pp-loader-card { min-width: 140px; padding: 12px 14px; }
            .pp-dot { width: 9px; height: 9px; }
          }
        `}</style>

        <div className="pp-loader-overlay" role="status" aria-live="polite" aria-label={text}>
          <div className="pp-loader-card">
            <div style={{ fontWeight: 700, fontSize: 14, color: '#e6f7fb' }}>{text}</div>
            <div className="pp-dots" aria-hidden>
              <div className="pp-dot" />
              <div className="pp-dot" />
              <div className="pp-dot" />
            </div>
          </div>
        </div>
      </>
    );
  }