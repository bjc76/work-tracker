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
interface DailyData { date: string; minutes: number; }
const CATEGORIES: Category[] = ['Supervisions', 'Lectures', 'Revision'];

const App: React.FC = () => {
  const [activeCategory, setActiveCategory] = useState<Category>('Revision');
  const [seconds, setSeconds] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [history, setHistory] = useState<DailyData[]>([]);
  const [todayMinutes, setTodayMinutes] = useState(0);
  const [dailyGoal, setDailyGoal] = useState(240); // 4 hours default
  const [isEditingGoal, setIsEditingGoal] = useState(false);
  const [manualMinutes, setManualMinutes] = useState('');
  const [showManual, setShowManual] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('rev_hist');
    const savedGoal = localStorage.getItem('daily_goal');
    if (savedGoal) setDailyGoal(parseInt(savedGoal));

    if (saved) {
      const parsed = JSON.parse(saved);
      setHistory(parsed);
      const today = new Date().toISOString().split('T')[0];
      const entry = parsed.find((d: DailyData) => d.date === today);
      if (entry) setTodayMinutes(entry.minutes);
    } else {
      // Professional mock data for first launch
      const mock = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        mock.push({ 
          date: d.toISOString().split('T')[0], 
          minutes: i === 0 ? 0 : Math.floor(Math.random() * 180) + 60 
        });
      }
      setHistory(mock);
      localStorage.setItem('rev_hist', JSON.stringify(mock));
    }
  }, []);

  useEffect(() => {
    if (isActive) {
      timerRef.current = window.setInterval(() => setSeconds(s => s + 1), 1000);
    } else if (timerRef.current) clearInterval(timerRef.current);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isActive]);

  const addMinutes = (mins: number) => {
    const today = new Date().toISOString().split('T')[0];
    const next = [...history];
    const idx = next.findIndex(d => d.date === today);
    if (idx > -1) next[idx].minutes += mins;
    else next.push({ date: today, minutes: mins });
    const trimmed = next.slice(-7);
    setHistory(trimmed);
    localStorage.setItem('rev_hist', JSON.stringify(trimmed));
    setTodayMinutes(trimmed.find(d => d.date === today)?.minutes || 0);
  };

  const handleManualAdd = () => {
    const mins = parseInt(manualMinutes);
    if (!isNaN(mins) && mins > 0) {
      addMinutes(mins);
      setManualMinutes('');
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
  const off = circ - Math.min((seconds / 60) / 300, 1) * circ;
  const dProg = Math.min(todayMinutes / dailyGoal, 1);

  return (
    <div className="app-container">
      <header className="app-header">
        <h1 className="academic-title">Academic tracker</h1>
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
          
          <button className="manual-log-btn" onClick={() => setShowManual(!showManual)}>
            {showManual ? 'Cancel' : '+ Log minutes'}
          </button>
        </div>
      </main>

      {showManual && (
        <div className="manual-input-bar">
          <input 
            type="number" 
            placeholder="Min" 
            value={manualMinutes} 
            onChange={e => setManualMinutes(e.target.value)}
            className="manual-input"
          />
          <button onClick={handleManualAdd} className="add-btn">Add</button>
        </div>
      )}

      <section className="progress-section">
        <div className="progress-labels">
          <span>Daily Progress</span>
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
            <span className="progress-value" onClick={() => setIsEditingGoal(true)}>{Math.round(dProg * 100)}%</span>
          )}
        </div>
        <div className="flat-progress-track">
          <div className="flat-progress-fill" style={{ width: `${dProg * 100}%` }} />
        </div>
        <div className="today-total-row">
          <span className="today-total">{Math.floor(todayMinutes / 60)}h {todayMinutes % 60}m completed</span>
          <span className="goal-label" onClick={() => setIsEditingGoal(true)}>Goal: {Math.floor(dailyGoal / 60)}h</span>
        </div>
      </section>

      <footer className="history-section">
        <div className="chart-container">
          <ResponsiveContainer width="100%" height={50}>
            <BarChart data={history.map(d => ({ d: new Date(d.date).toLocaleDateString('en-US', { weekday: 'narrow' }), m: d.minutes }))}>
              <Bar dataKey="m" radius={[2, 2, 0, 0]}>
                {history.map((_, i) => <Cell key={i} fill={i === history.length - 1 ? '#007AFF' : '#D0E3FF'} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </footer>
    </div>
  );
};

export default App;
