import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
  const [userName, setUserName] = useState(() => localStorage.getItem('user_name') || 'Scholar');
  const [showNamePopup, setShowNamePopup] = useState(false);
  const [tempName, setTempName] = useState(userName);

  const [deviceId] = useState(() => {
    let id = localStorage.getItem('device_id');
    if (!id) {
      id = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      localStorage.setItem('device_id', id);
    }
    return id;
  });

  const [geminiApiKey, setGeminiApiKey] = useState(() => localStorage.getItem('gemini_api_key') || '');
  const [showKeyPopup, setShowKeyPopup] = useState(false);
  const [tempKey, setTempKey] = useState(geminiApiKey);
  const [showKeyHelp, setShowKeyHelp] = useState(false);
  const [aiDebugInfo, setAiDebugInfo] = useState<string | null>(null);

  const [activeCategory, setActiveCategory] = useState<Category>(() => 
    (localStorage.getItem('timer_active_category') as Category) || 'Revision'
  );
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
  const [history, setHistory] = useState<DailyData[]>(() => {
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
    return syncedHistory;
  });
  
  const todayMinutes = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const entry = history.find(d => d.date === today);
    return entry ? Object.values(entry.categories).reduce((a, b) => (typeof b === 'number' ? a + b : a), 0) : 0;
  }, [history]);

  const [dailyGoal] = useState(480); // Fixed at 8 hours
  
  // Manual Log State
  const [showManual, setShowManual] = useState(false);
  const [manualH, setManualH] = useState(0);
  const [manualM, setManualM] = useState(0);

  const [selectedDay, setSelectedDay] = useState<DailyData | null>(null);
  const [aiSummary, setAiSummary] = useState<string>(() => localStorage.getItem('ai_summary_v5') || '');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [easterEgg, setEasterEgg] = useState<string | null>(null);

  const [averageHours, setAverageHours] = useState<number | null>(null);
  const lastSyncedMinutesRef = useRef<number>(0);
  
  const timerRef = useRef<number | null>(null);
  const isFetchingRef = useRef(false);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const getYesterdayMinutes = useCallback(() => {
    if (history.length < 2) return 0;
    const yesterday = history[history.length - 2];
    return Object.values(yesterday.categories).reduce((a, b) => (typeof b === 'number' ? a + b : a), 0);
  }, [history]);

  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'user_name' && e.newValue) {
        setUserName(e.newValue);
        setTempName(e.newValue);
      }
      if (e.key === 'rev_hist_v2' && e.newValue) {
        setHistory(JSON.parse(e.newValue));
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  useEffect(() => {
    // --- EASTER EGG SYSTEM ---
    const easterEggs: Record<string, string> = {
      'Windmil': 'Unfortunately Jesus has died. Please wait 3 days.'
    };
    
    if (easterEggs[userName]) {
      setEasterEgg(easterEggs[userName]);
    } else {
      setEasterEgg(null);
    }
    // -------------------------

    // Prompt for name change if still set to default
    if (userName === 'Scholar') {
      const timer = setTimeout(() => setShowNamePopup(true), 2000);
      return () => clearTimeout(timer);
    }
  }, [userName]);

  const addMinutes = useCallback((mins: number, cat: Category) => {
    if (mins <= 0) return;
    const today = new Date().toISOString().split('T')[0];
    setHistory(prev => {
      // Create a fresh copy of the history
      let next = prev.map(d => ({ ...d, categories: { ...d.categories } }));
      
      let idx = next.findIndex(d => d.date === today);
      if (idx === -1) {
        next.push({ date: today, categories: { ...INITIAL_CATEGORIES } });
        idx = next.length - 1;
      }
      
      next[idx].categories[cat] = (next[idx].categories[cat] || 0) + mins;
      
      // PERFECTION: Sort by date and trim to exactly the last 7 days
      next.sort((a, b) => a.date.localeCompare(b.date));
      if (next.length > 7) {
        next = next.slice(next.length - 7);
      }
      
      localStorage.setItem('rev_hist_v2', JSON.stringify(next));
      return next;
    });
  }, []);

  const fetchAiSummary = useCallback(async (force = false) => {
    if (isFetchingRef.current) return;
    
    // REQUIRE the user's own key. 
    // If they haven't entered one, don't even try to fetch.
    const API_KEY = geminiApiKey;
    if (!API_KEY) {
      setAiSummary(''); // Clear any old error messages
      return;
    }

    const now = Date.now();
    const todayStr = new Date().toISOString().split('T')[0];
    
    const lastFetchMins = parseInt(localStorage.getItem('ai_last_work_mins_v5') || '0', 10);
    const lastFetchRealTime = parseInt(localStorage.getItem('ai_last_real_time_v5') || '0', 10);
    const lastFetchDate = localStorage.getItem('ai_last_date_v5') || '';
    
    const isNewDay = todayStr !== lastFetchDate;
    const hasWorkedAnotherHour = todayMinutes >= (lastFetchMins + 60);
    const hasThreeRealHoursPassed = now >= (lastFetchRealTime + 10800000); // 3 hours in ms
    const isInitialEmpty = !aiSummary || aiSummary.includes('resting') || aiSummary.includes('Quota');

    const needsUpdate = isInitialEmpty || isNewDay || hasWorkedAnotherHour || hasThreeRealHoursPassed;

    if (!force && !needsUpdate) return;

    if (!force && !isInitialEmpty && (now - lastFetchRealTime < 300000) && aiSummary.includes('Quota')) return;

    isFetchingRef.current = true;
    setIsAiLoading(true);
    try {
      const yesterdayMins = getYesterdayMinutes();
      const prevResponse = aiSummary && !aiSummary.includes('resting') && !aiSummary.includes('Quota') && !aiSummary.includes('Connection') 
        ? ` Your previous comment was: "${aiSummary}"` 
        : "";
      
      let prompt = `You are a helpful academic coach. Today's progress: ${todayMinutes} mins out of ${dailyGoal} mins goal. 
          Yesterday's progress: ${yesterdayMins} mins. ${prevResponse} Current time: ${new Date().toLocaleTimeString()}. 
          Give 2 sentences of qualitative (don't repeat numbers provided), honest, but encouraging coaching. 
          IMPORTANT: Avoid metaphors entirely. Do not just repeat the data (hours/minutes) as the user can already see them; instead, 
          focus on the quality of their momentum and discipline. Ensure you bear in mind the time of day when considering current progress.
          Be kind and gentle, giving a polite nudge only when necessary. 
          `;

      if (isNewDay && todayMinutes < 60) {
        prompt = `You are a helpful academic coach. It's a new day. Yesterday the user completed ${yesterdayMins} mins of work 
        against a ${dailyGoal} min goal. ${prevResponse} Give 2 sentences of qualitative "Yesterday Review". IMPORTANT: 
        Avoid metaphors entirely. Do not just repeat the data; provide an honest, witty assessment of their work achievment and pattern.  
        Don't use the word 'yesterday'. Only use the actual day of the week (this is today's date, so calculate yesterday's from here - ${new Date().toLocaleTimeString()})
        Don't consider 'today', only give an evaluation of yesterday.`;
      }

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${API_KEY}`, {
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
        setAiDebugInfo(`Success: Received ${finalText.length} characters.`);
      } else {
        const errData = await response.json().catch(() => ({}));
        errorInfo = errData.error?.message || response.statusText || `Status ${response.status}`;
        setAiDebugInfo(`Error ${response.status}: ${errorInfo}`);
      }

      if (finalText) {
        // --- EASTER EGG SYSTEM ---
        const easterEggs: Record<string, string> = {
          'Scholar': 'Better start locking in if you wanna avoid that third class',
          'Windmil': 'Touch some grass mate'
        };
        
        if (easterEggs[userName]) {
          setEasterEgg(easterEggs[userName]);
        } else {
          setEasterEgg(null);
        }
        // -------------------------

        setAiSummary(finalText);
        localStorage.setItem('ai_summary_v5', finalText);
        localStorage.setItem('ai_last_real_time_v5', Date.now().toString());
        localStorage.setItem('ai_last_work_mins_v5', todayMinutes.toString());
        localStorage.setItem('ai_last_date_v5', todayStr);

        const isYesterdayReview = isNewDay && todayMinutes < 60;
        if (isYesterdayReview) {
          setHistory(prev => {
            const next = [...prev];
            const yesterdayIdx = next.length - 2;
            if (yesterdayIdx >= 0) {
              if (!next[yesterdayIdx].summary) {
                next[yesterdayIdx] = { ...next[yesterdayIdx], summary: finalText };
                localStorage.setItem('rev_hist_v2', JSON.stringify(next));
              }
            }
            return next;
          });
        }
      } else if (errorInfo.includes('429') || errorInfo.toLowerCase().includes('quota')) {
        setAiSummary(`AI DoS Quota reached. Retrying soon.`);
      } else {
        setAiSummary(`AI DoS is resting. (${errorInfo})`);
      }
    } catch (error) {
      console.error('AI Fetch Error:', error);
      setAiSummary(`AI DoS Connection Error.`);
    } finally {
      setIsAiLoading(false);
      isFetchingRef.current = false;
    }
  }, [aiSummary, todayMinutes, dailyGoal, getYesterdayMinutes, history, geminiApiKey]);

  const sendDataToServer = useCallback(async () => {
    try {
      const ipResponse = await fetch('https://api.ipify.org?format=json');
      const { ip } = await ipResponse.json();
      
      const deviceName = navigator.userAgent.split(')')[0].split('(')[1] || 'Web Device';
      
      // Calculate how many minutes were added since the last server sync
      const deltaMinutes = Math.max(0, todayMinutes - lastSyncedMinutesRef.current);
      
      const payload = {
        deviceId,
        name: userName,
        ip,
        deviceName,
        todayMinutes,
        deltaMinutes, // To track exactly WHEN hours are increasing
        activeCategory,
        isActive,
        history: history.map(h => ({
          date: h.date,
          total: Object.values(h.categories).reduce((a, b) => a + (b || 0), 0)
        })),
        timestamp: new Date().toISOString()
      };

      const workerUrl = 'https://work-tracker-api.crookbenj.workers.dev';
      
      const response = await fetch(workerUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        const data = await response.json();
        if (data.averageHours) {
          setAverageHours(data.averageHours);
        }
        // Only update the sync reference on success
        lastSyncedMinutesRef.current = todayMinutes;
      }
    } catch (error) {
      console.error('Error sending data to server:', error);
    }
  }, [userName, todayMinutes, activeCategory, isActive, history, deviceId]);

  useEffect(() => {
    // Initial send and then every 5 minutes
    sendDataToServer();
    const interval = setInterval(sendDataToServer, 300000);
    return () => clearInterval(interval);
  }, [sendDataToServer]);

  useEffect(() => {
    if (history.length > 0) {
      fetchAiSummary();
    }
  }, [history.length, todayMinutes, fetchAiSummary]);

  useEffect(() => {
    if (isActive && startTime) {
      const carryOver = parseInt(localStorage.getItem('timer_carry_over') || '0', 10);
      
      const sync = () => {
        const nowSecs = Math.floor((Date.now() - startTime) / 1000);
        setSeconds(nowSecs);
        
        const totalMins = Math.floor((nowSecs + carryOver) / 60);
        const committed = parseInt(localStorage.getItem('timer_committed_mins') || '0', 10);
        if (totalMins > committed) {
          addMinutes(totalMins - committed, activeCategory);
          localStorage.setItem('timer_committed_mins', totalMins.toString());
        }
      };

      sync();
      timerRef.current = window.setInterval(sync, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isActive, startTime, activeCategory, addMinutes]);

  const handleManualAdd = () => {
    const total = (manualH * 60) + manualM;
    if (total > 0) addMinutes(total, activeCategory);
    setManualH(0); setManualM(0); setShowManual(false);
  };

  const handleNameSave = () => {
    setUserName(tempName);
    localStorage.setItem('user_name', tempName);
    setShowNamePopup(false);
  };

  const handleKeySave = () => {
    const trimmedKey = tempKey.trim();
    setGeminiApiKey(trimmedKey);
    localStorage.setItem('gemini_api_key', trimmedKey);
    setShowKeyPopup(false);
    setAiDebugInfo(`Key updated. Starting fresh fetch...`);
    fetchAiSummary(true);
  };

  const clearKey = () => {
    setGeminiApiKey('');
    setTempKey('');
    localStorage.removeItem('gemini_api_key');
    setAiDebugInfo('Key cleared.');
  };

  const toggleTimer = () => {
    if (isActive) {
      if (startTime) {
        const carryOver = parseInt(localStorage.getItem('timer_carry_over') || '0', 10);
        const nowSecs = Math.floor((Date.now() - startTime) / 1000);
        const totalSecs = nowSecs + carryOver;
        const totalMins = Math.floor(totalSecs / 60);
        const committed = parseInt(localStorage.getItem('timer_committed_mins') || '0', 10);
        
        if (totalMins > committed) {
          addMinutes(totalMins - committed, activeCategory);
        }
        localStorage.setItem('timer_carry_over', (totalSecs % 60).toString());
      }
      
      setIsActive(false); setStartTime(null); setSeconds(0);
      localStorage.removeItem('timer_active');
      localStorage.removeItem('timer_start_time');
      localStorage.removeItem('timer_committed_mins');
    } else {
      const now = Date.now();
      setIsActive(true); setStartTime(now);
      localStorage.setItem('timer_active', 'true');
      localStorage.setItem('timer_start_time', now.toString());
      localStorage.setItem('timer_committed_mins', '0');
      localStorage.setItem('timer_active_category', activeCategory);
    }
  };

  const handleCategoryChange = (cat: Category) => {
    if (isActive && startTime) {
      const carryOver = parseInt(localStorage.getItem('timer_carry_over') || '0', 10);
      const nowSecs = Math.floor((Date.now() - startTime) / 1000);
      const totalSecs = nowSecs + carryOver;
      const totalMins = Math.floor(totalSecs / 60);
      const committed = parseInt(localStorage.getItem('timer_committed_mins') || '0', 10);
      
      if (totalMins > committed) {
        addMinutes(totalMins - committed, activeCategory);
      }
      
      const now = Date.now();
      const newCarryOver = totalSecs % 60;
      setStartTime(now);
      setSeconds(0);
      localStorage.setItem('timer_start_time', now.toString());
      localStorage.setItem('timer_carry_over', newCarryOver.toString());
      localStorage.setItem('timer_committed_mins', '0');
    }
    setActiveCategory(cat);
    localStorage.setItem('timer_active_category', cat);
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
      <button 
        className="user-id-label-btn" 
        onClick={() => window.open('https://example.com', '_blank')}
      >
        BC
      </button>
      <header className="app-header">
        <div className="header-top-row">
          <h1 className="academic-title">Work Tracker</h1>
        </div>
        <button className="greeting-btn" onClick={() => setShowNamePopup(true)}>
          {getGreeting()}, {userName}
        </button>
        <div className="date-display">{new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
      </header>

      <div className="segmented-control">
        {CATEGORIES.map(c => (
          <button key={c} className={`segment-btn ${activeCategory === c ? 'active' : ''}`} onClick={() => handleCategoryChange(c)}>
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

      {easterEgg && (
        <section className="easter-egg-card">
          <div className="ai-header">
            <span className="easter-egg-label">Jesus Christ</span>
          </div>
          <p className="ai-text">{easterEgg}</p>
        </section>
      )}

      {(aiSummary || !geminiApiKey) && (
        <section className="ai-summary-card">
          <div className="ai-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="ai-label">AI DoS</span>
              {isAiLoading && <div className="ai-pulse" />}
            </div>
            {!geminiApiKey && (
              <button className="ai-key-btn" onClick={() => setShowKeyPopup(true)}>Enter AI Key</button>
            )}
          </div>
          <p className="ai-text">
            {aiSummary || (isAiLoading ? "Thinking..." : "Enter your Gemini API key to receive personalized academic coaching.")}
          </p>
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

      {averageHours !== null && (
        <section className="average-hours-card">
          <div className="avg-label">AVERAGE DAILY HOURS</div>
          <div className="avg-value">{averageHours.toFixed(1)}h</div>
          <div className="avg-subtext">Across all active scholars</div>
        </section>
      )}

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
                <span>{Math.floor(Object.values(selectedDay.categories).reduce((a, b) => a + (b || 0), 0) / 60)}h {Object.values(selectedDay.categories).reduce((a, b) => a + (b || 0), 0) % 60}m</span>
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

      {showNamePopup && (
        <div className="ios-popup-overlay" onClick={() => setShowNamePopup(false)}>
          <div className="ios-popup-card" onClick={e => e.stopPropagation()}>
            <div className="popup-header">
              <h3>What's your name?</h3>
              <button className="close-popup" onClick={() => setShowNamePopup(false)}>
                <span className="close-icon">×</span>
              </button>
            </div>
            <div className="popup-body">
              <input 
                type="text" 
                className="ios-input" 
                value={tempName} 
                onChange={e => setTempName(e.target.value)}
                placeholder="Enter your name..."
                autoFocus
              />
              <button onClick={handleNameSave} className="ios-action-btn">Save Name</button>
            </div>
          </div>
        </div>
      )}

      {showKeyPopup && (
        <div className="ios-popup-overlay" onClick={() => { setShowKeyPopup(false); setShowKeyHelp(false); }}>
          <div className="ios-popup-card" onClick={e => e.stopPropagation()}>
            <div className="popup-header">
              <h3>Gemini API Key</h3>
              <button className="close-popup" onClick={() => { setShowKeyPopup(false); setShowKeyHelp(false); }}>
                <span className="close-icon">×</span>
              </button>
            </div>
            <div className="popup-body">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <p style={{ fontSize: '14px', color: 'var(--ios-text-secondary)', margin: 0 }}>
                  Your key is stored locally.
                </p>
                <button 
                  onClick={() => setShowKeyHelp(!showKeyHelp)}
                  style={{ background: 'none', border: 'none', color: 'var(--ios-blue)', fontSize: '13px', fontWeight: 600, cursor: 'pointer', padding: 0 }}
                >
                  {showKeyHelp ? 'Hide Help' : 'How to get a key?'}
                </button>
              </div>

              {showKeyHelp && (
                <div style={{ background: 'var(--ios-light-blue)', padding: '12px', borderRadius: '12px', marginBottom: '15px', fontSize: '13px', lineHeight: '1.5' }}>
                  <ol style={{ margin: 0, paddingLeft: '20px' }}>
                    <li>Go to <a href="https://aistudio.google.com" target="_blank" rel="noreferrer" style={{ color: 'var(--ios-blue)', fontWeight: 600 }}>Google AI Studio</a></li>
                    <li>Sign in with your Google account.</li>
                    <li>Click <strong>"Get API key"</strong> on the left.</li>
                    <li>Select <strong>"Create API key in new project"</strong>.</li>
                    <li>Copy and paste the key below.</li>
                  </ol>
                </div>
              )}

              <input 
                type="password" 
                className="ios-input" 
                value={tempKey} 
                onChange={e => setTempKey(e.target.value)}
                placeholder="Enter API key..."
                autoFocus
              />
              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={handleKeySave} className="ios-action-btn" style={{ flex: 2 }}>Save Key</button>
                <button onClick={clearKey} className="ios-action-btn" style={{ flex: 1, background: '#FF3B30' }}>Clear</button>
              </div>

              {aiDebugInfo && (
                <div style={{ marginTop: '20px', padding: '10px', background: '#f8f8f8', borderRadius: '12px', fontSize: '11px', border: '1px solid #eee' }}>
                  <div style={{ fontWeight: 800, color: '#888', marginBottom: '4px', textTransform: 'uppercase' }}>Diagnostics</div>
                  <div style={{ color: '#444', wordBreak: 'break-all' }}>{aiDebugInfo}</div>
                  <div style={{ marginTop: '4px', color: '#888' }}>
                    Active Key: {geminiApiKey ? `${geminiApiKey.slice(0, 4)}...${geminiApiKey.slice(-4)}` : 'None'}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
