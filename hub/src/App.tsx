import React, { useState, useRef, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import GalagaBackground from './GalagaBackground';
import BlackHoleTransition from './BlackHoleTransition';
import MicroRPGCanvas from './MicroRPGCanvas';
import DiscordWidget from './DiscordWidget';
import IosBootTerminal from './IosBootTerminal';
import AlienSpawnEffect from './AlienSpawnEffect';
import SpokeCarousel from './SpokeCarousel';
import VirtualLandscape from './VirtualLandscape';

function GithubSidebarSection() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [repos, setRepos] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const toggleExpand = async () => {
    if (!isExpanded && repos.length === 0) {
      setLoading(true);
      try {
        const res = await fetch('https://api.github.com/users/HyattJM/repos?sort=updated&per_page=30');
        const data = await res.json();
        if (Array.isArray(data)) {
          setRepos(data);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    setIsExpanded(!isExpanded);
  };

  return (
    <div className="mt-2 flex flex-col w-full border-t border-slate-800/50 pt-2 flex-shrink-0 min-h-0">
      <button 
        onClick={toggleExpand}
        className="flex items-center justify-between w-full p-3 text-slate-400 hover:text-white hover:bg-slate-800/50 rounded-lg text-left font-medium transition-colors"
      >
        <div className="flex items-center gap-3">
          <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/></svg>
          GitHub Library
        </div>
        <span className="text-xs">{isExpanded ? '▼' : '▶'}</span>
      </button>

      {isExpanded && (
        <div className="flex flex-col gap-2 mt-3 mb-2">
          {loading ? (
            <div className="text-slate-500 text-xs italic py-2 px-3">Initializing uplink...</div>
          ) : (
            repos.map((repo) => (
              <a 
                key={repo.id}
                href={repo.html_url}
                target="_blank"
                rel="noreferrer"
                className="group flex flex-col gap-1 p-3 rounded-lg bg-zinc-950/50 hover:bg-emerald-950/30 border border-slate-800/50 hover:border-emerald-500/50 transition-all cursor-pointer shadow-lg"
              >
                <div className="text-slate-300 group-hover:text-emerald-400 text-sm font-bold truncate transition-colors flex items-center justify-between">
                  {repo.name}
                  <svg className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3"/></svg>
                </div>
                {repo.description && (
                  <div className="text-slate-500 text-[10px] line-clamp-2 leading-snug">
                    {repo.description}
                  </div>
                )}
              </a>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function GithubShuttleRoute({ triggerWarpTo, repoUrl, repoName }: { triggerWarpTo: (p: string) => void, repoUrl: string, repoName: string }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      window.open(repoUrl, '_blank');
    }, 1500);
    return () => clearTimeout(timer);
  }, [repoUrl]);

  return (
    <div className="w-full h-full flex flex-col relative bg-zinc-950 items-center justify-center">
      <button onClick={() => triggerWarpTo('/')} className="absolute top-6 right-6 z-50 px-6 py-2 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded font-bold tracking-widest hover:bg-emerald-500/30 uppercase text-sm cursor-pointer shadow-xl backdrop-blur-md">
        &larr; Return to Hub
      </button>
      <div className="text-center">
        <div className="text-6xl mb-6 animate-bounce">🚀</div>
        <h1 className="text-4xl font-bold mb-4 text-emerald-400 font-mono uppercase tracking-widest">Shuttling to GitHub</h1>
        <p className="text-zinc-400 mb-8 max-w-md mx-auto">Establishing secure connection to {repoName} infrastructure...</p>
        <a 
          href={repoUrl} 
          target="_blank" 
          rel="noreferrer"
          className="px-8 py-3 bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 rounded-lg font-bold tracking-[0.2em] uppercase hover:bg-emerald-500/40 transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)] inline-block"
        >
          Initialize Link
        </a>
      </div>
    </div>
  );
}

function AppContent() {
  const [inVR, setInVR] = useState(false);
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

      {/* 3D Virtual Landscape Overlay */}
      {inVR && (
        <VirtualLandscape 
          triggerWarpTo={(path) => {
            setInVR(false);
            triggerWarpTo(path);
          }} 
          onExit={() => setInVR(false)} 
        />
      )}

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
        <div className="p-4 border-b border-slate-800/50 flex flex-col gap-3 bg-zinc-950/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center p-2 overflow-hidden shrink-0">
              <svg viewBox="0 0 24 24" className="w-full h-full text-emerald-400 fill-current"><path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"/></svg>
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-bold text-slate-200 truncate">James Hyatt</span>
              <span className="text-[10px] text-slate-400 truncate" title="jamesmichaelhyatt@google.com">
                jamesmichaelhyatt@google.com
              </span>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-4 flex flex-col gap-2 overflow-y-auto custom-scrollbar">
          <button onClick={() => navigate('/')} className="flex items-center gap-3 w-full p-3 rounded-lg bg-emerald-400/10 text-emerald-400 text-left font-semibold border-l-2 border-emerald-400 shrink-0">
             Hub
          </button>
          <button onClick={() => triggerWarpTo('/portfolio')} className="flex items-center gap-3 w-full p-3 text-slate-400 hover:text-white hover:bg-slate-800/50 rounded-lg text-left font-medium transition-colors shrink-0">
            💻 Portfolio
          </button>
          <button onClick={() => triggerWarpTo('/logic-layer')} className="flex items-center gap-3 w-full p-3 text-slate-400 hover:text-white hover:bg-slate-800/50 rounded-lg text-left font-medium transition-colors shrink-0">
            ⚙️ Logic Layer
          </button>
          <button onClick={() => triggerWarpTo('/metrix')} className="flex items-center gap-3 w-full p-3 text-slate-400 hover:text-white hover:bg-slate-800/50 rounded-lg text-left font-medium transition-colors shrink-0">
            📊 Metrix Platform
          </button>
          <button onClick={() => triggerWarpTo('/movie-app')} className="flex items-center gap-3 w-full p-3 text-slate-400 hover:text-white hover:bg-slate-800/50 rounded-lg text-left font-medium transition-colors shrink-0">
            🎬 Movie App
          </button>
          <button onClick={() => triggerWarpTo('/bot-dashboard')} className="flex items-center gap-3 w-full p-3 text-slate-400 hover:text-white hover:bg-slate-800/50 rounded-lg text-left font-medium transition-colors shrink-0">
            🤖 Discord Bot
          </button>
          <button onClick={() => triggerWarpTo('/return-automator')} className="flex items-center gap-3 w-full p-3 text-slate-400 hover:text-white hover:bg-slate-800/50 rounded-lg text-left font-medium transition-colors shrink-0">
            📦 Return Automator
          </button>
          <button onClick={() => triggerWarpTo('/rare-finds')} className="flex items-center gap-3 w-full p-3 text-slate-400 hover:text-white hover:bg-slate-800/50 rounded-lg text-left font-medium transition-colors shrink-0">
            📚 Rare Finds
          </button>
          
          <GithubSidebarSection />
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
                <p className="text-slate-400 mb-8 max-w-xl leading-relaxed">
                  Welcome to hyattjm.com. Choose an access point below to initialize a gateway.
                </p>

                <button 
                  onClick={() => setInVR(true)}
                  className="px-8 py-3 bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 rounded-lg font-bold tracking-[0.2em] uppercase hover:bg-emerald-500/40 transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)] hover:shadow-[0_0_25px_rgba(16,185,129,0.6)] mb-12"
                >
                  [ ENTER VR MATRIX ]
                </button>

                <SpokeCarousel triggerWarpTo={triggerWarpTo} />

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

                  {/* Card 6 (Rare Finds) */}
                  <div className="bg-zinc-950/40 backdrop-blur-lg border border-zinc-800 rounded-2xl p-8 flex flex-col hover:border-zinc-500 hover:bg-zinc-950/60 transition-all shadow-2xl md:col-span-2 lg:col-span-1">
                    <div className="text-4xl mb-6 text-amber-500">📚</div>
                    <h2 className="text-2xl font-bold text-white mb-3">Rare Finds Bookstore</h2>
                    <p className="text-zinc-200 text-sm mb-8 flex-1">
                      Boutique e-commerce platform for unique literary discoveries.
                    </p>
                    <button 
                      onClick={() => triggerWarpTo('/rare-finds')}
                      className="text-emerald-400 text-sm font-bold tracking-widest uppercase flex items-center gap-2 hover:text-emerald-300 w-fit"
                    >
                      Enter &rarr;
                    </button>
                  </div>
                </div>
              </div>
            } />
            
            <Route path="/portfolio" element={<GithubShuttleRoute triggerWarpTo={triggerWarpTo} repoUrl="https://github.com/HyattJM" repoName="HyattJM GitHub" />} />
            <Route path="/logic-layer" element={<GithubShuttleRoute triggerWarpTo={triggerWarpTo} repoUrl="https://github.com/HyattJM/logic-layer" repoName="Logic Layer" />} />
            
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
            
            <Route path="/bot-dashboard" element={<GithubShuttleRoute triggerWarpTo={triggerWarpTo} repoUrl="https://github.com/HyattJM/discord-bot" repoName="Discord Bot" />} />
            <Route path="/rare-finds" element={<GithubShuttleRoute triggerWarpTo={triggerWarpTo} repoUrl="https://github.com/HyattJM/CS491-Rare-Finds" repoName="Rare Finds Bookstore" />} />
            
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
