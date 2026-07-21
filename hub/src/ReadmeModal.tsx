import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface ReadmeModalProps {
  app: any;
  isOpen: boolean;
  onClose: () => void;
  onLaunch: () => void;
}

const ReadmeModal: React.FC<ReadmeModalProps> = ({ app, isOpen, onClose, onLaunch }) => {
  const [readme, setReadme] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen || !app) return;

    setReadme('');
    const isGithub = app.externalUrl && app.externalUrl.includes('github.com');
    
    if (isGithub) {
      setLoading(true);
      
      const parts = app.externalUrl.split('github.com/');
      if (parts.length > 1) {
        const repoPath = parts[1].replace(/\/$/, '');
        
        fetch(`https://api.github.com/repos/${repoPath}/readme`)
          .then(res => res.json())
          .then(data => {
            if (data.content) {
              const decoded = atob(data.content);
              setReadme(decoded);
            } else {
              setReadme('No README found for this repository.');
            }
            setLoading(false);
          })
          .catch(err => {
            console.error(err);
            setReadme('Error loading README from GitHub.');
            setLoading(false);
          });
      } else {
        setReadme('Invalid GitHub URL.');
        setLoading(false);
      }
    } else {
      setReadme(`# ${app.title}\n\n${app.description}\n\n*No external repository attached to this uplink.*`);
    }
  }, [isOpen, app]);

  return (
    <AnimatePresence>
      {isOpen && app && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8">
          
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm cursor-pointer"
            onClick={onClose}
          />
          
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-4xl max-h-[85vh] bg-zinc-950/95 border flex flex-col rounded-xl shadow-[0_0_50px_rgba(0,0,0,0.8)] overflow-hidden"
            style={{ 
              boxShadow: `0 0 30px ${app.shadow}`,
              borderColor: app.shadow.replace('0.3', '0.5')
            }}
          >
            {/* Header */}
            <div className="p-4 border-b flex justify-between items-center bg-black/40" style={{ borderColor: app.shadow.replace('0.3', '0.3') }}>
              <div className="flex items-center gap-3">
                <span className="text-3xl drop-shadow-lg">{app.icon}</span>
                <h2 className="text-xl font-bold text-white tracking-widest uppercase font-heading">{app.title}</h2>
              </div>
              <button 
                onClick={onClose}
                className="text-zinc-500 hover:text-white font-mono transition-colors text-xl px-2 cursor-pointer"
              >
                [X]
              </button>
            </div>
            
            {/* Body */}
            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
              {loading ? (
                <div className="w-full h-40 flex items-center justify-center text-emerald-500 font-mono animate-pulse tracking-widest text-sm">
                  &gt; EXTRACTING REPOSITORY DATA...
                </div>
              ) : (
                <div className="prose prose-invert prose-emerald max-w-none 
                  prose-headings:font-heading prose-headings:tracking-wider prose-h1:text-3xl prose-h2:text-2xl 
                  prose-a:text-emerald-400 hover:prose-a:text-emerald-300 prose-pre:bg-zinc-900 prose-pre:border prose-pre:border-zinc-800
                  prose-img:rounded-lg prose-img:shadow-lg"
                >
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {readme}
                  </ReactMarkdown>
                </div>
              )}
            </div>
            
            {/* Footer */}
            <div className="p-4 border-t flex justify-end gap-4 bg-black/60" style={{ borderColor: app.shadow.replace('0.3', '0.3') }}>
              <button 
                onClick={onClose}
                className="px-6 py-2 text-zinc-400 hover:text-white font-bold tracking-widest text-sm uppercase transition-colors cursor-pointer"
              >
                Close
              </button>
              <button 
                onClick={onLaunch}
                className="px-8 py-2 border rounded font-bold tracking-[0.2em] uppercase transition-all cursor-pointer bg-white/5 hover:bg-white/10"
                style={{ 
                  color: app.shadow.replace('rgba', 'rgb').replace(',0.3)', ')'), 
                  borderColor: app.shadow.replace('0.3', '0.5'),
                  boxShadow: `0 0 15px ${app.shadow}` 
                }}
              >
                Launch Uplink
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default ReadmeModal;
