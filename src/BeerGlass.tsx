import React, { useMemo } from 'react';
import './BeerGlass.css';

interface BeerGlassProps {
  progress: number; // 0 to 1
  isActive: boolean;
  seconds: number;
}

const BeerGlass: React.FC<BeerGlassProps> = ({ progress, isActive, seconds }) => {
  // progress 0 is empty, 1 is full
  // We want a little bit of foam at the top even when full
  const beerHeight = progress * 100;
  const foamHeight = progress > 0 ? Math.min(15, 5 + progress * 15) : 0;
  
  const formatTime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sc = s % 60;
    return {
      h: h.toString().padStart(2, '0'),
      m: m.toString().padStart(2, '0'),
      s: sc.toString().padStart(2, '0')
    };
  };

  const time = formatTime(seconds);

  // Memoize bubbles to avoid Math.random() in render (react-hooks/purity)
  const bubbles = useMemo(() => {
    return [...Array(8)].map((_, i) => ({
      id: i,
      cx: 25 + Math.random() * 50,
      r: 0.5 + Math.random() * 1.5,
      dur: 1.5 + Math.random() * 2,
      begin: Math.random() * 2
    }));
  }, []);

  return (
    <div className="beer-glass-container">
      {/* Aesthetic Beer Tap */}
      <div className={`beer-tap-pro ${isActive ? 'active' : ''}`}>
        <svg viewBox="0 0 60 60" className="tap-svg">
          <defs>
            <linearGradient id="metalGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" style={{ stopColor: '#9ca3af', stopOpacity: 1 }} />
              <stop offset="50%" style={{ stopColor: '#f3f4f6', stopOpacity: 1 }} />
              <stop offset="100%" style={{ stopColor: '#4b5563', stopOpacity: 1 }} />
            </linearGradient>
            <linearGradient id="handleGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" style={{ stopColor: '#1f2937', stopOpacity: 1 }} />
              <stop offset="100%" style={{ stopColor: '#000000', stopOpacity: 1 }} />
            </linearGradient>
          </defs>
          
          {/* Base/Wall attachment */}
          <rect x="0" y="20" width="10" height="20" rx="2" fill="url(#metalGradient)" />
          
          {/* Main pipe */}
          <path d="M10,25 L35,25 Q45,25 45,35 L45,45" fill="none" stroke="url(#metalGradient)" strokeWidth="8" strokeLinecap="round" />
          
          {/* Nozzle end */}
          <rect x="40" y="42" width="10" height="6" rx="1" fill="url(#metalGradient)" />
          
          {/* Handle Base */}
          <circle cx="25" cy="25" r="5" fill="url(#metalGradient)" />
          
          {/* Handle */}
          <g className="tap-handle-group">
            <rect x="22" y="5" width="6" height="20" rx="3" fill="url(#handleGradient)" />
            <circle cx="25" cy="5" r="4" fill="#111827" />
          </g>
        </svg>
        {isActive && (
          <div className="beer-stream-container">
            <div className="beer-stream-main" />
            <div className="beer-stream-glow" />
            <div className="beer-stream-bubbles" />
          </div>
        )}
      </div>

      <div className="glass-wrapper">
        <svg viewBox="0 0 100 150" className="glass-svg">
          <defs>
            <linearGradient id="beerGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" style={{ stopColor: '#f59e0b', stopOpacity: 1 }} />
              <stop offset="50%" style={{ stopColor: '#fbbf24', stopOpacity: 1 }} />
              <stop offset="100%" style={{ stopColor: '#d97706', stopOpacity: 1 }} />
            </linearGradient>
            <filter id="foamGlow">
              <feGaussianBlur stdDeviation="1.5" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Glass Outline - More Stylish Shape */}
          <path 
            d="M15,5 L85,5 L78,140 Q77,148 70,148 L30,148 Q23,148 22,140 Z" 
            fill="rgba(255, 255, 255, 0.15)" 
            stroke="rgba(255, 255, 255, 0.4)" 
            strokeWidth="1.5"
          />

          {/* Beer Liquid */}
          <clipPath id="glassClip">
            <path d="M15,5 L85,5 L78,140 Q77,148 70,148 L30,148 Q23,148 22,140 Z" />
          </clipPath>

          <g clipPath="url(#glassClip)">
            <rect 
              x="0" 
              y={150 - (beerHeight * 1.4)} 
              width="100" 
              height={beerHeight * 1.4} 
              fill="url(#beerGradient)"
              className="beer-liquid"
            />
            
            {/* Foam / Head - Layered for better look */}
            <rect 
              x="0" 
              y={150 - (beerHeight * 1.4) - foamHeight} 
              width="100" 
              height={foamHeight} 
              fill="#ffffff"
              className="beer-foam"
            />
            <rect 
              x="0" 
              y={150 - (beerHeight * 1.4) - (foamHeight * 0.7)} 
              width="100" 
              height={foamHeight * 0.7} 
              fill="rgba(255, 255, 255, 0.5)"
              className="beer-foam-overlay"
            />

            {/* Surface Movement / Wave */}
            {progress > 0 && (
              <g className={`beer-surface-group ${isActive ? 'pouring' : 'swilling'}`}>
                <path
                  className="beer-surface-wave"
                  d={`M-10,${150 - (beerHeight * 1.4)} Q25,${150 - (beerHeight * 1.4) - (isActive ? 8 : 4)} 50,${150 - (beerHeight * 1.4)} T110,${150 - (beerHeight * 1.4)}`}
                  fill="none"
                  stroke="rgba(255,255,255,0.6)"
                  strokeWidth="2"
                />
              </g>
            )}

            {/* Bubbles - Stable via memoization */}
            {progress > 0 && (
              <g className="bubbles-group">
                {bubbles.map((b) => (
                  <circle key={b.id} cx={b.cx} cy="140" r={b.r} fill="white" opacity="0.4">
                    <animate attributeName="cy" from="140" to={150 - (beerHeight * 1.4)} dur={`${b.dur}s`} repeatCount="indefinite" begin={`${b.begin}s`} />
                    <animate attributeName="opacity" values="0;0.6;0" dur={`${b.dur}s`} repeatCount="indefinite" begin={`${b.begin}s`} />
                  </circle>
                ))}
              </g>
            )}
          </g>

          {/* Glass Reflection */}
          <path d="M22,15 L28,15 L25,135 Q25,140 30,140" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="2" strokeLinecap="round" />
          <path d="M78,20 L75,20 L72,60" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1" strokeLinecap="round" />
        </svg>

        {/* Vertical Timer Overlay */}
        <div className="vertical-timer">
          <div className="timer-unit">
            <span className="timer-val">{time.h}</span>
            <span className="timer-label">H</span>
          </div>
          <div className="timer-unit">
            <span className="timer-val">{time.m}</span>
            <span className="timer-label">M</span>
          </div>
          <div className="timer-unit">
            <span className="timer-val">{time.s}</span>
            <span className="timer-label">S</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BeerGlass;
