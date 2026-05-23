import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis,
  ResponsiveContainer, 
  Cell 
} from 'recharts';
import { Play, Square } from 'lucide-react';
import './App.css';

type Category = 'Supervisions' | 'Lectures' | 'Revision' | 'Labs';
interface DailyData { 
  date: string; 
  categories: Record<Category, number>;
  summary?: string;
}
const CATEGORIES: Category[] = ['Supervisions', 'Lectures', 'Revision', 'Labs'];
const INITIAL_CATEGORIES: Record<Category, number> = { Revision: 0, Lectures: 0, Supervisions: 0, Labs: 0 };
const MAX_TIMER_MINUTES = 60; // 1 hour for the visual circle

// --- Helper for iOS Scroll Picker ---
const Picker: React.FC<{
  value: number;
  max: number;
  label: string;
  onChange: (val: number) => void;
}> = ({ value, max, label, onChange }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const itemHeight = 44;
  const items = Array.from({ length: max + 1 }, (_, i) => i);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = value * itemHeight;
    }
  }, []);

  const onScroll = () => {
    if (!scrollRef.current) return;
    const index = Math.round(scrollRef.current.scrollTop / itemHeight);
    if (index >= 0 && index <= max && index !== value) {
      onChange(index);
    }
  };

  return (
    <div className="ios-picker-col">
      <div className="ios-picker-scroll" ref={scrollRef} onScroll={onScroll}>
        <div className="ios-picker-spacer" />
        {items.map(i => (
          <div key={i} className={`ios-picker-item ${value === i ? 'active' : ''}`}>
            {i.toString().padStart(2, '0')}
          </div>
        ))}
        <div className="ios-picker-spacer" />
      </div>
      <span className="ios-picker-label">{label}</span>
    </div>
  );
};

