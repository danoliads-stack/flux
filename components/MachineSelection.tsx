import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';
import { MachineData, MachineStatus, AppUser } from '../types';
import { logger } from '../src/utils/logger';

interface MachineSelectionProps {
  user: AppUser;
  machines: MachineData[];
  onSelect: (machine: MachineData) => void;
  onLogout: () => void;
}

const MachineSelection: React.FC<MachineSelectionProps> = ({ user, machines: propMachines, onSelect, onLogout }) => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<'ALL' | string>('ALL');
  const [machines, setMachines] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMachines = async () => {
      setLoading(true);
      logger.log('Fetching machines for user:', user.name, 'setor_id:', user.setor_id);

      // Build query - filter by operator's sector if setor_id exists
      let query = supabase
        .from('maquinas')
        .select('*, setores(nome)')
        .order('nome');

      // If operator has a sector, only show machines from that sector
      if (user.setor_id) {
        query = query.eq('setor_id', user.setor_id);
      }

      const { data, error } = await query;

      logger.log('Machines result:', { data, error, setor_id: user.setor_id });

      if (error) {
        logger.error('Error fetching machines:', error);
        setLoading(false);
        return;
      }

      if (data) {
        const abstractImages = [
          "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=800&auto=format&fit=crop",
          "https://images.unsplash.com/photo-1614850523296-d8c1af93d400?q=80&w=800&auto=format&fit=crop",
          "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?q=80&w=800&auto=format&fit=crop",
          "https://images.unsplash.com/photo-1634017839464-5c339ebe3cb4?q=80&w=800&auto=format&fit=crop",
          "https://images.unsplash.com/photo-1557683316-973673baf926?q=80&w=800&auto=format&fit=crop",
          "https://images.unsplash.com/photo-1579546929518-9e396f3cc809?q=80&w=800&auto=format&fit=crop",
          "https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=800&auto=format&fit=crop",
          "https://images.unsplash.com/photo-1534972195531-d756b9bfa9f2?q=80&w=800&auto=format&fit=crop"
        ];

        // Map to expected format
        const mapped = data.map((m, index) => ({
          ...m,
          id: m.id,
          nome: m.nome,
          codigo: m.codigo,
          status_atual: m.status_atual || 'AVAILABLE',
          setor_nome: m.setores?.nome || 'N/A',
          imageUrl: abstractImages[index % abstractImages.length]
        }));
        logger.log('Mapped machines:', mapped.length, 'for sector:', user.setor_id);
        setMachines(mapped);
      }
      setLoading(false);
    };
    fetchMachines();
  }, [user.setor_id]);

  const filteredMachines = machines.filter(m => {
    const matchesSearch = m.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.codigo.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filter === 'ALL' || m.status_atual === filter;
    return matchesSearch && matchesFilter;
  });

  const statusCounts = {
    total: machines.length,
    disponivel: machines.filter(m => m.status_atual === 'AVAILABLE').length,
    produzindo: machines.filter(m => m.status_atual === 'RUNNING' || m.status_atual === 'SETUP').length,
    parada: machines.filter(m => m.status_atual === 'STOPPED').length,
    manutencao: machines.filter(m => m.status_atual === 'MAINTENANCE').length,
  };

  return (
    <div className="min-h-screen bg-[#0b0c10] text-[#f3f4f6] flex flex-col font-body">
      {/* Header - Responsivo */}
      <header className="border-b border-[#2d3342]/30 bg-[#0b0c10] sticky top-0 z-20">
        <div className="flex items-center justify-between px-4 md:px-8 py-3 md:py-4">
          <div className="flex items-center gap-2 md:gap-4">
            <img
              src="/assets/logo-horizontal.png"
              alt="FLUX Logo"
              className="h-8 md:h-10 w-auto object-contain"
            />
            <div className="hidden md:block w-px h-6 bg-[#2d3342] mx-2"></div>
            <span className="hidden md:block text-white font-bold tracking-tight uppercase text-sm font-display">Painel do Operador</span>
          </div>

          <div className="flex items-center gap-3 md:gap-6">
            <div className="flex items-center gap-2 md:gap-3">
              <div className="hidden sm:block text-right">
                <p className="text-xs md:text-sm font-bold text-white">{user.name}</p>
                <p className="text-[9px] md:text-[10px] text-gray-500 font-bold uppercase">Matrícula: {user.matricula || user.id}</p>
              </div>
              <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-xs md:text-sm">
                {user.name?.substring(0, 2).toUpperCase()}
              </div>
            </div>
            <button
              onClick={() => {
                onLogout();
                navigate('/login');
              }}
              className="px-3 md:px-4 py-1.5 md:py-2 bg-[#15181e] border border-[#2d3342] text-white text-[10px] md:text-xs font-bold rounded-lg hover:bg-danger/20 hover:border-danger/30 hover:text-danger transition-all uppercase"
            >
              <span className="hidden sm:inline">Sair</span>
              <span className="material-icons-outlined sm:hidden text-base">logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 w-full px-4 md:px-8 py-6 md:py-10 overflow-y-auto">
        {/* Title */}
        <div className="mb-6 md:mb-8 animate-fade-in">
          <h1 className="text-2xl md:text-4xl lg:text-5xl font-display font-black tracking-tight text-white uppercase">
            Selecione a Máquina
          </h1>
          <p className="text-gray-500 text-sm md:text-base mt-1">
            Escolha uma máquina disponível para iniciar seu turno.
          </p>
        </div>

        {/* Stats Cards - Responsivo */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
          <div className="bg-[#15181e] border border-[#2d3342] rounded-xl p-3 md:p-4">
            <p className="text-[10px] md:text-xs text-gray-500 uppercase font-bold">Total</p>
            <p className="text-xl md:text-2xl font-bold text-white">{statusCounts.total}</p>
          </div>
          <div className="bg-[#15181e] border border-secondary/20 rounded-xl p-3 md:p-4">
            <p className="text-[10px] md:text-xs text-secondary uppercase font-bold">Disponíveis</p>
            <p className="text-xl md:text-2xl font-bold text-secondary">{statusCounts.disponivel}</p>
          </div>
          <div className="bg-[#15181e] border border-primary/20 rounded-xl p-3 md:p-4">
            <p className="text-[10px] md:text-xs text-primary uppercase font-bold">Produzindo</p>
            <p className="text-xl md:text-2xl font-bold text-primary">{statusCounts.produzindo}</p>
          </div>
          <div className="bg-[#15181e] border border-red-500/20 rounded-xl p-3 md:p-4">
            <p className="text-[10px] md:text-xs text-red-500 uppercase font-bold">Paradas</p>
            <p className="text-xl md:text-2xl font-bold text-red-500">{statusCounts.parada}</p>
          </div>
          <div className="bg-[#15181e] border border-orange-500/20 rounded-xl p-3 md:p-4">
            <p className="text-[10px] md:text-xs text-orange-500 uppercase font-bold">Manutenção</p>
            <p className="text-xl md:text-2xl font-bold text-orange-500">{statusCounts.manutencao}</p>
          </div>
        </div>

        {/* Toolbar - Responsivo */}
        <div className="bg-[#15181e] p-3 md:p-4 rounded-xl border border-[#2d3342]/40 flex flex-col md:flex-row gap-3 mb-6 shadow-xl">
          <div className="relative flex-1">
            <span className="material-icons-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-lg md:text-xl">search</span>
            <input
              type="text"
              placeholder="Buscar por nome ou código..."
              className="w-full bg-[#0b0c10] border border-[#2d3342] rounded-lg py-2.5 md:py-3 pl-10 md:pl-12 pr-4 text-sm text-white focus:ring-1 focus:ring-primary transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1 md:pb-0">
            <FilterButton label="Todas" active={filter === 'ALL'} onClick={() => setFilter('ALL')} />
            <FilterButton label="Disponível" dotColor="bg-secondary" active={filter === 'AVAILABLE'} onClick={() => setFilter('AVAILABLE')} />
            <FilterButton label="Produzindo" dotColor="bg-primary" active={filter === 'RUNNING'} onClick={() => setFilter('RUNNING')} />
            <FilterButton label="Parada" dotColor="bg-red-500" active={filter === 'STOPPED'} onClick={() => setFilter('STOPPED')} />
            <FilterButton label="Manutenção" dotColor="bg-orange-500" active={filter === 'MAINTENANCE'} onClick={() => setFilter('MAINTENANCE')} />
          </div>
        </div>

        {/* Grid - Responsivo */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <span className="material-icons-outlined animate-spin text-4xl text-primary mr-3">sync</span>
            <span className="text-gray-500">Carregando máquinas...</span>
          </div>
        ) : filteredMachines.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-500">
            <span className="material-icons-outlined text-6xl mb-4">precision_manufacturing</span>
            <p>Nenhuma máquina encontrada.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6 pb-10">
            {filteredMachines.map(machine => (
              <MachineCard
                key={machine.id}
                machine={machine}
                currentUserId={user.id}
                onSelect={() => onSelect(machine as MachineData)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

const FilterButton = ({ label, dotColor, active, onClick }: { label: string, dotColor?: string, active: boolean, onClick: () => void }) => (
  <button
    onClick={onClick}
    className={`px-3 md:px-4 py-2 rounded-lg text-[10px] md:text-xs font-bold flex items-center gap-1.5 md:gap-2 transition-all border uppercase tracking-wide whitespace-nowrap ${active ? 'bg-primary border-primary text-white shadow-glow' : 'bg-[#1f242d] border-[#2d3342] text-gray-400 hover:text-white'
      }`}
  >
    {dotColor && <span className={`w-1.5 h-1.5 md:w-2 md:h-2 rounded-full ${dotColor}`}></span>}
    {label}
  </button>
);

interface MachineCardProps {
  machine: any;
  currentUserId: string;
  onSelect: () => void;
}

const MachineCard: React.FC<MachineCardProps> = ({ machine, currentUserId, onSelect }) => {
  const isOccupied = machine.operador_atual_id && machine.operador_atual_id !== currentUserId;
  const isAvailable = !isOccupied && machine.status_atual === 'AVAILABLE';
  const isProducing = !isOccupied && (machine.status_atual === 'RUNNING' || machine.status_atual === 'SETUP');
  const isStopped = !isOccupied && machine.status_atual === 'STOPPED';
  const isMaintenance = !isOccupied && machine.status_atual === 'MAINTENANCE';

  const getStatusConfig = () => {
    if (isOccupied) return {
      bg: 'bg-surface-dark border-white/5 opacity-60',
      border: 'border-white/10',
      glow: '',
      text: 'text-gray-500',
      dot: 'bg-gray-500',
      icon: 'lock',
      label: 'Ocupada'
    };
    if (isAvailable) return {
      bg: 'bg-gradient-to-br from-emerald-500/20 to-emerald-600/10',
      border: 'border-emerald-500/40',
      glow: 'shadow-emerald-500/20',
      text: 'text-emerald-400',
      dot: 'bg-emerald-400',
      icon: 'check_circle',
      label: 'Disponível'
    };
    if (isProducing) return {
      bg: 'bg-gradient-to-br from-blue-500/20 to-cyan-500/10',
      border: 'border-blue-500/40',
      glow: 'shadow-blue-500/20',
      text: 'text-blue-400',
      dot: 'bg-blue-400',
      icon: 'settings',
      label: machine.status_atual === 'SETUP' ? 'Em Setup' : 'Produzindo'
    };
    if (isStopped) return {
      bg: 'bg-gradient-to-br from-red-500/20 to-rose-500/10',
      border: 'border-red-500/40',
      glow: 'shadow-red-500/20',
      text: 'text-red-400',
      dot: 'bg-red-400',
      icon: 'report_problem',
      label: 'Parada'
    };
    return {
      bg: 'bg-gradient-to-br from-orange-500/20 to-amber-500/10',
      border: 'border-orange-500/40',
      glow: 'shadow-orange-500/20',
      text: 'text-orange-400',
      dot: 'bg-orange-400',
      icon: 'engineering',
      label: 'Manutenção'
    };
  };

  const status = getStatusConfig();

  return (
    <div
      onClick={!isOccupied ? onSelect : undefined}
      className={`group relative flex flex-col ${status.bg} border ${status.border} rounded-2xl overflow-hidden transition-all duration-300 ${!isOccupied ? 'cursor-pointer hover:scale-[1.02] hover:shadow-2xl active:scale-[0.98]' : 'cursor-not-allowed grayscale-[0.5]'} ${status.glow} backdrop-blur-sm`}
    >
      {/* Decorative Corner Accent */}
      <div className={`absolute top-0 right-0 w-24 h-24 ${status.bg} opacity-50 blur-2xl`}></div>

      {/* Header with Icon */}
      <div className="relative p-5 pb-3">
        <div className="flex items-start justify-between">
          {/* Machine Icon */}
          <div className={`w-14 h-14 rounded-xl ${status.bg} border ${status.border} flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}>
            <span className={`material-icons-outlined text-2xl ${status.text}`}>precision_manufacturing</span>
          </div>

          {/* Status Badge */}
          <div className={`px-3 py-1.5 rounded-full flex items-center gap-2 bg-black/30 border ${status.border} backdrop-blur-sm`}>
            <span className={`w-2 h-2 rounded-full ${status.dot} ${isProducing ? 'animate-pulse' : ''}`}></span>
            <span className={`${status.text} text-[10px] font-black uppercase tracking-widest`}>
              {status.label}
            </span>
          </div>
        </div>

        {/* Machine Name & Code */}
        <div className="mt-4">
          <h3 className="text-xl font-display font-black text-white uppercase tracking-tight group-hover:text-primary transition-colors">
            {machine.nome}
          </h3>
          <p className="text-xs text-gray-500 font-mono mt-0.5">{machine.codigo}</p>
        </div>
      </div>

      {/* Stats Row */}
      <div className="px-5 py-3 border-t border-white/5 bg-black/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-icons-outlined text-sm text-gray-500">location_on</span>
            <span className="text-xs text-gray-400 font-medium">{machine.setor_nome}</span>
          </div>

          {/* Action Indicator */}
          <div className={`flex items-center gap-1.5 ${status.text} opacity-0 ${!isOccupied && 'group-hover:opacity-100'} transition-opacity duration-300`}>
            {isOccupied ? (
              <>
                <span className="text-xs font-bold uppercase">Bloqueada</span>
                <span className="material-icons-outlined text-sm">lock</span>
              </>
            ) : (
              <>
                <span className="text-xs font-bold uppercase">Selecionar</span>
                <span className="material-icons-outlined text-sm">arrow_forward</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Indicator Bar */}
      <div className={`h-1 ${isAvailable ? 'bg-gradient-to-r from-emerald-500 to-emerald-400' :
        isProducing ? 'bg-gradient-to-r from-blue-500 to-cyan-400' :
          'bg-gradient-to-r from-red-500 to-rose-400'
        }`}></div>
    </div>
  );
};

export default MachineSelection;
