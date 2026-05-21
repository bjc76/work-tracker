import React, { useState, useEffect, useRef } from 'react';
import { 
  BarChart, 
  Bar, 
  ResponsiveContainer, 
  Cell 
} from 'recharts';
import { Play, Square } from 'lucide-react';
import './App.css';

type Category = 'Supervisions' | 'Lectures' | 'Revision';
interface DailyData { 
  date: string; 
  categories: Record<Category, number>;
}
const CATEGORIES: Category[] = ['Supervisions', 'Lectures', 'Revision'];
const MAX_TIMER_MINUTES = 120; // 2 hours for the visual circle

const App: React.FC = () => {
  const [activeCategory, setActiveCategory] = useState<Category>('Revision');
  const [seconds, setSeconds] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [history, setHistory] = useState<DailyData[]>([]);
  const [todayMinutes, setTodayMinutes] = useState(0);
  const [dailyGoal, setDailyGoal] = useState(240); // 4 hours default
  const [isEditingGoal, setIsEditingGoal] = useState(false);
  
  // Manual Log State
  const [showManual, setShowManual] = useState(false);
  const [manualHours, setManualHours] = useState('0');
  const [manualMinutes, setManualMinutes] = useState('0');

  const [selectedDay, setSelectedDay] = useState<DailyData | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('rev_hist_v2');
    const savedGoal = localStorage.getItem('daily_goal');
    if (savedGoal) setDailyGoal(parseInt(savedGoal));

    let finalHistory: DailyData[] = [];

    if (saved) {
      finalHistory = JSON.parse(saved);
    } else {
      const legacy = localStorage.getItem('rev_hist');
      if (legacy) {
        const parsedLegacy = JSON.parse(legacy);
        finalHistory = parsedLegacy.map((d: any) => ({
          date: d.date,
          categories: { Revision: d.minutes || 0, Lectures: 0, Supervisions: 0 }
        }));
        localStorage.removeItem('rev_hist');
      }
    }

    const syncedHistory: DailyData[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const existing = finalHistory.find(h => h.date === dateStr);
      if (existing) {
        syncedHistory.push(existing);
      } else {
        syncedHistory.push({ 
          date: dateStr, 
          categories: { Revision: 0, Lectures: 0, Supervisions: 0 } 
        });
      }
    }

    setHistory(syncedHistory);
    updateTodayTotal(syncedHistory);
    localStorage.setItem('rev_hist_v2', JSON.stringify(syncedHistory));
  }, []);

  const updateTodayTotal = (hist: DailyData[]) => {
    const today = new Date().toISOString().split('T')[0];
    const entry = hist.find(d => d.date === today);
    if (entry) {
      const total = Object.values(entry.categories).reduce((a, b) => a + b, 0);
      setTodayMinutes(total);
    }
  };

  useEffect(() => {
    if (isActive) {
      timerRef.current = window.setInterval(() => setSeconds(s => s + 1), 1000);
    } else if (timerRef.current) clearInterval(timerRef.current);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isActive]);

  const addMinutes = (mins: number) => {
    const today = new Date().toISOString().split('T')[0];
    const next = [...history];
    let idx = next.findIndex(d => d.date === today);
    
    if (idx === -1) {
      next.push({ 
        date: today, 
        categories: { Revision: 0, Lectures: 0, Supervisions: 0 } 
      });
      idx = next.length - 1;
    }

    next[idx].categories[activeCategory] += mins;
    
    const syncedHistory: DailyData[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const existing = next.find(h => h.date === dateStr);
      if (existing) {
        syncedHistory.push(existing);
      } else {
        syncedHistory.push({ 
          date: dateStr, 
          categories: { Revision: 0, Lectures: 0, Supervisions: 0 } 
        });
      }
    }

    setHistory(syncedHistory);
    localStorage.setItem('rev_hist_v2', JSON.stringify(syncedHistory));
    updateTodayTotal(syncedHistory);
  };

  const handleManualAdd = () => {
    const totalMins = (parseInt(manualHours) || 0) * 60 + (parseInt(manualMinutes) || 0);
    if (totalMins > 0) {
      addMinutes(totalMins);
      setManualHours('0');
      setManualMinutes('0');
      setShowManual(false);
    }
  };

  const toggle = () => {
    if (isActive) {
      const mins = Math.floor(seconds / 60);
      if (mins > 0) addMinutes(mins);
      setIsActive(false);
      setSeconds(0);
    } else setIsActive(true);
  };

  const updateGoal = (g: number) => {
    setDailyGoal(g);
    localStorage.setItem('daily_goal', g.toString());
    setIsEditingGoal(false);
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
      <div className="user-id-label">bjc76</div>
      <header className="app-header">
        <h1 className="academic-title">Academic Tracker</h1>
        <div className="date-display">{new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}</div>
      </header>

      <div className="segmented-control">
        {CATEGORIES.map(c => (
          <button 
            key={c} 
            className={`segment-btn ${activeCategory === c ? 'active' : ''}`} 
            onClick={() => setActiveCategory(c)}
          >
            {c}
          </button>
        ))}
      </div>

      <main className="timer-section">
        <div className="timer-wrapper">
          <button className="timer-control-surface" onClick={toggle}>
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
          
          <button className="manual-log-btn" onClick={() => setShowManual(true)}>
            + Log
          </button>
        </div>
      </main>

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
          {isEditingGoal ? (
            <input 
              type="number" 
              className="goal-input"
              autoFocus
              onBlur={e => updateGoal(parseInt(e.target.value) || 240)}
              onKeyDown={e => e.key === 'Enter' && updateGoal(parseInt((e.target as HTMLInputElement).value) || 240)}
              defaultValue={dailyGoal}
            />
          ) : (
            <span className="goal-label" onClick={() => setIsEditingGoal(true)}>Goal: {Math.floor(dailyGoal / 60)}h</span>
          )}
        </div>
      </section>

      <footer className="history-section">
        <div className="chart-container">
          <ResponsiveContainer width="100%" height={50}>
            <BarChart 
              data={chartData} 
              onClick={(data: any) => {
                if (data && data.activePayload) {
                  setSelectedDay(data.activePayload[0].payload.raw);
                }
              }}
            >
              <Bar dataKey="total" radius={[2, 2, 0, 0]} minPointSize={4}>
                {chartData.map((_entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={index === chartData.length - 1 ? '#007AFF' : '#D0E3FF'} 
                    style={{ cursor: 'pointer' }}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="chart-labels">
          {chartData.map((d, i) => (
            <span key={i} className="chart-day-label">{d.day}</span>
          ))}
        </div>
      </footer>

      {/* Manual Log Popup */}
      {showManual && (
        <div className="ios-popup-overlay" onClick={() => setShowManual(false)}>
          <div className="ios-popup-card" onClick={e => e.stopPropagation()}>
            <div className="popup-header">
              <h3>Manual Log</h3>
              <button className="close-popup" onClick={() => setShowManual(false)}>×</button>
            </div>
            <div className="popup-body">
              <div className="picker-container">
                <div className="picker-column">
                  <input 
                    type="number" 
                    value={manualHours} 
                    onChange={e => setManualHours(e.target.value)}
                    className="picker-input"
                    min="0"
                    max="23"
                  />
                  <span className="picker-label">hrs</span>
                </div>
                <div className="picker-column">
                  <input 
                    type="number" 
                    value={manualMinutes} 
                    onChange={e => setManualMinutes(e.target.value)}
                    className="picker-input"
                    min="0"
                    max="59"
                  />
                  <span className="picker-label">min</span>
                </div>
              </div>
              <button onClick={handleManualAdd} className="ios-action-btn">Add to {activeCategory}</button>
            </div>
          </div>
        </div>
      )}

      {/* History Popup */}
      {selectedDay && (
        <div className="ios-popup-overlay" onClick={() => setSelectedDay(null)}>
          <div className="ios-popup-card" onClick={e => e.stopPropagation()}>
            <div className="popup-header">
              <h3>{new Date(selectedDay.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</h3>
              <button className="close-popup" onClick={() => setSelectedDay(null)}>×</button>
            </div>
            <div className="popup-body">
              <div className="popup-total-row">
                <span className="total-label">Total Pursuit</span>
                <span className="total-val">{Math.floor(Object.values(selectedDay.categories).reduce((a,b)=>a+b,0) / 60)}h {Object.values(selectedDay.categories).reduce((a,b)=>a+b,0) % 60}m</span>
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
