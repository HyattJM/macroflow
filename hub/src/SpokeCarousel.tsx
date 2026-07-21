import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const APPS = [
  {
    id: 'portfolio',
    title: 'Developer Portfolio',
    description: 'Input -> Reality. The core showcase of active projects and execution history.',
    icon: '💻',
    color: 'emerald-400',
    shadow: 'rgba(52,211,153,0.3)',
    path: '/portfolio'
  },
  {
    id: 'logic-layer',
    title: 'Logic Layer Supply',
    description: 'E-commerce utility catalog & micro-SaaS agency.',
    icon: '⚙️',
    color: 'indigo-400',
    shadow: 'rgba(129,140,248,0.3)',
    path: '/logic-layer'
  },
  {
    id: 'metrix',
    title: 'Metrix Platform',
    description: 'Comprehensive health and fitness tracking system with integrated AI macro analysis.',
    icon: '📊',
    color: 'cyan-400',
    shadow: 'rgba(34,211,238,0.3)',
    path: '/metrix'
  },
  {
    id: 'movie-app',
    title: 'Movie App',
    description: 'React cinematic interface. Live local deployment loaded directly from GitHub source.',
    icon: '🎬',
    color: 'red-500',
    shadow: 'rgba(239,68,68,0.3)',
    path: '/movie-app'
  },
  {
    id: 'discord-bot',
    title: 'Discord Bot Dashboard',
    description: 'Autonomous systems controller and ops monitoring.',
    icon: '🤖',
    color: 'blue-500',
    shadow: 'rgba(59,130,246,0.3)',
    path: '/bot-dashboard'
  },
  {
    id: 'return-automator',
    title: 'Return Automator',
    description: 'Automated reverse logistics and RMA handling. Live production system.',
    icon: '📦',
    color: 'orange-500',
    shadow: 'rgba(249,115,22,0.3)',
    path: '/return-automator'
  }
];

interface SpokeCarouselProps {
  triggerWarpTo: (path: string) => void;
}

const SpokeCarousel: React.FC<SpokeCarouselProps> = ({ triggerWarpTo }) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const totalItems = APPS.length;
  const radius = 450; // Z-translation distance for the 3D cylinder
  const angle = 360 / totalItems;

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % totalItems);
    }, 6000);
    return () => clearInterval(timer);
  }, [totalItems]);

  const handleDragEnd = (e: any, { offset }: any) => {
    const swipe = offset.x;
    if (swipe < -50) {
      setActiveIndex((prev) => (prev + 1) % totalItems);
    } else if (swipe > 50) {
      setActiveIndex((prev) => (prev - 1 + totalItems) % totalItems);
    }
  };

  const getCardStyle = (index: number) => {
    // Calculate shortest distance in a circular array
    let diff = (index - activeIndex) % totalItems;
    if (diff > totalItems / 2) diff -= totalItems;
    if (diff < -totalItems / 2) diff += totalItems;

    const isActive = diff === 0;

    return {
      rotateY: diff * angle,
      translateZ: radius,
      opacity: isActive ? 1 : 0.85, // Keep all cards highly visible
      scale: isActive ? 1 : 0.85,
      filter: isActive ? 'blur(0px)' : 'blur(0px)', // Remove blur so they are completely legible
      zIndex: isActive ? 10 : 5 - Math.abs(diff),
    };
  };

  const activeApp = APPS[activeIndex];

  return (
    <div className="relative w-full h-[50vh] min-h-[500px] flex flex-col items-center justify-center overflow-visible perspective-[1200px] mt-10">
      
      {/* Background Ambient Glow */}
      <div 
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full blur-[120px] opacity-20 pointer-events-none transition-colors duration-1000"
        style={{ backgroundColor: activeApp.shadow.replace('0.3', '1') }}
      />

      {/* 3D Spoke Container */}
      <div className="relative w-[300px] h-[400px]" style={{ transformStyle: 'preserve-3d' }}>
        <motion.div 
          className="absolute w-full h-full cursor-grab active:cursor-grabbing"
          style={{ transformStyle: 'preserve-3d' }}
          animate={{ rotateY: -activeIndex * angle }}
          transition={{ type: 'spring', stiffness: 50, damping: 20, mass: 1.5 }}
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.2}
          onDragEnd={handleDragEnd}
        >
          {APPS.map((app, index) => {
            const style = getCardStyle(index);
            const isActive = index === activeIndex;

            return (
              <motion.div
                key={app.id}
                className="absolute top-1/2 left-1/2 w-[280px] h-[360px] -mt-[180px] -ml-[140px] rounded-2xl flex flex-col items-center justify-center transition-all duration-700"
                style={{
                  transformStyle: 'preserve-3d',
                  // The physical rotation and push out from the center
                  transform: `rotateY(${style.rotateY}deg) translateZ(${style.translateZ}px)`,
                  opacity: style.opacity,
                  filter: style.filter,
                  zIndex: style.zIndex,
                }}
                animate={{ scale: style.scale }}
                transition={{ duration: 0.7 }}
                onClick={() => {
                  if (!isActive) {
                    setActiveIndex(index);
                  } else {
                    triggerWarpTo(app.path);
                  }
                }}
              >
                {/* The visual card itself */}
                <div 
                  className={`w-full h-full rounded-2xl border flex flex-col items-center justify-center bg-zinc-950/80 backdrop-blur-xl transition-all duration-700 shadow-2xl ${isActive ? 'border-' + app.color.split('-')[0] + '-500 cursor-pointer hover:bg-zinc-900/90' : 'border-zinc-800'}`}
                  style={{
                    boxShadow: isActive ? `0 0 40px ${app.shadow}` : 'none',
                    // The glossy floor reflection
                    WebkitBoxReflect: isActive ? 'below 2px linear-gradient(transparent 70%, rgba(0,0,0,0.5))' : 'none'
                  }}
                >
                  <div className="text-8xl mb-6 drop-shadow-2xl">{app.icon}</div>
                  <h3 className="text-xl font-bold text-white text-center px-4 font-heading">{app.title}</h3>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      </div>

      {/* Decoupled Text Description */}
      <div className="absolute bottom-[-20px] w-full max-w-xl mx-auto text-center h-24 flex flex-col items-center justify-center z-20 pointer-events-none">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeIndex}
            initial={{ opacity: 0, y: 10, filter: 'blur(4px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -10, filter: 'blur(4px)' }}
            transition={{ duration: 0.3 }}
            className="flex flex-col gap-2"
          >
            <h2 className={`text-3xl font-bold font-heading tracking-widest uppercase`} style={{ color: activeApp.shadow.replace('0.3', '1') }}>
              {activeApp.title}
            </h2>
            <p className="text-zinc-400 text-sm font-sans tracking-wide">
              {activeApp.description}
            </p>
          </motion.div>
        </AnimatePresence>
      </div>

    </div>
  );
};

export default SpokeCarousel;
