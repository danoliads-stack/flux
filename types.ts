
export type UserRole = 'OPERATOR' | 'SUPERVISOR' | 'ADMIN';
export type UserPerspective = UserRole | 'LOGIN' | 'MACHINE_SELECTION' | 'TRACEABILITY' | 'REPORTS';
export type OPState = 'IDLE' | 'SETUP' | 'PRODUCAO' | 'PARADA' | 'SUSPENSA' | 'FINALIZADA';

export enum Permission {
  VIEW_OPERATOR_DASHBOARD = 'VIEW_OPERATOR_DASHBOARD',
  VIEW_SUPERVISOR_DASHBOARD = 'VIEW_SUPERVISOR_DASHBOARD',
  VIEW_ADMIN_DASHBOARD = 'VIEW_ADMIN_DASHBOARD',
  MANAGE_MACHINE_SETUP = 'MANAGE_MACHINE_SETUP',
  MANAGE_USERS = 'MANAGE_USERS',
  MANAGE_ROLES = 'MANAGE_ROLES',
  VIEW_REPORTS = 'VIEW_REPORTS'
}

export interface RoleConfig {
  role: UserRole;
  label: string;
  description: string;
  permissions: Permission[];
}

export interface AppUser {
  id: string;
  name: string;
  role: UserRole;
  avatar: string;
  sector: string;
  setor_id?: string;
  turno?: string;
  matricula?: string;
}

export enum MachineStatus {
  RUNNING = 'RUNNING',
  SETUP = 'SETUP',
  STOPPED = 'STOPPED',
  IDLE = 'IDLE',
  SUSPENDED = 'SUSPENDED',
  AVAILABLE = 'AVAILABLE',
  IN_USE = 'IN_USE',
  MAINTENANCE = 'MAINTENANCE'
}

export interface MachineData {
  id: string; // UUID in DB
  nome: string;
  codigo: string;
  setor_id: string;
  status_atual: MachineStatus;
  operador_atual_id?: string;
  op_atual_id?: string;
  created_at: string;
  updated_at?: string;
  data_emissao?: string; // For sorting
  realized?: number;
  oee?: number;
  stopReason?: string;
  status_change_at?: string;
  ordens_producao?: { codigo: string } | null;
  operadores?: { nome: string } | null;
}

export interface ProductionOrder {
  id: string; // UUID in DB
  codigo: string;
  nome_produto: string;
  prioridade: 'ALTA' | 'NORMAL' | 'BAIXA';
  quantidade_meta: number;
  ciclo_estimado: string;
  material: string;
  status: 'PENDENTE' | 'EM_ANDAMENTO' | 'SUSPENSA' | 'FINALIZADA';
  data_emissao: string;
  maquina_id?: string | null;
  posicao_sequencia?: number | null;
}

export interface RecentRecord {
  time: string;
  event: string;
  detail: string;
  user: string;
  status: string;
}

export type ChecklistAcionamento = 'tempo' | 'quantidade';
export type ChecklistStatus = 'ok' | 'problema';

export interface ChecklistEvento {
  id: string;
  op_id: string;
  operador_id: string;
  maquina_id: string;
  setor_id: string;
  tipo_acionamento: ChecklistAcionamento;
  referencia_acionamento: string;
  status: ChecklistStatus;
  observacao?: string;
  created_at: string;
}

export interface DiarioBordoEvento {
  id: string;
  op_id: string;
  operador_id: string;
  maquina_id: string;
  setor_id: string;
  descricao: string;
  created_at: string;
}

export interface LoteRastreabilidade {
  id: string;
  op_id: string;
  setor_origem_id: string;
  setor_destino_id?: string;
  maquina_id: string;
  quantidade_liberada: number;
  quantidade_refugo: number;
  created_at: string;
}

export interface Setor {
  id: string;
  nome: string;
}

export interface ChecklistTemplate {
  id: string;
  nome: string;
  descricao: string | null;
  tipo: string;
  setor_id: string | null;
  intervalo_minutos: number;
  prioridade: string;
  obrigatorio: boolean;
  ativo: boolean;
  quantidade_itens?: number;
  // Optional for UI logic
  setores?: { nome: string };
  checklist_items?: ChecklistItem[];
}

export interface ChecklistItem {
  id: string;
  checklist_id: string;
  descricao: string;
  tipo_resposta: 'CHECKBOX' | 'TEXTO' | 'NUMERO' | 'FOTO';
  ordem: number;
  obrigatorio: boolean;
  ativo: boolean;
}

export interface ChecklistResposta {
  item_id: string;
  valor: string | boolean | number;
  foto_url?: string;
}
