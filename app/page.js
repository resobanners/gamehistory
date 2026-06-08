'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

const MONTHS = [
  'OCAK', 'ŞUBAT', 'MART', 'NİSAN',
  'MAYIS', 'HAZİRAN', 'TEMMUZ', 'AĞUSTOS',
  'EYLÜL', 'EKİM', 'KASIM', 'ARALIK',
];

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
  const rosterRef = useRef(null);

  useEffect(() => {
    document.title = "Müdavim Oyun Takibi";
  }, []);

  const [monthGames, setMonthGames] = useLocalStorage(
    STORAGE_KEY,
    Object.fromEntries(MONTHS.map((_, i) => [i, []]))
  );

  const [modal, setModal] = useState(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef(null);

  const searchGames = useCallback(async (q) => {
    if (!q.trim()) { setResults([]); return; }
    setSearching(true);
    try {
      const res = await fetch('/api/igdb', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: 'games',
          // ADDED: sort total_rating_count desc to prioritize popular games
          body: `search "${q}"; fields name,cover.url,total_rating_count; where cover != null; sort total_rating_count desc; limit 12;`,
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

  const handleShareImage = async () => {
    if (!rosterRef.current) return;
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(rosterRef.current, {
        backgroundColor: '#0e0e12',
        useCORS: true,
        scale: 2,
        logging: false,
      });

      canvas.toBlob(async (blob) => {
        if (!blob) return;
        const file = new File([blob], '2026-takvimi.png', { type: 'image/png' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: '2026 Oyun Takibi' });
        } else {
          const link = document.createElement('a');
          link.href = URL.createObjectURL(blob);
          link.download = '2026-oyun-takvimi.png';
          link.click();
        }
      }, 'image/png');
    } catch (err) { console.error(err); }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Outfit:wght@300;400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #0e0e12; color: #e8e6f0; font-family: 'Outfit', sans-serif; }
        
        .page { max-width: 1400px; margin: 0 auto; padding: 20px; min-height: 100vh; }
        
        .header {
          display: flex; justify-content: space-between; align-items: center;
          margin-bottom: 30px;
        }

        .site-title {
          font-family: 'Bebas Neue', sans-serif;
          font-size: clamp(2.5rem, 6vw, 3.5rem);
          background: linear-gradient(135deg, #c9b8ff 0%, #ff8fc8 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .share-btn {
          background: linear-gradient(135deg, #2a2835 0%, #1a1825 100%);
          color: #c9b8ff; border: 1px solid #3d3a50;
          padding: 12px 24px; border-radius: 12px; cursor: pointer;
          font-weight: 600; transition: 0.3s;
        }
        .share-btn:hover { border-color: #c9b8ff; transform: translateY(-2px); }

        .grid-months {
          display: grid; 
          grid-template-columns: repeat(4, 1fr); 
          gap: 20px;
        }

        @media (max-width: 1100px) { .grid-months { grid-template-columns: repeat(3, 1fr); } }
        @media (max-width: 768px) { .grid-months { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 480px) { .grid-months { grid-template-columns: 1fr; } }

        .month-col {
          background: #16141f; border: 1px solid #2a2835; border-radius: 16px;
          padding: 20px; display: flex; flex-direction: column; min-height: 220px;
          transition: border-color 0.3s;
        }
        .month-col:hover { border-color: #3d3a50; }

        .month-label {
          font-family: 'Bebas Neue', sans-serif; font-size: 1.6rem;
          color: #c9b8ff; margin-bottom: 15px; letter-spacing: 1px;
        }

        /* IMPROVED GRID: Larger covers and tighter grouping */
        .games-grid {
          display: grid; 
          grid-template-columns: repeat(auto-fill, minmax(90px, 1fr)); 
          gap: 10px;
        }

        .game-card {
          position: relative; aspect-ratio: 3/4; border-radius: 8px;
          overflow: hidden; background: #0e0e12; box-shadow: 0 4px 12px rgba(0,0,0,0.5);
        }
        .game-card img { width: 100%; height: 100%; object-fit: cover; transition: transform 0.3s; }
        .game-card:hover img { transform: scale(1.1); }

        .remove-btn {
          position: absolute; top: 4px; right: 4px; width: 22px; height: 22px;
          background: #ff4d6d; border: none; border-radius: 50%;
          color: white; font-size: 12px; cursor: pointer; opacity: 0;
          display: flex; align-items: center; justify-content: center;
          transition: opacity 0.2s; z-index: 2;
        }
        .game-card:hover .remove-btn { opacity: 1; }

        .add-btn {
          aspect-ratio: 3/4; border: 2px dashed #2a2835; border-radius: 8px;
          background: transparent; color: #3d3a50; font-size: 2rem;
          cursor: pointer; display: flex; align-items: center; justify-content: center;
          transition: 0.3s;
        }
        .add-btn:hover { border-color: #c9b8ff; color: #c9b8ff; background: rgba(201, 184, 255, 0.03); }

        /* Modal */
        .modal-backdrop {
          position: fixed; inset: 0; background: rgba(0,0,0,0.85);
          display: flex; align-items: center; justify-content: center; z-index: 100;
          backdrop-filter: blur(5px);
        }
        .modal {
          background: #16141f; width: 95%; max-width: 550px;
          border-radius: 24px; border: 1px solid #2a2835;
          max-height: 85vh; display: flex; flex-direction: column;
          box-shadow: 0 20px 50px rgba(0,0,0,0.6);
        }
        .search-input {
          width: 100%; background: #0e0e12; border: 1px solid #2a2835;
          padding: 16px; color: white; border-radius: 12px; outline: none;
          font-size: 1rem; transition: border-color 0.3s;
        }
        .search-input:focus { border-color: #c9b8ff; }
      `}</style>

      <div className="page">
        <header className="header">
          <h1 className="site-title">2026 OYUN TAKİBİ</h1>
          <button className="share-btn" onClick={handleShareImage}>
            🖼️ Görsel Olarak Paylaş
          </button>
        </header>

        <div className="grid-months" ref={rosterRef}>
          {MONTHS.map((month, mi) => (
            <div key={mi} className="month-col">
              <div className="month-label">{month}</div>
              <div className="games-grid">
                {(monthGames[mi] || []).map((game) => (
                  <div key={game.id} className="game-card">
                    <img src={game.coverUrl} alt={game.name} crossOrigin="anonymous" />
                    <button className="remove-btn" onClick={() => removeGame(mi, game.id)}>✕</button>
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
            {/* UPDATED TITLE: Correct Turkish grammar */}
            <div style={{ padding: '25px', textAlign: 'center' }}>
              <span style={{ color: '#c9b8ff', fontWeight: '600', fontSize: '1.2rem' }}>
                {MONTHS[modal.monthIndex].charAt(0) + MONTHS[modal.monthIndex].slice(1).toLowerCase()} ayına oyun ekle:
              </span>
            </div>
            <div style={{ padding: '0 25px 20px' }}>
              <input className="search-input" placeholder="Oyun ara..." value={query} onChange={handleQueryChange} autoFocus />
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '0 25px 25px' }}>
              {searching ? <div style={{ textAlign: 'center', padding: '20px', color: '#c9b8ff' }}>Aranıyor...</div> : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px' }}>
                  {results.map((game) => {
                    const url = game.cover?.url?.replace('t_thumb', 't_cover_big').replace(/^\/\//, 'https://');
                    return (
                      <div key={game.id} onClick={() => addGame({ id: game.id, name: game.name, coverUrl: url })} style={{ cursor: 'pointer' }}>
                        <div className="game-card" style={{ marginBottom: '5px' }}>
                           <img src={url || 'https://via.placeholder.com/150x200?text=No+Image'} style={{ width: '100%', display: 'block' }} />
                        </div>
                        <div style={{ fontSize: '11px', textAlign: 'center', color: '#b8b4cc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{game.name}</div>
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
