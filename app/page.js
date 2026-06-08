'use client';

import { useState, useEffect, useRef } from 'react';

const MONTHS = [
  'Ocak', 'Şubat', 'Mart', 'Nisan',
  'Mayıs', 'Haziran', 'Temmuz', 'Ağustos',
  'Eylül', 'Ekim', 'Kasım', 'Aralık',
];

const STORAGE_KEY = 'game-tracker-2025';

function useLocalStorage(key, initial) {
  const [state, setState] = useState(() => {
    if (typeof window === 'undefined') return initial;
    try {
      const stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) : initial;
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(state));
  }, [key, state]);

  return [state, setState];
}

export default function GameTracker() {
  // { [monthIndex]: Game[] }
  const [monthGames, setMonthGames] = useLocalStorage(
    STORAGE_KEY,
    Object.fromEntries(MONTHS.map((_, i) => [i, []]))
  );

  const [modal, setModal] = useState(null); // { monthIndex }
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [dragInfo, setDragInfo] = useState(null);
  const debounceRef = useRef(null);

  // Search IGDB via our proxy
  const searchGames = async (q) => {
    if (!q.trim()) { setResults([]); return; }
    setSearching(true);
    try {
      const res = await fetch('/api/igdb', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: 'games',
          body: `search "${q}"; fields name,cover.url,first_release_date,rating; where cover != null; limit 12;`,
        }),
      });
      const data = await res.json();
      setResults(Array.isArray(data) ? data : []);
    } catch {
      setResults([]);
    }
    setSearching(false);
  };

  const handleQueryChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchGames(val), 400);
  };

  const addGame = (game) => {
    const mi = modal.monthIndex;
    setMonthGames((prev) => {
      const existing = prev[mi] || [];
      if (existing.find((g) => g.id === game.id)) return prev;
      return { ...prev, [mi]: [...existing, game] };
    });
    setModal(null);
    setQuery('');
    setResults([]);
  };

  const removeGame = (monthIndex, gameId) => {
    setMonthGames((prev) => ({
      ...prev,
      [monthIndex]: (prev[monthIndex] || []).filter((g) => g.id !== gameId),
    }));
  };

  const coverUrl = (url) =>
    url
      ? url.replace('t_thumb', 't_cover_big').replace(/^\/\//, 'https://')
      : null;

  // Drag-and-drop between months
  const onDragStart = (e, fromMonth, gameId) => {
    setDragInfo({ fromMonth, gameId });
    e.dataTransfer.effectAllowed = 'move';
  };

  const onDrop = (e, toMonth) => {
    e.preventDefault();
    if (!dragInfo || dragInfo.fromMonth === toMonth) return;
    const { fromMonth, gameId } = dragInfo;
    const game = (monthGames[fromMonth] || []).find((g) => g.id === gameId);
    if (!game) return;
    setMonthGames((prev) => ({
      ...prev,
      [fromMonth]: (prev[fromMonth] || []).filter((g) => g.id !== gameId),
      [toMonth]: [...(prev[toMonth] || []), game],
    }));
    setDragInfo(null);
  };

  const onDragOver = (e) => e.preventDefault();

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Outfit:wght@300;400;500;600&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        body {
          background: #0e0e12;
          color: #e8e6f0;
          font-family: 'Outfit', sans-serif;
          min-height: 100vh;
        }

        .page {
          max-width: 1400px;
          margin: 0 auto;
          padding: 48px 24px 80px;
        }

        .site-title {
          font-family: 'Bebas Neue', sans-serif;
          font-size: clamp(2.4rem, 5vw, 4rem);
          letter-spacing: 0.12em;
          background: linear-gradient(135deg, #c9b8ff 0%, #ff8fc8 50%, #ffcc70 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          margin-bottom: 8px;
        }

        .site-sub {
          color: #6b6880;
          font-size: 0.9rem;
          font-weight: 300;
          letter-spacing: 0.05em;
          margin-bottom: 56px;
        }

        .grid-months {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 32px;
        }

        @media (max-width: 900px) {
          .grid-months { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 560px) {
          .grid-months { grid-template-columns: 1fr; }
        }

        .month-col {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .month-label {
          font-family: 'Bebas Neue', sans-serif;
          font-size: 1.6rem;
          letter-spacing: 0.1em;
          color: #c9b8ff;
          padding-bottom: 6px;
          border-bottom: 1px solid #2a2835;
        }

        .games-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 8px;
          min-height: 80px;
          border-radius: 10px;
          transition: background 0.2s;
        }

        .games-grid.drag-over {
          background: rgba(201, 184, 255, 0.06);
          outline: 2px dashed #c9b8ff55;
        }

        .game-card {
          position: relative;
          border-radius: 8px;
          overflow: hidden;
          aspect-ratio: 3/4;
          background: #1a1825;
          cursor: grab;
          group: true;
          transition: transform 0.18s, box-shadow 0.18s;
        }

        .game-card:hover { transform: scale(1.04); box-shadow: 0 8px 32px #00000080; }
        .game-card:active { cursor: grabbing; }

        .game-card img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }

        .game-card-overlay {
          position: absolute;
          inset: 0;
          background: linear-gradient(to top, #00000099 0%, transparent 50%);
          opacity: 0;
          transition: opacity 0.18s;
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
          padding: 8px;
        }

        .game-card:hover .game-card-overlay { opacity: 1; }

        .game-card-name {
          font-size: 0.72rem;
          font-weight: 600;
          color: #fff;
          line-height: 1.2;
          text-shadow: 0 1px 4px #000;
        }

        .remove-btn {
          position: absolute;
          top: 5px;
          right: 5px;
          width: 22px;
          height: 22px;
          background: #ff4d6d;
          border: none;
          border-radius: 50%;
          color: #fff;
          font-size: 0.7rem;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0;
          transition: opacity 0.15s;
          z-index: 10;
        }

        .game-card:hover .remove-btn { opacity: 1; }

        .add-btn {
          aspect-ratio: 3/4;
          border-radius: 8px;
          border: 2px dashed #2e2b3a;
          background: transparent;
          color: #3d3a50;
          font-size: 1.6rem;
          cursor: pointer;
          transition: border-color 0.18s, color 0.18s, background 0.18s;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .add-btn:hover {
          border-color: #c9b8ff;
          color: #c9b8ff;
          background: rgba(201, 184, 255, 0.05);
        }

        /* Modal */
        .modal-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.75);
          backdrop-filter: blur(6px);
          z-index: 100;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          animation: fadeIn 0.2s;
        }

        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

        .modal {
          background: #16141f;
          border: 1px solid #2a2835;
          border-radius: 16px;
          width: 100%;
          max-width: 620px;
          max-height: 85vh;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          animation: slideUp 0.22s cubic-bezier(.16,1,.3,1);
        }

        @keyframes slideUp {
          from { transform: translateY(24px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }

        .modal-header {
          padding: 20px 24px 16px;
          border-bottom: 1px solid #2a2835;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .modal-title {
          font-family: 'Bebas Neue', sans-serif;
          font-size: 1.3rem;
          letter-spacing: 0.08em;
          color: #c9b8ff;
        }

        .modal-close {
          background: none;
          border: none;
          color: #6b6880;
          font-size: 1.2rem;
          cursor: pointer;
          transition: color 0.15s;
          line-height: 1;
        }
        .modal-close:hover { color: #fff; }

        .search-bar {
          padding: 16px 24px;
          border-bottom: 1px solid #2a2835;
        }

        .search-input {
          width: 100%;
          background: #0e0e12;
          border: 1px solid #2a2835;
          border-radius: 8px;
          padding: 10px 14px;
          color: #e8e6f0;
          font-family: 'Outfit', sans-serif;
          font-size: 0.95rem;
          outline: none;
          transition: border-color 0.15s;
        }

        .search-input:focus { border-color: #c9b8ff; }
        .search-input::placeholder { color: #3d3a50; }

        .results-area {
          flex: 1;
          overflow-y: auto;
          padding: 16px 24px;
        }

        .results-area::-webkit-scrollbar { width: 5px; }
        .results-area::-webkit-scrollbar-track { background: transparent; }
        .results-area::-webkit-scrollbar-thumb { background: #2a2835; border-radius: 99px; }

        .results-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
        }

        .result-card {
          cursor: pointer;
          border-radius: 8px;
          overflow: hidden;
          background: #1a1825;
          border: 2px solid transparent;
          transition: border-color 0.15s, transform 0.15s;
          position: relative;
        }

        .result-card:hover { border-color: #c9b8ff; transform: scale(1.03); }

        .result-card img {
          width: 100%;
          aspect-ratio: 3/4;
          object-fit: cover;
          display: block;
        }

        .result-card-name {
          padding: 6px 8px;
          font-size: 0.72rem;
          font-weight: 500;
          color: #b8b4cc;
          line-height: 1.3;
        }

        .empty-state {
          color: #3d3a50;
          text-align: center;
          padding: 40px 0;
          font-size: 0.9rem;
        }

        .spinner {
          text-align: center;
          padding: 40px;
          color: #c9b8ff;
          font-size: 0.85rem;
          letter-spacing: 0.08em;
        }

        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
        .spinner { animation: pulse 1.2s infinite; }
      `}</style>

      <div className="page">
        <h1 className="site-title">2025 Oyun Takibi</h1>
        <p className="site-sub">Oynadığın oyunları aylara göre takip et · Sürükle & bırak ile taşı</p>

        <div className="grid-months">
          {MONTHS.map((month, mi) => (
            <div
              key={mi}
              className="month-col"
              onDrop={(e) => onDrop(e, mi)}
              onDragOver={onDragOver}
              onDragEnter={(e) => e.currentTarget.querySelector('.games-grid')?.classList.add('drag-over')}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget)) {
                  e.currentTarget.querySelector('.games-grid')?.classList.remove('drag-over');
                }
              }}
            >
              <div className="month-label">{month}</div>
              <div className="games-grid">
                {(monthGames[mi] || []).map((game) => (
                  <div
                    key={game.id}
                    className="game-card"
                    draggable
                    onDragStart={(e) => onDragStart(e, mi, game.id)}
                    onDragEnd={() => document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'))}
                  >
                    {game.coverUrl ? (
                      <img src={game.coverUrl} alt={game.name} loading="lazy" />
                    ) : (
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%', color:'#3d3a50', fontSize:'0.7rem', textAlign:'center', padding:'8px' }}>
                        {game.name}
                      </div>
                    )}
                    <div className="game-card-overlay">
                      <div className="game-card-name">{game.name}</div>
                    </div>
                    <button
                      className="remove-btn"
                      onClick={() => removeGame(mi, game.id)}
                      title="Kaldır"
                    >✕</button>
                  </div>
                ))}
                <button
                  className="add-btn"
                  onClick={() => { setModal({ monthIndex: mi }); setQuery(''); setResults([]); }}
                  title="Oyun ekle"
                >
                  +
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {modal && (
        <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) { setModal(null); setQuery(''); setResults([]); }}}>
          <div className="modal">
            <div className="modal-header">
              <span className="modal-title">Oyun Ekle — {MONTHS[modal.monthIndex]}</span>
              <button className="modal-close" onClick={() => { setModal(null); setQuery(''); setResults([]); }}>✕</button>
            </div>
            <div className="search-bar">
              <input
                className="search-input"
                type="text"
                placeholder="Oyun ara… (örn: Elden Ring)"
                value={query}
                onChange={handleQueryChange}
                autoFocus
              />
            </div>
            <div className="results-area">
              {searching ? (
                <div className="spinner">Aranıyor…</div>
              ) : results.length > 0 ? (
                <div className="results-grid">
                  {results.map((game) => {
                    const url = game.cover?.url
                      ? game.cover.url.replace('t_thumb', 't_cover_big').replace(/^\/\//, 'https://')
                      : null;
                    return (
                      <div
                        key={game.id}
                        className="result-card"
                        onClick={() => addGame({ id: game.id, name: game.name, coverUrl: url })}
                      >
                        {url ? (
                          <img src={url} alt={game.name} loading="lazy" />
                        ) : (
                          <div style={{ aspect:'3/4', background:'#1a1825', display:'flex', alignItems:'center', justifyContent:'center', aspectRatio:'3/4', padding:'12px', color:'#6b6880', fontSize:'0.75rem', textAlign:'center' }}>
                            {game.name}
                          </div>
                        )}
                        <div className="result-card-name">{game.name}</div>
                      </div>
                    );
                  })}
                </div>
              ) : query ? (
                <div className="empty-state">Sonuç bulunamadı</div>
              ) : (
                <div className="empty-state">Aramaya başla…</div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
