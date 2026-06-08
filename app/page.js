'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

const MONTHS = [
  'Ocak', 'Şubat', 'Mart', 'Nisan',
  'Mayıs', 'Haziran', 'Temmuz', 'Ağustos',
  'Eylül', 'Ekim', 'Kasım', 'Aralık',
];

// Updated to 2026
const STORAGE_KEY = 'game-tracker-2026';

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
  const [monthGames, setMonthGames] = useLocalStorage(
    STORAGE_KEY,
    Object.fromEntries(MONTHS.map((_, i) => [i, []]))
  );

  const [modal, setModal] = useState(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [dragInfo, setDragInfo] = useState(null);
  const debounceRef = useRef(null);

  // Optimized Search
  const searchGames = useCallback(async (q) => {
    if (!q.trim()) { setResults([]); return; }
    setSearching(true);
    try {
      const res = await fetch('/api/igdb', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: 'games',
          body: `search "${q}"; fields name,cover.url,first_release_date; where cover != null; limit 12;`,
        }),
      });
      const data = await res.json();
      setResults(Array.isArray(data) ? data : []);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  const handleQueryChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    // Faster debounce (300ms) for better feel
    debounceRef.current = setTimeout(() => searchGames(val), 300);
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

  // Share functionality
  const handleShare = async () => {
    const shareData = {
      title: '2026 Oyun Takibim',
      text: 'Bu yıl oynayacağım oyunları listeledim!',
      url: window.location.href,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(window.location.href);
        alert('Link kopyalandı! Arkadaşlarına gönderebilirsin.');
      }
    } catch (err) {
      console.error('Sharing failed', err);
    }
  };

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
          overflow-x: hidden;
        }

        .page {
          max-width: 1400px;
          margin: 0 auto;
          padding: 24px 16px 80px;
        }

        .header-section {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 40px;
        }

        .site-title {
          font-family: 'Bebas Neue', sans-serif;
          font-size: clamp(2rem, 8vw, 3.5rem);
          letter-spacing: 0.05em;
          background: linear-gradient(135deg, #c9b8ff 0%, #ff8fc8 50%, #ffcc70 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .site-sub {
          color: #6b6880;
          font-size: 0.85rem;
          margin-top: 4px;
        }

        .share-btn {
          background: #2a2835;
          color: #c9b8ff;
          border: 1px solid #3d3a50;
          padding: 8px 16px;
          border-radius: 99px;
          font-size: 0.8rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .share-btn:hover { background: #3d3a50; transform: translateY(-2px); }

        .grid-months {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 20px;
        }

        @media (max-width: 1100px) {
          .grid-months { grid-template-columns: repeat(3, 1fr); }
        }
        @media (max-width: 768px) {
          .grid-months { grid-template-columns: repeat(2, 1fr); gap: 12px; }
          .header-section { flex-direction: column; gap: 16px; }
          .page { padding-top: 16px; }
        }
        @media (max-width: 480px) {
          .grid-months { grid-template-columns: 1fr; }
        }

        .month-col {
          display: flex;
          flex-direction: column;
          gap: 10px;
          background: #16141f;
          padding: 12px;
          border-radius: 12px;
          border: 1px solid #2a2835;
        }

        .month-label {
          font-family: 'Bebas Neue', sans-serif;
          font-size: 1.4rem;
          letter-spacing: 0.05em;
          color: #c9b8ff;
          padding-bottom: 4px;
          border-bottom: 1px solid #2a2835;
        }

        .games-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 8px;
          min-height: 60px;
        }

        .game-card {
          position: relative;
          border-radius: 6px;
          overflow: hidden;
          aspect-ratio: 3/4;
          background: #0e0e12;
          cursor: grab;
          transition: transform 0.15s;
        }
        .game-card:hover { transform: scale(1.05); z-index: 2; }

        .game-card img { width: 100%; height: 100%; object-fit: cover; }

        .remove-btn {
          position: absolute;
          top: 4px;
          right: 4px;
          width: 20px;
          height: 20px;
          background: rgba(255, 77, 109, 0.9);
          border: none;
          border-radius: 50%;
          color: #fff;
          font-size: 0.6rem;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0;
          transition: opacity 0.2s;
        }
        .game-card:hover .remove-btn { opacity: 1; }

        .add-btn {
          aspect-ratio: 3/4;
          border-radius: 6px;
          border: 2px dashed #2a2835;
          background: transparent;
          color: #3d3a50;
          font-size: 1.4rem;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }
        .add-btn:hover { border-color: #c9b8ff; color: #c9b8ff; background: rgba(201, 184, 255, 0.03); }

        /* Modal Enhancements for Mobile */
        .modal-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.85);
          backdrop-filter: blur(8px);
          z-index: 100;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
        }

        .modal {
          background: #16141f;
          border: 1px solid #2a2835;
          border-radius: 20px;
          width: 100%;
          max-width: 500px;
          max-height: 80vh;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .search-input {
          width: 100%;
          background: #0e0e12;
          border: 1px solid #2a2835;
          border-radius: 12px;
          padding: 12px 16px;
          color: #fff;
          font-size: 1rem;
          outline: none;
        }
        .search-input:focus { border-color: #c9b8ff; }

        .results-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
          padding: 16px;
        }

        .result-card {
          cursor: pointer;
          border-radius: 8px;
          overflow: hidden;
          background: #1a1825;
          transition: transform 0.2s;
        }
        .result-card:hover { transform: translateY(-4px); }
        .result-card-name {
          padding: 6px;
          font-size: 0.7rem;
          text-align: center;
          color: #b8b4cc;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .spinner { padding: 40px; text-align: center; color: #c9b8ff; animation: pulse 1s infinite; }
        @keyframes pulse { 50% { opacity: 0.5; } }
      `}</style>

      <div className="page">
        <header className="header-section">
          <div>
            <h1 className="site-title">2026 Oyun Takibi</h1>
            <p className="site-sub">Oyunlarını planla, listeni paylaş.</p>
          </div>
          <button className="share-btn" onClick={handleShare}>
            <span>📤</span> Listeyi Paylaş
          </button>
        </header>

        <div className="grid-months">
          {MONTHS.map((month, mi) => (
            <div
              key={mi}
              className="month-col"
              onDrop={(e) => onDrop(e, mi)}
              onDragOver={onDragOver}
            >
              <div className="month-label">{month}</div>
              <div className="games-grid">
                {(monthGames[mi] || []).map((game) => (
                  <div
                    key={game.id}
                    className="game-card"
                    draggable
                    onDragStart={(e) => onDragStart(e, mi, game.id)}
                  >
                    <img src={game.coverUrl} alt={game.name} loading="lazy" />
                    <button
                      className="remove-btn"
                      onClick={() => removeGame(mi, game.id)}
                    >✕</button>
                  </div>
                ))}
                <button
                  className="add-btn"
                  onClick={() => { setModal({ monthIndex: mi }); setQuery(''); setResults([]); }}
                >
                  +
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {modal && (
        <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && setModal(null)}>
          <div className="modal">
            <div style={{ padding: '20px', borderBottom: '1px solid #2a2835', display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: '600', color: '#c9b8ff' }}>{MONTHS[modal.monthIndex]} İçin Oyun Ara</span>
              <button onClick={() => setModal(null)} style={{ background: 'none', border: 'none', color: '#6b6880', cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ padding: '16px' }}>
              <input
                className="search-input"
                type="text"
                placeholder="Hızlıca oyun ara..."
                value={query}
                onChange={handleQueryChange}
                autoFocus
              />
            </div>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {searching ? (
                <div className="spinner">Aranıyor...</div>
              ) : (
                <div className="results-grid">
                  {results.map((game) => {
                    const url = game.cover?.url?.replace('t_thumb', 't_cover_big').replace(/^\/\//, 'https://');
                    return (
                      <div
                        key={game.id}
                        className="result-card"
                        onClick={() => addGame({ id: game.id, name: game.name, coverUrl: url })}
                      >
                        <img src={url || 'https://via.placeholder.com/150x200?text=No+Image'} alt={game.name} style={{ width: '100%', aspectRation: '3/4', objectFit: 'cover' }} />
                        <div className="result-card-name">{game.name}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
