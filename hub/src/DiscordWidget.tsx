import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

interface DiscordMessage {
  author: string;
  content: string;
  timestamp: string;
}

const mockHistory: DiscordMessage[] = [
  {
    author: "System Architect Bot",
    content: `"Upon receiving an orders/create webhook, store relevant order/customer data."
"Implement a placeholder 'workflow' that triggers a simple, non-personalized action (e.g., log a 'thank you' message to console/DB, or send a dummy email via a mock service) after a delay (e.g., 5 minutes post-order). This demonstrates event processing and delayed actions."

"4. Basic Embedded Frontend Dashboard": {
  "objective": "Provide a minimal interface for store owners to install the app and see basic status.",
  "details": [
    "Develop an embedded React/Next.js frontend that allows a store owner to initiate the Shopify OAuth installation flow.",
    "Display a simple 'App Installed' status on the dashboard."
  ]
}

"Deliverable": "A functional Shopify app boilerplate including secure OAuth installation, backend webhook listener for orders/create, a basic PostgreSQL schema, a proof-of-concept delayed action, and a minimal embedded React/Next.js dashboard, ready for initial testing and validation."

---
This prompt now provides a concrete, actionable blueprint for your Antigravity IDE to begin developing the foundational elements of your Shopify SaaS micro-application. The Backend Manager will oversee the robust implementation of the API and database, while the UI/UX Specialist will ensure the embedded frontend adheres to Shopify's app guidelines. Your QA agent can now proceed with verifying each component of this MVP.`,
    timestamp: new Date(Date.now() - 10 * 60000).toISOString() // 10 mins ago
  },
  {
    author: "James Hyatt",
    content: "Are we live?\n\\",
    timestamp: new Date(Date.now() - 2 * 60000).toISOString() // 2 mins ago
  }
];

const DiscordWidget = () => {
  const [messages, setMessages] = useState<DiscordMessage[]>(mockHistory);
  const [status, setStatus] = useState('Connected');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Simulate live websocket connection dropping in a new message
    const timer = setTimeout(() => {
      setMessages(prev => [
        ...prev,
        {
          author: "Ops Bot",
          content: "Yes. All local endpoints are green. Monitoring active.",
          timestamp: new Date().toISOString()
        }
      ]);
    }, 4000);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.9, x: 100 }}
      animate={{ opacity: 1, scale: 1, x: 0 }}
      className="absolute top-6 right-6 w-96 h-[500px] bg-slate-900/80 backdrop-blur-xl border border-slate-700/50 rounded-xl flex flex-col overflow-hidden shadow-2xl z-20 pointer-events-auto"
    >
      <div className="bg-slate-800/90 px-4 py-3 border-b border-slate-700/50 flex justify-between items-center">
        <h2 
          onClick={() => navigate('/bot-dashboard')}
          className="text-white font-bold flex items-center gap-2 cursor-pointer hover:text-indigo-300 transition-colors"
        >
          <span className="text-indigo-400">#</span> daily-standup
        </h2>
        <span className={`text-xs px-2 py-1 rounded-full ${status === 'Connected' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
          {status}
        </span>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-6">
        {messages.map((msg, idx) => {
          const isBot = msg.author.includes('AI') || msg.author.includes('Bot');
          return (
            <div key={idx} className="flex flex-col gap-1">
              <div className="flex items-baseline gap-2">
                <span className={`font-bold text-sm ${isBot ? 'text-indigo-400' : 'text-emerald-400'}`}>
                  {msg.author}
                  {isBot && <span className="ml-2 text-[10px] bg-indigo-500/20 px-1 rounded text-indigo-300">APP</span>}
                </span>
                <span className="text-xs text-slate-500">
                  {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                </span>
              </div>
              <div className="text-slate-200 text-xs whitespace-pre-wrap leading-relaxed font-mono">
                {msg.content}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>
    </motion.div>
  );
};

export default DiscordWidget;
