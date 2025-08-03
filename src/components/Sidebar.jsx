export default function Sidebar({ selected, setSelected }) {
  const tabs = ["My Boards", "Shared with Me", "All Boards"];

  return (
    <div style={{
      marginTop: '60px',}}>
      {tabs.map(tab => (
        <div
          key={tab}
          style={{
            padding: '0.5rem',
            cursor: 'pointer',
            background: selected === tab ? '#ddd' : 'transparent',
            borderRadius: '6px',
            marginBottom: '0.5rem',
            marginTop: '0.5rem',
          }}
          onClick={() => setSelected(tab)}
        >
          {tab}
        </div>
      ))}
    </div>
  );
}
