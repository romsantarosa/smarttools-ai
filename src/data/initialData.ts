import { ToolItem, ShiftRegistration, MaintenanceItem, PurchaseRequest, CompanyConfig, User, BerthTurnUpdate } from '../types';

export const INITIAL_USER: User = {
  id: 'usr-001',
  name: 'Carlos Eduardo Santos',
  email: 'carlos.santos@btp.com.br',
  role: 'Supervisor',
  registrationNumber: 'BTP-9082',
  avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=250',
  phone: '+55 (13) 99781-4433',
  shiftTurn: '07-13',
};

export const INITIAL_CONFIG: CompanyConfig = {
  companyName: 'Brasil Terminal Portuário S.A. (BTP)',
  systemSubtitle: 'Sistema Inteligente de Controle de Ferramentas Operacionais',
  cnpj: '08.402.119/0001-44',
  terminalName: 'Terminal de Containers BTP - Porto de Santos',
  activeBerths: ['Ponto 1', 'Ponto 2', 'Ponto 3'],
  logoUrl: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&q=80&w=200',
  supervisorsList: [
    'Bolacha',
    'Thiago',
    'Conde',
    'Gasolina',
    'XTudo',
  ],
  operatorsList: [
    'João Paulo Souza',
    'Marcos Vinícius Lima',
    'Lucas Mendes',
    'Tiago Barbosa',
    'Alexandre Prado',
    'Diego Ferreira',
  ],
  themeMode: 'light',
  enableNotifications: true,
  minStockGlobalThreshold: 4,
  firebaseEnabled: false,
};

export const INITIAL_TOOLS: ToolItem[] = [
  {
    id: 'tool-001',
    name: 'Vara 2 metros',
    available: 18,
    inMaintenance: 2,
    total: 20,
    minStock: 5,
    category: 'Varas de Destravamento',
    qrCodePrefix: 'BTP-V2M',
    updatedAt: new Date().toISOString(),
    lastInspector: 'Carlos Eduardo Santos',
  },
  {
    id: 'tool-002',
    name: 'Vara 3 metros',
    available: 14,
    inMaintenance: 1,
    total: 15,
    minStock: 4,
    category: 'Varas de Destravamento',
    qrCodePrefix: 'BTP-V3M',
    updatedAt: new Date().toISOString(),
    lastInspector: 'Roberto Silveira',
  },
  {
    id: 'tool-003',
    name: 'Vara 6 metros',
    available: 4,
    inMaintenance: 3,
    total: 7,
    minStock: 6, // ALERT: Available (4) <= Min (6) -> Warning/Alert
    category: 'Varas de Destravamento',
    qrCodePrefix: 'BTP-V6M',
    updatedAt: new Date().toISOString(),
    lastInspector: 'João Paulo Souza',
  },
  {
    id: 'tool-004',
    name: 'Vara 9 metros',
    available: 2,
    inMaintenance: 2,
    total: 4,
    minStock: 5, // CRITICAL: Available (2) <= Min (5) -> Critical Alert
    category: 'Varas de Destravamento',
    qrCodePrefix: 'BTP-V9M',
    updatedAt: new Date().toISOString(),
    lastInspector: 'Marcos Vinícius Lima',
  },
  {
    id: 'tool-005',
    name: 'Spanner (Mão de Força)',
    available: 12,
    inMaintenance: 1,
    total: 13,
    minStock: 4,
    category: 'Mão de Força & Trava',
    qrCodePrefix: 'BTP-SPN',
    updatedAt: new Date().toISOString(),
    lastInspector: 'Lucas Mendes',
  },
  {
    id: 'tool-006',
    name: 'Trava Pneumática de Torção',
    available: 8,
    inMaintenance: 0,
    total: 8,
    minStock: 3,
    category: 'Equipamentos Especiais',
    qrCodePrefix: 'BTP-TPN',
    updatedAt: new Date().toISOString(),
    lastInspector: 'Fernando Alencar',
  },
];

