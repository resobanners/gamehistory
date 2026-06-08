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
  const [isExporting, setIsExporting] = useState(false);

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
    if (!q || !q.trim()) { setResults([]); return; }
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
    const url = game.cover?.url?.replace('t_thumb', 't_cover_big').replace(/^\/\//, 'https://');
    setMonthGames((prev) => {
      const existing = prev[mi] || [];
      if (existing.find((g) => g.id === game.id)) return prev;
      return { ...prev, [mi]: [...existing, { id: game.id, name: game.name, coverUrl: url }] };
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
    setIsExporting(true);
    
    // CSS'in renderlanması için bekle
    await new Promise(r => setTimeout(r, 600));

    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(rosterRef.current, {
        backgroundColor: '#0e0e12',
        useCORS: true,
        scale: 2,
        windowWidth: 1400,
      });

      canvas.toBlob(async (blob) => {
        if (!blob) return;
        const file = new File([blob], '2026-oyun-takvimim.png', { type: 'image/png' });
        
        // Share API desteği kontrolü (Kopyalama/Gönderme)
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: '2026 Oyun Takvimi' });
        } else {
          // Fallback: İndirme
          const link = document.createElement('a');
          link.href = URL.createObjectURL(blob);
          link.download = '2026-oyun-takvimi.png';
          link.click();
        }
        setIsExporting(false);
      }, 'image/png');
    } catch (err) {
      console.error(err);
      setIsExporting(false);
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Outfit:wght@300;400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #0e0e12; color: #e8e6f0; font-family: 'Outfit', sans-serif; }

        .page { max-width: 1400px; margin: 0 auto; padding: 20px; }
        .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; }
        .site-title { font-family: 'Bebas Neue', sans-serif; font-size: 2.5rem; letter-spacing: 2px; color: #c9b8ff; }
        .share-btn { background: #2a2835; color: #c9b8ff; border: 1px solid #3d3a50; padding: 10px 20px; border-radius: 10px; cursor: pointer; font-weight: 700; transition: 0.3s; }
        .share-btn:hover { background: #c9b8ff; color: #000; }

        .grid-months { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
        @media (max-width: 1100px) { .grid-months { grid-template-columns: repeat(3, 1fr); } }
        @media (max-width: 850px) { .grid-months { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 500px) { .grid-months { grid-template-columns: 1fr; } }

        .month-col {
          background: rgba(22, 20, 31, 0.8); border: 1px solid #2a2835; border-radius: 20px;
          padding: 15px; display: flex; flex-direction: column; min-height: 250px;
        }

        .month-label {
          font-family: 'Bebas Neue', sans-serif; font-size: 1.4rem; color: #c9b8ff;
          text-align: center; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid #2a2835;
        }

        .games-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }

        .game-card {
          position: relative; aspect-ratio: 3/4; border-radius: 8px; overflow: hidden; background: #000;
        }
        .game-card img { width: 100%; height: 100%; object-fit: cover; display: block; }

        .remove-btn {
          position: absolute; top: 5px; right: 5px; width: 26px; height: 26px;
          background: #ff4d6d; border: none; border-radius: 50%; color: white;
          cursor: pointer; display: flex; align-items: center; justify-content: center;
          opacity: 0; transition: 0.2s; z-index: 10;
        }
        .game-card:hover .remove-btn { opacity: 1; }

        .add-btn {
          aspect-ratio: 3/4; border: 2px dashed #2a2835; border-radius: 8px;
          color: #3d3a50; font-size: 2rem; cursor: pointer; display: flex; align-items: center; justify-content: center;
        }

        /* 📸 POSTER ÇEKİMİ (OTONOM DOLGU) */
        .is-exporting .grid-months { grid-template-columns: repeat(4, 1fr) !important; width: 1400px; padding: 30px; }
        .is-exporting .month-col { height: 600px !important; overflow: hidden; }
        
        .is-exporting .games-grid { 
            flex: 1 !important; 
            grid-auto-rows: 1fr !important; /* Dikey boşluğu eşit böler */
        }

        /* Eğer son oyun tekse (odd), tüm genişliği kaplar */
        .is-exporting .game-card:last-child:nth-child(odd) { grid-column: span 2 !important; }

        .is-exporting .game-card { 
            aspect-ratio: auto !important; /* Esnemesi için oranı kaldırıyoruz */
            height: 100% !important; 
        }
        
        /* Object-fit: cover sayesinde resim esnemez, crop yapar (kaliteli durur) */
        .is-exporting .game-card img { height: 100% !important; object-fit: cover !important; }

        .is-exporting .add-btn, .is-exporting .remove-btn { display: none !important; }

        /* MODAL */
        .modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.9); display: flex; align-items: center; justify-content: center; z-index: 1000; backdrop-filter: blur(8px); }
        .modal { background: #16141f; width: 90%; max-width: 500px; border-radius: 20px; border: 1px solid #2a2835; max-height: 80vh; overflow: hidden; display: flex; flex-direction: column; }
        .modal-header { padding: 20px; border-bottom: 1px solid #2a2835; }
        .search-input { width: 100%; background: #0e0e12; border: 1px solid #3d3a50; padding: 12px; color: white; border-radius: 10px; outline: none; }
        .search-results { flex: 1; overflow-y: auto; padding: 15px; }
        .search-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
        .search-card { cursor: pointer; text-align: center; }
        .search-card img { width: 100%; aspect-ratio: 3/4; object-fit: cover; border-radius: 8px; }
      `}</style>

      <div className={`page ${isExporting ? 'is-exporting' : ''}`}>
        <header className="header" data-html2canvas-ignore="true">
          <h1 className="site-title">2026 OYUN TAKİBİ</h1>
          <button className="share-btn" onClick={handleShareImage}>📸 Paylaş</button>
        </header>

        <div className="grid-months" ref={rosterRef}>
          {MONTHS.map((month, mi) => {
            const games = monthGames[mi] || [];
            
            // Poster çekilirken Mart (2 oyun) vb. durumlar için sütun sayısını otonom ayarla
            let columns = 'repeat(2, 1fr)';
            if (isExporting && games.length > 0 && games.length <= 2) {
                columns = '1fr';
            }

            return (
              <div key={mi} className="month-col">
                <div className="month-label">{month} {games.length > 0 && `(${games.length})`}</div>
                <div className="games-grid" style={{ gridTemplateColumns: columns }}>
                  {games.map((game) => (
                    <div key={game.id} className="game-card">
                      <img src={game.coverUrl} alt={game.name} crossOrigin="anonymous" />
                      <button className="remove-btn" onClick={() => removeGame(mi, game.id)}>✕</button>
                    </div>
                  ))}
                  {!isExporting && (
                    <button className="add-btn" onClick={() => setModal({ monthIndex: mi })}>+</button>
                  )}
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
                <input className="search-input" placeholder="Oyun ismi..." value={query} onChange={handleQueryChange} autoFocus />
            </div>
            <div className="search-results">
              {searching ? <div style={{textAlign:'center', padding:'20px'}}>Aranıyor...</div> : (
                <div className="search-grid">
                  {results.map((game) => (
                    <div key={game.id} className="search-card" onClick={() => addGame(game)}>
                      <img src={game.cover?.url?.replace('t_thumb', 't_cover_big').replace(/^\/\//, 'https://')} alt={game.name} />
                      <div style={{fontSize:'10px', marginTop:'5px'}}>{game.name}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
