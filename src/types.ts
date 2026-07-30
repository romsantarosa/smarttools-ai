export type UserRole = 'Operador' | 'Supervisor' | 'Administrador';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatarUrl?: string;
  registrationNumber: string; // Matrícula BTP
  phone?: string;
  shiftTurn?: ShiftTurn;
}

export type ShiftTurn = '07-13' | '13-19' | '19-01' | '01-07';

export interface ToolItem {
  id: string;
  name: string;
  available: number;
  inMaintenance: number;
  total: number; // available + inMaintenance
  minStock: number;
  category: 'Varas de Destravamento' | 'Mão de Força & Trava' | 'Equipamentos Especiais';
  qrCodePrefix: string;
  updatedAt: string;
  lastInspector?: string;
}

export interface ShiftMovementItem {
  toolId: string;
  toolName: string;
  quantityOut: number;
  quantityIn: number;
}

export interface GangMaterial {
  id: string;
  toolId: string;
  toolName: string;
  quantity: number;
}

export interface GangDetail {
  gangNumber: number; // Terno 1, Terno 2, Terno 3...
  materials: GangMaterial[];
  totalMaterialsCount: number;
  notes?: string;
}

export interface BerthTurnUpdate {
  id: string;
  date: string; // YYYY-MM-DD
  turn: ShiftTurn; // '07-13' | '13-19' | '19-01' | '01-07'
  berth: 'Ponto 1' | 'Ponto 2' | 'Ponto 3'; // Ponto 1, Ponto 2, Ponto 3
  shipName: string; // Nome do Navio
  numTernos: number; // Número de ternos
  gangs: GangDetail[]; // Detalhe de materiais em cada terno
  totalMaterials: number; // Número total de materiais no berço/ponto
  observations: string; // Campo Observação
  updatedBy: string;
  updatedAt: string;
}

export interface ShiftRegistration {
  id: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  operatorName: string;
  supervisorName: string;
  turn: ShiftTurn;
  shipName: string; // Navio
  voyage: string; // Viagem (ex: 2026-08)
  berth: string; // Berço 1, Berço 2, Berço 3
  observations: string;
  movements: ShiftMovementItem[];
  status: 'Ativo' | 'Finalizado';
  createdAt: string;
}

export interface MaintenanceItem {
  id: string;
  toolId: string;
  toolName: string;
  quantity: number;
  reason: string;
  responsible: string;
  date: string; // YYYY-MM-DD
  time?: string;
  status: 'Aguardando' | 'Em manutenção' | 'Concluído';
  completedAt?: string;
  notes?: string;
}

export type UrgencyLevel = 'Baixa' | 'Média' | 'Alta';
export type PurchaseStatus = 'Solicitado' | 'Aprovado' | 'Comprado' | 'Recebido';

export interface PurchaseRequest {
  id: string;
  toolId: string;
  toolName: string;
  quantity: number;
  urgency: UrgencyLevel;
  reason: string;
  status: PurchaseStatus;
  requestedBy: string;
  date: string;
  estimatedCost?: number;
  approvedBy?: string;
  updatedAt?: string;
}

export interface AIOpinionLog {
  id: string;
  date: string;
  time: string;
  supervisorName: string;
  opinion: string;
  recommendations: string[];
  riskLevel: 'BAIXO' | 'MÉDIO' | 'ALTO';
}

export interface CompanyConfig {
  companyName: string; // ex: Brasil Terminal Portuário S.A.
  systemSubtitle: string;
  cnpj: string;
  terminalName: string; // BTP Alemoa Santos
  activeBerths: string[];
  logoUrl: string;
  supervisorsList: string[];
  operatorsList: string[];
  themeMode: 'light' | 'dark';
  enableNotifications: boolean;
  minStockGlobalThreshold: number;
  firebaseEnabled: boolean;
}

export interface ShipInfo {
  id: string;
  name: string;
  company?: string;
  castanha: string;
  macaco: string;
  peacao: string;
  details: string;
  hasPeDeGalinha: boolean;
  twinStatus?: string;
  warnings?: string[];
  updatedAt?: string;
}

export interface BtpShipRecord {
  imo: string;
  navio: string;
  mv?: string;
  movimento: string; // 'Atracação' | 'Desatracação' | 'Remanejamento' | 'Entrada' | 'Saída' | 'Fundeado'
  berco: string; // 'BTP-1' | 'BTP-2' | 'BTP-3'
  horario: string; // HH:mm
  data: string; // YYYY-MM-DD
  situacao: string; // 'Confirmado' | 'Em Andamento' | 'Previsto' | 'Concluído' | 'Fundeado'
  status?: string;
  agencia?: string;
  pratico?: string;
  observacoes?: string;
  loc1?: string;
  loc2?: string;
}

export interface BtpSummaryResponse {
  atracados: BtpShipRecord[];
  previstos: BtpShipRecord[];
  movimentos: BtpShipRecord[];
  fundeados: BtpShipRecord[];
  timestamp: string;
  cacheTimeRemainingSeconds: number;
  isMockData?: boolean;
}