export const INITIAL_SHIFTS: ShiftRegistration[] = [
  {
    id: 'shift-101',
    date: new Date().toISOString().split('T')[0],
    time: '07:30',
    operatorName: 'João Paulo Souza',
    supervisorName: 'Carlos Eduardo Santos',
    turn: '07-13',
    shipName: 'Cap San Augustin',
    voyage: 'BTP-2026-088',
    berth: 'Ponto 1',
    observations: 'Operação de destravamento de containers iniciada sem anomalias nas pontes.',
    movements: [
      { toolId: 'tool-001', toolName: 'Vara 2 metros', quantityOut: 4, quantityIn: 4 },
      { toolId: 'tool-003', toolName: 'Vara 6 metros', quantityOut: 2, quantityIn: 2 },
      { toolId: 'tool-005', toolName: 'Spanner (Mão de Força)', quantityOut: 2, quantityIn: 2 },
    ],
    status: 'Finalizado',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'shift-102',
    date: new Date().toISOString().split('T')[0],
    time: '13:15',
    operatorName: 'Marcos Vinícius Lima',
    supervisorName: 'Roberto Silveira',
    turn: '13-19',
    shipName: 'Maersk Leticia',
    voyage: 'BTP-2026-089',
    berth: 'Ponto 2',
    observations: 'Dois spanners necessitaram troca devido ao desgaste na rosca de retenção.',
    movements: [
      { toolId: 'tool-002', toolName: 'Vara 3 metros', quantityOut: 3, quantityIn: 3 },
      { toolId: 'tool-004', toolName: 'Vara 9 metros', quantityOut: 2, quantityIn: 1 },
      { toolId: 'tool-005', toolName: 'Spanner (Mão de Força)', quantityOut: 3, quantityIn: 2 },
    ],
    status: 'Ativo',
    createdAt: new Date().toISOString(),
  },
];

export const INITIAL_MAINTENANCE: MaintenanceItem[] = [
  {
    id: 'maint-201',
    toolId: 'tool-003',
    toolName: 'Vara 6 metros',
    quantity: 2,
    reason: 'Fissura na ponteira de encaixe da trava superior.',
    responsible: 'Oficina Central BTP - Técnico Ricardo',
    date: new Date().toISOString().split('T')[0],
    time: '08:45',
    status: 'Em manutenção',
    notes: 'Solda de reforço e calibração estrutural.',
  },
  {
    id: 'maint-202',
    toolId: 'tool-004',
    toolName: 'Vara 9 metros',
    quantity: 2,
    reason: 'Empenamento no tubo de liga de alumínio reforçado.',
    responsible: 'Oficina Externa MetalSants',
    date: new Date().toISOString().split('T')[0],
    time: '10:20',
    status: 'Aguardando',
    notes: 'Aguardando laudo técnico do fornecedor.',
  },
  {
    id: 'maint-203',
    toolId: 'tool-005',
    toolName: 'Spanner (Mão de Força)',
    quantity: 1,
    reason: 'Troca de mola do gatilho de fixação.',
    responsible: 'Manutenção Interna - Técnico Almir',
    date: new Date().toISOString().split('T')[0],
    time: '11:10',
    status: 'Aguardando',
    notes: 'Substituição de gaxetas de fricção.',
  },
];

export const INITIAL_PURCHASES: PurchaseRequest[] = [
  {
    id: 'pur-301',
    toolId: 'tool-004',
    toolName: 'Vara 9 metros',
    quantity: 5,
    urgency: 'Alta',
    reason: 'Estoque abaixo do limite de segurança para escala de navios Post-Panamax.',
    status: 'Aprovado',
    requestedBy: 'Carlos Eduardo Santos',
    date: new Date().toISOString().split('T')[0],
    estimatedCost: 14500.0,
    approvedBy: 'Gerência Operacional',
  },
  {
    id: 'pur-302',
    toolId: 'tool-003',
    toolName: 'Vara 6 metros',
    quantity: 4,
    urgency: 'Média',
    reason: 'Reposição de frota operacional preventiva.',
    status: 'Solicitado',
    requestedBy: 'Roberto Silveira',
    date: new Date().toISOString().split('T')[0],
    estimatedCost: 8200.0,
  },
];