const App: React.FC = () => {
  const [activeCategory, setActiveCategory] = useState<Category>('Revision');
  const [isActive, setIsActive] = useState(() => localStorage.getItem('timer_active') === 'true');
  const [startTime, setStartTime] = useState<number | null>(() => {
    const saved = localStorage.getItem('timer_start_time');
    return saved ? parseInt(saved) : null;
  });
  const [seconds, setSeconds] = useState(() => {
    const savedActive = localStorage.getItem('timer_active') === 'true';
    const savedStart = localStorage.getItem('timer_start_time');
    if (savedActive && savedStart) {
      return Math.floor((Date.now() - parseInt(savedStart)) / 1000);
    }
    return 0;
  });
  const [history, setHistory] = useState<DailyData[]>([]);
  const [todayMinutes, setTodayMinutes] = useState(0);
  const [dailyGoal] = useState(480); // Fixed at 8 hours
  
  // Manual Log State
  const [showManual, setShowManual] = useState(false);
  const [manualH, setManualH] = useState(0);
  const [manualM, setManualM] = useState(0);

  const [selectedDay, setSelectedDay] = useState<DailyData | null>(null);
  const [aiSummary, setAiSummary] = useState<string>(() => localStorage.getItem('ai_summary_v5') || '');
  const [isAiLoading, setIsAiLoading] = useState(false);
  
  const timerRef = useRef<number | null>(null);
  const isFetchingRef = useRef(false);

  const getYesterdayMinutes = useCallback(() => {
    if (history.length < 2) return 0;
    const yesterday = history[history.length - 2];
    return Object.values(yesterday.categories).reduce((a, b) => (typeof b === 'number' ? a + b : a), 0);
  }, [history]);

  const fetchAiSummary = useCallback(async (force = false) => {
    if (isFetchingRef.current) return;
    const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
    if (!API_KEY) return;

    const now = Date.now();
    const todayStr = new Date().toISOString().split('T')[0];
    
    const lastFetchMins = parseInt(localStorage.getItem('ai_last_work_mins_v5') || '0', 10);
    const lastFetchRealTime = parseInt(localStorage.getItem('ai_last_real_time_v5') || '0', 10);
    const lastFetchDate = localStorage.getItem('ai_last_date_v5') || '';
    
    const isNewDay = todayStr !== lastFetchDate;
    const hasWorkedAnotherHour = todayMinutes >= (lastFetchMins + 60);
    const hasThreeRealHoursPassed = now >= (lastFetchRealTime + 10800000); // 3 hours in ms
    const isInitialEmpty = !aiSummary || aiSummary.includes('resting') || aiSummary.includes('Quota');

    // Automation Rules:
    // 1. Initial Load (Empty)
    // 2. New Day (to get Yesterday Review)
    // 3. 1 Hour of active work progress
    // 4. 3 Hours of real time (even if no work)
    const needsUpdate = isInitialEmpty || isNewDay || hasWorkedAnotherHour || hasThreeRealHoursPassed;

    if (!force && !needsUpdate) return;

    // Safety: Don't retry more than once every 5 mins on error
    if (!force && !isInitialEmpty && (now - lastFetchRealTime < 300000) && aiSummary.includes('Quota')) return;

    isFetchingRef.current = true;
    setIsAiLoading(true);
    try {
      const yesterdayMins = getYesterdayMinutes();
      const prevResponse = aiSummary && !aiSummary.includes('resting') && !aiSummary.includes('Quota') && !aiSummary.includes('Connection') 
        ? ` Your previous comment was: "${aiSummary}"` 
        : "";
      
      let prompt = `You are a helpful academic coach. Today's progress: ${todayMinutes} mins out of ${dailyGoal} mins goal. Yesterday's progress: ${yesterdayMins} mins. ${prevResponse} Current time: ${new Date().toLocaleTimeString()}. Give 2 sentences of qualitative, critically honest, and slightly witty coaching. IMPORTANT: Avoid metaphors entirely. Do not just repeat the data (hours/minutes) as the user can already see them; instead, focus on the quality of their momentum and discipline.`;

      // Specific prompt for Yesterday Review (Start of day / No work yet)
      if (isNewDay && todayMinutes < 60) {
        prompt = `You are a helpful academic coach. It's a new day. Yesterday the user completed ${yesterdayMins} mins of work against a ${dailyGoal} min goal. ${prevResponse} Give 2 sentences of qualitative "Yesterday Review". IMPORTANT: Avoid metaphors entirely. Do not just repeat the data; provide an honest, witty assessment of their work pattern and a nudge for today.`;
      }

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 150 }
        })
      });

      let finalText = "";
      let errorInfo = "";

      if (response.ok) {
        const data = await response.json();
        finalText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
      } else {
        const errData = await response.json().catch(() => ({}));
        errorInfo = errData.error?.message || response.statusText || `Status ${response.status}`;
      }

      if (finalText) {
        setAiSummary(finalText);
        localStorage.setItem('ai_summary_v5', finalText);
        localStorage.setItem('ai_last_real_time_v5', Date.now().toString());
        localStorage.setItem('ai_last_work_mins_v5', todayMinutes.toString());
        localStorage.setItem('ai_last_date_v5', todayStr);

        // PERSISTENCE: If this is the "Yesterday Review", save it into yesterday's record
        const isYesterdayReview = isNewDay && todayMinutes < 60;
        if (isYesterdayReview) {
          setHistory(prev => {
            const next = [...prev];
            const yesterdayIdx = next.length - 2;
            if (yesterdayIdx >= 0) {
              // Only save if yesterday doesn't already have a summary
              if (!next[yesterdayIdx].summary) {
                next[yesterdayIdx] = { ...next[yesterdayIdx], summary: finalText };
                localStorage.setItem('rev_hist_v2', JSON.stringify(next));
              }
            }
            return next;
          });
        }
      } else if (errorInfo.includes('429') || errorInfo.toLowerCase().includes('quota')) {
        setAiSummary(`AI Quota reached. Retrying soon.`);
      } else {
        setAiSummary(`AI Coach is resting. (${errorInfo})`);
      }
    } catch (error: any) {
      console.error('AI Fetch Error:', error);
      setAiSummary(`AI Connection Error.`);
    } finally {
      setIsAiLoading(false);
      isFetchingRef.current = false;
    }
  }, [aiSummary, todayMinutes, dailyGoal, getYesterdayMinutes, history]);

  useEffect(() => {
    if (history.length > 0) {
      fetchAiSummary();
    }
  }, [history.length, todayMinutes, fetchAiSummary]);

  const updateTodayTotal = (hist: DailyData[]) => {
    const today = new Date().toISOString().split('T')[0];
    const entry = hist.find(d => d.date === today);
    if (entry) {
      const total = Object.values(entry.categories).reduce((a, b) => (typeof b === 'number' ? a + b : a), 0);
      setTodayMinutes(total);
    }
  };

  useEffect(() => {
    const saved = localStorage.getItem('rev_hist_v2');
    let finalHistory: DailyData[] = [];
    if (saved) finalHistory = JSON.parse(saved);

    const syncedHistory: DailyData[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const existing = finalHistory.find(h => h.date === dateStr);
      
      syncedHistory.push(existing ? {
        ...existing,
        categories: {
          ...INITIAL_CATEGORIES,
          ...(existing.categories as Record<Category, number>)
        }
      } : { 
        date: dateStr, 
        categories: { ...INITIAL_CATEGORIES } 
      });
    }

    setHistory(syncedHistory);
    updateTodayTotal(syncedHistory);
    localStorage.setItem('rev_hist_v2', JSON.stringify(syncedHistory));
  }, []);

  useEffect(() => {
    if (isActive && startTime) {
      timerRef.current = window.setInterval(() => {
        const newSeconds = Math.floor((Date.now() - startTime) / 1000);
        
        // Auto-increment progress every 60 seconds
        setSeconds(prev => {
          if (Math.floor(newSeconds / 60) > Math.floor(prev / 60)) {
            addMinutes(1);
          }
          return newSeconds;
        });
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isActive, startTime]);

  const addMinutes = (mins: number) => {
    const today = new Date().toISOString().split('T')[0];
    setHistory(prev => {
      const next = prev.map(d => ({ ...d, categories: { ...d.categories } }));
      let idx = next.findIndex(d => d.date === today);
      if (idx === -1) {
        next.push({ date: today, categories: { ...INITIAL_CATEGORIES } });
        idx = next.length - 1;
      }
      next[idx].categories[activeCategory] = (next[idx].categories[activeCategory] || 0) + mins;
      localStorage.setItem('rev_hist_v2', JSON.stringify(next));
      setTimeout(() => updateTodayTotal(next), 0);
      return next;
    });
  };

  const handleManualAdd = () => {
    const total = manualH * 60 + manualM;
    if (total > 0) addMinutes(total);
    setManualH(0); setManualM(0); setShowManual(false);
  };

  const toggleTimer = () => {
    if (isActive) {
      // No longer adding minutes here as they are added incrementally
      setIsActive(false); setStartTime(null); setSeconds(0);
      localStorage.removeItem('timer_active');
      localStorage.removeItem('timer_start_time');
    } else {
      const now = Date.now();
      setIsActive(true); setStartTime(now);
      localStorage.setItem('timer_active', 'true');
      localStorage.setItem('timer_start_time', now.toString());
    }
  };

  const format = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sc = s % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${sc.toString().padStart(2, '0')}`;
  };

  const radius = 135;
  const circ = 2 * Math.PI * radius;
  const off = circ - Math.min((seconds / 60) / MAX_TIMER_MINUTES, 1) * circ;
  const dProg = Math.min(todayMinutes / dailyGoal, 1);

  const chartData = history.map(d => ({
    day: new Date(d.date).toLocaleDateString('en-US', { weekday: 'narrow' }),
    total: Object.values(d.categories).reduce((a, b) => (typeof b === 'number' ? a + b : a), 0),
    raw: d
  }));

  return (
    <div className="app-container">
      <div className="user-id-label">BC</div>
      <header className="app-header">
        <div className="header-top-row">
          <h1 className="academic-title">Work Tracker</h1>
        </div>
        <div className="date-display">{new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
      </header>

      <div className="segmented-control">
        {CATEGORIES.map(c => (
          <button key={c} className={`segment-btn ${activeCategory === c ? 'active' : ''}`} onClick={() => setActiveCategory(c)}>
            {c}
          </button>
        ))}
      </div>

      <main className="timer-section">
        <div className="timer-wrapper">
          <div className="timer-control-surface">
            <button className="circular-timer-button" onClick={toggleTimer}>
              <div className="circular-timer-container">
                <svg className="timer-svg" viewBox="0 0 300 300">
                  <circle className="timer-track" cx="150" cy="150" r={radius} strokeWidth="5" />
                  <circle className="timer-progress" cx="150" cy="150" r={radius} strokeWidth="5" strokeDasharray={circ} style={{ strokeDashoffset: off }} strokeLinecap="round" />
                </svg>
                <div className="time-display-container">
                  <div className="time-string">{format(seconds)}</div>
                  <div className={`timer-status-icon ${isActive ? 'active' : ''}`}>
                    {isActive ? <Square size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" style={{ marginLeft: '4px' }} />}
                  </div>
                </div>
              </div>
            </button>
          </div>
        </div>
      </main>

      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '10px', marginTop: '-20px' }}>
        <button className="manual-log-btn" onClick={() => setShowManual(true)}>+ Log</button>
      </div>

      {aiSummary && (
        <section className="ai-summary-card">
          <div className="ai-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="ai-label">AI DOS</span>
              {isAiLoading && <div className="ai-pulse" />}
            </div>
          </div>
          <p className="ai-text">{aiSummary}</p>
        </section>
      )}

      <section className="progress-section">
        <div className="progress-labels">
          <span>Daily Progress</span>
          <span className="progress-value">{Math.round(dProg * 100)}%</span>
        </div>
        <div className="flat-progress-track">
          <div className="flat-progress-fill" style={{ width: `${dProg * 100}%` }} />
        </div>
        <div className="today-total-row">
          <span className="today-total">{Math.floor(todayMinutes / 60)}h {todayMinutes % 60}m completed</span>
          <span className="goal-label">Goal: 8h</span>
        </div>
      </section>

      <footer className="history-section">
        <div className="chart-container">
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
              <XAxis 
                dataKey="day" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 12, fill: '#8E8E93', fontWeight: 700 }}
                dy={12}
              />
              <Bar 
                dataKey="total" 
                radius={[6, 6, 0, 0]} 
                minPointSize={4}
                onClick={(data: any) => setSelectedDay(data.raw)}
              >
                {chartData.map((_, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={index === chartData.length - 1 ? '#007AFF' : '#D1E4FF'} 
                    style={{ cursor: 'pointer', transition: 'fill 0.3s ease' }}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </footer>

      {showManual && (
        <div className="ios-popup-overlay" onClick={() => setShowManual(false)}>
          <div className="ios-popup-card" onClick={e => e.stopPropagation()}>
            <div className="popup-header">
              <h3>Manual Log</h3>
              <button className="close-popup" onClick={() => setShowManual(false)}>
                <span className="close-icon">×</span>
              </button>
            </div>
            <div className="popup-body">
              <div className="ios-picker-wrapper">
                <Picker value={manualH} max={23} label="hours" onChange={setManualH} />
                <Picker value={manualM} max={59} label="min" onChange={setManualM} />
              </div>
              <button onClick={handleManualAdd} className="ios-action-btn">Add to {activeCategory}</button>
            </div>
          </div>
        </div>
      )}

      {selectedDay && (
        <div className="ios-popup-overlay" onClick={() => setSelectedDay(null)}>
          <div className="ios-popup-card" onClick={e => e.stopPropagation()}>
            <div className="popup-header">
              <h3>{new Date(selectedDay.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</h3>
              <button className="close-popup" onClick={() => setSelectedDay(null)}>
                <span className="close-icon">×</span>
              </button>
            </div>
            <div className="popup-body">
              <div className="popup-total-row">
                <span>Total Pursuit</span>
                <span>{Math.floor(Object.values(selectedDay.categories).reduce((a,b)=> (typeof b === 'number' ? a+b : a), 0) / 60)}h {Object.values(selectedDay.categories).reduce((a,b)=> (typeof b === 'number' ? a+b : a), 0) % 60}m</span>
              </div>
              <div className="popup-divider" />
              {CATEGORIES.map(cat => (
                <div key={cat} className="popup-cat-row">
                  <span className="cat-label">{cat}</span>
                  <span className="cat-val">{Math.floor((selectedDay.categories[cat] || 0) / 60)}h {(selectedDay.categories[cat] || 0) % 60}m</span>
                </div>
              ))}
              {selectedDay.summary && (
                <>
                  <div className="popup-divider" />
                  <div className="ai-history-summary">
                    <span className="ai-summary-label">Coach Review:</span>
                    <p className="ai-summary-text">{selectedDay.summary}</p>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
