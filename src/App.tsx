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
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('rev_hist');
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

  const toggle = () => {
    if (isActive) {
      const mins = Math.floor(seconds / 60);
      if (mins > 0) {
        const today = new Date().toISOString().split('T')[0];
        const next = [...history];
        const idx = next.findIndex(d => d.date === today);
        if (idx > -1) next[idx].minutes += mins;
        else next.push({ date: today, minutes: mins });
        const trimmed = next.slice(-7);
        setHistory(trimmed);
        localStorage.setItem('rev_hist', JSON.stringify(trimmed));
        setTodayMinutes(trimmed.find(d => d.date === today)?.minutes || 0);
      }
      setIsActive(false);
      setSeconds(0);
    } else setIsActive(true);
  };

  const format = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sc = s % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${sc.toString().padStart(2, '0')}`;
  };

  const radius = 100;
  const circ = 2 * Math.PI * radius;
  const off = circ - Math.min((seconds / 60) / 300, 1) * circ;
  const dProg = Math.min(todayMinutes / 240, 1);

  return (
    <div className="app-container">
      <header className="app-header">
        <h1 className="academic-title">Academic Pursuit</h1>
        <div className="date-display">{new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}</div>
      </header>

      <div className="category-scroller">
        {CATEGORIES.map(c => (
          <button key={c} className={`category-pill ${activeCategory === c ? 'active' : ''}`} onClick={() => setActiveCategory(c)}>{c}</button>
        ))}
      </div>

      <main className="timer-section">
        <div className="circular-timer-container">
          <svg className="timer-svg" viewBox="0 0 240 240">
            <circle className="timer-track" cx="120" cy="120" r={radius} strokeWidth="4" />
            <circle className="timer-progress" cx="120" cy="120" r={radius} strokeWidth="4" strokeDasharray={circ} style={{ strokeDashoffset: off }} strokeLinecap="round" />
          </svg>
          <div className="time-display-container">
            <div className="active-category-label">{activeCategory}</div>
            <div className="time-string">{format(seconds)}</div>
            <button className={`timer-action-btn ${isActive ? 'stop' : 'start'}`} onClick={toggle}>
              {isActive ? <Square size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
            </button>
          </div>
        </div>
      </main>

      <section className="progress-section">
        <div className="progress-labels">
          <span>Daily Progress</span>
          <span>{Math.round(dProg * 100)}%</span>
        </div>
        <div className="flat-progress-track">
          <div className="flat-progress-fill" style={{ width: `${dProg * 100}%` }} />
        </div>
        <div className="today-total">{Math.floor(todayMinutes / 60)}h {todayMinutes % 60}m completed</div>
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
