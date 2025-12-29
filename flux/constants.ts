
import { ProductionOrder, MachineData, MachineStatus, RecentRecord, RoleConfig, UserRole, Permission, AppUser } from './types';

export const ROLE_CONFIGS: RoleConfig[] = [
  {
    role: 'OPERATOR',
    label: 'Operador',
    description: 'Acesso às operações de máquina e registros de produção.',
    permissions: [Permission.VIEW_OPERATOR_DASHBOARD, Permission.MANAGE_MACHINE_SETUP]
  },
  {
    role: 'SUPERVISOR',
    label: 'Supervisor',
    description: 'Visão geral da fábrica, performance e relatórios.',
    permissions: [
      Permission.VIEW_OPERATOR_DASHBOARD,
      Permission.VIEW_SUPERVISOR_DASHBOARD,
      Permission.VIEW_REPORTS
    ]
  },
  {
    role: 'ADMIN',
    label: 'Administrador',
    description: 'Acesso total ao sistema, gestão de usuários e permissões.',
    permissions: Object.values(Permission) as Permission[]
  }
];

export const MOCK_APP_USERS: AppUser[] = [
  { id: 'OP-492', name: 'John Doe', role: 'OPERATOR', avatar: 'JD', sector: 'Usinagem' },
  { id: 'SV-002', name: 'João Supervisor', role: 'SUPERVISOR', avatar: 'JS', sector: 'Geral' },
  { id: 'AD-003', name: 'Admin User', role: 'ADMIN', avatar: 'AU', sector: 'TI' }
];

export const MOCK_MACHINES: MachineData[] = [
  {
    id: '1',
    nome: 'CNC-01',
    codigo: '883-A',
    setor_id: '1',
    // description: '5-Axis Milling Center', // Property not in MachineData
    // imageUrl: '...',
    status_atual: MachineStatus.AVAILABLE,
    created_at: new Date().toISOString()
  },
  {
    id: '2',
    nome: 'CNC-02',
    codigo: '883-B',
    setor_id: '1',
    status_atual: MachineStatus.IN_USE,
    operador_atual_id: 'M. Smith',
    created_at: new Date().toISOString()
  },
  {
    id: '3',
    nome: 'LATHE-01',
    codigo: '402-L',
    setor_id: '1',
    status_atual: MachineStatus.MAINTENANCE,
    created_at: new Date().toISOString()
  },
  {
    id: '4',
    nome: 'MILL-05',
    codigo: '901-M',
    setor_id: '1',
    status_atual: MachineStatus.AVAILABLE,
    created_at: new Date().toISOString()
  },
  {
    id: '5',
    nome: 'DRILL-02',
    codigo: '300-D',
    setor_id: '1',
    status_atual: MachineStatus.AVAILABLE,
    created_at: new Date().toISOString()
  },
  {
    id: '6',
    nome: 'PRESS-09',
    codigo: '772-P',
    setor_id: '1',
    status_atual: MachineStatus.IN_USE,
    operador_atual_id: 'J. Doe',
    created_at: new Date().toISOString()
  }
];

export const MOCK_ORDERS: ProductionOrder[] = [
  {
    id: 'OP-2023-4921',
    codigo: 'OP-4921',
    nome_produto: 'Painel Frontal - Modelo X5',
    prioridade: 'ALTA',
    quantidade_meta: 500,
    ciclo_estimado: '45s',
    material: 'Polímero ABS',
    status: 'PENDENTE',
    data_emissao: '2023-10-14'
  },
  {
    id: 'OP-2023-4925',
    codigo: 'OP-4925',
    nome_produto: 'Suporte Lateral Esq.',
    prioridade: 'NORMAL',
    quantidade_meta: 1200,
    ciclo_estimado: '22s',
    material: 'Polímero ABS',
    status: 'EM_ANDAMENTO',
    data_emissao: '2023-10-15'
  }
];

export const MOCK_RECORDS: RecentRecord[] = [
  { time: '14:55', event: 'Troca de Turno', detail: 'Mario substituiu João', user: 'Mario', status: 'OK' },
  { time: '14:30', event: 'Fim de Lote', detail: 'OP-2023-4910 Finalizada', user: 'João', status: 'Finalizado' }
];
