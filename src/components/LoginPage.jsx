export default function LoginPage({login}) {
    
    return (
  <div style={{
    width: '100vw',
    height: '100vh',
    overflow: 'hidden',
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: 'sans-serif'
  }}>
    {/* Background video */}
    <video
      autoPlay
      loop
      muted
      playsInline
      style={{
        position: 'absolute',
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        zIndex: 0
      }}
    >
      <source src="https://www.w3schools.com/howto/rain.mp4" type="video/mp4" />
      {/* Fallback background image */}
      <img src="https://images.unsplash.com/photo-1507525428034-b723cf961d3e" alt="bg" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
    </video>

    {/* Overlay + Button */}
    <div style={{
      position: 'relative',
      zIndex: 1,
      background: 'rgba(0, 0, 0, 0.6)',
      padding: '40px',
      borderRadius: '12px',
      textAlign: 'center',
      color: '#fff',
      maxWidth: '90%',
      boxShadow: '0 8px 24px rgba(0,0,0,0.4)'
    }}>
      <h2 style={{ marginBottom: '20px' }}>Welcome to PixPick</h2>
      <button
        onClick={login}
        style={{
          background: '#fff',
          color: '#333',
          padding: '12px 20px',
          borderRadius: '6px',
          border: 'none',
          cursor: 'pointer',
          fontWeight: 'bold',
          fontSize: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
        }}
      >
        <img src="https://upload.wikimedia.org/wikipedia/commons/4/4a/Logo_2013_Google.png" alt="G" style={{ width: '45px', height: '20px' }} />
        Login with Google
      </button>
    </div>
  </div>
);
}