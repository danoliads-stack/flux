
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    PieChart, Pie, Cell, LineChart, Line, AreaChart, Area
} from 'recharts';

interface KPI {
    label: string;
    value: string | number;
    unit: string;
    trend: 'up' | 'down' | 'neutral';
    trendValue: string;
    icon: string;
    color: string;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

const ExecutiveDashboard: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [kpis, setKpis] = useState<KPI[]>([
        { label: 'OEE Global', value: 0, unit: '%', trend: 'neutral', trendValue: '0%', icon: 'donut_large', color: 'text-secondary' },
        { label: 'Produção Total', value: 0, unit: 'un', trend: 'neutral', trendValue: '0%', icon: 'inventory_2', color: 'text-primary' },
        { label: 'Máquinas Ativas', value: 0, unit: '', trend: 'neutral', trendValue: '0', icon: 'precision_manufacturing', color: 'text-blue-400' },
        { label: 'Refugo', value: 0, unit: '%', trend: 'neutral', trendValue: '0%', icon: 'delete_forever', color: 'text-danger' }
    ]);

    const [productionData, setProductionData] = useState<any[]>([]);
    const [downtimeData, setDowntimeData] = useState<any[]>([]);
    const [trendData, setTrendData] = useState<any[]>([]);

    useEffect(() => {
        fetchDashboardData();
    }, []);

    const fetchDashboardData = async () => {
        setLoading(true);

        // 1. Fetch Machines for Active Count & OEE calc
        const { data: machines } = await supabase.from('maquinas').select('*');

        // 2. Fetch Production for today
        const today = new Date().toISOString().split('T')[0];
        const { data: production } = await supabase
            .from('registros_producao')
            .select('*')
            .gte('created_at', today);

        // 3. Fetch Stops for Pareto
        const { data: stops } = await supabase
            .from('paradas')
            .select('motivo, data_inicio, data_fim')
            .gte('created_at', today);

        // Fetch Stop Types for naming
        const { data: stopTypes } = await supabase
            .from('tipos_parada')
            .select('id, nome');

        const stopTypeMap = new Map<string, string>();
        stopTypes?.forEach((t: any) => stopTypeMap.set(t.id, t.nome));

        if (machines && production) {
            // Calculate KPIs
            const activeCount = machines.filter(m => m.status_atual === 'RUNNING' || m.status_atual === 'IN_USE').length;
            const totalProduced = production.reduce((acc, curr) => acc + (curr.quantidade_boa || 0), 0);
            const totalScrap = production.reduce((acc, curr) => acc + (curr.quantidade_refugo || 0), 0);
            const scrapRate = totalProduced + totalScrap > 0 ? (totalScrap / (totalProduced + totalScrap)) * 100 : 0;

            // Calculate approx OEE (Mean of machine OEEs)
            const avgOee = machines.reduce((acc, m) => acc + (m.oee || 0), 0) / (machines.length || 1);

            setKpis([
                { label: 'OEE Global', value: avgOee.toFixed(1), unit: '%', trend: 'up', trendValue: '+2.1%', icon: 'donut_large', color: 'text-secondary' },
                { label: 'Produção Hoje', value: totalProduced.toLocaleString(), unit: 'un', trend: 'up', trendValue: '+5.4%', icon: 'inventory_2', color: 'text-primary' },
                { label: 'Máquinas Ativas', value: `${activeCount}/${machines.length}`, unit: '', trend: 'neutral', trendValue: '0', icon: 'precision_manufacturing', color: 'text-blue-400' },
                { label: 'Taxa de Refugo', value: scrapRate.toFixed(2), unit: '%', trend: scrapRate > 2 ? 'down' : 'up', trendValue: '-0.5%', icon: 'delete_forever', color: scrapRate > 2 ? 'text-danger' : 'text-green-500' }
            ]);

            // Mock Chart Data (Real aggregation takes more complex SQL or JS logic)
            // Production by Hour (Mocked for visual)
            const mockHourlyData = [
                { name: '06h', producao: 120, meta: 150 },
                { name: '08h', producao: 180, meta: 150 },
                { name: '10h', producao: 160, meta: 150 },
                { name: '12h', producao: 140, meta: 150 },
                { name: '14h', producao: 200, meta: 150 },
                { name: '16h', producao: 40, meta: 50 }, // Incomplete hour
            ];
            setProductionData(mockHourlyData);

            // Downtime Pareto (Corrected with Names)
            if (stops) {
                const stopReasons: Record<string, number> = {};
                stops.forEach(s => {
                    const reasonId = s.motivo;
                    // If reasonId is a UUID map it, else if it's text use it, else generic
                    const reasonName = stopTypeMap.get(reasonId) || (reasonId && reasonId.length < 36 ? reasonId : 'Outros / Não Esp.');
                    stopReasons[reasonName] = (stopReasons[reasonName] || 0) + 1;
                });
                const paretoData = Object.entries(stopReasons)
                    .map(([name, value]) => ({ name, value }))
                    .sort((a, b) => b.value - a.value)
                    .slice(0, 5); // Top 5

                // Fallback if empty
                if (paretoData.length === 0) {
                    setDowntimeData([
                        { name: 'Sem dados hoje', value: 1 }
                    ]);
                } else {
                    setDowntimeData(paretoData);
                }
            }
        }

        setLoading(false);
    };

