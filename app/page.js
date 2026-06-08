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
          overflow-x: hidden;
        }

        /* Desktop: Sayfayı tek ekrana sığdır */
        @media (min-width: 1025px) {
          body { overflow: hidden; }
        }

        .page { 
          max-width: 1700px; 
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
          padding: 10px 0;
          flex-shrink: 0;
        }

        .site-title {
          font-family: 'Bebas Neue', sans-serif;
          font-size: clamp(1.8rem, 4vw, 2.5rem);
          letter-spacing: 2px;
          background: linear-gradient(135deg, #c9b8ff 0%, #ff8fc8 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .share-btn {
          background: linear-gradient(135deg, #2a2835 0%, #1a1825 100%);
          color: #c9b8ff; 
          border: 1px solid #3d3a50;
          padding: 10px 20px; 
          border-radius: 12px; 
          cursor: pointer;
          font-weight: 600; 
          box-shadow: 0 4px 15px rgba(0,0,0,0.3);
          transition: 0.3s;
        }
        .share-btn:hover { border-color: #c9b8ff; transform: translateY(-2px); }

        /* ANA GRID */
        .grid-months {
          display: grid; 
          grid-template-columns: repeat(4, 1fr); 
          gap: 15px;
          flex: 1;
          min-height: 0;
          padding-bottom: 20px;
        }

        @media (max-width: 1200px) { .grid-months { grid-template-columns: repeat(3, 1fr); } }
        @media (max-width: 1024px) { 
          .page { height: auto; }
          .grid-months { grid-template-columns: repeat(2, 1fr); flex: none; }
        }
        @media (max-width: 550px) { .grid-months { grid-template-columns: 1fr; } }

        .month-col {
          background: rgba(22, 20, 31, 0.6); 
          border: 1px solid rgba(42, 40, 53, 0.8); 
          border-radius: 20px;
          padding: 15px; 
          display: flex; 
          flex-direction: column;
          backdrop-filter: blur(10px);
          transition: 0.3s;
        }
        .month-col:hover { border-color: #3d3a50; background: rgba(22, 20, 31, 0.8); }

        .month-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 15px;
        }

        .month-label {
          font-family: 'Bebas Neue', sans-serif; 
          font-size: 1.5rem;
          color: #c9b8ff; 
          letter-spacing: 1.5px;
          text-shadow: 0 2px 10px rgba(201, 184, 255, 0.2);
        }

        .month-count {
          background: #2a2835;
          padding: 2px 10px;
          border-radius: 20px;
          font-size: 0.75rem;
          color: #ff8fc8;
          font-weight: 700;
          border: 1px solid #3d3a50;
        }

        /* OYUN GRİDİ - Kapaklar burada büyüyor */
        .games-grid {
          display: grid; 
          grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); 
          gap: 12px;
          overflow-y: auto;
          padding-right: 5px;
        }
        
        /* Custom Scrollbar */
        .games-grid::-webkit-scrollbar { width: 4px; }
        .games-grid::-webkit-scrollbar-thumb { background: #2a2835; border-radius: 10px; }

        .game-card {
          position: relative; 
          aspect-ratio: 3/4; 
          border-radius: 12px;
          overflow: hidden; 
          background: #0e0e12;
          box-shadow: 0 8px 20px rgba(0,0,0,0.4);
          transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }
        .game-card:hover { transform: scale(1.05) translateY(-5px); z-index: 5; }
        .game-card img { width: 100%; height: 100%; object-fit: cover; }

        .remove-btn {
          position: absolute; top: 5px; right: 5px; width: 24px; height: 24px;
          background: rgba(255, 77, 109, 0.9); border: none; border-radius: 50%;
          color: white; font-size: 12px; cursor: pointer; opacity: 0;
          display: flex; align-items: center; justify-content: center;
          transition: 0.2s; z-index: 10;
          backdrop-filter: blur(4px);
        }
        .game-card:hover .remove-btn { opacity: 1; }

        .add-btn {
          aspect-ratio: 3/4; 
          border: 2px dashed #2a2835; 
          border-radius: 12px;
          background: rgba(42, 40, 53, 0.2); 
          color: #3d3a50; 
          font-size: 2.5rem;
          cursor: pointer; 
          display: flex; align-items: center; justify-content: center;
          transition: 0.3s;
        }
        .add-btn:hover { 
          border-color: #c9b8ff; 
          color: #c9b8ff; 
          background: rgba(201, 184, 255, 0.05);
          transform: translateY(-5px);
        }

        /* MODAL */
        .modal-backdrop {
          position: fixed; inset: 0; background: rgba(0,0,0,0.95);
          display: flex; align-items: center; justify-content: center; z-index: 100;
          backdrop-filter: blur(10px);
        }
        .modal {
          background: #16141f; width: 95%; max-width: 650px;
          border-radius: 30px; border: 1px solid #2a2835;
          max-height: 85vh; display: flex; flex-direction: column;
          overflow: hidden;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
        }
        .modal-header {
            padding: 30px;
            background: linear-gradient(to bottom, #1c1a26, #16141f);
            border-bottom: 1px solid #2a2835;
        }
        .search-results-area {
            flex: 1;
            overflow-y: auto;
            padding: 25px;
        }
        .search-results-grid {
          display: grid; 
          grid-template-columns: repeat(3, 1fr); 
          gap: 20px;
        }
        .search-item {
          cursor: pointer;
          transition: 0.3s;
        }
        .search-item-img {
          width: 100%;
          aspect-ratio: 3/4;
          object-fit: cover;
          border-radius: 15px;
          background: #0e0e12;
          box-shadow: 0 10px 20px rgba(0,0,0,0.2);
          border: 1px solid transparent;
          transition: 0.3s;
        }
        .search-item:hover .search-item-img {
            border-color: #c9b8ff;
            transform: translateY(-5px);
        }
        .search-input {
          width: 100%; background: #0e0e12; border: 1px solid #2a2835;
          padding: 18px; color: white; border-radius: 15px; outline: none;
          font-size: 1.1rem; transition: 0.3s;
        }
        .search-input:focus { border-color: #c9b8ff; box-shadow: 0 0 15px rgba(201, 184, 255, 0.1); }
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
              <div className="month-header">
                <div className="month-label">{month}</div>
                <div className="month-count">{monthGames[mi]?.length || 0} OYUN</div>
              </div>
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
            <div className="modal-header">
                <div style={{ color: '#c9b8ff', fontSize: '1.2rem', fontWeight: '600', marginBottom: '20px', textAlign: 'center', fontFamily: 'Bebas Neue', letterSpacing: '1px' }}>
                    {MONTHS[modal.monthIndex]} LİSTESİNE EKLE
                </div>
                <input className="search-input" placeholder="Oyun ara..." value={query} onChange={handleQueryChange} autoFocus />
            </div>
            
            <div className="search-results-area">
                {searching ? (
                    <div style={{ textAlign: 'center', color: '#c9b8ff', padding: '40px', letterSpacing: '1px' }}>ARANIYOR...</div>
                ) : (
                    <div className="search-results-grid">
                        {results.map((game) => {
                            const url = game.cover?.url?.replace('t_thumb', 't_cover_big').replace(/^\/\//, 'https://');
                            return (
                                <div key={game.id} className="search-item" onClick={() => addGame({ id: game.id, name: game.name, coverUrl: url })}>
                                    <img src={url} className="search-item-img" alt={game.name} />
                                    <div style={{ fontSize: '11px', textAlign: 'center', color: '#b8b4cc', marginTop: '8px', fontWeight: '500' }}>
                                        {game.name}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
                {!searching && query && results.length === 0 && (
                    <div style={{ textAlign: 'center', color: '#6b6880', padding: '40px' }}>Oyun bulunamadı.</div>
                )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
