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
          body: `search "${q}"; fields name,cover.url; limit 20;`,
        }),
      });
      const data = await res.json();
      const filtered = (Array.isArray(data) ? data : []).filter(g => g.cover && g.cover.url);
      setResults(filtered);
    } catch (err) {
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
          await navigator.share({ files: [file], title: '2026 Oyun Takvimi' });
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
        
        body { 
          background: #0e0e12; 
          color: #e8e6f0; 
          font-family: 'Outfit', sans-serif;
          overflow: hidden; /* Masaüstünde scroll'u tamamen kapat */
        }

        @media (max-width: 1024px) {
          body { overflow: auto; }
        }

        .page { 
          max-width: 1600px; 
          margin: 0 auto; 
          padding: 10px 20px; 
          height: 100vh;
          display: flex;
          flex-direction: column;
        }
        
        .header {
          display: flex; 
          justify-content: space-between; 
          align-items: center;
          padding: 5px 0;
          flex-shrink: 0;
        }

        .site-title {
          font-family: 'Bebas Neue', sans-serif;
          font-size: clamp(1.8rem, 4vw, 2.5rem);
          background: linear-gradient(135deg, #c9b8ff 0%, #ff8fc8 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .share-btn {
          background: #2a2835;
          color: #c9b8ff; 
          border: 1px solid #3d3a50;
          padding: 8px 16px; 
          border-radius: 10px; 
          cursor: pointer;
          font-size: 0.85rem;
          font-weight: 600; 
        }

        .grid-months {
          display: grid; 
          grid-template-columns: repeat(4, 1fr); 
          gap: 10px;
          flex: 1;
          min-height: 0;
          padding-bottom: 10px;
        }

        @media (max-width: 1024px) { 
          .grid-months { grid-template-columns: repeat(3, 1fr); flex: none; height: auto; }
          .page { height: auto; overflow: visible; }
        }
        @media (max-width: 768px) { .grid-months { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 480px) { .grid-months { grid-template-columns: 1fr; } }

        .month-col {
          background: #16141f; 
          border: 1px solid #2a2835; 
          border-radius: 12px;
          padding: 10px; 
          display: flex; 
          flex-direction: column;
          overflow: hidden;
        }

        .month-label {
          font-family: 'Bebas Neue', sans-serif; 
          font-size: 1.2rem;
          color: #c9b8ff; 
          margin-bottom: 8px; 
          border-bottom: 1px solid #2a2835;
          padding-bottom: 4px;
        }

        .games-grid {
          display: grid; 
          grid-template-columns: repeat(auto-fill, minmax(70px, 1fr)); 
          gap: 6px;
          overflow-y: auto; /* Kutu içi dolarsa sadece kutu içinde scroll olsun */
        }

        .game-card {
          position: relative; 
          aspect-ratio: 3/4; 
          border-radius: 4px;
          overflow: hidden; 
          background: #0e0e12;
        }
        .game-card img { width: 100%; height: 100%; object-fit: cover; }

        .remove-btn {
          position: absolute; top: 2px; right: 2px; width: 18px; height: 18px;
          background: #ff4d6d; border: none; border-radius: 50%;
          color: white; font-size: 10px; cursor: pointer; opacity: 0;
          display: flex; align-items: center; justify-content: center;
          z-index: 2;
        }
        .game-card:hover .remove-btn { opacity: 1; }

        .add-btn {
          aspect-ratio: 3/4; 
          border: 1.5px dashed #2a2835; 
          border-radius: 4px;
          background: transparent; 
          color: #3d3a50; 
          font-size: 1.5rem;
          cursor: pointer; 
          display: flex; align-items: center; justify-content: center;
        }
        .add-btn:hover { border-color: #c9b8ff; color: #c9b8ff; }

        /* MODAL VE ARAMA FIX */
        .modal-backdrop {
          position: fixed; inset: 0; background: rgba(0,0,0,0.9);
          display: flex; align-items: center; justify-content: center; z-index: 100;
        }
        .modal {
          background: #16141f; width: 95%; max-width: 600px;
          border-radius: 16px; border: 1px solid #2a2835;
          max-height: 85vh; display: flex; flex-direction: column;
        }
        .search-results-grid {
          display: grid; 
          grid-template-columns: repeat(3, 1fr); 
          gap: 15px; 
          padding: 20px;
          overflow-y: auto;
        }
        .search-item {
          cursor: pointer;
          display: flex;
          flex-direction: column;
          gap: 5px;
        }
        .search-item-img {
          width: 100%;
          aspect-ratio: 3/4; /* Tüm arama sonuçlarını aynı boyuta zorla */
          object-fit: cover;
          border-radius: 8px;
          background: #0e0e12;
        }
        .search-input {
          width: 100%; background: #0e0e12; border: 1px solid #2a2835;
          padding: 15px; color: white; border-radius: 10px; outline: none;
        }
      `}</style>

      <div className="page">
        <header className="header">
          <h1 className="site-title">2026 OYUN TAKİBİ</h1>
          <button className="share-btn" onClick={handleShareImage}>
            🖼️ Görsel Paylaş
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
                    <button 
                      className="remove-btn" 
                      data-html2canvas-ignore="true"
                      onClick={() => removeGame(mi, game.id)}
                    >✕</button>
                  </div>
                ))}
                <button
                  className="add-btn"
                  data-html2canvas-ignore="true"
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
            <div style={{ padding: '20px', textAlign: 'center' }}>
              <span style={{ color: '#c9b8ff', fontWeight: '600' }}>
                {MONTHS[modal.monthIndex].charAt(0) + MONTHS[modal.monthIndex].slice(1).toLowerCase()} ayına oyun ekle:
              </span>
            </div>
            <div style={{ padding: '0 20px 10px' }}>
              <input className="search-input" placeholder="Oyun ismi yazın..." value={query} onChange={handleQueryChange} autoFocus />
            </div>
            <div className="search-results-grid">
              {searching ? <div style={{ gridColumn: 'span 3', textAlign: 'center', color: '#c9b8ff' }}>Aranıyor...</div> : (
                results.map((game) => {
                  const url = game.cover?.url?.replace('t_thumb', 't_cover_big').replace(/^\/\//, 'https://');
                  return (
                    <div key={game.id} className="search-item" onClick={() => addGame({ id: game.id, name: game.name, coverUrl: url })}>
                      <img src={url} className="search-item-img" alt={game.name} />
                      <div style={{ fontSize: '11px', textAlign: 'center', color: '#b8b4cc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {game.name}
                      </div>
                    </div>
                  );
                })
              )}
              {!searching && query && results.length === 0 && (
                <div style={{ gridColumn: 'span 3', textAlign: 'center', color: '#6b6880' }}>Oyun bulunamadı.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
