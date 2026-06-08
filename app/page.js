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
        scale: 3, 
        logging: false,
      });

      canvas.toBlob(async (blob) => {
        if (!blob) return;
        const file = new File([blob], '2026-posterim.png', { type: 'image/png' });
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
        }

        .page { 
          max-width: 1400px; 
          margin: 0 auto; 
          padding: 20px; 
          display: flex;
          flex-direction: column;
        }
        
        .header {
          display: flex; 
          justify-content: space-between; 
          align-items: center;
          margin-bottom: 25px;
        }

        .site-title {
          font-family: 'Bebas Neue', sans-serif;
          font-size: clamp(2rem, 5vw, 3rem);
          letter-spacing: 3px;
          background: linear-gradient(135deg, #c9b8ff 0%, #ff8fc8 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .share-btn {
          background: #2a2835;
          color: #c9b8ff; 
          border: 1px solid #3d3a50;
          padding: 12px 24px; 
          border-radius: 12px; 
          cursor: pointer;
          font-weight: 700;
          transition: 0.3s;
        }
        .share-btn:hover { background: #c9b8ff; color: #000; }

        .grid-months {
          display: grid; 
          grid-template-columns: repeat(4, 1fr); 
          gap: 16px;
        }

        @media (max-width: 1100px) { .grid-months { grid-template-columns: repeat(3, 1fr); } }
        @media (max-width: 800px) { .grid-months { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 500px) { .grid-months { grid-template-columns: 1fr; } }

        .month-col {
          background: rgba(22, 20, 31, 0.8); 
          border: 1px solid #2a2835; 
          border-radius: 20px;
          padding: 15px; 
          display: flex; 
          flex-direction: column;
          min-height: 200px;
        }

        .month-label {
          font-family: 'Bebas Neue', sans-serif; 
          font-size: 1.6rem;
          color: #c9b8ff; 
          letter-spacing: 1.5px;
          margin-bottom: 15px;
          text-align: center;
          border-bottom: 1px solid #2a2835;
          padding-bottom: 8px;
        }

        /* DİNAMİK IZGARA: Sütun sayısını aşağıda JSX içinde belirliyoruz */
        .games-grid {
          display: grid; 
          gap: 10px;
        }

        .game-card {
          position: relative; 
          aspect-ratio: 3/4; 
          border-radius: 8px;
          overflow: hidden; 
          background: #000;
          box-shadow: 0 4px 10px rgba(0,0,0,0.5);
          transition: transform 0.2s;
        }
        .game-card:hover { transform: scale(1.05); z-index: 10; }
        .game-card img { width: 100%; height: 100%; object-fit: cover; }

        .remove-btn {
          position: absolute; top: 4px; right: 4px; width: 22px; height: 22px;
          background: rgba(255, 77, 109, 0.9); border: none; border-radius: 50%;
          color: white; font-size: 11px; cursor: pointer; opacity: 0;
          display: flex; align-items: center; justify-content: center;
          transition: 0.2s; z-index: 10;
        }
        .game-card:hover .remove-btn { opacity: 1; }

        .add-btn {
          aspect-ratio: 3/4; 
          border: 2px dashed #2a2835; 
          border-radius: 8px;
          background: transparent; 
          color: #3d3a50; 
          font-size: 2rem;
          cursor: pointer; 
          display: flex; align-items: center; justify-content: center;
          transition: 0.3s;
        }
        .add-btn:hover { border-color: #c9b8ff; color: #c9b8ff; background: rgba(201, 184, 255, 0.03); }

        .modal-backdrop {
          position: fixed; inset: 0; background: rgba(0,0,0,0.95);
          display: flex; align-items: center; justify-content: center; z-index: 100;
          backdrop-filter: blur(10px);
        }
        .modal {
          background: #16141f; width: 95%; max-width: 600px;
          border-radius: 24px; border: 1px solid #2a2835;
          max-height: 80vh; display: flex; flex-direction: column;
          overflow: hidden;
        }
        .modal-header { padding: 25px; border-bottom: 1px solid #2a2835; }
        .search-results { flex: 1; overflow-y: auto; padding: 20px; }
        .search-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; }
        .search-card { cursor: pointer; transition: 0.2s; text-align: center; }
        .search-card img { width: 100%; aspect-ratio: 3/4; object-fit: cover; border-radius: 10px; border: 1px solid transparent; }
        .search-card:hover img { border-color: #c9b8ff; }
        .search-input {
          width: 100%; background: #0e0e12; border: 1px solid #2a2835;
          padding: 15px; color: white; border-radius: 12px; outline: none; font-size: 1.1rem;
        }
      `}</style>

      <div className="page">
        <header className="header">
          <h1 className="site-title">2026 OYUN TAKİBİ</h1>
          <button className="share-btn" onClick={handleShareImage}>
            📸 Poster Olarak Paylaş
          </button>
        </header>

        <div className="grid-months" ref={rosterRef}>
          {MONTHS.map((month, mi) => {
            const games = monthGames[mi] || [];
            // DÜZELTME: Eğer 2 veya daha az oyun varsa tek sütun yap, böylece dikey alanı daha iyi doldurur.
            const columnCount = games.length > 0 && games.length < 3 ? '1fr' : 'repeat(2, 1fr)';

            return (
              <div key={mi} className="month-col">
                <div className="month-label">{month}</div>
                
                <div className="games-grid" style={{ gridTemplateColumns: columnCount }}>
                  {games.map((game) => (
                    <div key={game.id} className="game-card">
                      <img src={game.coverUrl?.replace('t_thumb', 't_cover_big')} alt={game.name} crossOrigin="anonymous" />
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
            );
          })}
        </div>
      </div>

      {modal && (
        <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && setModal(null)}>
          <div className="modal">
            <div className="modal-header">
                <div style={{ color: '#c9b8ff', fontSize: '1.2rem', fontWeight: '800', marginBottom: '20px', textAlign: 'center', fontFamily: 'Bebas Neue', letterSpacing: '1px' }}>
                    {MONTHS[modal.monthIndex]} AYINA OYUN EKLE
                </div>
                <input className="search-input" placeholder="Oyun ara..." value={query} onChange={handleQueryChange} autoFocus />
            </div>
            
            <div className="search-results">
                {searching ? (
                    <div style={{ textAlign: 'center', color: '#c9b8ff', padding: '40px' }}>ARANIYOR...</div>
                ) : (
                    <div className="search-grid">
                        {results.map((game) => {
                            const url = game.cover?.url?.replace('t_thumb', 't_cover_big').replace(/^\/\//, 'https://');
                            return (
                                <div key={game.id} className="search-card" onClick={() => addGame({ id: game.id, name: game.name, coverUrl: url })}>
                                    <img src={url} alt={game.name} />
                                    <div style={{ fontSize: '11px', textAlign: 'center', color: '#b8b4cc', marginTop: '8px', fontWeight: '600' }}>
                                      {game.name}
                                    </div>
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
