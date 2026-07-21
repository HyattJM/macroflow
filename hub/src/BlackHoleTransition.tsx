import React, { useRef, useEffect } from 'react';

interface BlackHoleTransitionProps {
  isOpen: boolean;
  onTransitionComplete?: () => void;
}

const BlackHoleTransition: React.FC<BlackHoleTransitionProps> = ({ isOpen, onTransitionComplete }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>();
  
  // Animation state: 0 = idle, 1 = growing, 2 = peak (black screen), 3 = receding
  const animState = useRef(0);
  const progress = useRef(0);
  const targetProgress = useRef(0);
  const hasTriggeredComplete = useRef(false);
  
  // Use a ref for the callback so the render loop always has the freshest function
  // without needing to restart the canvas on every re-render.
  const onCompleteRef = useRef(onTransitionComplete);
  useEffect(() => {
    onCompleteRef.current = onTransitionComplete;
  }, [onTransitionComplete]);

  useEffect(() => {
    if (isOpen) {
      animState.current = 1;
      targetProgress.current = 1; // Grow to 1
      hasTriggeredComplete.current = false;
      if (canvasRef.current) {
        canvasRef.current.className = "fixed top-0 left-0 w-full h-full z-50 opacity-100 pointer-events-auto transition-opacity duration-300";
      }
    } else if (!isOpen && animState.current > 0) {
      animState.current = 3;
      targetProgress.current = 0; // Recede to 0
    }
  }, [isOpen]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = window.innerWidth;
    let height = window.innerHeight;
    
    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width;
      canvas.height = height;
    };
    window.addEventListener('resize', resize);
    resize();

    // Particle system for accretion disk
    interface Particle {
      angle: number;
      radius: number;
      speed: number;
      size: number;
      color: string;
    }
    const particles: Particle[] = [];
    const colors = ['#8b5cf6', '#6366f1', '#3b82f6', '#1e1b4b', '#f472b6']; // Cosmic colors
    
    for (let i = 0; i < 400; i++) {
      particles.push({
        angle: Math.random() * Math.PI * 2,
        radius: Math.random() * Math.max(width, height),
        speed: 0.02 + Math.random() * 0.05,
        size: Math.random() * 3 + 1,
        color: colors[Math.floor(Math.random() * colors.length)]
      });
    }

    const renderLoop = () => {
      // Update progress smoothly (easing)
      const diff = targetProgress.current - progress.current;
      progress.current += diff * 0.04; 

      // Handle Peak
      if (animState.current === 1 && progress.current > 0.98) {
        progress.current = 1;
        animState.current = 2; // Peak
        if (onCompleteRef.current && !hasTriggeredComplete.current) {
          hasTriggeredComplete.current = true;
          onCompleteRef.current(); // Trigger callback!
        }
      }
      
      // Handle Idle
      if (animState.current === 3 && progress.current < 0.01) {
        progress.current = 0;
        animState.current = 0; // Idle
        if (canvasRef.current) {
          canvasRef.current.className = "fixed top-0 left-0 w-full h-full z-50 opacity-0 pointer-events-none transition-opacity duration-300";
        }
      }

      // If completely idle, don't clear or draw (keep transparent)
      if (animState.current === 0 && progress.current === 0) {
        ctx.clearRect(0, 0, width, height);
        requestRef.current = requestAnimationFrame(renderLoop);
        return;
      }

      // Render
      ctx.clearRect(0, 0, width, height);
      
      const centerX = width / 2;
      const centerY = height / 2;
      
      // The max radius needed to cover the entire screen from the center
      const maxRadius = Math.sqrt(centerX * centerX + centerY * centerY) * 1.2; 
      const currentRadius = maxRadius * progress.current;

      // 1. Draw gravitational lensing/glow background (opacity based on progress)
      ctx.fillStyle = `rgba(15, 23, 42, ${progress.current * 0.9})`; // slate-900 tint
      ctx.fillRect(0, 0, width, height);

      // 2. Draw swirling accretion disk (particles)
      ctx.save();
      ctx.translate(centerX, centerY);
      
      for (const p of particles) {
        p.angle += p.speed;
        
        // Particles get pulled inward as the black hole grows
        let pull = p.radius - (p.radius * progress.current * 0.95); 
        
        const px = Math.cos(p.angle) * pull;
        const py = Math.sin(p.angle) * pull;

        ctx.beginPath();
        ctx.arc(px, py, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        
        // Fade out particles as they get close to center or as progress peaks
        ctx.globalAlpha = Math.max(0, (1 - progress.current) * 0.8 + 0.2); 
        ctx.fill();
      }
      ctx.restore();

      // 3. Draw Event Horizon (The Black Hole)
      if (currentRadius > 0) {
        ctx.beginPath();
        ctx.arc(centerX, centerY, currentRadius, 0, Math.PI * 2);
        
        // Glow effect around the black hole
        ctx.shadowBlur = 60 * progress.current;
        ctx.shadowColor = '#8b5cf6'; // Purple glow
        ctx.fillStyle = '#000000'; // Pure black
        ctx.fill();
        
        // Secondary inner glow (accretion disk edge)
        ctx.beginPath();
        ctx.arc(centerX, centerY, currentRadius * 1.05, 0, Math.PI * 2);
        ctx.lineWidth = 2 + (15 * progress.current);
        ctx.strokeStyle = `rgba(99, 102, 241, ${progress.current})`; // Indigo glow
        ctx.stroke();
      }
      
      // Reset shadow for next frame
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;

      requestRef.current = requestAnimationFrame(renderLoop);
    };

    requestRef.current = requestAnimationFrame(renderLoop);

    return () => {
      window.removeEventListener('resize', resize);
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, []); // Remove onTransitionComplete from dependencies!

  // Initialize with pointer-events-none so it doesn't block initially
  return (
    <canvas 
      ref={canvasRef} 
      className={`fixed top-0 left-0 w-full h-full z-50 transition-opacity duration-300 ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`} 
    />
  );
};

export default BlackHoleTransition;
