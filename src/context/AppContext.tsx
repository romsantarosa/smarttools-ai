import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  User,
  ToolItem,
  ShiftRegistration,
  MaintenanceItem,
  PurchaseRequest,
  PurchaseStatus,
  AIOpinionLog,
  CompanyConfig,
  BerthTurnUpdate,
  ShipInfo,
} from '../types';
import {
  INITIAL_USER,
  INITIAL_CONFIG,
  INITIAL_TOOLS,
  INITIAL_SHIFTS,
  INITIAL_MAINTENANCE,
  INITIAL_PURCHASES,
  INITIAL_BERTH_TURN_UPDATES,
} from '../data/initialData';
import { INITIAL_SHIPS } from '../data/initialShips';
import {
  loginWithFirebase,
  loginWithGoogleFirebase,
  loginWithFacebookFirebase,
  registerWithFirebase,
  resetPasswordFirebase,
  changePasswordFirebase,
  logoutFirebase,
} from '../services/authService';
import {
  subscribeBerthTurnUpdates,
  saveBerthTurnUpdateToFirestore,
  getBerthTurnDocId,
  subscribeShips,
  saveShipToFirestore,
  deleteShipFromFirestore,
  seedShipsCatalogIfEmpty,
} from '../services/dbService';

interface AppContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, role?: User['role']) => void;
  loginWithEmail: (email: string, password: string, role?: User['role']) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  loginWithFacebook: () => Promise<void>;
  registerUser: (data: { email: string; password: string; name: string; role: 'Supervisor' | 'Operador' }) => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  changePassword: (newPassword: string) => Promise<void>;
  logout: () => void;
  
  tools: ToolItem[];
  addTool: (tool: Omit<ToolItem, 'id' | 'total' | 'updatedAt'>) => void;
  updateTool: (id: string, updated: Partial<ToolItem>) => void;
  deleteTool: (id: string) => void;

  ships: ShipInfo[];
  addShip: (ship: Omit<ShipInfo, 'id'>) => void;
  updateShip: (id: string, ship: Partial<ShipInfo>) => void;
  deleteShip: (id: string) => void;
  findShipByName: (name: string) => ShipInfo | undefined;

  shifts: ShiftRegistration[];
  addShift: (shift: Omit<ShiftRegistration, 'id' | 'createdAt'>) => void;

  berthTurnUpdates: BerthTurnUpdate[];
  saveBerthTurnUpdate: (update: Omit<BerthTurnUpdate, 'id' | 'updatedAt'>) => void;

  maintenances: MaintenanceItem[];
  addMaintenance: (item: Omit<MaintenanceItem, 'id'>) => void;
  updateMaintenanceStatus: (id: string, status: MaintenanceItem['status']) => void;
  deleteMaintenance: (id: string) => void;

  purchases: PurchaseRequest[];
  addPurchase: (req: Omit<PurchaseRequest, 'id' | 'date'>) => void;
  updatePurchaseStatus: (id: string, status: PurchaseRequest['status']) => void;

  aiLogs: AIOpinionLog[];
  addAILog: (log: Omit<AIOpinionLog, 'id' | 'date' | 'time'>) => void;

  config: CompanyConfig;
  updateConfig: (newConfig: Partial<CompanyConfig>) => void;
  toggleTheme: () => void;

  // Permissions & Role Checks
  updateUserProfile: (updatedData: Partial<User>) => void;
  canEditRecord: (createdBy?: string) => boolean;
  canDeleteRecord: (createdBy?: string) => boolean;
  isSupervisor: boolean;
  isOperator: boolean;

  // Alerts & Calculations
  getLowStockCount: () => number;
  getCriticalStockCount: () => number;
  
  readNotificationIds: string[];
  markNotificationAsRead: (id: string) => void;
  markAllNotificationsAsRead: (ids: string[]) => void;
  clearReadNotifications: () => void;

  resetToDefaultData: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const STORAGE_KEY_PREFIX = 'btp_smart_tools_v2_';
const SHIPS_MIGRATION_FLAG_KEY = `${STORAGE_KEY_PREFIX}shipsLegacyMockMigrationDone`;

const LEGACY_MOCK_SHIP_NAMES = new Set([
  'AMERICO VESPUCIO',
  'MAERSK LETICIA',
  'MSC CARMELA',
  'CAP SAN AUGUSTIN',
]);

