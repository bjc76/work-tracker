import React from 'react';
import './BeerGlass.css';

interface BeerGlassProps {
  progress: number; // 0 to 1
  isActive: boolean;
}

const BeerGlass: React.FC<BeerGlassProps> = ({ progress, isActive }) => {
  // progress 0 is empty, 1 is full
  // We want a little bit of foam at the top even when full
  const beerHeight = progress * 100;
  const foamHeight = progress > 0 ? Math.min(10, progress * 15) : 0;

  return (
    <div className="beer-glass-container">
      {/* Tiny Beer Tap */}
      <div className={`beer-tap ${isActive ? 'active' : ''}`}>
        <div className="tap-handle" />
        <div className="tap-nozzle" />
        {isActive && <div className="beer-stream" />}
      </div>

      <div className="glass-wrapper">
        <svg viewBox="0 0 100 150" className="glass-svg">
          <defs>
            <linearGradient id="beerGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" style={{ stopColor: '#fbbf24', stopOpacity: 1 }} />
              <stop offset="100%" style={{ stopColor: '#d97706', stopOpacity: 1 }} />
            </linearGradient>
          </defs>

          {/* Glass Outline */}
          <path 
            d="M20,10 L80,10 L75,140 Q75,145 70,145 L30,145 Q25,145 25,140 Z" 
            fill="rgba(255, 255, 255, 0.2)" 
            stroke="rgba(255, 255, 255, 0.5)" 
            strokeWidth="1"
          />

          {/* Beer Liquid */}
          <clipPath id="glassClip">
            <path d="M20,10 L80,10 L75,140 Q75,145 70,145 L30,145 Q25,145 25,140 Z" />
          </clipPath>

          <g clipPath="url(#glassClip)">
            <rect 
              x="0" 
              y={150 - (beerHeight * 1.35)} 
              width="100" 
              height={beerHeight * 1.35} 
              fill="url(#beerGradient)"
              className="beer-liquid"
            />
            
            {/* Foam / Head */}
            <rect 
              x="0" 
              y={150 - (beerHeight * 1.35) - foamHeight} 
              width="100" 
              height={foamHeight} 
              fill="#ffffff"
              className="beer-foam"
            />

            {/* Surface Movement / Swill */}
            {progress > 0 && (
              <path
                className={`beer-surface ${isActive ? 'pouring' : 'swilling'}`}
                d={`M0,${150 - (beerHeight * 1.35)} Q50,${150 - (beerHeight * 1.35) - (isActive ? 10 : 2)} 100,${150 - (beerHeight * 1.35)}`}
                fill="none"
                stroke="rgba(255,255,255,0.4)"
                strokeWidth="2"
              />
            )}

            {/* Bubbles */}
            {progress > 0 && isActive && (
              <g className="bubbles">
                <circle cx="40" cy="130" r="1" fill="white" opacity="0.6">
                  <animate attributeName="cy" from="130" to="20" dur="2s" repeatCount="indefinite" />
                  <animate attributeName="opacity" from="0.6" to="0" dur="2s" repeatCount="indefinite" />
                </circle>
                <circle cx="60" cy="120" r="1.5" fill="white" opacity="0.6">
                  <animate attributeName="cy" from="120" to="30" dur="2.5s" repeatCount="indefinite" />
                  <animate attributeName="opacity" from="0.6" to="0" dur="2.5s" repeatCount="indefinite" />
                </circle>
                <circle cx="50" cy="140" r="1" fill="white" opacity="0.6">
                  <animate attributeName="cy" from="140" to="10" dur="1.8s" repeatCount="indefinite" />
                  <animate attributeName="opacity" from="0.6" to="0" dur="1.8s" repeatCount="indefinite" />
                </circle>
              </g>
            )}
          </g>

          {/* Glass Reflection */}
          <path d="M25,20 L30,20 L28,130 Q28,135 32,135" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
        </svg>
      </div>
    </div>
  );
};

export default BeerGlass;
