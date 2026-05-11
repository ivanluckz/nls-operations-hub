import { useState } from 'react';
import ImpactDashboard from './components/ImpactDashboard';
import InteractiveDemo from './components/InteractiveDemo';
import {
  Brain,
  BarChart3,
  Zap,
  Users,
  Clock,
  DollarSign,
  Menu,
  X,
  GraduationCap,
  Award,
  Target,
  ArrowRight,
  Sparkles,
} from 'lucide-react';

type View = 'dashboard' | 'overview' | 'interactive';

function App() {
  const [activeView, setActiveView] = useState<View>('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navigation = [
    { name: 'Live AI Demo', icon: Sparkles, view: 'interactive' as const },
    { name: 'Impact Dashboard', icon: BarChart3, view: 'dashboard' as const },
    { name: 'Platform Overview', icon: Brain, view: 'overview' as const },
  ];

  const stats = [
    { label: 'Students Managed', value: '500+', icon: Users },
    { label: 'Activities', value: '30+', icon: GraduationCap },
    { label: 'Hours Saved/Month', value: '160+', icon: Clock },
    { label: 'Cost Savings', value: '$3.2k/mo', icon: DollarSign },
  ];

  const features = [
    {
      title: 'AI-Powered Allocation',
      description: 'Smart algorithms distribute students fairly based on preferences and capacity',
      icon: Brain,
      impact: '8hrs → 5min (99% reduction)',
    },
    {
      title: 'Admin AI Assistant',
      description: 'Process student requests automatically with contextual understanding',
      icon: Zap,
      impact: '2-3 days → 5 minutes (95% faster)',
    },
    {
      title: 'QR-Based Attendance',
      description: 'Instant attendance tracking with automated notifications and streaks',
      icon: Users,
      impact: '2hrs/day → 5min/day (96% reduction)',
    },
    {
      title: 'Real-Time Analytics',
      description: 'Live dashboards for leadership visibility and trend analysis',
      icon: BarChart3,
      impact: 'Zero visibility → Real-time insights',
    },
  ];

  if (activeView === 'dashboard') {
    return <ImpactDashboard onBack={() => setActiveView('overview')} />;
  }

  if (activeView === 'interactive') {
    return (
      <div className="min-h-screen bg-background">
        <header className="bg-background/80 backdrop-blur-md border-b border-border sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <button 
                onClick={() => setActiveView('overview')}
                className="flex items-center gap-3 hover:opacity-80 transition-opacity"
              >
                <div className="p-2 bg-primary rounded-lg shadow-[0_0_15px_rgba(0,209,255,0.4)]">
                  <Brain className="w-6 h-6 text-background" />
                </div>
                <div>
                  <h1 className="text-xl font-bold tracking-tight">NLS Ops Hub</h1>
                  <p className="text-[10px] text-primary font-medium tracking-widest uppercase">Live Demo Mode</p>
                </div>
              </button>
              <button 
                onClick={() => setActiveView('overview')}
                className="text-slate-400 hover:text-white text-sm font-bold uppercase tracking-widest px-4 py-2 border border-border rounded-xl hover:bg-white/5 transition-all"
              >
                Exit Demo
              </button>
            </div>
          </div>
        </header>
        <InteractiveDemo />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-white selection:bg-primary/30">
      {/* Background Glow */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-primary/20 blur-[120px] rounded-full animate-pulse-slow"></div>
        <div className="absolute -bottom-[10%] -right-[10%] w-[40%] h-[40%] bg-blue-600/10 blur-[120px] rounded-full animate-pulse-slow"></div>
      </div>

      {/* Navigation Header */}
      <header className="bg-background/80 backdrop-blur-md border-b border-border sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary rounded-lg shadow-[0_0_15px_rgba(0,209,255,0.4)]">
                <Brain className="w-6 h-6 text-background" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-white">NLS Ops Hub</h1>
                <p className="text-[10px] text-primary font-medium tracking-widest uppercase">AI-Powered School Operations</p>
              </div>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-1">
              {navigation.map((item) => (
                <button
                  key={item.view}
                  onClick={() => setActiveView(item.view)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                    activeView === item.view
                      ? 'bg-primary/10 text-primary border border-primary/20'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <item.icon className="w-4 h-4" />
                  {item.name}
                </button>
              ))}
            </nav>

            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-border bg-background/95 backdrop-blur-xl">
            <div className="px-4 py-4 space-y-2">
              {navigation.map((item) => (
                <button
                  key={item.view}
                  onClick={() => {
                    setActiveView(item.view);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                    activeView === item.view
                      ? 'bg-primary/10 text-primary border border-primary/20'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <item.icon className="w-5 h-5" />
                  {item.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </header>

      {/* Hero Section */}
      <section className="relative py-20 px-4 sm:px-6 lg:px-8 overflow-hidden">
        <div className="max-w-7xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 border border-primary/20 rounded-full text-primary text-xs font-bold tracking-widest uppercase mb-8 animate-float">
            <Award className="w-4 h-4" />
            Internal Tools Hacks 2026 - Winning Demo
          </div>
          
          <h2 className="text-5xl md:text-7xl font-black mb-8 leading-tight">
            Replacing 40+ hours of
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-blue-400 to-primary-light">manual admin work</span>
          </h2>
          
          <p className="text-xl text-slate-400 max-w-3xl mx-auto mb-12 leading-relaxed">
            At NLS Middle School (Kigali, Rwanda), we transformed co-curricular management 
            from a manual Excel nightmare into an automated, AI-powered operations platform.
          </p>

          <div className="flex flex-col sm:flex-row gap-6 justify-center mb-20">
            <button
              onClick={() => setActiveView('interactive')}
              className="px-8 py-4 bg-primary text-background rounded-xl font-bold hover:scale-105 transition-all shadow-[0_0_20px_rgba(0,209,255,0.4)] flex items-center justify-center gap-2 group"
            >
              <Sparkles className="w-5 h-5" />
              Launch Live AI Demo
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
            <button
              onClick={() => setActiveView('dashboard')}
              className="px-8 py-4 glass-card bg-white/5 border-white/10 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-white/10 transition-all"
            >
              <BarChart3 className="w-5 h-5 text-primary" />
              View Impact Dashboard
            </button>
          </div>

          {/* Key Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-5xl mx-auto">
            {stats.map((stat, index) => (
              <div key={index} className="glass-card flex flex-col items-center text-center group hover:-translate-y-1">
                <div className="p-3 bg-primary/10 rounded-xl mb-4 group-hover:bg-primary/20 transition-colors">
                  <stat.icon className="w-6 h-6 text-primary" />
                </div>
                <div className="text-3xl font-black mb-1 stat-glow">{stat.value}</div>
                <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Problem Section */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 bg-card/30 relative border-y border-border">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h3 className="text-3xl md:text-4xl font-bold mb-4">The Problem We Solved</h3>
            <p className="text-lg text-slate-400 max-w-2xl mx-auto">
              Managing 500+ students across 30+ activities was an operational nightmare
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                '8+ hours/week manual Excel allocations',
                '2-3 days for student request processing',
                'Paper-based attendance tracking',
                'Zero visibility into operations',
                'Constant human errors',
                '$200/month printing costs',
              ].map((problem, index) => (
                <div key={index} className="flex items-center gap-3 p-4 rounded-xl bg-white/5 border border-white/5 hover:border-red-500/30 transition-all group">
                  <div className="w-2 h-2 bg-red-500 rounded-full group-hover:shadow-[0_0_10px_rgba(239,68,68,0.8)]"></div>
                  <span className="text-sm text-slate-300 font-medium">{problem}</span>
                </div>
              ))}
            </div>
            <div className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-red-500 to-orange-600 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-1000"></div>
              <div className="relative bg-card border border-red-900/30 rounded-2xl p-8">
                <h4 className="text-xl font-bold text-red-500 mb-4">Before NLS Ops Hub</h4>
                <p className="text-slate-300 mb-6 italic leading-relaxed">
                  "Our admin team spent countless hours in Excel spreadsheets, 
                  dealing with email chains, and manually tracking everything on paper."
                </p>
                <div className="flex items-baseline gap-2">
                  <div className="text-5xl font-black text-red-500">40+</div>
                  <div className="text-xl font-bold text-red-900">hrs/month</div>
                </div>
                <p className="text-slate-500 text-sm mt-1 uppercase tracking-widest font-bold">Manual Admin Waste</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Solution Features */}
      <section className="py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h3 className="text-3xl md:text-4xl font-bold mb-4">Our AI-Powered Solution</h3>
            <p className="text-lg text-slate-400 max-w-2xl mx-auto">
              Comprehensive automation platform that handles the entire co-curricular lifecycle
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {features.map((feature, index) => (
              <div key={index} className="glass-card group cursor-default">
                <div className="flex items-start gap-6">
                  <div className="p-4 bg-primary/10 rounded-2xl group-hover:bg-primary/20 transition-all group-hover:scale-110">
                    <feature.icon className="w-8 h-8 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-xl font-bold mb-3">{feature.title}</h4>
                    <p className="text-slate-400 mb-5 leading-relaxed">{feature.description}</p>
                    <div className="inline-flex items-center gap-2 text-sm font-bold text-primary bg-primary/10 px-4 py-2 rounded-full border border-primary/20 group-hover:bg-primary group-hover:text-background transition-all">
                      <Zap className="w-4 h-4" />
                      {feature.impact}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Call to Action */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        <div className="absolute inset-0 bg-primary/5"></div>
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <div className="p-12 glass-card border-primary/20 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-10">
              <Brain className="w-32 h-32 text-primary" />
            </div>
            <h3 className="text-4xl font-black mb-6">Ready to see the impact?</h3>
            <p className="text-xl text-slate-400 mb-10 leading-relaxed max-w-2xl mx-auto">
              Explore our Impact Intelligence Dashboard to see the quantifiable ROI and operational improvements
            </p>
            <button
              onClick={() => setActiveView('interactive')}
              className="px-10 py-5 bg-primary text-background rounded-xl font-black hover:scale-105 transition-all shadow-[0_0_30px_rgba(0,209,255,0.4)] flex items-center justify-center gap-3 mx-auto text-lg"
            >
              <Sparkles className="w-6 h-6" />
              Launch Live Demo
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-background border-t border-border py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center">
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Brain className="w-6 h-6 text-primary" />
            </div>
            <span className="text-2xl font-black tracking-tight">NLS Ops Hub</span>
          </div>
          <p className="text-slate-500 mb-8 max-w-md mx-auto">
            Transforming school administration with AI-driven operations for the next generation of educators.
          </p>
          <div className="pt-8 border-t border-border flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm text-slate-600 font-medium tracking-wide uppercase">
              Internal Tools Hacks 2026 • Kigali, Rwanda
            </p>
            <div className="flex gap-6">
              <span className="w-2 h-2 bg-primary rounded-full animate-pulse"></span>
              <span className="w-2 h-2 bg-primary/60 rounded-full animate-pulse delay-75"></span>
              <span className="w-2 h-2 bg-primary/30 rounded-full animate-pulse delay-150"></span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App


