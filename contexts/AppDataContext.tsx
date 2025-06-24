
import React, { createContext, useContext, ReactNode, useEffect, useState, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { 
  Equipment, Product, ProductionLine, ScheduledProductionRun, OperatingDayTime, 
  ProductClassification, ScheduleStatus, LinePauseHistoryEntry 
} from '../types';
import { generateUUID } from '../utils/uuid';
import { useAuth } from './AuthContext'; // Import useAuth to get current user

// --- Tipos do Banco de Dados (snake_case) ---
interface DbEquipment {
  id: string;
  name: string;
  type: string;
  maintenance_date?: string;
  created_at?: string;
  updated_at?: string;
}

interface DbProduct {
  id: string;
  name: string;
  sku: string;
  description: string;
  ingredients?: string[];
  processing_times: Array<{ equipmentId: string; timePerUnitMinutes: number; }>; // JSONB
  classification: ProductClassification;
  manufactured_for?: string;
  created_at?: string;
  updated_at?: string;
}

interface DbProductionLine {
  id: string;
  name: string;
  description?: string;
  equipment_ids: string[]; // UUID[]
  operating_hours: OperatingDayTime[]; // JSONB
  created_at?: string;
  updated_at?: string;
  // Pause fields
  is_paused?: boolean;
  current_pause_start_time?: string | null;
  current_pause_reason?: string | null;
  paused_by_user_email?: string | null;
}

interface DbScheduledProductionRun {
  id: string;
  product_id: string;
  line_id: string;
  start_time: string;
  end_time: string;
  quantity: number;
  notes?: string;
  status: ScheduleStatus;
  created_at?: string;
  updated_at?: string;
  interruption_pause_start_time?: string | null;
  interruption_pause_end_time?: string | null;
}

interface DbLinePauseHistoryEntry {
  id: string;
  line_id: string;
  paused_by_user_email: string;
  pause_start_time: string;
  pause_end_time: string;
  pause_reason?: string | null;
  duration_minutes: number;
  created_at: string;
}


// --- Funções de Mapeamento ---
const mapDbToEquipment = (db: DbEquipment): Equipment => ({
  id: db.id,
  name: db.name,
  type: db.type,
  maintenanceDate: db.maintenance_date,
  createdAt: db.created_at,
  updatedAt: db.updated_at,
});

const mapEquipmentToDb = (eq: Omit<Equipment, 'id' | 'createdAt' | 'updatedAt'>): Omit<DbEquipment, 'id' | 'created_at' | 'updated_at'> => ({
  name: eq.name,
  type: eq.type,
  maintenance_date: eq.maintenanceDate,
});

const mapDbToProduct = (db: DbProduct): Product => ({
  id: db.id,
  name: db.name,
  sku: db.sku,
  description: db.description,
  ingredients: db.ingredients,
  processingTimes: db.processing_times,
  classification: db.classification,
  manufacturedFor: db.manufactured_for,
  createdAt: db.created_at,
  updatedAt: db.updated_at,
});

const mapProductToDb = (p: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>): Omit<DbProduct, 'id' | 'created_at' | 'updated_at'> => ({
  name: p.name,
  sku: p.sku,
  description: p.description,
  ingredients: p.ingredients,
  processing_times: p.processingTimes,
  classification: p.classification,
  manufactured_for: p.manufacturedFor,
});

const mapDbToProductionLine = (db: DbProductionLine): ProductionLine => ({
  id: db.id,
  name: db.name,
  description: db.description,
  equipmentIds: db.equipment_ids || [],
  operatingHours: db.operating_hours,
  createdAt: db.created_at,
  updatedAt: db.updated_at,
  isPaused: db.is_paused,
  currentPauseStartTime: db.current_pause_start_time,
  currentPauseReason: db.current_pause_reason,
  pausedByUserEmail: db.paused_by_user_email,
});

const mapProductionLineToDb = (pl: Omit<ProductionLine, 'id' | 'createdAt' | 'updatedAt'>): Omit<DbProductionLine, 'id' | 'created_at' | 'updated_at'> => ({
  name: pl.name,
  description: pl.description,
  equipment_ids: pl.equipmentIds,
  operating_hours: pl.operatingHours,
  is_paused: pl.isPaused,
  current_pause_start_time: pl.currentPauseStartTime,
  current_pause_reason: pl.currentPauseReason,
  paused_by_user_email: pl.pausedByUserEmail,
});

const mapDbToScheduledRun = (db: DbScheduledProductionRun): ScheduledProductionRun => ({
  id: db.id,
  productId: db.product_id,
  lineId: db.line_id,
  startTime: db.start_time,
  endTime: db.end_time,
  quantity: db.quantity,
  notes: db.notes,
  status: db.status,
  createdAt: db.created_at,
  updatedAt: db.updated_at,
  interruptionPauseStartTime: db.interruption_pause_start_time,
  interruptionPauseEndTime: db.interruption_pause_end_time,
});

const mapScheduledRunToDb = (sr: Omit<ScheduledProductionRun, 'id' | 'createdAt' | 'updatedAt'>): Omit<DbScheduledProductionRun, 'id' | 'created_at' | 'updated_at'> => ({
  product_id: sr.productId,
  line_id: sr.lineId,
  start_time: sr.startTime,
  end_time: sr.endTime,
  quantity: sr.quantity,
  notes: sr.notes,
  status: sr.status,
  interruption_pause_start_time: sr.interruptionPauseStartTime,
  interruption_pause_end_time: sr.interruptionPauseEndTime,
});

// Helper: Convert HH:MM string to total minutes from midnight
const timeStringToMinutes = (timeStr: string): number => {
  if (!timeStr || !timeStr.includes(':')) return 0;
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
};
const daysOfWeekNames = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];

