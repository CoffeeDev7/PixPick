import { useState } from "react";

export default function Sidebar({ selected, setSelected }) {
  const tabs = ["My Boards", "Shared with Me", "All Boards"];

  return (
    <div style={{
      width: '220px',
      minHeight: '100vh',
      background: '#f5f5f5',
      padding: '1rem',
      boxSizing: 'border-box'
    }}>
      <h2 style={{ marginBottom: '1rem' }}>PixPick</h2>
      {tabs.map(tab => (
        <div
          key={tab}
          style={{
            padding: '0.5rem',
            cursor: 'pointer',
            background: selected === tab ? '#ddd' : 'transparent',
            borderRadius: '6px',
            marginBottom: '0.5rem'
          }}
          onClick={() => setSelected(tab)}
        >
          {tab}
        </div>
      ))}
    </div>
  );
}