function isLegacyMockShipsData(value: unknown): value is ShipInfo[] {
  if (!Array.isArray(value) || value.length < 80) return false;

  const names = value
    .map(item => (item && typeof item === 'object' && 'name' in item ? String((item as any).name).toUpperCase() : ''))
    .filter(Boolean);

  const hits = names.filter(name => LEGACY_MOCK_SHIP_NAMES.has(name)).length;
  const legacyIdLikeCount = value.filter(item => typeof item?.id === 'string' && item.id.startsWith('ship-')).length;

  return hits >= 2 && legacyIdLikeCount >= 50;
}

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY_PREFIX}user`);
    return saved ? JSON.parse(saved) : INITIAL_USER;
  });

  const [config, setConfig] = useState<CompanyConfig>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY_PREFIX}config`);
    return saved ? JSON.parse(saved) : INITIAL_CONFIG;
  });

  const [tools, setTools] = useState<ToolItem[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY_PREFIX}tools`);
    return saved ? JSON.parse(saved) : INITIAL_TOOLS;
  });

  const [ships, setShips] = useState<ShipInfo[]>(() => {
    const migrationDone = localStorage.getItem(SHIPS_MIGRATION_FLAG_KEY) === '1';
    const saved = localStorage.getItem(`${STORAGE_KEY_PREFIX}ships`);
    if (!saved) return INITIAL_SHIPS;

    try {
      const parsed = JSON.parse(saved);

      if (!migrationDone && isLegacyMockShipsData(parsed)) {
        localStorage.setItem(SHIPS_MIGRATION_FLAG_KEY, '1');
        return [];
      }

      if (!migrationDone) {
        localStorage.setItem(SHIPS_MIGRATION_FLAG_KEY, '1');
      }

      return parsed;
    } catch {
      return INITIAL_SHIPS;
    }
  });

  const [shifts, setShifts] = useState<ShiftRegistration[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY_PREFIX}shifts`);
    return saved ? JSON.parse(saved) : INITIAL_SHIFTS;
  });

  const [berthTurnUpdates, setBerthTurnUpdates] = useState<BerthTurnUpdate[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY_PREFIX}berthTurnUpdates`);
    return saved ? JSON.parse(saved) : INITIAL_BERTH_TURN_UPDATES;
  });

  const [maintenances, setMaintenances] = useState<MaintenanceItem[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY_PREFIX}maintenances`);
    return saved ? JSON.parse(saved) : INITIAL_MAINTENANCE;
  });

  const [purchases, setPurchases] = useState<PurchaseRequest[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY_PREFIX}purchases`);
    return saved ? JSON.parse(saved) : INITIAL_PURCHASES;
  });

  const [aiLogs, setAiLogs] = useState<AIOpinionLog[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY_PREFIX}aiLogs`);
    return saved ? JSON.parse(saved) : [];
  });

  const [readNotificationIds, setReadNotificationIds] = useState<string[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY_PREFIX}readNotificationIds`);
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}readNotificationIds`, JSON.stringify(readNotificationIds));
  }, [readNotificationIds]);

  const markNotificationAsRead = (id: string) => {
    setReadNotificationIds(prev => (prev.includes(id) ? prev : [...prev, id]));
  };

  const markAllNotificationsAsRead = (ids: string[]) => {
    setReadNotificationIds(prev => Array.from(new Set([...prev, ...ids])));
  };

  const clearReadNotifications = () => {
    setReadNotificationIds([]);
  };

  // Save to localStorage
  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}user`, JSON.stringify(user));
  }, [user]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}config`, JSON.stringify(config));
    
    // Apply theme to document root for Tailwind CSS dark mode
    const root = document.documentElement;
    if (config.themeMode === 'dark') {
      root.classList.add('dark');
      root.setAttribute('data-theme', 'dark');
      root.style.colorScheme = 'dark';
    } else {
      root.classList.remove('dark');
      root.setAttribute('data-theme', 'light');
      root.style.colorScheme = 'light';
    }
  }, [config.themeMode, config]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}tools`, JSON.stringify(tools));
  }, [tools]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}ships`, JSON.stringify(ships));
  }, [ships]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}shifts`, JSON.stringify(shifts));
  }, [shifts]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}berthTurnUpdates`, JSON.stringify(berthTurnUpdates));
  }, [berthTurnUpdates]);

  // Firestore Real-Time Subscription for Berth Turn Updates
  useEffect(() => {
    const unsubscribe = subscribeBerthTurnUpdates(remoteUpdates => {
      if (remoteUpdates && remoteUpdates.length > 0) {
        setBerthTurnUpdates(prev => {
          // Merge remote updates with existing local updates
          const updatedMap = new Map<string, BerthTurnUpdate>();
          
          // First add local/previous
          prev.forEach(item => {
            const key = getBerthTurnDocId(item.date, item.turn, item.berth);
            updatedMap.set(key, item);
          });

          // Override or add from remote
          remoteUpdates.forEach(item => {
            const key = getBerthTurnDocId(item.date, item.turn, item.berth);
            updatedMap.set(key, item);
          });

          return Array.from(updatedMap.values());
        });
      }
    });

    return () => unsubscribe();
  }, []);

  // Firestore ships sync + one-time initial seed when collection is empty
  useEffect(() => {
    seedShipsCatalogIfEmpty().catch(err => {
      console.warn('Ships seed warning:', err);
    });

    const unsubscribe = subscribeShips(remoteShips => {
      setShips(remoteShips);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}maintenances`, JSON.stringify(maintenances));
  }, [maintenances]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}purchases`, JSON.stringify(purchases));
  }, [purchases]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}aiLogs`, JSON.stringify(aiLogs));
  }, [aiLogs]);

  // Auth Implementation
  const login = (email: string, role: User['role'] = 'Supervisor') => {
    const newUser: User = {
      id: `usr-${Date.now()}`,
      name: email.split('@')[0].replace(/[\._-]/g, ' ').toUpperCase() || 'USUARIO OPERACIONAL',
      email,
      role,
      registrationNumber: 'BTP-' + Math.floor(1000 + Math.random() * 9000),
      shiftTurn: '07-13',
    };
    setUser(newUser);
  };

  const loginWithEmail = async (email: string, password: string, role: User['role'] = 'Supervisor') => {
    const validRole = role === 'Operador' ? 'Operador' : 'Supervisor';
    const u = await loginWithFirebase(email, password, validRole);
    setUser(u);
  };

  const loginWithGoogle = async () => {
    const u = await loginWithGoogleFirebase();
    setUser(u);
  };

  const loginWithFacebook = async () => {
    const u = await loginWithFacebookFirebase();
    setUser(u);
  };

  const registerUser = async (data: { email: string; password: string; name: string; role: 'Supervisor' | 'Operador' }) => {
    const u = await registerWithFirebase(data);
    setUser(u);
  };

  const sendPasswordReset = async (email: string) => {
    await resetPasswordFirebase(email);
  };

  const changePassword = async (newPassword: string) => {
    await changePasswordFirebase(newPassword);
  };

  const logout = async () => {
    try {
      await logoutFirebase();
    } catch (e) {
      console.warn('Firebase logout notice:', e);
    }
    setUser(null);
  };

  // Tools Logic
  const addTool = (data: Omit<ToolItem, 'id' | 'total' | 'updatedAt'>) => {
    const newTool: ToolItem = {
      ...data,
      id: `tool-${Date.now()}`,
      available: Math.max(0, data.available),
      inMaintenance: Math.max(0, data.inMaintenance),
      total: Math.max(0, data.available) + Math.max(0, data.inMaintenance),
      updatedAt: new Date().toISOString(),
    };
    setTools(prev => [...prev, newTool]);
  };

  const updateTool = (id: string, updated: Partial<ToolItem>) => {
    setTools(prev =>
      prev.map(t => {
        if (t.id === id) {
          const available = updated.available !== undefined ? Math.max(0, updated.available) : t.available;
          const inMaintenance = updated.inMaintenance !== undefined ? Math.max(0, updated.inMaintenance) : t.inMaintenance;
          return {
            ...t,
            ...updated,
            available,
            inMaintenance,
            total: available + inMaintenance,
            updatedAt: new Date().toISOString(),
          };
        }
        return t;
      })
    );
  };

  const deleteTool = (id: string) => {
    setTools(prev => prev.filter(t => t.id !== id));
  };

  // Ships Logic
  const addShip = (data: Omit<ShipInfo, 'id'>) => {
    const newShip: ShipInfo = {
      ...data,
      id: `ship-${Date.now()}`,
      updatedAt: new Date().toISOString().split('T')[0],
    };
    setShips(prev => [newShip, ...prev]);
    saveShipToFirestore(newShip).catch(err => {
      console.warn('Failed to save ship to Firestore:', err);
    });
  };

  const updateShip = (id: string, updated: Partial<ShipInfo>) => {
    setShips(prev => {
      const next = prev.map(s => (s.id === id ? { ...s, ...updated, updatedAt: new Date().toISOString().split('T')[0] } : s));
      const target = next.find(s => s.id === id);
      if (target) {
        saveShipToFirestore(target).catch(err => {
          console.warn('Failed to update ship on Firestore:', err);
        });
      }
      return next;
    });
  };

  const deleteShip = (id: string) => {
    setShips(prev => prev.filter(s => s.id !== id));
    deleteShipFromFirestore(id).catch(err => {
      console.warn('Failed to delete ship from Firestore:', err);
    });
  };

  const findShipByName = (name: string) => {
    if (!name) return undefined;
    const cleanName = name.trim().toLowerCase();
    return ships.find(s => s.name.toLowerCase() === cleanName || s.name.toLowerCase().includes(cleanName));
  };

  // Shift Logic
  const addShift = (data: Omit<ShiftRegistration, 'id' | 'createdAt'>) => {
    const newShift: ShiftRegistration = {
      ...data,
      id: `shift-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    setShifts(prev => [newShift, ...prev]);
  };

  // Berth Turn Updates Logic
  const saveBerthTurnUpdate = (data: Omit<BerthTurnUpdate, 'id' | 'updatedAt'>) => {
    const nowStr = new Date().toISOString().split('T')[0] + ' ' + new Date().toTimeString().substring(0, 5);
    const docId = getBerthTurnDocId(data.date, data.turn, data.berth);

    const recordToSave: BerthTurnUpdate = {
      ...data,
      id: docId,
      updatedAt: nowStr,
    };

    setBerthTurnUpdates(prev => {
      const existingIndex = prev.findIndex(
        item => item.turn === data.turn && item.berth === data.berth && item.date === data.date
      );

      if (existingIndex >= 0) {
        const updatedList = [...prev];
        updatedList[existingIndex] = recordToSave;
        return updatedList;
      } else {
        return [recordToSave, ...prev];
      }
    });

    // Save to Firestore
    saveBerthTurnUpdateToFirestore(recordToSave).catch(err => {
      console.warn('Failed to save turn update to Firestore:', err);
    });
  };

  // Maintenance Logic
  const addMaintenance = (item: Omit<MaintenanceItem, 'id'>) => {
    const qty = Math.max(1, item.quantity);
    const newMaint: MaintenanceItem = {
      ...item,
      quantity: qty,
      id: `maint-${Date.now()}`,
    };

    setMaintenances(prev => [newMaint, ...prev]);

    // Automatically deduct from available stock and add to inMaintenance stock if status is 'Aguardando' or 'Em manutenção'
    if (item.status !== 'Concluído') {
      setTools(prevTools =>
        prevTools.map(t => {
          if (t.id === item.toolId || t.name === item.toolName) {
            const actualAvailable = Math.max(0, t.available - qty);
            const actualInMaint = t.inMaintenance + qty;
            return {
              ...t,
              available: actualAvailable,
              inMaintenance: actualInMaint,
              total: actualAvailable + actualInMaint,
              updatedAt: new Date().toISOString(),
            };
          }
          return t;
        })
      );
    }
  };

  const updateMaintenanceStatus = (id: string, newStatus: MaintenanceItem['status']) => {
    setMaintenances(prev =>
      prev.map(m => {
        if (m.id === id) {
          const oldStatus = m.status;
          
          // CRITICAL REQUIREMENT: When status changes to "Concluído", automatically return quantity to available stock!
          if (oldStatus !== 'Concluído' && newStatus === 'Concluído') {
            setTools(prevTools =>
              prevTools.map(t => {
                if (t.id === m.toolId || t.name === m.toolName) {
                  const returnedQty = m.quantity;
                  const newInMaint = Math.max(0, t.inMaintenance - returnedQty);
                  const newAvail = t.available + returnedQty;
                  return {
                    ...t,
                    available: newAvail,
                    inMaintenance: newInMaint,
                    total: newAvail + newInMaint,
                    updatedAt: new Date().toISOString(),
                  };
                }
                return t;
              })
            );
          }

          return {
            ...m,
            status: newStatus,
            completedAt: newStatus === 'Concluído' ? new Date().toISOString() : m.completedAt,
          };
        }
        return m;
      })
    );
  };

  const deleteMaintenance = (id: string) => {
    setMaintenances(prev => prev.filter(m => m.id !== id));
  };

  // Purchases Logic
  const addPurchase = (data: Omit<PurchaseRequest, 'id' | 'date'>) => {
    const newPur: PurchaseRequest = {
      ...data,
      id: `pur-${Date.now()}`,
      quantity: Math.max(1, data.quantity),
      date: new Date().toISOString().split('T')[0],
      requestedBy: user?.name || 'Operador BTP',
    };
    setPurchases(prev => [newPur, ...prev]);
  };

  const updatePurchaseStatus = (id: string, newStatus: PurchaseStatus) => {
    setPurchases(prev =>
      prev.map(p => {
        if (p.id === id) {
          const oldStatus = p.status;

          // When purchase status becomes 'Recebido', increase available stock automatically
          if (oldStatus !== 'Recebido' && newStatus === 'Recebido') {
            setTools(prevTools =>
              prevTools.map(t => {
                if (t.id === p.toolId || t.name === p.toolName) {
                  const addQty = p.quantity;
                  const newAvail = t.available + addQty;
                  return {
                    ...t,
                    available: newAvail,
                    total: newAvail + t.inMaintenance,
                    updatedAt: new Date().toISOString(),
                  };
                }
                return t;
              })
            );
          }

          return {
            ...p,
            status: newStatus,
            updatedAt: new Date().toISOString(),
          };
        }
        return p;
      })
    );
  };

  // AI Logs Logic
  const addAILog = (data: Omit<AIOpinionLog, 'id' | 'date' | 'time'>) => {
    const now = new Date();
    const newLog: AIOpinionLog = {
      ...data,
      id: `ai-${Date.now()}`,
      date: now.toISOString().split('T')[0],
      time: now.toTimeString().split(' ')[0].substring(0, 5),
    };
    setAiLogs(prev => [newLog, ...prev]);
  };

  // Config Logic
  const updateConfig = (newConfig: Partial<CompanyConfig>) => {
    setConfig(prev => ({ ...prev, ...newConfig }));
  };

  const toggleTheme = () => {
    setConfig(prev => ({
      ...prev,
      themeMode: prev.themeMode === 'light' ? 'dark' : 'light',
    }));
  };

  // Permissions & Role Helper logic
  const isSupervisor = user?.role === 'Supervisor' || user?.role === 'Administrador';
  const isOperator = user?.role === 'Operador';

  const updateUserProfile = (updatedData: Partial<User>) => {
    setUser(prev => (prev ? { ...prev, ...updatedData } : null));
  };

  const canEditRecord = (createdBy?: string) => {
    if (!user) return false;
    // Supervisor or Administrador can edit everything
    if (isSupervisor) return true;
    // Operador can edit if record has no creator specified or if createdBy matches current user's name
    if (!createdBy || createdBy.trim() === '') return true;
    return createdBy.toLowerCase().trim() === user.name.toLowerCase().trim();
  };

  const canDeleteRecord = (createdBy?: string) => {
    if (!user) return false;
    // Strictly Supervisor or Administrador can delete records
    if (isSupervisor) return true;
    // Operadores cannot delete records created by others
    return false;
  };

  // Calculations
  const getLowStockCount = () => {
    return tools.filter(t => t.available <= t.minStock && t.available > 0).length;
  };

  const getCriticalStockCount = () => {
    return tools.filter(t => t.available <= Math.ceil(t.minStock / 2)).length;
  };

  const resetToDefaultData = () => {
    setTools(INITIAL_TOOLS);
    setShips(INITIAL_SHIPS);
    setShifts(INITIAL_SHIFTS);
    setBerthTurnUpdates(INITIAL_BERTH_TURN_UPDATES);
    setMaintenances(INITIAL_MAINTENANCE);
    setPurchases(INITIAL_PURCHASES);
    setAiLogs([]);
    setConfig(INITIAL_CONFIG);
    setReadNotificationIds([]);
  };

  return (
    <AppContext.Provider
      value={{
        user,
        isAuthenticated: Boolean(user),
        login,
        loginWithEmail,
        loginWithGoogle,
        loginWithFacebook,
        registerUser,
        sendPasswordReset,
        changePassword,
        logout,
        tools,
        addTool,
        updateTool,
        deleteTool,
        ships,
        addShip,
        updateShip,
        deleteShip,
        findShipByName,
        shifts,
        addShift,
        berthTurnUpdates,
        saveBerthTurnUpdate,
        maintenances,
        addMaintenance,
        updateMaintenanceStatus,
        deleteMaintenance,
        purchases,
        addPurchase,
        updatePurchaseStatus,
        aiLogs,
        addAILog,
        config,
        updateConfig,
        toggleTheme,
        updateUserProfile,
        canEditRecord,
        canDeleteRecord,
        isSupervisor,
        isOperator,
        getLowStockCount,
        getCriticalStockCount,
        readNotificationIds,
        markNotificationAsRead,
        markAllNotificationsAsRead,
        clearReadNotifications,
        resetToDefaultData,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