interface AppDataContextType {
  equipment: Equipment[];
  addEquipment: (item: Omit<Equipment, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateEquipment: (item: Equipment) => Promise<void>;
  deleteEquipment: (id: string) => Promise<void>;
  getEquipmentById: (id: string) => Equipment | undefined;

  products: Product[];
  addProduct: (item: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateProduct: (item: Product) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  getProductById: (id: string) => Product | undefined;

  productionLines: ProductionLine[];
  addProductionLine: (item: Pick<ProductionLine, 'name' | 'description' | 'operatingHours'>) => Promise<ProductionLine | null>;
  updateProductionLine: (item: ProductionLine, shouldRefetch?: boolean) => Promise<ProductionLine | null>;
  deleteProductionLine: (id: string) => Promise<void>;
  getProductionLineById: (id: string) => ProductionLine | undefined;
  pauseLine: (lineId: string, reason: string) => Promise<{ success: boolean; message?: string }>;
  resumeLine: (lineId: string) => Promise<{ success: boolean; message?: string }>;


  schedules: ScheduledProductionRun[];
  addSchedule: (item: Omit<ScheduledProductionRun, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateSchedule: (item: ScheduledProductionRun, shouldRefetch?: boolean) => Promise<ScheduledProductionRun | null>;
  deleteSchedule: (id: string) => Promise<void>;
  getScheduleById: (id: string) => ScheduledProductionRun | undefined;
  
  optimizeDaySchedules: (dateToOptimize: Date) => Promise<{
    optimizedCount: number;
    unoptimizedCount: number;
    details: string[];
  }>;

  addWorkingTime: (baseDate: Date, minutesToAdd: number, line: ProductionLine) => Date;
  calculateEffectiveWorkDuration: (startTime: Date, endTime: Date, line: ProductionLine) => number;

  linePauseHistory: LinePauseHistoryEntry[]; 

  isLoading: boolean;
  error: Error | null;
  fetchInitialData: () => Promise<void>;
}

const AppDataContext = createContext<AppDataContextType | undefined>(undefined);

export const AppDataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth(); 
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [productionLines, setProductionLines] = useState<ProductionLine[]>([]);
  const [schedules, setSchedules] = useState<ScheduledProductionRun[]>([]);
  const [linePauseHistory, setLinePauseHistory] = useState<LinePauseHistoryEntry[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [errorState, setErrorState] = useState<Error | null>(null);

  const handleError = useCallback((operation: string, error: any, publicMessage?: string) => {
    let message = `AppDataContext: Error during ${operation}. Message: ${error?.message || 'N/A'}. Details:`;
    try {
      message += ` ${JSON.stringify(error, Object.getOwnPropertyNames(error))}`;
    } catch (e) {
      message = `AppDataContext: Error during ${operation}. Raw error: ${error}`;
    }
    console.error(message);
    const resolvedMessage = publicMessage || `Falha durante ${operation}. Por favor, tente novamente. Detalhe: ${error?.message || 'Erro desconhecido'}`;
    setErrorState(new Error(resolvedMessage));
  }, []);

  const fetchInitialData = useCallback(async () => {
    setIsLoading(true);
    setErrorState(null);
    try {
      const { data: equipmentData, error: equipmentError } = await supabase.from('equipment').select('*').order('name');
      if (equipmentError) throw equipmentError;
      setEquipment(equipmentData.map(mapDbToEquipment));

      const { data: productsData, error: productsError } = await supabase.from('products').select('*').order('name');
      if (productsError) throw productsError;
      setProducts(productsData.map(mapDbToProduct));

      const { data: linesData, error: linesError } = await supabase.from('production_lines').select('*').order('name');
      if (linesError) throw linesError;
      setProductionLines(linesData.map(mapDbToProductionLine));
      
      const { data: schedulesData, error: schedulesError } = await supabase.from('scheduled_production_runs').select('*').order('start_time');
      if (schedulesError) throw schedulesError;
      setSchedules(schedulesData.map(mapDbToScheduledRun));

      const { data: pauseHistoryData, error: pauseHistoryError } = await supabase.from('line_pause_history').select('*').order('pause_start_time', { ascending: false });
      if (pauseHistoryError) throw pauseHistoryError;
      setLinePauseHistory(pauseHistoryData.map((dbEntry: DbLinePauseHistoryEntry) => ({
        id: dbEntry.id,
        lineId: dbEntry.line_id,
        pausedByUserEmail: dbEntry.paused_by_user_email,
        pauseStartTime: dbEntry.pause_start_time,
        pauseEndTime: dbEntry.pause_end_time,
        pauseReason: dbEntry.pause_reason,
        durationMinutes: dbEntry.duration_minutes,
        createdAt: dbEntry.created_at,
      })));


    } catch (e: any) {
       handleError('fetchInitialData', e);
    } finally {
      setIsLoading(false);
    }
  }, [handleError]); 

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  // --- Equipment Operations ---
  const addEquipmentOp = useCallback(async (item: Omit<Equipment, 'id' | 'createdAt' | 'updatedAt'>) => {
    const dbItem = mapEquipmentToDb(item);
    const { data, error: eqError } = await supabase.from('equipment').insert({ ...dbItem, id: generateUUID() }).select().single();
    if (eqError) { handleError('addEquipment', eqError); return; }
    if (data) setEquipment(prev => [...prev, mapDbToEquipment(data as DbEquipment)].sort((a,b) => a.name.localeCompare(b.name)));
  }, [handleError]);

  const updateEquipmentOp = useCallback(async (item: Equipment) => {
    const { id, createdAt, updatedAt, ...rest } = item;
    const dbItem = mapEquipmentToDb(rest);
    const { data, error: eqError } = await supabase.from('equipment').update(dbItem).eq('id', id).select().single();
    if (eqError) { handleError('updateEquipment', eqError); return; }
    if (data) {
      setEquipment(prev => prev.map(e => e.id === id ? mapDbToEquipment(data as DbEquipment) : e).sort((a,b) => a.name.localeCompare(b.name)));
    }
  }, [handleError]);

  const deleteEquipmentOp = useCallback(async (id: string) => {
    const productsToUpdate = products.filter(p => p.processingTimes.some(pt => pt.equipmentId === id));
    for (const prod of productsToUpdate) {
        const newProcessingTimes = prod.processingTimes.filter(pt => pt.equipmentId !== id);
        const { error: productUpdateError } = await supabase
            .from('products')
            .update({ processing_times: newProcessingTimes, updated_at: new Date().toISOString() })
            .eq('id', prod.id);
        if (productUpdateError) {
            handleError('deleteEquipment (product update)', productUpdateError, `Erro ao remover equipamento de "${prod.name}".`);
            return; 
        }
    }
    setProducts(prevProducts => prevProducts.map(p => {
        if (productsToUpdate.some(ptu => ptu.id === p.id)) {
            return { ...p, processingTimes: p.processingTimes.filter(pt => pt.equipmentId !== id) };
        }
        return p;
    }));

    const linesToUpdate = productionLines.filter(l => l.equipmentIds.includes(id));
    for (const line of linesToUpdate) {
        const newEquipmentIds = line.equipmentIds.filter(eqId => eqId !== id);
        const { error: lineUpdateError } = await supabase
            .from('production_lines')
            .update({ equipment_ids: newEquipmentIds, updated_at: new Date().toISOString() })
            .eq('id', line.id);
        if (lineUpdateError) {
            handleError('deleteEquipment (line update)', lineUpdateError, `Erro ao remover equipamento da linha "${line.name}".`);
            return; 
        }
    }
    setProductionLines(prevLines => prevLines.map(l => {
        if (linesToUpdate.some(ltu => ltu.id === l.id)) {
            return { ...l, equipmentIds: l.equipmentIds.filter(eqId => eqId !== id) };
        }
        return l;
    }));

    const { error: eqError } = await supabase.from('equipment').delete().eq('id', id);
    if (eqError) { handleError('deleteEquipment', eqError); return; }
    setEquipment(prev => prev.filter(e => e.id !== id));
  }, [products, productionLines, handleError]);
  
  const getEquipmentByIdOp = useCallback((id: string): Equipment | undefined => equipment.find(e => e.id === id), [equipment]);

  // --- Product Operations ---
  const addProductOp = useCallback(async (item: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) => {
    const dbItem = mapProductToDb(item);
    const { data, error: pError } = await supabase.from('products').insert({ ...dbItem, id: generateUUID() }).select().single();
    if (pError) { handleError('addProduct', pError); return; }
    if (data) setProducts(prev => [...prev, mapDbToProduct(data as DbProduct)].sort((a,b) => a.name.localeCompare(b.name)));
  }, [handleError]);

  const updateProductOp = useCallback(async (item: Product) => {
    const { id, createdAt, updatedAt, ...rest } = item;
    const dbItem = mapProductToDb(rest);
    const { data, error: pError } = await supabase.from('products').update(dbItem).eq('id', id).select().single();
    if (pError) { handleError('updateProduct', pError); return; }
    if (data) {
      setProducts(prev => prev.map(p => p.id === id ? mapDbToProduct(data as DbProduct) : p).sort((a,b) => a.name.localeCompare(b.name)));
    }
  }, [handleError]);

  const deleteProductOp = useCallback(async (id: string) => {
    const schedulesToDelete = schedules.filter(s => s.productId === id);
    for (const sch of schedulesToDelete) {
        const { error: scheduleDeleteError } = await supabase.from('scheduled_production_runs').delete().eq('id', sch.id);
        if (scheduleDeleteError) {
            handleError('deleteProduct (schedule deletion)', scheduleDeleteError, `Erro ao deletar agendamento para produto ID ${id}.`);
            return; 
        }
    }
    setSchedules(prevSchedules => prevSchedules.filter(s => s.productId !== id));

    const { error: pError } = await supabase.from('products').delete().eq('id', id);
    if (pError) { handleError('deleteProduct', pError); return; }
    setProducts(prev => prev.filter(p => p.id !== id));
  }, [schedules, handleError]);
  
  const getProductByIdOp = useCallback((id: string): Product | undefined => products.find(p => p.id === id), [products]);

  // --- Production Line Operations ---
  const addProductionLineOp = useCallback(async (item: Pick<ProductionLine, 'name' | 'description' | 'operatingHours'>): Promise<ProductionLine | null> => {
    const dbItem = mapProductionLineToDb({ ...item, equipmentIds: [] }); 
    const { data, error: plError } = await supabase.from('production_lines').insert({ ...dbItem, id: generateUUID() }).select().single();
    if (plError) { handleError('addProductionLine', plError); return null; }
    if (data) {
        const newLine = mapDbToProductionLine(data as DbProductionLine);
        setProductionLines(prev => [...prev, newLine].sort((a,b) => a.name.localeCompare(b.name)));
        return newLine;
    }
    return null;
  }, [handleError]);

  const updateProductionLineOp = useCallback(async (item: ProductionLine, shouldRefetch: boolean = false): Promise<ProductionLine | null> => {
    const { id, createdAt, updatedAt, ...rest } = item;
    const dbItem = mapProductionLineToDb(rest);
    const { data, error: plError } = await supabase.from('production_lines').update(dbItem).eq('id', id).select().single();
    if (plError) { handleError('updateProductionLine', plError); return null; }
    if (data) {
        const updatedLine = mapDbToProductionLine(data as DbProductionLine);
        setProductionLines(prev => prev.map(l => l.id === id ? updatedLine : l).sort((a,b) => a.name.localeCompare(b.name)));
        if (shouldRefetch) await fetchInitialData(); 
        return updatedLine;
    }
    return null;
  }, [handleError, fetchInitialData]);

  const deleteProductionLineOp = useCallback(async (id: string) => {
    const schedulesOnLine = schedules.filter(s => s.lineId === id);
    for (const sch of schedulesOnLine) {
        const { error: scheduleDeleteError } = await supabase.from('scheduled_production_runs').delete().eq('id', sch.id);
        if (scheduleDeleteError) {
            handleError('deleteProductionLine (schedule deletion)', scheduleDeleteError, `Erro ao deletar agendamentos da linha ID ${id}.`);
            return; 
        }
    }
    setSchedules(prevSchedules => prevSchedules.filter(s => s.lineId !== id));

    const { error: plError } = await supabase.from('production_lines').delete().eq('id', id);
    if (plError) { handleError('deleteProductionLine', plError); return; }
    setProductionLines(prev => prev.filter(l => l.id !== id));
  }, [schedules, handleError]);
  
  const getProductionLineByIdOp = useCallback((id: string): ProductionLine | undefined => productionLines.find(l => l.id === id), [productionLines]);

  // --- Schedule Operations ---
  const addScheduleOp = useCallback(async (item: Omit<ScheduledProductionRun, 'id' | 'createdAt' | 'updatedAt'>) => {
    const dbItem = mapScheduledRunToDb(item);
    const { data, error: sError } = await supabase.from('scheduled_production_runs').insert({ ...dbItem, id: generateUUID() }).select().single();
    if (sError) { handleError('addSchedule', sError); return; }
    if (data) {
        const newSchedule = mapDbToScheduledRun(data as DbScheduledProductionRun);
        setSchedules(prev => [...prev, newSchedule].sort((a,b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()));
    }
  }, [handleError]);

  const updateScheduleOp = useCallback(async (item: ScheduledProductionRun, shouldRefetch: boolean = false): Promise<ScheduledProductionRun | null> => {
    const { id, createdAt, updatedAt, ...rest } = item;
    const dbItem = mapScheduledRunToDb(rest);
    const { data, error: sError } = await supabase.from('scheduled_production_runs').update(dbItem).eq('id', id).select().single();
    if (sError) { handleError('updateSchedule', sError); return null; }
    if (data) {
        const updatedSchedule = mapDbToScheduledRun(data as DbScheduledProductionRun);
        setSchedules(prev => prev.map(s => s.id === id ? updatedSchedule : s).sort((a,b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()));
        if (shouldRefetch) await fetchInitialData();
        return updatedSchedule;
    }
    return null;
  }, [handleError, fetchInitialData]);

  const deleteScheduleOp = useCallback(async (id: string) => {
    const { error: sError } = await supabase.from('scheduled_production_runs').delete().eq('id', id);
    if (sError) { handleError('deleteSchedule', sError); return; }
    setSchedules(prev => prev.filter(s => s.id !== id));
  }, [handleError]);

  const getScheduleByIdOp = useCallback((id: string): ScheduledProductionRun | undefined => schedules.find(s => s.id === id), [schedules]);


  // --- PAUSE/RESUME LOGIC ---
  const pauseLineOp = useCallback(async (lineId: string, reason: string): Promise<{ success: boolean; message?: string }> => {
    const lineToPause = productionLines.find(l => l.id === lineId);
    if (!lineToPause || !user) {
      const msg = !lineToPause ? "Linha não encontrada." : "Usuário não autenticado.";
      handleError('pauseLine', new Error(msg));
      return { success: false, message: msg };
    }
    const updatePayload = {
      is_paused: true,
      current_pause_start_time: new Date().toISOString(),
      current_pause_reason: reason,
      paused_by_user_email: user.email,
    };
    const { error: pauseError } = await supabase.from('production_lines').update(updatePayload).eq('id', lineId);
    if (pauseError) {
      let publicMsg = `Falha ao pausar a linha "${lineToPause.name}".`;
      if (pauseError.message.includes("schema cache") && pauseError.message.includes("column")) {
          const match = pauseError.message.match(/the '([^']+)' column/);
          const columnName = match && match[1] ? match[1] : "desconhecida";
          publicMsg = `A coluna "${columnName}" não foi encontrada no cache do esquema do banco de dados. Verifique a estrutura da tabela no Supabase e tente um "hard refresh" (Ctrl+Shift+R). Se persistir, recarregue o esquema na seção API das configurações do seu projeto Supabase. Detalhe original: ${pauseError.message}`;
      } else {
          publicMsg += ` Detalhe: ${pauseError.message}`;
      }
      handleError('pauseLine', pauseError, publicMsg);
      return { success: false, message: publicMsg };
    }
    setProductionLines(prevLines =>
      prevLines.map(l =>
        l.id === lineId
          ? { ...l, ...mapDbToProductionLine({ ...lineToPause, ...updatePayload } as unknown as DbProductionLine) } 
          : l
      ).sort((a,b) => a.name.localeCompare(b.name))
    );
    return { success: true, message: `Linha "${lineToPause.name}" pausada com sucesso.` };
  }, [productionLines, user, handleError]);

  const addWorkingTime = useCallback((baseDate: Date, minutesToAdd: number, line: ProductionLine): Date => {
    let newDate = new Date(baseDate);
    let remainingMinutesToAdd = minutesToAdd;
    let safetyBreak = 100000; 

    while (remainingMinutesToAdd > 0 && safetyBreak > 0) {
      safetyBreak--;
      const dayOfWeek = newDate.getDay();
      const operatingDay = line.operatingHours.find(oh => oh.dayOfWeek === dayOfWeek);

      if (operatingDay && operatingDay.isActive) {
        const opStartTimeMinutesToday = timeStringToMinutes(operatingDay.startTime);
        const opEndTimeMinutesToday = operatingDay.endTime === "00:00" ? 24 * 60 : timeStringToMinutes(operatingDay.endTime);
        
        let currentTimeMinutesInDay = newDate.getHours() * 60 + newDate.getMinutes();

        if (currentTimeMinutesInDay < opStartTimeMinutesToday) {
          newDate.setHours(Math.floor(opStartTimeMinutesToday / 60), opStartTimeMinutesToday % 60, 0, 0);
          currentTimeMinutesInDay = opStartTimeMinutesToday;
        }

        if (currentTimeMinutesInDay >= opEndTimeMinutesToday) {
          newDate.setDate(newDate.getDate() + 1);
          newDate.setHours(0, 0, 0, 0);
          continue; 
        }

        const availableMinutesInSlot = opEndTimeMinutesToday - currentTimeMinutesInDay;
        const minutesToProcessThisSlot = Math.min(remainingMinutesToAdd, availableMinutesInSlot);

        newDate.setMinutes(newDate.getMinutes() + minutesToProcessThisSlot);
        remainingMinutesToAdd -= minutesToProcessThisSlot;

        if (remainingMinutesToAdd > 0 && minutesToProcessThisSlot === availableMinutesInSlot) {
            newDate.setHours(Math.floor(opEndTimeMinutesToday/60), opEndTimeMinutesToday % 60, 0, 0);
        }

      } else {
        newDate.setDate(newDate.getDate() + 1);
        newDate.setHours(0, 0, 0, 0);
      }
    }
     if (safetyBreak === 0) {
        console.error("addWorkingTime safety break triggered. Base:", baseDate, "Minutes:", minutesToAdd, "Line:", line.name);
        return new Date(8640000000000000); 
    }
    return newDate;
  }, []); 

  const calculateEffectiveWorkDuration = useCallback((startTime: Date, endTime: Date, line: ProductionLine): number => {
    if (endTime <= startTime) return 0;

    let totalEffectiveMinutes = 0;
    const currentDayIter = new Date(startTime.getFullYear(), startTime.getMonth(), startTime.getDate());
    const finalEndTime = new Date(endTime);

    while (currentDayIter < finalEndTime) {
        const dayOfWeek = currentDayIter.getDay();
        const operatingDay = line.operatingHours.find(oh => oh.dayOfWeek === dayOfWeek);

        if (operatingDay && operatingDay.isActive) {
            const opDayStartDateTime = new Date(currentDayIter);
            const [opStartH, opStartM] = operatingDay.startTime.split(':').map(Number);
            opDayStartDateTime.setHours(opStartH, opStartM, 0, 0);

            const opDayEndDateTime = new Date(currentDayIter);
            if (operatingDay.endTime === "00:00") {
                opDayEndDateTime.setDate(opDayEndDateTime.getDate() + 1);
                opDayEndDateTime.setHours(0, 0, 0, 0);
            } else {
                const [opEndH, opEndM] = operatingDay.endTime.split(':').map(Number);
                opDayEndDateTime.setHours(opEndH, opEndM, 0, 0);
            }
            
            const segmentStartForCalc = (startTime > opDayStartDateTime) ? startTime : opDayStartDateTime;
            const segmentEndForCalc = (finalEndTime < opDayEndDateTime) ? finalEndTime : opDayEndDateTime;
            
            // Further clamp to the current iteration day's boundaries if segment spans multiple days
            const dayStartBoundary = new Date(currentDayIter);
            dayStartBoundary.setHours(0,0,0,0);
            const dayEndBoundary = new Date(currentDayIter);
            dayEndBoundary.setDate(currentDayIter.getDate() + 1);
            dayEndBoundary.setHours(0,0,0,0);

            const effectiveSegmentStart = segmentStartForCalc > dayStartBoundary ? segmentStartForCalc : dayStartBoundary;
            const effectiveSegmentEnd = segmentEndForCalc < dayEndBoundary ? segmentEndForCalc : dayEndBoundary;


            if (effectiveSegmentEnd > effectiveSegmentStart && effectiveSegmentStart >= opDayStartDateTime && effectiveSegmentEnd <= opDayEndDateTime) {
                 totalEffectiveMinutes += (effectiveSegmentEnd.getTime() - effectiveSegmentStart.getTime()) / (1000 * 60);
            }
        }
        currentDayIter.setDate(currentDayIter.getDate() + 1); 
    }
    return Math.max(0, Math.round(totalEffectiveMinutes));
  }, []);


  const resumeLineOp = useCallback(async (lineId: string): Promise<{ success: boolean; message?: string }> => {
    const lineToResume = productionLines.find(l => l.id === lineId);
    if (!lineToResume || !lineToResume.isPaused || !lineToResume.currentPauseStartTime || !user) {
      const msg = !lineToResume ? "Linha não encontrada." : (!lineToResume.isPaused ? "Linha não está pausada." : (!user ? "Usuário não autenticado." : "Dados da pausa atual incompletos."));
      handleError('resumeLine', new Error(msg));
      return { success: false, message: msg };
    }
    const pauseStartTimeObj = new Date(lineToResume.currentPauseStartTime);
    const pauseEndTimeObj = new Date(); 
    
    const wallClockPauseDurationMinutes = Math.round((pauseEndTimeObj.getTime() - pauseStartTimeObj.getTime()) / (1000 * 60));

    const historyEntry: Omit<DbLinePauseHistoryEntry, 'id' | 'created_at'> = {
      line_id: lineId,
      paused_by_user_email: lineToResume.pausedByUserEmail || user.email || 'Não especificado',
      pause_start_time: pauseStartTimeObj.toISOString(),
      pause_end_time: pauseEndTimeObj.toISOString(),
      pause_reason: lineToResume.currentPauseReason,
      duration_minutes: wallClockPauseDurationMinutes,
    };
    const { data: historyData, error: historyError } = await supabase.from('line_pause_history').insert({ ...historyEntry, id: generateUUID() }).select().single();
    if (historyError) {
      handleError('resumeLine (history logging)', historyError, `Falha ao registrar histórico de pausa para "${lineToResume.name}".`);
      return { success: false, message: `Falha ao registrar histórico de pausa. Detalhe: ${historyError.message}` };
    }
     if (historyData) {
        setLinePauseHistory(prev => [ { id: historyData.id, lineId: historyData.line_id, pausedByUserEmail: historyData.paused_by_user_email, pauseStartTime: historyData.pause_start_time, pauseEndTime: historyData.pause_end_time, pauseReason: historyData.pause_reason, durationMinutes: historyData.duration_minutes, createdAt: historyData.created_at, }, ...prev ].sort((a,b) => new Date(b.pauseStartTime).getTime() - new Date(a.pauseStartTime).getTime()));
    }

    const updatePayload = { is_paused: false, current_pause_start_time: null, current_pause_reason: null, paused_by_user_email: null, };
    const { error: resumeError } = await supabase.from('production_lines').update(updatePayload).eq('id', lineId);
    if (resumeError) {
      handleError('resumeLine', resumeError, `Falha ao retomar linha "${lineToResume.name}". Detalhe: ${resumeError.message}`);
      return { success: false, message: `Falha ao retomar linha. Detalhe: ${resumeError.message}` };
    }
    
    const effectiveLostOperatingTimeDuringPause = calculateEffectiveWorkDuration(pauseStartTimeObj, pauseEndTimeObj, lineToResume);
    let propagationMessages: string[] = [];

    for (const schedule of schedules) {
      if (schedule.lineId !== lineId) continue;

      const originalStartTime = new Date(schedule.startTime);
      const originalEndTime = new Date(schedule.endTime);
      let newStartTimeForDb = schedule.startTime;
      let newEndTimeForDb = schedule.endTime;
      let newStatusForDb = schedule.status;
      let interruptionPropsUpdate: { interruption_pause_start_time?: string | null, interruption_pause_end_time?: string | null } = {
          interruption_pause_start_time: schedule.interruptionPauseStartTime || null, // Preserve existing if any, unless overridden
          interruption_pause_end_time: schedule.interruptionPauseEndTime || null,
      };


      const originalEffectiveWorkDuration = calculateEffectiveWorkDuration(originalStartTime, originalEndTime, lineToResume);

      if (schedule.status === 'Em Progresso' && originalEndTime > pauseStartTimeObj) { 
        if (originalStartTime >= pauseStartTimeObj) { 
            const shiftedStartTime = addWorkingTime(originalStartTime, effectiveLostOperatingTimeDuringPause, lineToResume);
            newStartTimeForDb = shiftedStartTime.toISOString();
            newEndTimeForDb = addWorkingTime(shiftedStartTime, originalEffectiveWorkDuration, lineToResume).toISOString();
            interruptionPropsUpdate.interruption_pause_start_time = null; // Not directly interrupted by *this* pause if it started during
            interruptionPropsUpdate.interruption_pause_end_time = null;
            propagationMessages.push(`Agendamento Em Progresso ID ${schedule.id} (${getProductByIdOp(schedule.productId)?.name || 'N/A'}) iniciado durante pausa, reprogramado.`);
        } else { 
            const effectiveWorkRemaining = calculateEffectiveWorkDuration(pauseStartTimeObj, originalEndTime, lineToResume);

            if (effectiveWorkRemaining <= 0) {
                newStatusForDb = 'Concluído';
                newEndTimeForDb = pauseStartTimeObj.toISOString(); 
                interruptionPropsUpdate.interruption_pause_start_time = null; // No longer interrupted if completed
                interruptionPropsUpdate.interruption_pause_end_time = null;
                propagationMessages.push(`Agendamento ID ${schedule.id} (${getProductByIdOp(schedule.productId)?.name || 'N/A'}) concluído no início da pausa.`);
            } else {
                newEndTimeForDb = addWorkingTime(pauseEndTimeObj, effectiveWorkRemaining, lineToResume).toISOString();
                interruptionPropsUpdate.interruption_pause_start_time = pauseStartTimeObj.toISOString();
                interruptionPropsUpdate.interruption_pause_end_time = pauseEndTimeObj.toISOString();
                propagationMessages.push(`Agendamento ID ${schedule.id} (${getProductByIdOp(schedule.productId)?.name || 'N/A'}) continuado, novo fim: ${new Date(newEndTimeForDb).toLocaleString('pt-BR')}.`);
            }
        }
      } else if (schedule.status === 'Pendente' && (originalStartTime >= pauseStartTimeObj || (originalEndTime > pauseStartTimeObj && originalStartTime < pauseStartTimeObj))) { 
        const shiftedStartTime = addWorkingTime(originalStartTime, effectiveLostOperatingTimeDuringPause, lineToResume);
        newStartTimeForDb = shiftedStartTime.toISOString();
        newEndTimeForDb = addWorkingTime(shiftedStartTime, originalEffectiveWorkDuration, lineToResume).toISOString();
        interruptionPropsUpdate.interruption_pause_start_time = null; // Pendente schedules are shifted, not "interrupted" in the same visual way
        interruptionPropsUpdate.interruption_pause_end_time = null;
        propagationMessages.push(`Agendamento Pendente ID ${schedule.id} (${getProductByIdOp(schedule.productId)?.name || 'N/A'}) reprogramado devido à pausa.`);
      }

      if (newStatusForDb !== 'Em Progresso') { // Clear interruption if not actively 'Em Progresso'
          interruptionPropsUpdate.interruption_pause_start_time = null;
          interruptionPropsUpdate.interruption_pause_end_time = null;
      }


      if (newStartTimeForDb !== schedule.startTime || newEndTimeForDb !== schedule.endTime || newStatusForDb !== schedule.status || 
          interruptionPropsUpdate.interruption_pause_start_time !== schedule.interruptionPauseStartTime || 
          interruptionPropsUpdate.interruption_pause_end_time !== schedule.interruptionPauseEndTime) {
         const updatedDbSchedule = { 
            start_time: newStartTimeForDb, 
            end_time: newEndTimeForDb, 
            status: newStatusForDb,
            ...interruptionPropsUpdate 
        };
         const { error: scheduleUpdateError } = await supabase.from('scheduled_production_runs').update(updatedDbSchedule).eq('id', schedule.id);
         if (scheduleUpdateError) {
            propagationMessages.push(`Erro ao atualizar agendamento ID ${schedule.id}: ${scheduleUpdateError.message}`);
         }
      }
    }
    await fetchInitialData(); 
    let finalMessage = `Linha "${lineToResume.name}" retomada. Duração (relógio): ${wallClockPauseDurationMinutes} min. Tempo de operação perdido: ${effectiveLostOperatingTimeDuringPause} min.`;
    if (propagationMessages.length > 0) {
        finalMessage += ` Detalhes da propagação: ${propagationMessages.join('; ')}`;
    }
    return { success: true, message: finalMessage };
  }, [productionLines, user, handleError, schedules, getProductByIdOp, fetchInitialData, addWorkingTime, calculateEffectiveWorkDuration]);

  const optimizeDaySchedulesOp = useCallback(async (dateToOptimize: Date): Promise<{ optimizedCount: number; unoptimizedCount: number; details: string[] }> => {
    setIsLoading(true);
    let optimizedCount = 0;
    let unoptimizedCount = 0;
    let details: string[] = [];
    const startOfDay = new Date(dateToOptimize);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(dateToOptimize);
    endOfDay.setHours(23, 59, 59, 999);
    const schedulesForDay = schedules.filter(s => {
      const sDate = new Date(s.startTime);
      return sDate >= startOfDay && sDate <= endOfDay;
    }).sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
    const linesInUseToday = [...new Set(schedulesForDay.map(s => s.lineId))].map(id => getProductionLineByIdOp(id)).filter(l => l !== undefined) as ProductionLine[];
    for (const line of linesInUseToday) {
      if (line.isPaused) {
        details.push(`Linha ${line.name} está pausada e foi ignorada na otimização.`);
        continue;
      }
      const lineSchedules = schedulesForDay.filter(s => s.lineId === line.id).sort((a, b) => {
            const productA = getProductByIdOp(a.productId);
            const productB = getProductByIdOp(b.productId);
            if (productA?.classification === 'Top Seller' && productB?.classification !== 'Top Seller') return -1;
            if (productA?.classification !== 'Top Seller' && productB?.classification === 'Top Seller') return 1;
            return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
        });
      let lastEndTimeOnLine = new Date(startOfDay); 
      for (const schedule of lineSchedules) {
        const product = getProductByIdOp(schedule.productId);
        if (!product) {
          details.push(`Produto ID ${schedule.productId} não encontrado para o agendamento ${schedule.id}.`);
          unoptimizedCount++;
          continue;
        }
        if (product.classification === 'Top Seller' || schedule.status !== 'Pendente') {
           const scheduleEndTime = new Date(schedule.endTime);
           if (scheduleEndTime > lastEndTimeOnLine) lastEndTimeOnLine = scheduleEndTime;
          continue; 
        }
        
        const originalEffectiveDurationMinutes = calculateEffectiveWorkDuration(new Date(schedule.startTime), new Date(schedule.endTime), line);

        let proposedStartTime = new Date(lastEndTimeOnLine);
        let newStartTime = addWorkingTime(proposedStartTime, 0, line); 
        if (newStartTime.getDate() !== startOfDay.getDate()) {
            details.push(`Agendamento ${schedule.id} (${product.name}) não pôde ser encaixado em ${line.name} hoje. Tentando manter horário original.`);
             const originalStartTimeCheck = new Date(schedule.startTime);
             const canKeepOriginal = originalStartTimeCheck >= lastEndTimeOnLine && addWorkingTime(originalStartTimeCheck, originalEffectiveDurationMinutes, line) <= endOfDay;
            if(canKeepOriginal) { lastEndTimeOnLine = addWorkingTime(originalStartTimeCheck, originalEffectiveDurationMinutes, line); } else { unoptimizedCount++; }
            continue;
        }
        let newEndTime = addWorkingTime(newStartTime, originalEffectiveDurationMinutes, line);
        let conflictWithFixed = false;
        if (newEndTime > endOfDay) {
             conflictWithFixed = true; 
             details.push(`Agendamento ${schedule.id} (${product.name}) otimizado para ${newStartTime.toLocaleTimeString('pt-BR')} em ${line.name} extrapolaria o dia.`);
        } else {
            for (const nextSchedule of lineSchedules) {
                if (nextSchedule.id === schedule.id) continue; 
                const nextProduct = getProductByIdOp(nextSchedule.productId);
                if (nextProduct?.classification === 'Top Seller' || nextSchedule.status !== 'Pendente') {
                    const nextScheduleStart = new Date(nextSchedule.startTime);
                    const nextScheduleEnd = new Date(nextSchedule.endTime);
                    if (newStartTime < nextScheduleEnd && newEndTime > nextScheduleStart) {
                        conflictWithFixed = true;
                        details.push(`Conflito ao otimizar ${schedule.id} (${product.name}): colide com ${nextSchedule.id} (${nextProduct.name}) em ${line.name}.`);
                        break;
                    }
                }
            }
        }
        if (!conflictWithFixed) {
            if (newStartTime.toISOString() !== schedule.startTime || newEndTime.toISOString() !== schedule.endTime) {
                const updateResult = await updateScheduleOp({ ...schedule, startTime: newStartTime.toISOString(), endTime: newEndTime.toISOString(), });
                if (updateResult) {
                    optimizedCount++;
                    details.push(`Agendamento ${schedule.id} (${product.name}) otimizado para ${newStartTime.toLocaleTimeString('pt-BR')} em ${line.name}.`);
                } else {
                    unoptimizedCount++;
                    details.push(`Falha ao atualizar agendamento ${schedule.id} (${product.name}) durante otimização.`);
                    newEndTime = new Date(schedule.endTime); 
                }
            }
            lastEndTimeOnLine = newEndTime;
        } else {
            unoptimizedCount++;
            const originalStartTimeCheck = new Date(schedule.startTime);
            if (originalStartTimeCheck >= lastEndTimeOnLine) {
                 const originalEndTimeCheck = addWorkingTime(originalStartTimeCheck, originalEffectiveDurationMinutes, line);
                 if (!lineSchedules.some(ns => { 
                    if (ns.id === schedule.id) return false;
                    const nsp = getProductByIdOp(ns.productId);
                    if (nsp?.classification === 'Top Seller' || ns.status !== 'Pendente') {
                         const nss = new Date(ns.startTime); const nse = new Date(ns.endTime);
                         return originalStartTimeCheck < nse && originalEndTimeCheck > nss;
                    } return false;
                 })) { lastEndTimeOnLine = originalEndTimeCheck; }
            }
        }
      }
    }
    setIsLoading(false);
    await fetchInitialData(); 
    return { optimizedCount, unoptimizedCount, details };
  }, [schedules, getProductionLineByIdOp, getProductByIdOp, updateScheduleOp, fetchInitialData, addWorkingTime, calculateEffectiveWorkDuration]);

  // Effect for automatic schedule status updates
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      schedules.forEach(schedule => {
        const startTime = new Date(schedule.startTime);
        const endTime = new Date(schedule.endTime);
        if (
          schedule.status === 'Pendente' &&
          now >= startTime &&
          now < endTime
        ) {
          const product = getProductByIdOp(schedule.productId);
          // console.log(`AppDataContext: Schedule ${schedule.id} (${product?.name || 'Desconhecido'}) está iniciando. Atualizando status para 'Em Progresso'.`);
          updateScheduleOp({ ...schedule, status: 'Em Progresso' });
        }
      });
    }, 60000); // Check every minute

    return () => clearInterval(timer);
  }, [schedules, updateScheduleOp, getProductByIdOp]); 

