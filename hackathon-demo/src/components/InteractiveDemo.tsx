import React, { useState, useEffect } from 'react';
import { 
  Brain, 
  Send, 
  Zap, 
  Users, 
  CheckCircle, 
  Loader2, 
  Sparkles,
  ArrowRight,
  Database,
  ShieldCheck,
  Activity
} from 'lucide-react';

interface Message {
  id: string;
  role: 'system' | 'ai' | 'user';
  text: string;
  timestamp: Date;
  status?: 'processing' | 'done';
}

const InteractiveDemo: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'system',
      text: 'AI Operations Agent Initialized. Ready for student requests.',
      timestamp: new Date(),
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [allocationStep, setAllocationStep] = useState(0);

  const simulateAI = async (userInput: string) => {
    setIsProcessing(true);
    
    // Add user message
    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: userInput,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);

    // Simulate thinking
    await new Promise(resolve => setTimeout(resolve, 1500));

    const responses = [
      "Analyzing student preferences for Term 2...",
      "Resolving capacity conflict in 'Robotics Club'. 5 students queued, 2 slots available.",
      "Optimizing allocation based on student 'Interest Score' and 'Past Attendance'.",
      "Drafting automated notification for parents regarding activity swaps.",
    ];

    for (const text of responses) {
      const msg: Message = {
        id: Math.random().toString(),
        role: 'ai',
        text,
        timestamp: new Date(),
        status: 'processing',
      };
      setMessages(prev => [...prev, msg]);
      await new Promise(resolve => setTimeout(resolve, 1000));
      setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, status: 'done' } : m));
    }

    setIsProcessing(false);
  };

  const handleSend = () => {
    if (!inputValue.trim()) return;
    simulateAI(inputValue);
    setInputValue('');
  };

  useEffect(() => {
    const interval = setInterval(() => {
      setAllocationStep(prev => (prev + 1) % 5);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-background text-white p-6 selection:bg-primary/30">
      {/* Background Glow */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[20%] left-[10%] w-[30%] h-[30%] bg-primary/5 blur-[100px] rounded-full"></div>
        <div className="absolute bottom-[20%] right-[10%] w-[30%] h-[30%] bg-blue-600/5 blur-[100px] rounded-full"></div>
      </div>

      <div className="max-w-7xl mx-auto relative z-10">
        <div className="flex flex-col lg:flex-row gap-8">
          
          {/* Left Column: AI Agent Terminal */}
          <div className="lg:w-1/2 flex flex-col h-[calc(100vh-100px)]">
            <div className="glass-card flex-1 flex flex-col border-white/5 overflow-hidden">
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-border">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Brain className="w-5 h-5 text-primary shadow-primary" />
                  </div>
                  <div>
                    <h2 className="font-bold">AI Admin Console</h2>
                    <p className="text-[10px] text-primary uppercase tracking-widest font-bold">Autonomous Operations</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <div className="w-2 h-2 bg-primary/30 rounded-full"></div>
                </div>
              </div>

              {/* Chat Messages */}
              <div className="flex-1 overflow-y-auto space-y-4 mb-6 pr-2 custom-scrollbar">
                {messages.map((msg) => (
                  <div 
                    key={msg.id} 
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2`}
                  >
                    <div className={`max-w-[85%] p-4 rounded-2xl ${
                      msg.role === 'user' 
                        ? 'bg-primary text-background font-bold' 
                        : msg.role === 'system'
                        ? 'bg-white/5 border border-white/10 text-slate-400 text-xs italic'
                        : 'bg-white/5 border border-white/10 text-white'
                    }`}>
                      <div className="flex items-center gap-2 mb-1">
                        {msg.role === 'ai' && <Sparkles className="w-3 h-3 text-primary" />}
                        <span className="text-[10px] uppercase tracking-tighter opacity-50">
                          {msg.role === 'ai' ? 'NLS Ops AI' : msg.role === 'user' ? 'Admin' : 'System'}
                        </span>
                      </div>
                      <p className="text-sm leading-relaxed">{msg.text}</p>
                      {msg.status === 'processing' && (
                        <div className="mt-2 flex items-center gap-2 text-[10px] text-primary">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          Executing...
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Input Area */}
              <div className="relative">
                <input 
                  type="text" 
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                  placeholder="Type a command (e.g. 'Optimize Term 2 allocations')"
                  className="w-full bg-white/5 border border-border rounded-xl px-4 py-4 text-sm focus:outline-none focus:border-primary/50 transition-all pr-12"
                  disabled={isProcessing}
                />
                <button 
                  onClick={handleSend}
                  disabled={isProcessing}
                  className="absolute right-2 top-2 p-2 bg-primary text-background rounded-lg hover:scale-105 transition-all disabled:opacity-50"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Live Visualization */}
          <div className="lg:w-1/2 space-y-6">
            
            {/* Live Allocation Preview */}
            <div className="glass-card border-white/5 overflow-hidden group">
              <div className="flex items-center justify-between mb-8">
                <h3 className="font-bold flex items-center gap-2">
                  <Zap className="w-5 h-5 text-primary" />
                  Live Smart Allocation
                </h3>
                <div className="text-[10px] font-black text-primary bg-primary/10 px-3 py-1 rounded-full border border-primary/20 uppercase tracking-widest">
                  Processing Term 2
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 relative h-[300px]">
                {/* Students Column */}
                <div className="space-y-4">
                  <p className="text-[10px] text-slate-500 font-bold uppercase mb-4 tracking-wider">Unassigned</p>
                  {[1, 2, 3, 4, 5].map(i => (
                    <div key={i} className={`p-3 bg-white/5 border border-border rounded-lg text-xs font-medium flex items-center gap-2 transition-all duration-700 ${allocationStep === i ? 'opacity-0 -translate-x-10 scale-75' : 'opacity-100'}`}>
                      <Users className="w-3 h-3 text-slate-400" />
                      Student #{540 + i}
                    </div>
                  ))}
                </div>

                {/* Processing Middle */}
                <div className="flex flex-col items-center justify-center">
                  <div className="relative">
                    <div className="absolute inset-0 bg-primary/20 blur-2xl animate-pulse"></div>
                    <div className="relative p-6 bg-card border-2 border-primary/30 rounded-3xl animate-float">
                      <Brain className="w-10 h-10 text-primary" />
                    </div>
                    {/* Animated Lines */}
                    <div className="absolute top-1/2 -left-12 w-12 h-[2px] bg-gradient-to-r from-transparent to-primary"></div>
                    <div className="absolute top-1/2 -right-12 w-12 h-[2px] bg-gradient-to-r from-primary to-transparent"></div>
                  </div>
                  <p className="mt-4 text-[10px] font-bold text-primary animate-pulse">OPTIMIZING...</p>
                </div>

                {/* Activities Column */}
                <div className="space-y-4">
                  <p className="text-[10px] text-slate-500 font-bold uppercase mb-4 tracking-wider">Allocated</p>
                  {[
                    { name: 'Robotics', color: 'text-blue-400' },
                    { name: 'Basketball', color: 'text-orange-400' },
                    { name: 'Debate', color: 'text-purple-400' },
                    { name: 'Coding', color: 'text-green-400' },
                    { name: 'Art', color: 'text-pink-400' },
                  ].map((act, i) => (
                    <div key={i} className={`p-3 bg-white/5 border border-border rounded-lg text-xs font-medium flex flex-col gap-1 transition-all duration-1000 ${allocationStep >= i + 1 ? 'border-primary/50 translate-x-0' : 'opacity-40'}`}>
                      <div className="flex items-center justify-between">
                        <span className={act.color}>{act.name}</span>
                        {allocationStep >= i + 1 && <CheckCircle className="w-3 h-3 text-primary animate-in zoom-in" />}
                      </div>
                      <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-primary transition-all duration-1000" 
                          style={{ width: allocationStep >= i + 1 ? '100%' : '0%' }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* System Health */}
            <div className="grid grid-cols-2 gap-4">
              <div className="glass-card border-white/5 p-4 flex items-center gap-4">
                <div className="p-3 bg-primary/10 rounded-xl">
                  <Database className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 font-bold uppercase">Data Points</p>
                  <p className="text-xl font-black">1.2M+</p>
                </div>
              </div>
              <div className="glass-card border-white/5 p-4 flex items-center gap-4">
                <div className="p-3 bg-green-400/10 rounded-xl">
                  <ShieldCheck className="w-6 h-6 text-green-400" />
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 font-bold uppercase">Safety Score</p>
                  <p className="text-xl font-black">99.9%</p>
                </div>
              </div>
            </div>

            {/* Operational Load */}
            <div className="glass-card border-white/5">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400">Operational Capacity</h4>
                <span className="text-xs font-bold text-primary">8% LOAD</span>
              </div>
              <div className="flex items-center gap-2 h-12">
                {[...Array(20)].map((_, i) => (
                  <div 
                    key={i} 
                    className={`flex-1 rounded-sm transition-all duration-500 ${
                      i < 2 ? 'bg-primary shadow-[0_0_10px_rgba(0,209,255,0.5)]' : 'bg-white/5'
                    }`}
                    style={{ height: `${Math.random() * 60 + 20}%` }}
                  ></div>
                ))}
              </div>
              <div className="mt-4 flex items-center justify-between text-[10px] font-bold text-slate-500 uppercase">
                <div className="flex items-center gap-2">
                  <Activity className="w-3 h-3" />
                  Latency: 12ms
                </div>
                <div>Uptime: 100.00%</div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};

export default InteractiveDemo;
