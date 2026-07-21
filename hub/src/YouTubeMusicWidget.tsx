import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const YouTubeMusicWidget = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* The minimized side button */}
      <motion.button 
        initial={{ x: 100 }}
        animate={{ x: 0 }}
        onClick={() => setIsOpen(true)}
        className={`fixed top-1/3 right-0 bg-zinc-950/90 border border-r-0 border-red-500/30 p-3 py-6 rounded-l-xl z-30 flex flex-col items-center gap-3 hover:bg-zinc-900 transition-colors shadow-[0_0_15px_rgba(239,68,68,0.2)] backdrop-blur-md ${isOpen ? 'opacity-0 pointer-events-none' : 'opacity-100 cursor-pointer'}`}
      >
        <span className="text-red-500 text-xl drop-shadow-[0_0_5px_rgba(239,68,68,0.8)]">▶</span>
        <span className="text-red-400 text-xs font-bold tracking-widest uppercase" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>RADIO</span>
      </motion.button>

      {/* The scooped out iframe panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ x: 400, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 400, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed top-1/3 right-6 w-[350px] h-[235px] bg-zinc-950/90 backdrop-blur-xl border border-red-500/30 rounded-xl flex flex-col overflow-hidden shadow-[0_0_30px_rgba(239,68,68,0.15)] z-40 pointer-events-auto"
          >
            <div className="bg-zinc-900/90 px-4 py-2 border-b border-red-500/20 flex justify-between items-center shrink-0">
              <h2 className="text-red-400 text-xs font-bold tracking-widest flex items-center gap-2">
                <span className="text-red-500">▶</span> MATRIX RADIO
              </h2>
              <button 
                onClick={() => setIsOpen(false)}
                className="text-zinc-500 hover:text-red-400 text-xs font-mono transition-colors cursor-pointer px-2 py-1"
              >
                [ MINIMIZE ]
              </button>
            </div>
            
            <div className="w-full flex-1 bg-black">
              <iframe 
                width="100%" 
                height="100%" 
                src="https://www.youtube.com/embed/videoseries?list=PLofht4BTc5vS1Q6PIfQ080k3x45oD1b7P" 
                title="YouTube video player" 
                frameBorder="0" 
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                allowFullScreen
              ></iframe>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default YouTubeMusicWidget;
