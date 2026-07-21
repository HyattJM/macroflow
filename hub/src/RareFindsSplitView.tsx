import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function RareFindsSplitView() {
  const navigate = useNavigate();
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchReadme() {
      setLoading(true);
      setError(null);
      
      try {
        let res = await fetch(`https://raw.githubusercontent.com/HyattJM/CS491-Bookstore-Product/main/README.md`);
        if (!res.ok) {
          res = await fetch(`https://raw.githubusercontent.com/HyattJM/CS491-Bookstore-Product/master/README.md`);
        }
        
        if (!res.ok) {
          throw new Error('Could not find README.md in main or master branch.');
        }
        
        const text = await res.text();
        setContent(text);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    
    fetchReadme();
  }, []);

  return (
    <div className="w-full h-full flex flex-col md:flex-row relative z-50 bg-[#0a0a0f]">
      {/* Absolute Return Button */}
      <button 
        onClick={() => navigate('/')} 
        className="fixed top-6 right-6 z-[60] px-6 py-2 bg-emerald-500/80 text-white border border-emerald-400 rounded-full font-bold tracking-widest hover:bg-emerald-600 uppercase text-sm cursor-pointer shadow-2xl backdrop-blur-md transition-transform hover:scale-105"
      >
        &larr; Return to Hub
      </button>

      {/* Left Pane: Embedded App */}
      <div className="flex-1 w-full md:w-1/2 h-1/2 md:h-full relative overflow-hidden border-b md:border-b-0 md:border-r border-slate-800/80">
        <div className="absolute inset-0 flex flex-col items-center justify-center z-0 bg-zinc-950">
          <div className="w-10 h-10 border-t-2 border-emerald-500 rounded-full animate-spin mb-4" />
          <p className="text-emerald-500 font-mono tracking-widest text-sm uppercase">INITIALIZING RARE FINDS UPLINK...</p>
        </div>
        <iframe 
          src="https://rarefinds-live-24-production.up.railway.app" 
          className="w-full h-full border-0 absolute inset-0 z-10" 
          title="Rare Finds Live"
        />
      </div>

      {/* Right Pane: Embedded README */}
      <div className="flex-1 w-full md:w-1/2 h-1/2 md:h-full overflow-y-auto custom-scrollbar p-6 md:p-12 relative bg-zinc-950">
        <div className="max-w-3xl mx-auto mt-16 md:mt-0">
          <div className="flex items-center gap-4 border-b border-slate-800 pb-6 mb-8">
            <svg className="w-8 h-8 fill-emerald-500" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/></svg>
            <h1 className="text-2xl font-bold text-emerald-400 uppercase tracking-widest m-0">
              RARE FINDS // README
            </h1>
          </div>
          
          {loading && (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-12 h-12 border-t-2 border-emerald-500 rounded-full animate-spin mb-6" />
              <p className="text-emerald-400 font-mono tracking-widest animate-pulse text-sm">DECRYPTING DOCUMENTATION...</p>
            </div>
          )}
          
          {error && (
            <div className="text-red-400 font-mono py-10 px-6 bg-red-950/20 rounded-xl border border-red-900/50 text-center">
              [ERROR]: {error}
            </div>
          )}
          
          {!loading && !error && (
            <div className="prose prose-invert prose-emerald max-w-none 
              prose-headings:text-slate-100 prose-headings:font-bold
              prose-h1:text-emerald-400 prose-h1:border-b prose-h1:border-slate-800 prose-h1:pb-4
              prose-h2:text-emerald-300 prose-h2:mt-8
              prose-a:text-emerald-400 prose-a:no-underline hover:prose-a:underline
              prose-pre:bg-[#050505] prose-pre:border prose-pre:border-slate-800/80 prose-pre:shadow-inner
              prose-img:rounded-xl prose-img:border prose-img:border-slate-800
              prose-code:text-emerald-200 prose-code:bg-emerald-950/30 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded
              prose-strong:text-slate-200
              prose-hr:border-slate-800">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {content}
              </ReactMarkdown>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
