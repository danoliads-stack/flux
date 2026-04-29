import { AppUser } from '../../types';

export const mockOperator: AppUser = {
  id: 'op-001',
  name: 'JOSEMAR',
  role: 'OPERATOR',
  avatar: 'JO',
  sector: 'CORTE VINCO',
  setor_id: 'setor-001',
  turno: 'Turno 1',
  matricula: '3333',
};

export const mockAdmin: AppUser = {
  id: 'admin-001',
  name: 'Admin User',
  role: 'ADMIN',
  avatar: 'AU',
  sector: 'Administração',
};

export const mockSupervisor: AppUser = {
  id: 'sup-001',
  name: 'Supervisor',
  role: 'SUPERVISOR',
  avatar: 'SU',
  sector: 'Administração',
};
