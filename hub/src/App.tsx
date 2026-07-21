import React, { useState, useRef, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import GalagaBackground from './GalagaBackground';
import BlackHoleTransition from './BlackHoleTransition';
import MicroRPGCanvas from './MicroRPGCanvas';
import DiscordWidget from './DiscordWidget';
import IosBootTerminal from './IosBootTerminal';
import AlienSpawnEffect from './AlienSpawnEffect';
import SpokeCarousel from './SpokeCarousel';

function AppContent() {
  const [isWarping, setIsWarping] = useState(false);
  const [warpTarget, setWarpTarget] = useState<string>('');
  const [isMuted, setIsMuted] = useState(true); 
  const [currentTrack, setCurrentTrack] = useState(1); // Default to song1.mp3 (Derezzed)
  const [hasStarted, setHasStarted] = useState(false);
  const [showInitialBlackHole, setShowInitialBlackHole] = useState(false);
  const [showLightning, setShowLightning] = useState(false);
  const [showAlienSpawn, setShowAlienSpawn] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const navigate = useNavigate();

  const playlist = ["/music.mp3", "/song1.mp3", "/song2.mp3"];

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = 0.2;
      if (!isMuted) {
        audioRef.current.play().catch(e => console.log("Autoplay prevented:", e));
      } else {
        audioRef.current.pause();
      }
    }
  }, [isMuted, currentTrack]);

  const handleStart = () => {
    setHasStarted(true);
    setIsMuted(false);
    
    // Lightning fires as soon as power is clicked
    setShowLightning(true);
    setTimeout(() => setShowLightning(false), 1000); 

    // Black hole triggers
    setShowInitialBlackHole(true);
    
    setTimeout(() => {
        setShowInitialBlackHole(false);
        // Alien spawn cues up with Derezzed after blackhole recedes
        setShowAlienSpawn(true);
    }, 1500); 
  };

  const handleNextTrack = () => {
    setCurrentTrack((prev) => (prev + 1) % playlist.length);
  };

  const triggerWarpTo = (path: string) => {
    setWarpTarget(path);
    setIsWarping(true);
  };

  const handleWarpComplete = () => {
    navigate(warpTarget);
    setTimeout(() => setIsWarping(false), 800);
  };

  return (
    <div className="relative w-full h-screen font-sans bg-transparent text-white overflow-hidden flex">
      {!hasStarted && (
        <div className="absolute inset-0 z-[100] bg-black flex flex-col items-center justify-center">
            <h1 className="text-4xl font-bold text-white mb-8 tracking-widest uppercase">System Offline</h1>
            <button 
                onClick={handleStart}
                className="px-8 py-4 bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 rounded-lg font-bold tracking-[0.2em] uppercase hover:bg-emerald-500/40 hover:scale-105 transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)] hover:shadow-[0_0_25px_rgba(16,185,129,0.6)]"
            >
                Initialize Power
            </button>
        </div>
      )}

      {/* Lightning Flash overlay synchronized with black hole opening */}
      <div 
        className={`absolute inset-0 z-40 bg-white pointer-events-none transition-opacity duration-300 ${
          showInitialBlackHole ? 'opacity-30' : 'opacity-0'
        }`}
      />

      {/* Dramatic Lightning Strike overlay */}
      {showLightning && (
        <div className="absolute inset-0 z-[45] pointer-events-none animate-lightning" />
      )}

      {/* Alien Spawn Animation */}
      {showAlienSpawn && <AlienSpawnEffect />}

      <GalagaBackground />
      <BlackHoleTransition isOpen={isWarping || showInitialBlackHole} onTransitionComplete={isWarping ? handleWarpComplete : undefined} />
      
      {/* Overlay Widgets */}
      {hasStarted && (
        <>
          <DiscordWidget />
          <IosBootTerminal />
        </>
      )}
      
      {/* Background Audio */}
      <audio 
        ref={audioRef} 
        src={playlist[currentTrack]} 
        onEnded={handleNextTrack} 
      />

      {/* Audio Controls (Bottom Left) */}
      <div className="absolute bottom-8 left-8 flex gap-3 z-50 pointer-events-auto">
        <button 
          onClick={() => setIsMuted(!isMuted)}
          className="w-12 h-12 bg-slate-800/80 hover:bg-slate-700 backdrop-blur-md rounded-full flex items-center justify-center text-xl border border-slate-700/50 transition-colors shadow-lg"
        >
          {isMuted ? '🔇' : '🔊'}
        </button>
        <button 
          onClick={handleNextTrack}
          className="w-12 h-12 bg-slate-800/80 hover:bg-slate-700 backdrop-blur-md rounded-full flex items-center justify-center text-xl border border-slate-700/50 transition-colors shadow-lg"
          title="Next Track"
        >
          ⏭️
        </button>
      </div>

      {/* Left Sidebar (Matches Original) */}
      <aside className="w-[240px] h-full bg-[#0a0a0f] border-r border-slate-800/50 flex flex-col z-20 flex-shrink-0 pointer-events-auto">
        <div className="p-6 border-b border-slate-800/50 flex items-center justify-center">
          <div className="text-3xl font-bold text-emerald-400 tracking-widest">H</div>
        </div>
        <nav className="flex-1 p-4 flex flex-col gap-2">
          <button onClick={() => navigate('/')} className="flex items-center gap-3 w-full p-3 rounded-lg bg-emerald-400/10 text-emerald-400 text-left font-semibold border-l-2 border-emerald-400">
             Hub
          </button>
          <button onClick={() => triggerWarpTo('/portfolio')} className="flex items-center gap-3 w-full p-3 text-slate-400 hover:text-white hover:bg-slate-800/50 text-left font-medium transition-colors">
            💻 Portfolio
          </button>
          <button onClick={() => triggerWarpTo('/logic-layer')} className="flex items-center gap-3 w-full p-3 text-slate-400 hover:text-white hover:bg-slate-800/50 text-left font-medium transition-colors">
            ⚙️ Logic Layer
          </button>
          <button onClick={() => triggerWarpTo('/metrix')} className="flex items-center gap-3 w-full p-3 text-slate-400 hover:text-white hover:bg-slate-800/50 text-left font-medium transition-colors">
            📊 Metrix Platform
          </button>
          <button onClick={() => triggerWarpTo('/movie-app')} className="flex items-center gap-3 w-full p-3 text-slate-400 hover:text-white hover:bg-slate-800/50 text-left font-medium transition-colors">
            🎬 Movie App
          </button>
          <button onClick={() => triggerWarpTo('/bot-dashboard')} className="flex items-center gap-3 w-full p-3 text-slate-400 hover:text-white hover:bg-slate-800/50 text-left font-medium transition-colors">
            🤖 Discord Bot
          </button>
          <button onClick={() => triggerWarpTo('/return-automator')} className="flex items-center gap-3 w-full p-3 text-slate-400 hover:text-white hover:bg-slate-800/50 text-left font-medium transition-colors">
            📦 Return Automator
          </button>
        </nav>
        <div className="p-6 text-xs text-slate-600 font-mono">v1.0.0</div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 relative z-20 h-full flex flex-col">
        
        {/* Top Header */}
        <header className="h-20 w-full flex items-center justify-between px-10">
          <div className="text-sm font-bold tracking-widest text-slate-300">
            HYATTJM // <span className="text-emerald-400">HUB</span>
          </div>
          <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            SYSTEM ONLINE
          </div>
        </header>

        {/* Dynamic Route Content */}
        <div className="flex-1 w-full p-10 pt-20 overflow-y-auto">
          <Routes>
            <Route path="/" element={
              <div className="max-w-4xl">
                <h3 className="text-emerald-400 text-sm font-bold tracking-widest mb-2">CENTRAL HUB</h3>
                <h1 className="text-5xl font-bold text-white mb-8">Select a Reality</h1>
                <p className="text-slate-400 mb-12 max-w-xl leading-relaxed">
                  Welcome to hyattjm.com. Choose an access point below to initialize a gateway.
                </p>

                <SpokeCarousel />

                <div className="grid grid-cols-2 gap-6 mt-16">
                  {/* Card 1 */}
                  <div className="bg-zinc-950/40 backdrop-blur-lg border border-zinc-800 rounded-2xl p-8 flex flex-col hover:border-zinc-500 hover:bg-zinc-950/60 transition-all shadow-2xl">
                    <div className="text-4xl mb-6 text-emerald-400">💻</div>
                    <h2 className="text-2xl font-bold text-white mb-3">Developer Portfolio</h2>
                    <p className="text-zinc-200 text-sm mb-8 flex-1">
                      Input -&gt; Reality. The core showcase of my active projects, skills, and execution history.
                    </p>
                    <button 
                      onClick={() => triggerWarpTo('/portfolio')}
                      className="text-emerald-400 text-sm font-bold tracking-widest uppercase flex items-center gap-2 hover:text-emerald-300 w-fit"
                    >
                      Enter &rarr;
                    </button>
                  </div>

                  {/* Card 2 */}
                  <div className="bg-zinc-950/40 backdrop-blur-lg border border-zinc-800 rounded-2xl p-8 flex flex-col hover:border-zinc-500 hover:bg-zinc-950/60 transition-all shadow-2xl">
                    <div className="text-4xl mb-6 text-slate-300">⚙️</div>
                    <h2 className="text-2xl font-bold text-white mb-3">Logic Layer Supply</h2>
                    <p className="text-zinc-200 text-sm mb-8 flex-1">
                      E-commerce utility catalog & micro-SaaS agency.
                    </p>
                    <button 
                      onClick={() => triggerWarpTo('/logic-layer')}
                      className="text-emerald-400 text-sm font-bold tracking-widest uppercase flex items-center gap-2 hover:text-emerald-300 w-fit"
                    >
                      Enter &rarr;
                    </button>
                  </div>

                  {/* Card 3 (Metrix) */}
                  <div className="bg-zinc-950/40 backdrop-blur-lg border border-zinc-800 rounded-2xl p-8 flex flex-col hover:border-zinc-500 hover:bg-zinc-950/60 transition-all shadow-2xl md:col-span-2 lg:col-span-1">
                    <div className="text-4xl mb-6 text-indigo-400">📊</div>
                    <h2 className="text-2xl font-bold text-white mb-3">Metrix Platform</h2>
                    <p className="text-zinc-200 text-sm mb-4 flex-1">
                      Comprehensive health and fitness tracking system with integrated AI macro analysis.
                    </p>
                    <div className="flex gap-4 mt-auto">
                      <a 
                        href="http://localhost:8000/api/" 
                        target="_blank" 
                        rel="noreferrer"
                        className="text-indigo-400 text-xs font-bold tracking-widest uppercase flex items-center gap-2 hover:text-indigo-300 bg-indigo-500/10 px-3 py-2 rounded"
                      >
                        API Gateway
                      </a>
                      <a 
                        href="/deploy/app-release.apk" 
                        download
                        className="text-emerald-400 text-xs font-bold tracking-widest uppercase flex items-center gap-2 hover:text-emerald-300 bg-emerald-500/10 px-3 py-2 rounded"
                      >
                        Download APK
                      </a>
                    </div>
                  </div>
                  {/* Card 4 (Movie App) */}
                  <div className="bg-zinc-950/40 backdrop-blur-lg border border-zinc-800 rounded-2xl p-8 flex flex-col hover:border-zinc-500 hover:bg-zinc-950/60 transition-all shadow-2xl">
                    <div className="text-4xl mb-6 text-red-500">🎬</div>
                    <h2 className="text-2xl font-bold text-white mb-3">Movie App</h2>
                    <p className="text-zinc-200 text-sm mb-8 flex-1">
                      React cinematic interface. Live local deployment loaded directly from GitHub source.
                    </p>
                    <button 
                      onClick={() => triggerWarpTo('/movie-app')}
                      className="text-emerald-400 text-sm font-bold tracking-widest uppercase flex items-center gap-2 hover:text-emerald-300 w-fit"
                    >
                      Enter &rarr;
                    </button>
                  </div>

                  {/* Card 5 (Discord Bot) */}
                  <div className="bg-zinc-950/40 backdrop-blur-lg border border-zinc-800 rounded-2xl p-8 flex flex-col hover:border-zinc-500 hover:bg-zinc-950/60 transition-all shadow-2xl">
                    <div className="text-4xl mb-6 text-blue-500">🤖</div>
                    <h2 className="text-2xl font-bold text-white mb-3">Discord Bot Dashboard</h2>
                    <p className="text-zinc-200 text-sm mb-8 flex-1">
                      Autonomous systems controller and ops monitoring.
                    </p>
                    <button 
                      onClick={() => triggerWarpTo('/bot-dashboard')}
                      className="text-emerald-400 text-sm font-bold tracking-widest uppercase flex items-center gap-2 hover:text-emerald-300 w-fit"
                    >
                      Enter &rarr;
                    </button>
                  </div>
                </div>
              </div>
            } />
            
            <Route path="/portfolio" element={
              <div className="w-full h-full flex flex-col relative bg-zinc-950">
                <button onClick={() => triggerWarpTo('/')} className="absolute top-6 right-6 z-50 px-6 py-2 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded font-bold tracking-widest hover:bg-emerald-500/30 uppercase text-sm cursor-pointer shadow-xl backdrop-blur-md">
                  &larr; Return to Hub
                </button>
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                  <h1 className="text-4xl font-bold mb-4 text-zinc-500 font-mono">[ SYSTEM OFFLINE ]</h1>
                  <p className="text-zinc-600 mb-6">The Developer Portfolio deployment is currently unreachable.</p>
                </div>
              </div>
            } />
            
            <Route path="/logic-layer" element={
              <div className="w-full h-full flex flex-col relative bg-zinc-950">
                <button onClick={() => triggerWarpTo('/')} className="absolute top-6 right-6 z-50 px-6 py-2 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded font-bold tracking-widest hover:bg-emerald-500/30 uppercase text-sm cursor-pointer shadow-xl backdrop-blur-md">
                  &larr; Return to Hub
                </button>
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                  <h1 className="text-4xl font-bold mb-4 text-zinc-500 font-mono">[ SYSTEM OFFLINE ]</h1>
                  <p className="text-zinc-600 mb-6">The Logic Layer Supply deployment is currently unreachable.</p>
                </div>
              </div>
            } />
            
            <Route path="/metrix" element={
              <div className="w-full h-full flex flex-col relative">
                <button onClick={() => triggerWarpTo('/')} className="absolute top-6 right-6 z-50 px-6 py-2 bg-emerald-500/80 text-white border border-emerald-400 rounded-full font-bold tracking-widest hover:bg-emerald-600 uppercase text-sm cursor-pointer shadow-2xl backdrop-blur-md">
                  &larr; Return to Hub
                </button>
                <div className="flex-1 w-full h-full bg-zinc-950 overflow-hidden">
                  <iframe src="http://localhost:8081" className="w-full h-full border-0" title="Metrix Platform Live" />
                </div>
              </div>
            } />
            
            <Route path="/movie-app" element={
              <div className="w-full h-full flex flex-col relative">
                <button onClick={() => triggerWarpTo('/')} className="absolute top-6 right-6 z-50 px-6 py-2 bg-emerald-500/80 text-white border border-emerald-400 rounded-full font-bold tracking-widest hover:bg-emerald-600 uppercase text-sm cursor-pointer shadow-2xl backdrop-blur-md">
                  &larr; Return to Hub
                </button>
                <div className="flex-1 w-full h-full bg-zinc-950 overflow-hidden">
                  <iframe src="http://localhost:5174" className="w-full h-full border-0" title="Movie App Live" />
                </div>
              </div>
            } />
            
            <Route path="/bot-dashboard" element={
              <div className="w-full h-full flex flex-col relative bg-zinc-950">
                <button onClick={() => triggerWarpTo('/')} className="absolute top-6 right-6 z-50 px-6 py-2 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded font-bold tracking-widest hover:bg-emerald-500/30 uppercase text-sm cursor-pointer shadow-xl backdrop-blur-md">
                  &larr; Return to Hub
                </button>
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                  <h1 className="text-4xl font-bold mb-4 text-zinc-500 font-mono">[ SYSTEM OFFLINE ]</h1>
                  <p className="text-zinc-600 mb-6">The Discord Bot Dashboard deployment is currently unreachable.</p>
                </div>
              </div>
            } />
            
            <Route path="/return-automator" element={
              <div className="w-full h-full flex flex-col relative">
                <button onClick={() => triggerWarpTo('/')} className="absolute top-6 right-6 z-50 px-6 py-2 bg-emerald-500/80 text-white border border-emerald-400 rounded-full font-bold tracking-widest hover:bg-emerald-600 uppercase text-sm cursor-pointer shadow-2xl backdrop-blur-md">
                  &larr; Return to Hub
                </button>
                <div className="flex-1 w-full h-full bg-zinc-950 overflow-hidden">
                  <iframe src="https://returnautomator.com" className="w-full h-full border-0" title="Return Automator Live" />
                </div>
              </div>
            } />
          </Routes>
        </div>

      </main>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}

export default App;
