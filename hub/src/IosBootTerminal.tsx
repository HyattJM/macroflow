import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

const bootSequence = [
  "Initializing iOS XNU Kernel...",
  "Loading boot drivers... [OK]",
  "Mounting root filesystem (hfs+) [OK]",
  "Starting launchd...",
  "[  0.4231] AppleSMC: Successfully initialized",
  "[  0.8992] mDNSResponder: Starting network discovery",
  "[  1.1013] configd: Network state configuration loaded",
  "[  1.4022] WindowServer: Initializing graphics subsystem",
  "[  1.8291] System auth server started.",
  "[  2.0003] Loading macroflow_hub.app payload...",
  "----------------------------------------",
  "HYATT ECOSYSTEMS SECURE TERMINAL v2.4.1",
  "Connection established.",
  "Monitoring root ops...",
  "Initializing live task manager daemon..."
];

const generateTaskMgrLog = () => {
  const timestamp = new Date().toISOString().substring(11, 19);
  const events = [
    () => `[${timestamp}] CPU: ${Math.floor(Math.random() * 30 + 10)}% | RAM: ${(Math.random() * 4 + 14).toFixed(1)}GB/32GB`,
    () => `[${timestamp}] NET: en0 rx: ${Math.floor(Math.random() * 5000)}kb/s tx: ${Math.floor(Math.random() * 1000)}kb/s`,
    () => `[${timestamp}] PROC: node (PID ${Math.floor(Math.random() * 8000 + 1000)}) active`,
    () => `[${timestamp}] DISK: /dev/disk1s1 read: ${Math.floor(Math.random() * 15)}MB/s`,
    () => `[${timestamp}] KERNEL: memory page swap [OK]`,
    () => `[${timestamp}] SEC: Auth token verified for UID ${Math.floor(Math.random() * 500 + 500)}`,
    () => `[${timestamp}] SYNC: Matrix layer stabilized. Frame drop: 0.00%`
  ];
  return events[Math.floor(Math.random() * events.length)]();
};

const IosBootTerminal = () => {
  const [lines, setLines] = useState<string[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let currentLine = 0;
    let bootInterval: ReturnType<typeof setInterval>;
    let taskMgrInterval: ReturnType<typeof setInterval>;

    bootInterval = setInterval(() => {
      if (currentLine < bootSequence.length) {
        setLines(prev => [...prev, bootSequence[currentLine]]);
        currentLine++;
        if (containerRef.current) {
          containerRef.current.scrollTop = containerRef.current.scrollHeight;
        }
      } else {
        clearInterval(bootInterval);
        
        // Transition to live telemetry
        taskMgrInterval = setInterval(() => {
          setLines(prev => {
            const next = [...prev, generateTaskMgrLog()];
            if (next.length > 50) return next.slice(next.length - 50); // Prevent memory bloat
            return next;
          });
          if (containerRef.current) {
            containerRef.current.scrollTop = containerRef.current.scrollHeight;
          }
        }, 1200);
      }
    }, 150);

    return () => {
      clearInterval(bootInterval);
      if (taskMgrInterval) clearInterval(taskMgrInterval);
    };
  }, []);

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.9, x: -100 }}
      animate={{ opacity: 1, scale: 1, x: 0 }}
      className="absolute top-[540px] right-6 w-96 h-[300px] bg-black/90 backdrop-blur-md border border-slate-700/50 rounded-lg flex flex-col shadow-2xl z-20 overflow-hidden font-mono pointer-events-auto"
    >
      <div className="bg-slate-800/80 px-4 py-2 border-b border-slate-700/50 flex justify-between items-center text-xs text-slate-400">
        <span>root@ios-sys:~/taskmgr</span>
        <span className="flex gap-2">
          <div className="w-3 h-3 rounded-full bg-red-500" />
          <div className="w-3 h-3 rounded-full bg-yellow-500" />
          <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
        </span>
      </div>
      <div 
        ref={containerRef}
        className="flex-1 overflow-y-auto p-4 text-[11px] leading-relaxed text-green-400 flex flex-col"
      >
        {lines.map((line, idx) => (
          <div key={idx} className="whitespace-pre-wrap">{line}</div>
        ))}
        <div className="animate-pulse">_</div>
      </div>
    </motion.div>
  );
};

export default IosBootTerminal;