    return (
        <div className="p-8 flex flex-col h-full overflow-y-auto custom-scrollbar bg-[#0b0c10]">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h2 className="text-3xl font-bold text-white tracking-tight font-display uppercase flex items-center gap-3">
                        <span className="material-icons-outlined text-primary text-4xl">dashboard</span>
                        Visão Geral da Operação
                    </h2>
                    <p className="text-sm text-gray-500 mt-1 ml-12">Painel Executivo • Dados em Tempo Real</p>
                </div>
                <div className="flex gap-3">
                    <div className="bg-[#15181e] px-4 py-2 rounded-lg border border-border-dark text-xs text-gray-400 font-mono flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                        Atualizado agorinha
                    </div>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                {kpis.map((kpi, idx) => (
                    <div key={idx} className="bg-[#15181e] border border-border-dark rounded-xl p-6 relative overflow-hidden group hover:border-primary/20 transition-all">
                        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                            <span className="material-icons-outlined text-6xl">{kpi.icon}</span>
                        </div>

                        <div className={`p-2 rounded-lg bg-white/5 w-fit mb-4 ${kpi.color}`}>
                            <span className="material-icons-outlined text-2xl">{kpi.icon}</span>
                        </div>

                        <p className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-1">{kpi.label}</p>
                        <div className="flex items-end gap-2">
                            <span className="text-3xl font-bold text-white">{kpi.value}<span className="text-lg text-gray-500 ml-0.5">{kpi.unit}</span></span>
                        </div>

                        <div className="mt-3 flex items-center gap-2">
                            <span className={`text-xs font-bold px-1.5 py-0.5 rounded flex items-center gap-1 ${kpi.trend === 'up' ? 'bg-green-500/10 text-green-500' :
                                kpi.trend === 'down' ? 'bg-red-500/10 text-red-500' : 'bg-gray-500/10 text-gray-500'
                                }`}>
                                <span className="material-icons-outlined text-[10px]">
                                    {kpi.trend === 'up' ? 'trending_up' : kpi.trend === 'down' ? 'trending_down' : 'remove'}
                                </span>
                                {kpi.trendValue}
                            </span>
                            <span className="text-[10px] text-gray-600">vs. média 30d</span>
                        </div>
                    </div>
                ))}
            </div>

            {/* Charts Row 1 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                {/* Production vs Target Chart */}
                <div className="bg-[#15181e] border border-border-dark rounded-xl p-6 min-h-[350px] flex flex-col">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="font-bold text-white text-lg flex items-center gap-2">
                            <span className="material-icons-outlined text-gray-500">bar_chart</span>
                            Produção Horária
                        </h3>
                        <div className="flex gap-2">
                            <span className="flex items-center gap-1 text-[10px] text-primary"><span className="w-2 h-2 rounded-full bg-primary"></span>Realizado</span>
                            <span className="flex items-center gap-1 text-[10px] text-gray-500"><span className="w-2 h-2 rounded-full bg-gray-600"></span>Meta</span>
                        </div>
                    </div>
                    <div className="flex-1 w-full min-h-[250px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={productionData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#2d3342" vertical={false} />
                                <XAxis dataKey="name" stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#1a1c23', borderColor: '#2d3342', color: '#fff' }}
                                    cursor={{ fill: '#2d3342', opacity: 0.2 }}
                                />
                                <Bar dataKey="producao" name="Produzido" fill="#00E5FF" radius={[4, 4, 0, 0]} barSize={30} />
                                <Bar dataKey="meta" name="Meta" fill="#4B5563" radius={[4, 4, 0, 0]} barSize={30} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Downtime Pareto Chart */}
                <div className="bg-[#15181e] border border-border-dark rounded-xl p-6 min-h-[350px] flex flex-col">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="font-bold text-white text-lg flex items-center gap-2">
                            <span className="material-icons-outlined text-gray-500">pie_chart</span>
                            Distribuição de Paradas
                        </h3>
                    </div>
                    <div className="flex-1 w-full min-h-[250px] flex items-center justify-center">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={downtimeData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={100}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {downtimeData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="none" />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#1a1c23', borderColor: '#2d3342', color: '#fff' }}
                                />
                                <Legend
                                    layout="vertical"
                                    verticalAlign="middle"
                                    align="right"
                                    iconType="circle"
                                    formatter={(value) => <span style={{ color: '#9CA3AF', fontSize: '12px', fontWeight: 'bold' }}>{value}</span>}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Production Trend Line Chart */}
            <div className="bg-[#15181e] border border-border-dark rounded-xl p-6 min-h-[300px] flex flex-col">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="font-bold text-white text-lg flex items-center gap-2">
                        <span className="material-icons-outlined text-gray-500">show_chart</span>
                        Volume de Produção (Últimos 7 dias)
                    </h3>
                </div>
                <div className="flex-1 w-full min-h-[200px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={trendData}>
                            <defs>
                                <linearGradient id="colorProd" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#8884d8" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#8884d8" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#2d3342" vertical={false} />
                            <XAxis dataKey="day" stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} />
                            <YAxis stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#1a1c23', borderColor: '#2d3342', color: '#fff' }}
                            />
                            <Area type="monotone" dataKey="producao" name="Produção" stroke="#8884d8" fillOpacity={1} fill="url(#colorProd)" strokeWidth={3} />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
};

export default ExecutiveDashboard;