  return (
    <AppDataContext.Provider value={{
      equipment, addEquipment: addEquipmentOp, updateEquipment: updateEquipmentOp, deleteEquipment: deleteEquipmentOp, getEquipmentById: getEquipmentByIdOp,
      products, addProduct: addProductOp, updateProduct: updateProductOp, deleteProduct: deleteProductOp, getProductById: getProductByIdOp,
      productionLines, addProductionLine: addProductionLineOp, updateProductionLine: updateProductionLineOp, deleteProductionLine: deleteProductionLineOp, getProductionLineById: getProductionLineByIdOp,
      schedules, addSchedule: addScheduleOp, updateSchedule: updateScheduleOp, deleteSchedule: deleteScheduleOp, getScheduleById: getScheduleByIdOp,
      pauseLine: pauseLineOp,
      resumeLine: resumeLineOp,
      addWorkingTime,
      calculateEffectiveWorkDuration,
      linePauseHistory,
      optimizeDaySchedules: optimizeDaySchedulesOp,
      isLoading,
      error: errorState,
      fetchInitialData,
    }}>
      {children}
    </AppDataContext.Provider>
  );
};

export const useAppData = (): AppDataContextType => {
  const context = useContext(AppDataContext);
  if (context === undefined) {
    throw new Error('useAppData must be used within an AppDataProvider');
  }
  return context;
};