const todayStr = new Date().toISOString().split('T')[0];

export const INITIAL_BERTH_TURN_UPDATES: BerthTurnUpdate[] = [
  // TURNO 07-13
  {
    id: 'btu-001',
    date: todayStr,
    turn: '07-13',
    berth: 'Ponto 1',
    shipName: 'Cap San Augustin',
    numTernos: 3,
    gangs: [
      {
        gangNumber: 1,
        materials: [
          { id: 'm-101', toolId: 'tool-001', toolName: 'Vara 2 metros', quantity: 4 },
          { id: 'm-102', toolId: 'tool-005', toolName: 'Spanner (Mão de Força)', quantity: 2 },
        ],
        totalMaterialsCount: 6,
        notes: 'Ponte 1 - Destravamento proa',
      },
      {
        gangNumber: 2,
        materials: [
          { id: 'm-103', toolId: 'tool-002', toolName: 'Vara 3 metros', quantity: 3 },
          { id: 'm-104', toolId: 'tool-003', toolName: 'Vara 6 metros', quantity: 2 },
        ],
        totalMaterialsCount: 5,
        notes: 'Ponte 2 - Centro navio',
      },
      {
        gangNumber: 3,
        materials: [
          { id: 'm-105', toolId: 'tool-001', toolName: 'Vara 2 metros', quantity: 2 },
          { id: 'm-106', toolId: 'tool-005', toolName: 'Spanner (Mão de Força)', quantity: 2 },
        ],
        totalMaterialsCount: 4,
        notes: 'Ponte 3 - Popa',
      },
    ],
    totalMaterials: 15,
    observations: 'Operação de desembarque fluindo normalmente sem atrasos no Ponto 1.',
    updatedBy: 'Bolacha',
    updatedAt: `${todayStr} 08:30`,
  },
  {
    id: 'btu-002',
    date: todayStr,
    turn: '07-13',
    berth: 'Ponto 2',
    shipName: 'Maersk Leticia',
    numTernos: 3,
    gangs: [
      {
        gangNumber: 1,
        materials: [
          { id: 'm-201', toolId: 'tool-002', toolName: 'Vara 3 metros', quantity: 4 },
          { id: 'm-202', toolId: 'tool-005', toolName: 'Spanner (Mão de Força)', quantity: 3 },
        ],
        totalMaterialsCount: 7,
        notes: 'Terno 1 - Carga pesada',
      },
      {
        gangNumber: 2,
        materials: [
          { id: 'm-203', toolId: 'tool-004', toolName: 'Vara 9 metros', quantity: 2 },
          { id: 'm-204', toolId: 'tool-006', toolName: 'Trava Pneumática', quantity: 2 },
        ],
        totalMaterialsCount: 4,
        notes: 'Terno 2 - High Cube bay 14',
      },
      {
        gangNumber: 3,
        materials: [
          { id: 'm-205', toolId: 'tool-001', toolName: 'Vara 2 metros', quantity: 3 },
          { id: 'm-206', toolId: 'tool-005', toolName: 'Spanner (Mão de Força)', quantity: 2 },
        ],
        totalMaterialsCount: 5,
        notes: 'Terno 3 - Bay 22 proa',
      },
    ],
    totalMaterials: 16,
    observations: 'Troca de spanners realizada às 09:15 devido a folga no encaixe.',
    updatedBy: 'Thiago',
    updatedAt: `${todayStr} 09:45`,
  },
  {
    id: 'btu-003',
    date: todayStr,
    turn: '07-13',
    berth: 'Ponto 3',
    shipName: 'MSC Carmela',
    numTernos: 3,
    gangs: [
      {
        gangNumber: 1,
        materials: [
          { id: 'm-301', toolId: 'tool-001', toolName: 'Vara 2 metros', quantity: 5 },
          { id: 'm-302', toolId: 'tool-003', toolName: 'Vara 6 metros', quantity: 3 },
        ],
        totalMaterialsCount: 8,
      },
      {
        gangNumber: 2,
        materials: [
          { id: 'm-303', toolId: 'tool-005', toolName: 'Spanner (Mão de Força)', quantity: 4 },
        ],
        totalMaterialsCount: 4,
      },
      {
        gangNumber: 3,
        materials: [
          { id: 'm-304', toolId: 'tool-002', toolName: 'Vara 3 metros', quantity: 2 },
          { id: 'm-305', toolId: 'tool-005', toolName: 'Spanner (Mão de Força)', quantity: 2 },
        ],
        totalMaterialsCount: 4,
      },
    ],
    totalMaterials: 16,
    observations: 'Operação com 3 ternos em andamento no Ponto 3.',
    updatedBy: 'Conde',
    updatedAt: `${todayStr} 10:15`,
  },

  // TURNO 13-19
  {
    id: 'btu-004',
    date: todayStr,
    turn: '13-19',
    berth: 'Ponto 1',
    shipName: 'CMA CGM Paraty',
    numTernos: 3,
    gangs: [
      {
        gangNumber: 1,
        materials: [
          { id: 'm-401', toolId: 'tool-001', toolName: 'Vara 2 metros', quantity: 4 },
          { id: 'm-402', toolId: 'tool-002', toolName: 'Vara 3 metros', quantity: 3 },
        ],
        totalMaterialsCount: 7,
      },
      {
        gangNumber: 2,
        materials: [
          { id: 'm-403', toolId: 'tool-005', toolName: 'Spanner (Mão de Força)', quantity: 3 },
        ],
        totalMaterialsCount: 3,
      },
      {
        gangNumber: 3,
        materials: [
          { id: 'm-404', toolId: 'tool-003', toolName: 'Vara 6 metros', quantity: 2 },
          { id: 'm-405', toolId: 'tool-005', toolName: 'Spanner (Mão de Força)', quantity: 2 },
        ],
        totalMaterialsCount: 4,
      },
    ],
    totalMaterials: 14,
    observations: 'Troca de turno efetuada. Material conferido 100%.',
    updatedBy: 'Gasolina',
    updatedAt: `${todayStr} 14:00`,
  },
  {
    id: 'btu-005',
    date: todayStr,
    turn: '13-19',
    berth: 'Ponto 2',
    shipName: 'Maersk Leticia',
    numTernos: 2,
    gangs: [
      {
        gangNumber: 1,
        materials: [
          { id: 'm-501', toolId: 'tool-001', toolName: 'Vara 2 metros', quantity: 3 },
          { id: 'm-502', toolId: 'tool-005', toolName: 'Spanner (Mão de Força)', quantity: 3 },
        ],
        totalMaterialsCount: 6,
      },
      {
        gangNumber: 2,
        materials: [
          { id: 'm-503', toolId: 'tool-002', toolName: 'Vara 3 metros', quantity: 2 },
        ],
        totalMaterialsCount: 2,
      },
    ],
    totalMaterials: 8,
    observations: 'Previsão de término do embarque às 18:00.',
    updatedBy: 'Thiago',
    updatedAt: `${todayStr} 15:20`,
  },
  {
    id: 'btu-006',
    date: todayStr,
    turn: '13-19',
    berth: 'Ponto 3',
    shipName: 'Sem Navio Atracado',
    numTernos: 0,
    gangs: [],
    totalMaterials: 0,
    observations: 'Ponto 3 livre para manutenção preventiva nas cabeças de atracação.',
    updatedBy: 'XTudo',
    updatedAt: `${todayStr} 13:00`,
  },

  // TURNO 19-01
  {
    id: 'btu-007',
    date: todayStr,
    turn: '19-01',
    berth: 'Ponto 1',
    shipName: 'ONE Amazon',
    numTernos: 2,
    gangs: [
      {
        gangNumber: 1,
        materials: [
          { id: 'm-601', toolId: 'tool-001', toolName: 'Vara 2 metros', quantity: 4 },
          { id: 'm-602', toolId: 'tool-005', toolName: 'Spanner (Mão de Força)', quantity: 2 },
        ],
        totalMaterialsCount: 6,
      },
      {
        gangNumber: 2,
        materials: [
          { id: 'm-603', toolId: 'tool-003', toolName: 'Vara 6 metros', quantity: 2 },
        ],
        totalMaterialsCount: 2,
      },
    ],
    totalMaterials: 8,
    observations: 'Atracação confirmada às 19:30. Início das operações noturnas.',
    updatedBy: 'Conde',
    updatedAt: `${todayStr} 20:00`,
  },
  {
    id: 'btu-008',
    date: todayStr,
    turn: '19-01',
    berth: 'Ponto 2',
    shipName: 'Sem Navio Atracado',
    numTernos: 0,
    gangs: [],
    totalMaterials: 0,
    observations: 'Ponto em espera para atracação do navio Hapag-Lloyd às 22:00.',
    updatedBy: 'Gasolina',
    updatedAt: `${todayStr} 19:10`,
  },
  {
    id: 'btu-009',
    date: todayStr,
    turn: '19-01',
    berth: 'Ponto 3',
    shipName: 'MSC Carmela',
    numTernos: 2,
    gangs: [
      {
        gangNumber: 1,
        materials: [
          { id: 'm-701', toolId: 'tool-001', toolName: 'Vara 2 metros', quantity: 3 },
          { id: 'm-702', toolId: 'tool-005', toolName: 'Spanner (Mão de Força)', quantity: 2 },
        ],
        totalMaterialsCount: 5,
      },
      {
        gangNumber: 2,
        materials: [
          { id: 'm-703', toolId: 'tool-002', toolName: 'Vara 3 metros', quantity: 3 },
        ],
        totalMaterialsCount: 3,
      },
    ],
    totalMaterials: 8,
    observations: 'Operação noturna com visibilidade reduzida. Reforço de iluminação ativado.',
    updatedBy: 'Thiago',
    updatedAt: `${todayStr} 21:15`,
  },

  // TURNO 01-07
  {
    id: 'btu-010',
    date: todayStr,
    turn: '01-07',
    berth: 'Ponto 1',
    shipName: 'ONE Amazon',
    numTernos: 2,
    gangs: [
      {
        gangNumber: 1,
        materials: [
          { id: 'm-801', toolId: 'tool-001', toolName: 'Vara 2 metros', quantity: 3 },
          { id: 'm-802', toolId: 'tool-005', toolName: 'Spanner (Mão de Força)', quantity: 2 },
        ],
        totalMaterialsCount: 5,
      },
      {
        gangNumber: 2,
        materials: [
          { id: 'm-803', toolId: 'tool-002', toolName: 'Vara 3 metros', quantity: 2 },
        ],
        totalMaterialsCount: 2,
      },
    ],
    totalMaterials: 7,
    observations: 'Turno de madrugada concluído sem incidentes.',
    updatedBy: 'Bolacha',
    updatedAt: `${todayStr} 06:30`,
  },
  {
    id: 'btu-011',
    date: todayStr,
    turn: '01-07',
    berth: 'Ponto 2',
    shipName: 'Hapag Santos Express',
    numTernos: 2,
    gangs: [
      {
        gangNumber: 1,
        materials: [
          { id: 'm-901', toolId: 'tool-001', toolName: 'Vara 2 metros', quantity: 4 },
          { id: 'm-902', toolId: 'tool-005', toolName: 'Spanner (Mão de Força)', quantity: 2 },
        ],
        totalMaterialsCount: 6,
      },
      {
        gangNumber: 2,
        materials: [
          { id: 'm-903', toolId: 'tool-003', toolName: 'Vara 6 metros', quantity: 2 },
        ],
        totalMaterialsCount: 2,
      },
    ],
    totalMaterials: 8,
    observations: 'Operação iniciada às 02:15 com 2 ternos operacionais.',
    updatedBy: 'Conde',
    updatedAt: `${todayStr} 04:00`,
  },
  {
    id: 'btu-012',
    date: todayStr,
    turn: '01-07',
    berth: 'Ponto 3',
    shipName: 'Sem Navio Atracado',
    numTernos: 0,
    gangs: [],
    totalMaterials: 0,
    observations: 'Ponto livre.',
    updatedBy: 'Gasolina',
    updatedAt: `${todayStr} 01:15`,
  },
];

