'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

// Configuration
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
  const rosterRef = useRef(null); // Ref to capture the image

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
          body: `search "${q}"; fields name,cover.url; where cover != null; limit 12;`,
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

  // --- NEW SHARE AS IMAGE LOGIC ---
  const handleShareImage = async () => {
    if (!rosterRef.current) return;

    try {
      const html2canvas = (await import('html2canvas')).default;
      
      // Capture the grid
      const canvas = await html2canvas(rosterRef.current, {
        backgroundColor: '#0e0e12',
        useCORS: true, // Allows capturing images from IGDB
        scale: 2, // Better quality
        logging: false,
      });

      canvas.toBlob(async (blob) => {
        if (!blob) return;
        const file = new File([blob], '2026-oyun-takibi.png', { type: 'image/png' });

        // If mobile supports file sharing
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: '2026 Oyun Takibi',
            text: 'İşte bu yıl oynayacağım oyunlar!',
          });
        } else {
          // Desktop Fallback: Download
          const link = document.createElement('a');
          link.href = URL.createObjectURL(blob);
          link.download = '2026-oyun-takibi.png';
          link.click();
          alert('Görsel indirildi! Paylaşmaya hazırsın.');
        }
      }, 'image/png');
    } catch (err) {
      console.error('Share failed', err);
      alert('Görsel oluşturulurken bir hata oluştu.');
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Outfit:wght@300;400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #0e0e12; color: #e8e6f0; font-family: 'Outfit', sans-serif; min-height: 100vh; }
        
        .page { max-width: 1400px; margin: 0 auto; padding: 20px; }
        
        .header {
          display: flex; justify-content: space-between; align-items: center;
          margin-bottom: 20px;
        }

        .site-title {
          font-family: 'Bebas Neue', sans-serif;
          font-size: clamp(2rem, 5vw, 3rem);
          background: linear-gradient(135deg, #c9b8ff 0%, #ff8fc8 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .share-btn {
          background: #2a2835; color: #c9b8ff; border: 1px solid #3d3a50;
          padding: 10px 20px; border-radius: 99px; cursor: pointer;
          font-weight: 600; transition: 0.2s;
        }
        .share-btn:hover { background: #c9b8ff; color: #000; }

        .grid-months {
          display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px;
          padding: 10px;
        }

        @media (max-width: 1024px) { .grid-months { grid-template-columns: repeat(3, 1fr); } }
        @media (max-width: 768px) { .grid-months { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 480px) { .grid-months { grid-template-columns: 1fr; } }

        .month-col {
          background: #16141f; border: 1px solid #2a2835; border-radius: 12px;
          padding: 15px; display: flex; flex-direction: column; min-height: 160px;
        }

        .month-label {
          font-family: 'Bebas Neue', sans-serif; font-size: 1.4rem;
          color: #c9b8ff; border-bottom: 1px solid #2a2835;
          margin-bottom: 12px; padding-bottom: 5px;
        }

        .games-grid {
          display: grid; grid-template-columns: repeat(auto-fill, minmax(70px, 1fr)); gap: 8px;
        }

        .game-card {
          position: relative; aspect-ratio: 2/3; border-radius: 6px;
          overflow: hidden; background: #0e0e12;
        }
        .game-card img { width: 100%; height: 100%; object-fit: cover; }

        .remove-btn {
          position: absolute; top: 2px; right: 2px; width: 18px; height: 18px;
          background: #ff4d6d; border: none; border-radius: 50%;
          color: white; font-size: 10px; cursor: pointer; opacity: 0;
        }
        .game-card:hover .remove-btn { opacity: 1; }

        .add-btn {
          aspect-ratio: 2/3; border: 2px dashed #2a2835; border-radius: 6px;
          background: transparent; color: #3d3a50; font-size: 1.5rem;
          cursor: pointer; display: flex; align-items: center; justify-content: center;
        }
        .add-btn:hover { border-color: #c9b8ff; color: #c9b8ff; }

        .modal-backdrop {
          position: fixed; inset: 0; background: rgba(0,0,0,0.8);
          display: flex; align-items: center; justify-content: center; z-index: 100;
        }
        .modal {
          background: #16141f; width: 90%; max-width: 500px;
          border-radius: 16px; border: 1px solid #2a2835;
          max-height: 80vh; display: flex; flex-direction: column;
        }
        .search-input {
          width: 100%; background: #0e0e12; border: 1px solid #2a2835;
          padding: 12px; color: white; border-radius: 8px; outline: none;
        }
      `}</style>

      <div className="page">
        <header className="header">
          <h1 className="site-title">2026 OYUN TAKİBİ</h1>
          <button className="share-btn" onClick={handleShareImage}>
            🖼️ Görsel Olarak Paylaş
          </button>
        </header>

        {/* This div is what gets captured as an image */}
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
                {/* The add button is hidden during capture automatically by html2canvas if we wanted, 
                    but here we keep it simple. */}
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
            <div style={{ padding: '15px', textAlign: 'center', color: '#c9b8ff' }}>{MONTHS[modal.monthIndex]} EKLE</div>
            <div style={{ padding: '15px' }}>
              <input className="search-input" placeholder="Oyun ara..." value={query} onChange={handleQueryChange} autoFocus />
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '15px' }}>
              {searching ? <div>Aranıyor...</div> : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                  {results.map((game) => {
                    const url = game.cover?.url?.replace('t_thumb', 't_cover_big').replace(/^\/\//, 'https://');
                    return (
                      <div key={game.id} onClick={() => addGame({ id: game.id, name: game.name, coverUrl: url })} style={{ cursor: 'pointer' }}>
                        <img src={url} style={{ width: '100%', borderRadius: '4px' }} />
                        <div style={{ fontSize: '10px', textAlign: 'center', marginTop: '4px' }}>{game.name}</div>
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
