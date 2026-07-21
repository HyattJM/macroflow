import React, { useRef, useEffect } from 'react';

const GalagaBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

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

    // Load authentic separate PNG images
    const alienImages: HTMLImageElement[] = [];
    let loadedCount = 0;
    
    ['/alien1.png', '/alien2.png', '/alien3.png'].forEach((src) => {
      const img = new Image();
      img.src = src;
      img.onload = () => {
        loadedCount++;
      };
      alienImages.push(img);
    });

    // Starfield
    const stars = Array.from({ length: 150 }).map(() => ({
      x: Math.random() * width,
      y: Math.random() * height,
      size: Math.random() * 2,
      speed: Math.random() * 1.5 + 0.2
    }));
    
    // Alien Setup
    interface Alien {
      x: number;
      y: number;
      type: 'dive' | 'sine';
      speed: number;
      offsetX: number;
      spriteIndex: number; // To pick different aliens from sheet
      scale: number;
    }
    const aliens: Alien[] = [];
    let frameCount = 0;

    const spawnAlien = () => {
      const type = Math.random() > 0.5 ? 'dive' : 'sine';
      const startX = Math.random() * (width - 200) + 100;
      const speed = Math.random() * 1.5 + 1;
      const offsetX = Math.random() * Math.PI * 2;
      // 0, 1, 2 = Red, Green, Blue sprites we generated
      const spriteIndex = Math.floor(Math.random() * 3); 
      
      const squadSize = Math.floor(Math.random() * 2) + 3; // 3 or 4
      
      for (let i = 0; i < squadSize; i++) {
        aliens.push({
          x: startX + (i * 40), // Spacing
          y: -50 - (i * 30), // V-formation delay
          type,
          speed,
          offsetX,
          spriteIndex,
          scale: 2
        });
      }
    };

    let animationId: number;
    const render = () => {
      // Dark slate background
      ctx.fillStyle = '#0a0a0f';
      ctx.fillRect(0, 0, width, height);

      // Parallax Stars
      ctx.fillStyle = '#64748b';
      for (const star of stars) {
        star.y += star.speed;
        if (star.y > height) {
          star.y = 0;
          star.x = Math.random() * width;
        }
        ctx.fillRect(star.x, star.y, star.size, star.size);
      }

      // Spawner
      frameCount++;
      if (frameCount % 120 === 0) {
        spawnAlien();
      }

      // Render Aliens
      for (let i = aliens.length - 1; i >= 0; i--) {
        const a = aliens[i];
        
        if (a.type === 'sine') {
          a.y += a.speed;
          a.x += Math.sin(a.y * 0.05 + a.offsetX) * 2;
        } else {
          a.y += a.speed * 1.5;
        }

        if (loadedCount === 3) {
          const img = alienImages[a.spriteIndex];
          const sWidth = 8;
          const sHeight = 8;
          
          ctx.drawImage(
            img,
            0, 0, sWidth, sHeight,
            a.x - (sWidth * a.scale)/2, a.y - (sHeight * a.scale)/2,
            sWidth * a.scale, sHeight * a.scale
          );
        } else {
          // Fallback if image fails to load
          ctx.fillStyle = '#ef4444';
          ctx.fillRect(a.x - 10, a.y - 10, 20, 20);
        }

        if (a.y > height + 50) {
          aliens.splice(i, 1);
        }
      }

      animationId = requestAnimationFrame(render);
    };

    animationId = requestAnimationFrame(render);

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationId);
    };
  }, []);

  return (
    <canvas 
      ref={canvasRef} 
      className="fixed top-0 left-0 w-full h-full z-0 pointer-events-none" 
    />
  );
};

export default GalagaBackground;
