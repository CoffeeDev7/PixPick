
const Toast = ({ toast, setToast }) => {
  if (!toast) {
    return null;
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '84px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1200,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        pointerEvents: 'auto',
      }}
      role="status"
      aria-live="polite"
    >
      <div
        style={{
          display: 'flex',
          gap: 12,
          alignItems: 'center',
          padding: '12px 14px',
          minWidth: 220,
          maxWidth: 420,
          borderRadius: 12,
          boxShadow: '0 10px 30px rgba(8,10,20,0.35)',
          color: '#fff',
          background:
            toast.type === 'error'
              ? 'linear-gradient(180deg,#6f1f1f,#5b1515)'
              : toast.type === 'success'
              ? 'linear-gradient(180deg,#1b7a2b,#16621f)'
              : 'linear-gradient(180deg,#2b5fa8,#1b4aa0)',
        }}
      >
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: 10,
            display: 'grid',
            placeItems: 'center',
            background: 'rgba(255,255,255,0.06)',
            flexShrink: 0,
          }}
        >
          {toast.type === 'success' ? (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M20 6L9 17l-5-5" stroke="#e6ffef" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : toast.type === 'error' ? (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M18 6L6 18M6 6l12 12" stroke="#ffdede" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : (
            <div
              style={{
                width: 18,
                height: 18,
                border: '2px solid rgba(255,255,255,0.35)',
                borderTopColor: '#fff',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
              }}
            />
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 14, lineHeight: '1.05' }}>{toast.msg}</div>
        </div>
        <button
          onClick={() => setToast(null)}
          aria-label="Dismiss"
          style={{
            background: 'transparent',
            border: 'none',
            color: 'rgba(255,255,255,0.9)',
            cursor: 'pointer',
            fontSize: 16,
            padding: 8,
            marginLeft: 8,
          }}
        >
          ×
        </button>
      </div>

      {toast.type === 'info' && (
        <div
          style={{
            height: 6,
            width: '100%',
            maxWidth: 420,
            borderRadius: 6,
            overflow: 'hidden',
            background: 'rgba(255,255,255,0.08)',
          }}
        >
          <div
            style={{
              height: '100%',
              width: '100%',
              background: 'linear-gradient(90deg,#ffffff80,#ffffff40)',
              transformOrigin: 'left',
              animation: `toast-progress ${toast.duration || 20000}ms linear forwards`,
            }}
          />
        </div>
      )}

      {/* Styles for animations */}
      <style>{`
        .shimmer { position: relative; overflow: hidden; background: #e0e0e0; } .shimmer::after { content: ''; position: absolute; top: 0; left: -150%; height: 100%; width: 150%; background: linear-gradient(90deg, rgba(224,224,224,0) 0%, rgba(255,255,255,0.7) 50%, rgba(224,224,224,0) 100%); animation: shimmerMove 1.2s infinite linear; } @keyframes shimmerMove { 100% { left: 150%; } } @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } } @keyframes toast-progress { from { transform: scaleX(1); opacity: 1; } to { transform: scaleX(0); opacity: 0.6; } } .skeleton-dark { background: linear-gradient(90deg, #cfcfd3 0%, #bfbfc3 50%, #cfcfd3 100%); background-size: 200% 100%; animation: shimmer-dark 1.1s linear infinite; } .skeleton-dark.rect { width: 100%; height: 100%; border-radius: 8px; } @keyframes shimmer-dark { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
      `}</style>
    </div>
  );
};

export default Toast;