import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReadmeModal from './ReadmeModal';

const APPS = [
  {
    id: 'portfolio',
    title: 'Developer Portfolio',
    description: 'Input -> Reality. The core showcase of active projects and execution history.',
    icon: '💻',
    color: 'emerald-400',
    shadow: 'rgba(52,211,153,0.3)',
    externalUrl: 'https://github.com/HyattJM'
  },
  {
    id: 'logic-layer',
    title: 'Logic Layer Supply',
    description: 'E-commerce utility catalog & micro-SaaS agency.',
    icon: '⚙️',
    color: 'indigo-400',
    shadow: 'rgba(129,140,248,0.3)',
    externalUrl: 'https://github.com/HyattJM/logic-layer'
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
    externalUrl: 'https://github.com/HyattJM/discord-bot'
  },
  {
    id: 'return-automator',
    title: 'Return Automator',
    description: 'Automated reverse logistics and RMA handling. Live production system.',
    icon: '📦',
    color: 'orange-500',
    shadow: 'rgba(249,115,22,0.3)',
    path: '/return-automator'
  },
  {
    id: 'rare-finds',
    title: 'Rare Finds Bookstore',
    description: 'Boutique e-commerce platform for unique literary discoveries.',
    icon: '📚',
    color: 'amber-500',
    shadow: 'rgba(245,158,11,0.3)',
    externalUrl: 'https://github.com/HyattJM/CS491-Bookstore-Product'
  }
];

interface SpokeCarouselProps {
  triggerWarpTo: (path: string) => void;
}

