import React, { useState, useEffect, useRef } from 'react';
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
}
const CATEGORIES: Category[] = ['Supervisions', 'Lectures', 'Revision', 'Labs'];
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
  const [aiSummary, setAiSummary] = useState<string>(() => localStorage.getItem('ai_summary') || '');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const timerRef = useRef<number | null>(null);

  const getYesterdayMinutes = () => {
    if (history.length < 2) return 0;
    const yesterday = history[history.length - 2];
    return Object.values(yesterday.categories).reduce((a, b) => a + b, 0);
  };

  const fetchAiSummary = async (force = false) => {
    const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
    if (!API_KEY) return;

    const lastFetch = parseInt(localStorage.getItem('ai_last_fetch') || '0');
    const lastMins = parseInt(localStorage.getItem('ai_last_mins') || '0');
    const now = Date.now();
    
    // Only fetch if forced, or 1 hour passed, or progress increased by 30 mins
    if (!force && aiSummary && (now - lastFetch < 3600000) && (todayMinutes - lastMins < 30)) {
      return;
    }

    setIsAiLoading(true);
    try {
      const yesterdayMins = getYesterdayMinutes();
      
      const prompt = `You are a helpful academic coach. 
      Today's progress: ${todayMinutes} mins out of ${dailyGoal} mins goal.
      Yesterday's progress: ${yesterdayMins} mins.
      Current time: ${new Date().toLocaleTimeString()}.
      If less than 1 hour of progress has been made today, make the summary focus on yesterday's progress.
      Bear in mind that the target for every day is 8 hours, but anything above 5 hours is considered good. 
      Give 2 sentences of an encouraging and slightly witty comment about the user's progress. 
      Consider how they are doing compared to yesterday and how much of the day is left. 
      If it's late and they've done a lot, tell them to rest. If they've barely started, give them a gentle nudge.
      Focus on being concise and helpful.`;

      const response = await fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 60,
          }
        })
      });

      if (response.status === 429) {
        setAiSummary("API quota exceeded. Taking a break from AI feedback!");
        return;
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "Keep up the great work!";
      setAiSummary(text);
      localStorage.setItem('ai_summary', text);
      localStorage.setItem('ai_last_fetch', now.toString());
      localStorage.setItem('ai_last_mins', todayMinutes.toString());
    } catch (error) {
      console.error('AI Fetch Error:', error);
    } finally {
      setIsAiLoading(false);
    }
  };

  useEffect(() => {
    if (history.length > 0) {
      fetchAiSummary();
    }
  }, [history, todayMinutes]);

  const updateTodayTotal = (hist: DailyData[]) => {
    const today = new Date().toISOString().split('T')[0];
    const entry = hist.find(d => d.date === today);
    if (entry) {
      const total = Object.values(entry.categories).reduce((a, b) => a + b, 0);
      setTodayMinutes(total);
    }
  };

  useEffect(() => {
    const saved = localStorage.getItem('rev_hist_v2');

    let finalHistory: DailyData[] = [];
    if (saved) {
      finalHistory = JSON.parse(saved);
    }

    const syncedHistory: DailyData[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const existing = finalHistory.find(h => h.date === dateStr);
      
      syncedHistory.push(existing ? {
        ...existing,
        categories: {
          Revision: 0,
          Lectures: 0,
          Supervisions: 0,
          Labs: 0,
          ...(existing.categories as Partial<Record<Category, number>>)
        }
      } : { 
        date: dateStr, 
        categories: { Revision: 0, Lectures: 0, Supervisions: 0, Labs: 0 } 
      });
    }

    setHistory(syncedHistory);
    updateTodayTotal(syncedHistory);
    localStorage.setItem('rev_hist_v2', JSON.stringify(syncedHistory));
  }, []);

  useEffect(() => {
    if (isActive && startTime) {
      timerRef.current = window.setInterval(() => {
        setSeconds(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isActive, startTime]);

  const addMinutes = (mins: number) => {
    const today = new Date().toISOString().split('T')[0];
    
    setHistory(prev => {
      const next = prev.map(d => ({
        ...d,
        categories: { ...d.categories }
      }));
      
      let idx = next.findIndex(d => d.date === today);
      if (idx === -1) {
        next.push({ 
          date: today, 
          categories: { Revision: 0, Lectures: 0, Supervisions: 0, Labs: 0 } 
        });
        idx = next.length - 1;
      }
      
      const currentMins = next[idx].categories[activeCategory] || 0;
      next[idx].categories[activeCategory] = currentMins + mins;
      
      const syncedHistory: DailyData[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        const existing = next.find(h => h.date === dateStr);
        
        syncedHistory.push(existing ? {
          ...existing,
          categories: {
            Revision: 0,
            Lectures: 0,
            Supervisions: 0,
            Labs: 0,
            ...(existing.categories as Partial<Record<Category, number>>)
          }
        } : { 
          date: dateStr, 
          categories: { Revision: 0, Lectures: 0, Supervisions: 0, Labs: 0 } 
        });
      }

      localStorage.setItem('rev_hist_v2', JSON.stringify(syncedHistory));
      setTimeout(() => updateTodayTotal(syncedHistory), 0);
      return syncedHistory;
    });
  };

  const handleManualAdd = () => {
    const total = manualH * 60 + manualM;
    if (total > 0) {
      addMinutes(total);
    }
    setManualH(0);
    setManualM(0);
    setShowManual(false);
  };

  const toggleTimer = () => {
    if (isActive) {
      const mins = Math.floor(seconds / 60);
      if (mins > 0) addMinutes(mins);
      setIsActive(false);
      setStartTime(null);
      setSeconds(0);
      localStorage.removeItem('timer_active');
      localStorage.removeItem('timer_start_time');
    } else {
      const now = Date.now();
      setIsActive(true);
      setStartTime(now);
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
    total: Object.values(d.categories).reduce((a, b) => a + b, 0),
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
          <button className="manual-log-btn" onClick={() => setShowManual(true)}>+ Log</button>
        </div>
      </main>

      {aiSummary && (
        <section className="ai-summary-card">
          <div className="ai-header">
            <span className="ai-label">Coach AI</span>
            {isAiLoading && <div className="ai-pulse" />}
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
                <span>{Math.floor(Object.values(selectedDay.categories).reduce((a,b)=>a+b,0) / 60)}h {Object.values(selectedDay.categories).reduce((a,b)=>a+b,0) % 60}m</span>
              </div>
              <div className="popup-divider" />
              {CATEGORIES.map(cat => (
                <div key={cat} className="popup-cat-row">
                  <span className="cat-label">{cat}</span>
                  <span className="cat-val">{Math.floor(selectedDay.categories[cat] / 60)}h {selectedDay.categories[cat] % 60}m</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
