import React, { useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  Filler,
} from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';
import {
  Clock,
  DollarSign,
  TrendingUp,
  Users,
  Zap,
  Target,
  CheckCircle,
  AlertCircle,
  ArrowUp,
  ArrowDown,
  FileText,
  Brain,
  ArrowLeft,
} from 'lucide-react';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  Filler
);

interface ImpactMetrics {
  hoursSavedPerWeek: number;
  costSavingsPerMonth: number;
  automationRate: number;
  studentRequestsProcessed: number;
  avgProcessingTime: number;
  paperCostsSaved: number;
  staffReduction: number;
  errorRateReduction: number;
}

const ImpactDashboard: React.FC<{ onBack?: () => void }> = ({ onBack }) => {
  const [metrics] = useState<ImpactMetrics>({
    hoursSavedPerWeek: 39.5,
    costSavingsPerMonth: 3200,
    automationRate: 94,
    studentRequestsProcessed: 127,
    avgProcessingTime: 2.8,
    paperCostsSaved: 200,
    staffReduction: 67,
    errorRateReduction: 88,
  });

  // Calculate derived metrics
  const annualSavings = metrics.costSavingsPerMonth * 12;
  const implementationCost = 15000;
  const monthlyOperatingCost = 150;
  const yearlyOperatingCost = monthlyOperatingCost * 12;
  const firstYearROI = ((annualSavings - yearlyOperatingCost - implementationCost) / implementationCost) * 100;

  // Chart defaults for dark mode
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: '#121212',
        titleColor: '#00D1FF',
        bodyColor: '#ffffff',
        borderColor: '#2A2A2A',
        borderWidth: 1,
        padding: 12,
        cornerRadius: 8,
      },
    },
    scales: {
      x: {
        grid: {
          color: 'rgba(255, 255, 255, 0.05)',
        },
        ticks: {
          color: 'rgba(255, 255, 255, 0.5)',
        },
      },
      y: {
        grid: {
          color: 'rgba(255, 255, 255, 0.05)',
        },
        ticks: {
          color: 'rgba(255, 255, 255, 0.5)',
        },
      },
    },
  };

  // Chart data for time saved comparison
  const timeSavedData = {
    labels: ['Manual', 'NLS Ops Hub'],
    datasets: [
      {
        label: 'Hours per Week',
        data: [40, 0.5],
        backgroundColor: ['rgba(239, 68, 68, 0.6)', 'rgba(0, 209, 255, 0.8)'],
        borderColor: ['#ef4444', '#00D1FF'],
        borderWidth: 2,
        borderRadius: 8,
      },
    ],
  };

  // Chart data for cost breakdown
  const costBreakdownData = {
    labels: ['Staff', 'Paper', 'Errors', 'Comm', 'Other'],
    datasets: [
      {
        label: 'Monthly Savings ($)',
        data: [2400, 200, 300, 200, 100],
        backgroundColor: [
          'rgba(0, 209, 255, 0.7)',
          'rgba(34, 197, 94, 0.7)',
          'rgba(251, 146, 60, 0.7)',
          'rgba(147, 51, 234, 0.7)',
          'rgba(107, 114, 128, 0.7)',
        ],
        borderRadius: 8,
      },
    ],
  };

  // Chart data for automation rate over time
  const automationTrendData = {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May'],
    datasets: [
      {
        fill: true,
        label: 'Automation Rate (%)',
        data: [45, 62, 78, 87, 94],
        borderColor: '#00D1FF',
        backgroundColor: 'rgba(0, 209, 255, 0.1)',
        tension: 0.4,
        pointBackgroundColor: '#00D1FF',
        pointBorderColor: '#fff',
        pointHoverRadius: 6,
      },
    ],
  };

  // Chart data for request processing
  const requestProcessingData = {
    labels: ['Swaps', 'Excuses', 'Drops', 'Allocations', 'Other'],
    datasets: [
      {
        label: 'Requests',
        data: [45, 32, 18, 25, 7],
        backgroundColor: 'rgba(0, 209, 255, 0.8)',
        borderRadius: 8,
      },
    ],
  };

  const MetricCard: React.FC<{
    title: string;
    value: string | number;
    unit?: string;
    trend?: number;
    icon: React.ReactNode;
    description: string;
    color?: 'primary' | 'green' | 'purple' | 'orange';
  }> = ({ title, value, unit, trend, icon, description, color = 'primary' }) => {
    const colors = {
      primary: 'text-primary bg-primary/10 border-primary/20',
      green: 'text-green-400 bg-green-400/10 border-green-400/20',
      purple: 'text-purple-400 bg-purple-400/10 border-purple-400/20',
      orange: 'text-orange-400 bg-orange-400/10 border-orange-400/20',
    };

    return (
      <div className={`glass-card group hover:-translate-y-1 transition-all duration-300`}>
        <div className="flex items-start justify-between mb-4">
          <div className={`p-3 rounded-xl ${colors[color]}`}>
            {icon}
          </div>
          {trend !== undefined && (
            <div className={`flex items-center gap-1 text-xs font-bold ${
              trend > 0 ? 'text-green-400' : 'text-red-400'
            }`}>
              {trend > 0 ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
              {Math.abs(trend)}%
            </div>
          )}
        </div>
        <div className="space-y-1">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">{title}</p>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-black stat-glow">{value}</span>
            {unit && <span className="text-sm text-slate-500 font-bold">{unit}</span>}
          </div>
          <p className="text-[11px] text-slate-400 mt-2 font-medium">{description}</p>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background text-white p-6 selection:bg-primary/30">
      {/* Background Glow */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[10%] right-[10%] w-[30%] h-[30%] bg-primary/10 blur-[100px] rounded-full"></div>
        <div className="absolute bottom-[10%] left-[10%] w-[30%] h-[30%] bg-purple-600/10 blur-[100px] rounded-full"></div>
      </div>

      {/* Header */}
      <div className="max-w-7xl mx-auto mb-10 relative z-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 glass-card border-white/5">
          <div className="flex items-center gap-4">
            {onBack && (
              <button 
                onClick={onBack}
                className="p-2 hover:bg-white/5 rounded-lg transition-colors text-slate-400 hover:text-white"
              >
                <ArrowLeft className="w-6 h-6" />
              </button>
            )}
            <div>
              <h1 className="text-3xl font-black flex items-center gap-3">
                <Brain className="w-8 h-8 text-primary shadow-primary" />
                Impact Intelligence
              </h1>
              <p className="text-slate-500 font-medium mt-1">
                Real-time ROI and operational efficiency metrics for NLS Ops Hub
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 px-4 py-2 bg-green-500/10 border border-green-500/20 rounded-full">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.8)]"></div>
            <span className="text-xs font-bold text-green-400 uppercase tracking-widest">Live Demo Engine Active</span>
          </div>
        </div>
      </div>

      {/* Key Metrics Grid */}
      <div className="max-w-7xl mx-auto mb-8 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <MetricCard
            title="Hours Saved Weekly"
            value={metrics.hoursSavedPerWeek}
            unit="hrs"
            trend={12}
            icon={<Clock className="w-6 h-6" />}
            description="99% reduction in manual admin time"
            color="green"
          />
          <MetricCard
            title="Monthly Savings"
            value={`$${metrics.costSavingsPerMonth.toLocaleString()}`}
            trend={8}
            icon={<DollarSign className="w-6 h-6" />}
            description="Staff time + operational overhead"
            color="primary"
          />
          <MetricCard
            title="Automation Rate"
            value={metrics.automationRate}
            unit="%"
            trend={5}
            icon={<Zap className="w-6 h-6" />}
            description="Requests handled by AI Assistant"
            color="purple"
          />
          <MetricCard
            title="Resource Efficiency"
            value={metrics.staffReduction}
            unit="%"
            trend={15}
            icon={<Users className="w-6 h-6" />}
            description="Reallocation of staff to high-value tasks"
            color="orange"
          />
        </div>
      </div>

      {/* ROI Summary */}
      <div className="max-w-7xl mx-auto mb-8 relative z-10">
        <div className="relative group">
          <div className="absolute -inset-0.5 bg-gradient-to-r from-primary to-purple-600 rounded-2xl blur opacity-20 group-hover:opacity-30 transition duration-1000"></div>
          <div className="relative bg-card border border-white/5 rounded-2xl p-8 overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-5">
              <Target className="w-40 h-40 text-primary" />
            </div>
            <div className="flex flex-col lg:flex-row items-center justify-between gap-8">
              <div className="flex-1 text-center lg:text-left">
                <h2 className="text-2xl font-bold mb-2 flex items-center justify-center lg:justify-start gap-2">
                  <Target className="w-6 h-6 text-primary" />
                  Performance Benchmark (Year 1)
                </h2>
                <p className="text-slate-400 font-medium mb-8">
                  Implementation cost recovered in <span className="text-primary font-bold">{Math.ceil(implementationCost / (metrics.costSavingsPerMonth - monthlyOperatingCost))} months</span>
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                    <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider mb-1">Implementation</p>
                    <p className="text-xl font-black">${implementationCost.toLocaleString()}</p>
                  </div>
                  <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                    <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider mb-1">Annual Savings</p>
                    <p className="text-xl font-black text-green-400">${annualSavings.toLocaleString()}</p>
                  </div>
                  <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                    <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider mb-1">Operating Cost</p>
                    <p className="text-xl font-black text-slate-400">${yearlyOperatingCost.toLocaleString()}</p>
                  </div>
                  <div className="p-4 rounded-xl bg-primary/10 border border-primary/20">
                    <p className="text-primary text-[10px] font-bold uppercase tracking-wider mb-1">Net ROI</p>
                    <p className="text-xl font-black text-primary">{firstYearROI.toFixed(0)}%</p>
                  </div>
                </div>
              </div>
              <div className="lg:w-1/4 text-center p-8 bg-primary/5 rounded-2xl border border-primary/10">
                <div className="text-6xl font-black text-primary mb-2 stat-glow">{firstYearROI.toFixed(0)}%</div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Efficiency Gains</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8 relative z-10">
        <div className="glass-card flex flex-col h-[400px]">
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" />
            Time Allocation Matrix
          </h3>
          <div className="flex-1">
            <Bar data={timeSavedData} options={chartOptions} />
          </div>
        </div>

        <div className="glass-card flex flex-col h-[400px]">
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-green-400" />
            Operational Savings (Monthly)
          </h3>
          <div className="flex-1">
            <Bar data={costBreakdownData} options={chartOptions} />
          </div>
        </div>

        <div className="glass-card flex flex-col h-[400px]">
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-purple-400" />
            Automation Growth Curve
          </h3>
          <div className="flex-1">
            <Line data={automationTrendData} options={chartOptions} />
          </div>
        </div>

        <div className="glass-card flex flex-col h-[400px]">
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
            <FileText className="w-4 h-4 text-orange-400" />
            Throughput: Request Processing
          </h3>
          <div className="flex-1">
            <Bar data={requestProcessingData} options={chartOptions} />
          </div>
        </div>
      </div>

      {/* Process Improvements */}
      <div className="max-w-7xl mx-auto relative z-10">
        <div className="glass-card">
          <h3 className="text-xl font-black mb-8 flex items-center gap-3">
            <CheckCircle className="w-6 h-6 text-green-400" />
            Operational Transformation
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                title: 'Student Allocation',
                before: '8 hours/week manual Excel',
                after: '5 minutes AI-Powered',
                improvement: '99% Efficiency',
              },
              {
                title: 'Attendance Tracking',
                before: '2 hours/day paper-based',
                after: '5 minutes/day QR System',
                improvement: '96% Time Savings',
              },
              {
                title: 'Request Resolution',
                before: '2-3 days manual loop',
                after: '5 minutes AI-Response',
                improvement: '95% Speed Gain',
              },
              {
                title: 'Human Capital',
                before: '3 Full-time Admin staff',
                after: '1 Part-time Supervisor',
                improvement: '67% Cost Reduction',
              },
              {
                title: 'Data Accuracy',
                before: '15% Human Error Rate',
                after: '< 1% AI Verification',
                improvement: '93% Accuracy Increase',
              },
              {
                title: 'Environment Impact',
                before: '5,000+ sheets/year',
                after: 'Fully Digital Ecosystem',
                improvement: '100% Zero Paper',
              },
            ].map((item, index) => (
              <div key={index} className="p-5 rounded-2xl bg-white/5 border border-white/5 hover:border-primary/30 transition-all group">
                <h4 className="font-bold text-white mb-4 group-hover:text-primary transition-colors">{item.title}</h4>
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center gap-2 text-[10px] font-bold text-red-500 uppercase tracking-wider mb-1">
                      <AlertCircle className="w-3 h-3" /> Legacy Process
                    </div>
                    <p className="text-sm text-slate-400">{item.before}</p>
                  </div>
                  <div className="pt-3 border-t border-white/5">
                    <div className="flex items-center gap-2 text-[10px] font-bold text-green-400 uppercase tracking-wider mb-1">
                      <CheckCircle className="w-3 h-3" /> NLS Ops Hub
                    </div>
                    <p className="text-sm font-bold text-white">{item.after}</p>
                  </div>
                  <div className="mt-2 text-xs font-black text-primary bg-primary/10 py-2 rounded-lg text-center border border-primary/20">
                    {item.improvement}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImpactDashboard;