const SpokeCarousel: React.FC<SpokeCarouselProps> = ({ triggerWarpTo }) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [appsList, setAppsList] = useState(APPS);
  const [selectedApp, setSelectedApp] = useState<any>(null);
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 768 : false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  useEffect(() => {
    fetch('https://api.github.com/users/HyattJM/repos?sort=updated&per_page=50')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          const newApps = [...APPS];
          const existingUrls = new Set(APPS.map(a => a.externalUrl));
          const existingTitles = new Set(APPS.map(a => a.title.toLowerCase()));
          
          const ICONS = ['📦', '⚡', '🔥', '✨', '🌟', '🚀', '🔮', '🧬'];
          const COLORS = ['emerald', 'cyan', 'blue', 'indigo', 'violet', 'fuchsia', 'rose', 'orange', 'amber'];
          
          data.forEach(repo => {
            if (!existingUrls.has(repo.html_url) && !existingTitles.has(repo.name.toLowerCase())) {
              const randColor = COLORS[Math.floor(Math.random() * COLORS.length)];
              let shadow = 'rgba(255,255,255,0.3)';
              if (randColor === 'emerald') shadow = 'rgba(52,211,153,0.3)';
              else if (randColor === 'cyan') shadow = 'rgba(34,211,238,0.3)';
              else if (randColor === 'blue') shadow = 'rgba(59,130,246,0.3)';
              else if (randColor === 'indigo') shadow = 'rgba(129,140,248,0.3)';
              else if (randColor === 'violet') shadow = 'rgba(167,139,250,0.3)';
              else if (randColor === 'fuchsia') shadow = 'rgba(232,121,249,0.3)';
              else if (randColor === 'rose') shadow = 'rgba(251,113,133,0.3)';
              else if (randColor === 'orange') shadow = 'rgba(249,115,22,0.3)';
              else if (randColor === 'amber') shadow = 'rgba(251,191,36,0.3)';

              newApps.push({
                id: repo.name,
                title: repo.name,
                description: repo.description || 'GitHub Repository uplink.',
                icon: ICONS[Math.floor(Math.random() * ICONS.length)],
                color: `${randColor}-500`,
                shadow: shadow,
                externalUrl: repo.html_url
              });
            }
          });
          setAppsList(newApps);
        }
      })
      .catch(console.error);
  }, []);

  const totalItems = appsList.length;

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % totalItems);
    }, 8000); // Slower auto-scroll so you can read the deck
    return () => clearInterval(timer);
  }, [totalItems]);

  const wheelTimer = useRef<number>(0);

  const handleDragEnd = (e: any, { offset, velocity }: any) => {
    // Calculate how many cards to jump based on distance + speed
    const momentum = offset.x + (velocity.x * 0.2); 
    const jump = Math.round(momentum / -120); // About 120px momentum per card shift
    
    if (Math.abs(jump) > 0) {
      setActiveIndex((prev) => {
        let next = prev + jump;
        // Handle wrap around for negative numbers
        while (next < 0) next += totalItems;
        return next % totalItems;
      });
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    const now = Date.now();
    if (now - wheelTimer.current < 40) return; // throttle wheel events
    wheelTimer.current = now;

    if (e.deltaX > 20 || e.deltaY > 20) {
      setActiveIndex((prev) => (prev + 1) % totalItems);
    } else if (e.deltaX < -20 || e.deltaY < -20) {
      setActiveIndex((prev) => (prev - 1 + totalItems) % totalItems);
    }
  };

  const getCardStyle = (index: number) => {
    // Calculate shortest distance in a circular array
    let diff = (index - activeIndex) % totalItems;
    if (diff > totalItems / 2) diff -= totalItems;
    if (diff < -totalItems / 2) diff += totalItems;

    const isActive = diff === 0;
    
    // Spread them out horizontally into a fanned stack (a deck of cards)
    // Tighter overlap (70px desktop, 45px mobile)
    const xOffset = diff * (isMobile ? 45 : 70); 
    const yOffset = Math.abs(diff) * (isMobile ? 10 : 15); // arch downwards slightly
    const rotation = diff * (isMobile ? 3 : 4); // degrees fan

    return {
      x: xOffset,
      y: yOffset,
      rotateZ: rotation,
      scale: isActive ? 1.05 : Math.max(0.7, 1 - Math.abs(diff) * 0.08),
      zIndex: 100 - Math.abs(diff),
      opacity: isActive ? 1 : Math.max(0, 1 - Math.abs(diff) * 0.1),
    };
  };

  const activeApp = appsList[activeIndex];

  return (
    <div className="relative w-full h-[55vh] md:h-[65vh] min-h-[450px] md:min-h-[600px] flex flex-col items-center justify-center overflow-visible mt-4 mb-16">
      
      {/* Background Ambient Glow */}
      <div 
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full blur-[150px] opacity-25 pointer-events-none transition-colors duration-1000"
        style={{ backgroundColor: activeApp.shadow.replace('0.3', '1') }}
      />

      {/* 2D Fanned Stack Container (The Deck) */}
      <div className="relative w-full max-w-[1200px] h-[450px] flex justify-center items-center">
        <motion.div 
          className="absolute w-full h-full flex items-center justify-center cursor-grab active:cursor-grabbing"
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.2}
          onDragEnd={handleDragEnd}
          onWheel={handleWheel}
        >
          {appsList.map((app, index) => {
            const style = getCardStyle(index);
            const isActive = index === activeIndex;

            // Only render cards that are somewhat visible to keep the DOM clean when there are 50+ repos
            if (style.opacity <= 0.01) return null;

            return (
              <motion.div
                key={app.id}
                className="absolute top-1/2 left-1/2 w-[260px] h-[360px] -mt-[180px] -ml-[130px] md:w-[340px] md:h-[450px] md:-mt-[225px] md:-ml-[170px] rounded-3xl flex flex-col items-center justify-center"
                style={{
                  zIndex: style.zIndex,
                }}
                animate={{ 
                  x: style.x,
                  y: style.y,
                  rotate: style.rotateZ,
                  scale: style.scale,
                  opacity: style.opacity
                }}
                transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                onTap={() => {
                  if (!isActive) {
                    setActiveIndex(index);
                  } else {
                    setSelectedApp(app);
                  }
                }}
              >
                {/* The visual card itself */}
                <div 
                  className={`w-full h-full rounded-3xl border flex flex-col items-center justify-center bg-zinc-950/90 backdrop-blur-xl transition-all duration-700 shadow-2xl ${isActive ? 'border-' + app.color.split('-')[0] + '-500 cursor-pointer hover:bg-zinc-900' : 'border-zinc-800'}`}
                  style={{
                    boxShadow: isActive ? `0 0 50px ${app.shadow}` : '0 0 10px rgba(0,0,0,0.5)',
                  }}
                >
                  <div className="text-6xl md:text-8xl mb-4 md:mb-6 drop-shadow-2xl">{app.icon}</div>
                  <h3 className="text-lg md:text-xl font-bold text-white text-center px-4 font-heading">{app.title}</h3>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      </div>

      {/* Decoupled Text Description */}
      <div className="absolute bottom-[-40px] w-full max-w-xl mx-auto text-center h-24 flex flex-col items-center justify-center z-20 pointer-events-none">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeIndex}
            initial={{ opacity: 0, y: 10, filter: 'blur(4px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -10, filter: 'blur(4px)' }}
            transition={{ duration: 0.3 }}
            className="flex flex-col gap-2"
          >
            <h2 className={`text-xl md:text-3xl font-bold font-heading tracking-widest uppercase`} style={{ color: activeApp.shadow.replace('0.3', '1') }}>
              {activeApp.title}
            </h2>
            <p className="text-zinc-400 text-sm font-sans tracking-wide">
              {activeApp.description}
            </p>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Embedded Matrix Windows */}
      <ReadmeModal 
        app={selectedApp} 
        isOpen={!!selectedApp} 
        onClose={() => setSelectedApp(null)} 
        onLaunch={() => {
          if (selectedApp?.path) {
            triggerWarpTo(selectedApp.path);
          } else if (selectedApp?.externalUrl && selectedApp.externalUrl.includes('github.com')) {
            const parts = selectedApp.externalUrl.split('github.com/');
            if (parts.length > 1) {
              const repoPath = parts[1].replace(/\/$/, '');
              const repoName = repoPath.split('/')[1] || repoPath;
              triggerWarpTo(`/embed/${repoName}`);
            } else {
              window.open(selectedApp.externalUrl, '_blank');
            }
          } else if (selectedApp?.externalUrl) {
            window.open(selectedApp.externalUrl, '_blank');
          }
          setSelectedApp(null);
        }}
      />
    </div>
  );
};

export default SpokeCarousel;
