import React, { useState } from 'react';
import { motion } from 'framer-motion';

const YouTubeMusicWidget = () => {
  const [isMinimized, setIsMinimized] = useState(false);

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.9, y: -20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      className={`absolute top-6 right-[420px] w-[350px] bg-slate-900/80 backdrop-blur-xl border border-slate-700/50 rounded-xl flex flex-col overflow-hidden shadow-2xl z-20 pointer-events-auto transition-all duration-300 ${isMinimized ? 'h-[40px]' : 'h-[235px]'}`}
    >
      <div className="bg-slate-800/90 px-4 py-2 border-b border-slate-700/50 flex justify-between items-center shrink-0">
        <h2 className="text-white text-xs font-bold flex items-center gap-2">
          <span className="text-red-500">▶</span> YOUTUBE MUSIC
        </h2>
        <button 
          onClick={() => setIsMinimized(!isMinimized)}
          className="text-slate-400 hover:text-white text-xs font-mono"
        >
          {isMinimized ? '[+]' : '[-]'}
        </button>
      </div>
      
      {!isMinimized && (
        <div className="w-full flex-1 bg-black">
          <iframe 
            width="100%" 
            height="100%" 
            // Synthwave / Retrowave official YouTube playlist
            src="https://www.youtube.com/embed/videoseries?list=RDCLAK5uy_kQy94y7qX06_fP0U3y9m-w1O3K02X4-G4" 
            title="YouTube video player" 
            frameBorder="0" 
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
            allowFullScreen
          ></iframe>
        </div>
      )}
    </motion.div>
  );
};

export default YouTubeMusicWidget;
