import React, { useRef, useEffect } from 'react';

// Entity definitions
interface Player {
  x: number;
  y: number;
  width: number;
  height: number;
  speed: number;
  color: string;
}

interface Projectile {
  x: number;
  y: number;
  width: number;
  height: number;
  speed: number;
  color: string;
  owner: 'player' | 'enemy';
}

const MicroRPGCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>();
  
  // Game state
  const playerRef = useRef<Player>({
    x: window.innerWidth / 2 - 20,
    y: window.innerHeight / 2 - 20,
    width: 40,
    height: 40,
    speed: 5,
    color: '#34d399' // Emerald 400
  });

  const projectilesRef = useRef<Projectile[]>([]);
  const lastFiredRef = useRef<number>(0);
  const FIRE_COOLDOWN_MS = 250;

  const keys = useRef<{ [key: string]: boolean }>({});

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { 
      keys.current[e.key.toLowerCase()] = true; 
      if (e.key === ' ') keys.current['space'] = true; 
    };
    const handleKeyUp = (e: KeyboardEvent) => { 
      keys.current[e.key.toLowerCase()] = false; 
      if (e.key === ' ') keys.current['space'] = false; 
    };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas(); 

    const renderLoop = () => {
      const p = playerRef.current;
      const now = Date.now();

      // Physics/Movement
      if (keys.current['w'] || keys.current['arrowup']) p.y -= p.speed;
      if (keys.current['s'] || keys.current['arrowdown']) p.y += p.speed;
      if (keys.current['a'] || keys.current['arrowleft']) p.x -= p.speed;
      if (keys.current['d'] || keys.current['arrowright']) p.x += p.speed;

      // Bounds
      if (p.x < 0) p.x = 0;
      if (p.y < 0) p.y = 0;
      if (p.x + p.width > canvas.width) p.x = canvas.width - p.width;
      if (p.y + p.height > canvas.height) p.y = canvas.height - p.height;

      // Firing
      if (keys.current['space'] && now - lastFiredRef.current >= FIRE_COOLDOWN_MS) {
        lastFiredRef.current = now;
        projectilesRef.current.push({
          x: p.x + p.width / 2 - 4,
          y: p.y - 15,
          width: 8,
          height: 16,
          speed: 10,
          color: '#fbbf24',
          owner: 'player'
        });
      }

      for (let i = projectilesRef.current.length - 1; i >= 0; i--) {
        const proj = projectilesRef.current[i];
        proj.y -= proj.speed; 
        if (proj.y + proj.height < 0) projectilesRef.current.splice(i, 1);
      }

      // 5. Render
      // CRITICAL: We clearRect instead of fillRect so we can see the Galaga Background through this layer!
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw Grid (Semi-transparent retro grid)
      ctx.strokeStyle = 'rgba(30, 41, 59, 0.4)'; 
      ctx.lineWidth = 1;
      for(let x = 0; x < canvas.width; x += 40) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
      }
      for(let y = 0; y < canvas.height; y += 40) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
      }

      // Draw Projectiles
      for (const proj of projectilesRef.current) {
        ctx.fillStyle = proj.color;
        ctx.fillRect(proj.x, proj.y, proj.width, proj.height);
      }

      // Draw Player
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, p.width, p.height);

      requestRef.current = requestAnimationFrame(renderLoop);
    };

    requestRef.current = requestAnimationFrame(renderLoop);

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, []);

  return (
    <canvas 
      ref={canvasRef} 
      className="block w-full h-full relative z-30 pointer-events-auto outline-none bg-transparent" 
      tabIndex={0}
    />
  );
};

export default MicroRPGCanvas;
