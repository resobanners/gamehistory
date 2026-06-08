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
    } catch { return initial; }
  });
  useEffect(() => { localStorage.setItem(key, JSON.stringify(state)); }, [key, state]);
  return [state, setState];
}

export default function GameTracker() {
  const rosterRef = useRef(null);
  const [isExporting, setIsExporting] = useState(false);
  const [monthGames, setMonthGames] = useLocalStorage(STORAGE_KEY, Object.fromEntries(MONTHS.map((_, i) => [i, []])));
  const [modal, setModal] = useState(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef(null);

  const searchGames = useCallback(async (q) => {
    if (!q || !q.trim()) { setResults([]); return; }
    setSearching(true);
    try {
      const res = await fetch('/api/igdb', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: 'games', body: `search "${q}"; fields name,cover.url; limit 20;` }),
      });
      const data = await res.json();
      setResults(Array.isArray(data) ? data : []);
    } catch { setResults([]); } finally { setSearching(false); }
  }, []);

  const handleQueryChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchGames(val), 300);
  };

  const addGame = (game) => {
    const mi = modal.monthIndex;
    const url = game.cover?.url?.replace('t_thumb', 't_cover_big').replace(/^\/\//, 'https://');
    setMonthGames(prev => ({ ...prev, [mi]: [...(prev[mi] || []), { id: game.id, name: game.name, coverUrl: url }] }));
    setModal(null); setQuery(''); setResults([]);
  };

  const removeGame = (mi, id) => {
    setMonthGames(prev => ({ ...prev, [mi]: prev[mi].filter(g => g.id !== id) }));
  };

  const handleShareImage = async () => {
    if (!rosterRef.current) return;
    setIsExporting(true);
    await new Promise(r => setTimeout(r, 1000)); // Ensure styles are applied
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(rosterRef.current, { 
        backgroundColor: '#0e0e12', 
        useCORS: true, 
        scale: 2, 
        windowWidth: 1400 
      });

      canvas.toBlob(async (blob) => {
        if (!blob) return;
        const file = new File([blob], '2026-oyun-takvimi.png', { type: 'image/png' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: '2026 Oyun Takvimi' });
        } else {
          const link = document.createElement('a');
          link.href = URL.createObjectURL(blob);
          link.download = '2026-oyun-takvimi.png';
          link.click();
        }
        setIsExporting(false);
      }, 'image/png');
    } catch (err) { console.error(err); setIsExporting(false); }
  };

  // MATHEMATICAL ROW CHUNKING
  const getPosterRows = (games) => {
    if (games.length === 0) return [];
    const rows = [];
    // If 1 or 2 games, each gets its own full-width row (Horizontal split)
    const chunkSize = games.length <= 2 ? 1 : 2; 
    for (let i = 0; i < games.length; i += chunkSize) {
      rows.push(games.slice(i, i + chunkSize));
    }
    return rows;
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Outfit:wght@400;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #0e0e12; color: #e8e6f0; font-family: 'Outfit', sans-serif; overflow-x: hidden; }
        .page { max-width: 1400px; margin: 0 auto; padding: 20px; }
        .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; }
        .site-title { font-family: 'Bebas Neue', sans-serif; font-size: 2.5rem; color: #c9b8ff; letter-spacing: 2px; }
        .share-btn { background: #2a2835; color: #c9b8ff; border: 1px solid #3d3a50; padding: 12px 24px; border-radius: 12px; cursor: pointer; font-weight: 700; transition: 0.3s; }

        /* REGULAR UI GRID */
        .grid-months { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
        @media (max-width: 1100px) { .grid-months { grid-template-columns: repeat(3, 1fr); } }
        @media (max-width: 850px) { .grid-months { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 500px) { .grid-months { grid-template-columns: 1fr; } }

        .month-col { background: #16141f; border: 1px solid #2a2835; border-radius: 20px; padding: 15px; display: flex; flex-direction: column; min-height: 300px; position: relative; }
        .month-label { font-family: 'Bebas Neue', sans-serif; font-size: 1.5rem; color: #c9b8ff; text-align: center; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid #2a2835; }
        
        .ui-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
        .ui-card { position: relative; aspect-ratio: 3/4; border-radius: 8px; overflow: hidden; background: #000; }
        .ui-card img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .ui-remove { position: absolute; top: 5px; right: 5px; background: #ff4d6d; color: white; border: none; width: 24px; height: 24px; border-radius: 50%; cursor: pointer; opacity: 0; transition: 0.2s; z-index: 5; }
        .ui-card:hover .ui-remove { opacity: 1; }
        .ui-add { aspect-ratio: 3/4; border: 2px dashed #2a2835; border-radius: 8px; color: #2a2835; font-size: 2rem; cursor: pointer; display: flex; align-items: center; justify-content: center; background: none; }

        /* 📸 THE POSTER ENGINE (ABSOLUTE SCALING) */
        .is-exporting .grid-months { grid-template-columns: repeat(4, 1fr) !important; width: 1400px; padding: 40px; gap: 20px; }
        .is-exporting .month-col { height: 650px !important; overflow: hidden; padding: 15px; }
        
        /* Flex container forces equal height rows */
        .poster-flex { display: flex; flex-direction: column; height: 100%; width: 100%; }
        
        .poster-row { 
            display: flex; 
            flex: 1; /* This is the magic: Every row takes EXACTLY equal height */
            gap: 6px; 
            margin-bottom: 6px; 
            min-height: 0; 
            overflow: hidden;
        }
        .poster-row:last-child { margin-bottom: 0; }

        .poster-item { 
            flex: 1; /* Every item in a row takes equal width */
            height: 100%; 
            overflow: hidden; 
            border-radius: 4px; 
            background: #000;
        }
        .poster-item img { 
            width: 100%; 
            height: 100%; 
            object-fit: cover; /* High-quality crop, no squashing */
            display: block; 
        }
        
        .is-exporting .ui-grid, .is-exporting .ui-add { display: none !important; }

        /* MODAL */
        .modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.9); z-index: 1000; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(10px); }
        .modal { background: #16141f; width: 90%; max-width: 500px; border-radius: 24px; border: 1px solid #2a2835; max-height: 80vh; display: flex; flex-direction: column; overflow: hidden; }
        .search-input { width: calc(100% - 40px); margin: 20px; background: #0e0e12; border: 1px solid #3d3a50; padding: 12px; color: white; border-radius: 12px; outline: none; }
        .search-results { flex: 1; overflow-y: auto; padding: 0 20px 20px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
        .search-card img { width: 100%; aspect-ratio: 3/4; object-fit: cover; border-radius: 8px; cursor: pointer; }
      `}</style>

      <div className={`page ${isExporting ? 'is-exporting' : ''}`}>
        <header className="header" data-html2canvas-ignore="true">
          <h1 className="site-title">2026 OYUN TAKİBİ</h1>
          <button className="share-btn" onClick={handleShareImage}>
             {isExporting ? '⏳ Hazırlanıyor...' : '📸 Paylaş'}
          </button>
        </header>

        <div className="grid-months" ref={rosterRef}>
          {MONTHS.map((month, mi) => {
            const games = monthGames[mi] || [];
            return (
              <div key={mi} className="month-col">
                <div className="month-label">{month} {games.length > 0 && `(${games.length})`}</div>
                
                {/* 1. POSTER VIEW (Mathematical Slot System) */}
                {isExporting && (
                  <div className="poster-flex">
                    {getPosterRows(games).map((row, ri) => (
                      <div key={ri} className="poster-row">
                        {row.map(game => (
                          <div key={game.id} className="poster-item">
                            <img src={game.coverUrl} alt={game.name} crossOrigin="anonymous" />
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}

                {/* 2. REGULAR UI */}
                {!isExporting && (
                  <div className="ui-grid">
                    {games.map((game) => (
                      <div key={game.id} className="ui-card">
                        <img src={game.coverUrl} alt={game.name} />
                        <button className="ui-remove" onClick={() => removeGame(mi, game.id)}>✕</button>
                      </div>
                    ))}
                    <button className="ui-add" onClick={() => setModal({ monthIndex: mi })}>+</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {modal && (
        <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && setModal(null)}>
          <div className="modal">
            <input className="search-input" placeholder="Oyun ara..." value={query} onChange={handleQueryChange} autoFocus />
            <div className="search-results">
              {searching ? <div>Aranıyor...</div> : results.map(game => (
                <div key={game.id} className="search-card" onClick={() => addGame(game)}>
                  <img src={game.cover?.url?.replace('t_thumb', 't_cover_big').replace(/^\/\//, 'https://')} alt={game.name} />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
