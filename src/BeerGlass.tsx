import React, { useMemo, useRef, useEffect, useState } from 'react';
import './BeerGlass.css';

interface BeerGlassProps {
  progress: number; // 0 to 1
  isActive: boolean;
  seconds: number;
  onTap?: () => void;
}

const BeerGlass: React.FC<BeerGlassProps> = ({ progress, isActive, seconds, onTap }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
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

  const bubbles = useMemo(() => {
    return [...Array(8)].map((_, i) => ({
      id: i,
      cx: 25 + Math.random() * 50,
      r: 0.5 + Math.random() * 1.5,
      dur: 1.5 + Math.random() * 2,
      begin: Math.random() * 2
    }));
  }, []);

  // Fluid Simulation
  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    const particles: any[] = [];
    
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      if (isActive) {
        // Generate particles
        for (let i = 0; i < 3; i++) {
          particles.push({
            x: canvas.width / 2 + (Math.random() - 0.5) * 4,
            y: 0,
            vx: (Math.random() - 0.5) * 1,
            vy: 4 + Math.random() * 2,
            size: 3 + Math.random() * 3,
            life: 1
          });
        }
      }

      // Update and draw particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.01;

        const targetY = canvas.height - (beerHeight * (canvas.height / 100));
        
        if (p.y >= targetY) {
          p.life = 0; // "splashed"
        }

        if (p.life <= 0) {
          particles.splice(i, 1);
          continue;
        }

        ctx.fillStyle = `rgba(251, 191, 36, ${p.life})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        
        // Glow effect for stream
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#fbbf24';
      }

      animationFrameId = requestAnimationFrame(animate);
    };

    animate();
    return () => cancelAnimationFrame(animationFrameId);
  }, [isActive, beerHeight]);

  return (
    <div className="beer-glass-container">
      {/* Proper Beer Tap */}
      <div className={`beer-tap-pro ${isActive ? 'active' : ''}`} onClick={onTap}>
        <svg viewBox="0 0 100 120" className="tap-svg">
          <defs>
            <linearGradient id="tapMetalGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" style={{ stopColor: '#71717a', stopOpacity: 1 }} />
              <stop offset="30%" style={{ stopColor: '#e4e4e7', stopOpacity: 1 }} />
              <stop offset="60%" style={{ stopColor: '#a1a1aa', stopOpacity: 1 }} />
              <stop offset="100%" style={{ stopColor: '#3f3f46', stopOpacity: 1 }} />
            </linearGradient>
            <linearGradient id="tapHandleGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" style={{ stopColor: '#18181b', stopOpacity: 1 }} />
              <stop offset="100%" style={{ stopColor: '#000000', stopOpacity: 1 }} />
            </linearGradient>
            <filter id="tapShadow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur in="SourceAlpha" stdDeviation="2" />
              <feOffset dx="1" dy="2" result="offsetblur" />
              <feComponentTransfer>
                <feFuncA type="linear" slope="0.3" />
              </feComponentTransfer>
              <feMerge>
                <feMergeNode />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          
          {/* Mounting base */}
          <rect x="10" y="40" width="12" height="40" rx="2" fill="url(#tapMetalGradient)" filter="url(#tapShadow)" />
          
          {/* The Shank */}
          <rect x="22" y="50" width="15" height="15" fill="url(#tapMetalGradient)" />
          
          {/* Main Body / Faucet Body */}
          <path 
            d="M37,45 L65,45 Q75,45 75,55 L75,85 L60,85 L60,58 Q60,55 57,55 L37,55 Z" 
            fill="url(#tapMetalGradient)" 
            filter="url(#tapShadow)"
          />
          
          {/* Spout / Nozzle */}
          <rect x="62" y="85" width="10" height="15" rx="1" fill="#52525b" />
          <rect x="61" y="98" width="12" height="4" rx="1" fill="url(#tapMetalGradient)" />
          
          {/* Collar */}
          <rect x="42" y="42" width="6" height="20" rx="1" fill="#3f3f46" />

          {/* Handle Assembly */}
          <g className="tap-handle-group">
            {/* Pivot Point */}
            <circle cx="45" cy="45" r="7" fill="url(#tapMetalGradient)" />
            {/* Handle Rod */}
            <rect x="42" y="10" width="6" height="30" rx="3" fill="url(#tapHandleGradient)" />
            {/* Top Knob */}
            <circle cx="45" cy="8" r="10" fill="#09090b" />
            <circle cx="45" cy="8" r="4" fill="rgba(255,255,255,0.1)" />
          </g>
        </svg>

        {/* Fluid Canvas Overlay */}
        <canvas 
          ref={canvasRef} 
          width={40} 
          height={160} 
          className="fluid-canvas"
        />
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

          {/* Glass Outline */}
          <path 
            d="M15,5 L85,5 L78,140 Q77,148 70,148 L30,148 Q23,148 22,140 Z" 
            fill="rgba(255, 255, 255, 0.1)" 
            stroke="rgba(255, 255, 255, 0.3)" 
            strokeWidth="2"
          />

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
              fill="rgba(255, 255, 255, 0.4)"
              className="beer-foam-overlay"
            />

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

          <path d="M22,15 L28,15 L25,135 Q25,140 30,140" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="2" strokeLinecap="round" />
        </svg>

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
