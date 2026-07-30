import { ToolItem, ShiftRegistration, MaintenanceItem, PurchaseRequest, CompanyConfig, User, BerthTurnUpdate } from '../types';

export const INITIAL_USER: User | null = null;

export const INITIAL_CONFIG: CompanyConfig = {
  companyName: 'Instalação Corporativa',
  systemSubtitle: 'Ambiente operacional pronto para integração',
  cnpj: '',
  terminalName: 'Terminal BTP',
  activeBerths: [],
  logoUrl: '',
  supervisorsList: [],
  operatorsList: [],
  themeMode: 'light',
  enableNotifications: true,
  minStockGlobalThreshold: 4,
  firebaseEnabled: false,
};

export const INITIAL_TOOLS: ToolItem[] = [];

export const INITIAL_SHIFTS: ShiftRegistration[] = [];

export const INITIAL_MAINTENANCE: MaintenanceItem[] = [];

export const INITIAL_PURCHASES: PurchaseRequest[] = [];

export const INITIAL_BERTH_TURN_UPDATES: BerthTurnUpdate[] = [];
