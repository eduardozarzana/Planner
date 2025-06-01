
import React, { createContext, useContext, ReactNode, useEffect, useState, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { Equipment, Product, ProductionLine, ScheduledProductionRun, OperatingDayTime, ProductClassification, ScheduleStatus } from '../types'; // Added ScheduleStatus
import { generateUUID } from '../utils/uuid'; // Ainda pode ser útil para IDs temporários em formulários complexos

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
  equipmentIds: db.equipment_ids || [], // Garante que seja um array
  operatingHours: db.operating_hours,
  createdAt: db.created_at,
  updatedAt: db.updated_at,
});

const mapProductionLineToDb = (pl: Omit<ProductionLine, 'id' | 'createdAt' | 'updatedAt'>): Omit<DbProductionLine, 'id' | 'created_at' | 'updated_at'> => ({
  name: pl.name,
  description: pl.description,
  equipment_ids: pl.equipmentIds,
  operating_hours: pl.operatingHours,
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
});

const mapScheduledRunToDb = (sr: Omit<ScheduledProductionRun, 'id' | 'createdAt' | 'updatedAt'>): Omit<DbScheduledProductionRun, 'id' | 'created_at' | 'updated_at'> => ({
  product_id: sr.productId,
  line_id: sr.lineId,
  start_time: sr.startTime,
  end_time: sr.endTime,
  quantity: sr.quantity,
  notes: sr.notes,
  status: sr.status,
});


const timeToMinutes = (timeStr: string): number => {
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
  updateProductionLine: (item: ProductionLine) => Promise<void>;
  deleteProductionLine: (id: string) => Promise<void>;
  getProductionLineById: (id: string) => ProductionLine | undefined;

  schedules: ScheduledProductionRun[];
  addSchedule: (item: Omit<ScheduledProductionRun, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateSchedule: (item: ScheduledProductionRun) => Promise<void>;
  deleteSchedule: (id: string) => Promise<void>;
  getScheduleById: (id: string) => ScheduledProductionRun | undefined;
  
  optimizeDaySchedules: (dateToOptimize: Date) => Promise<{
    optimizedCount: number;
    unoptimizedCount: number;
    details: string[];
  }>;

  isLoading: boolean;
  error: Error | null;
  fetchInitialData: () => Promise<void>; // Expose to allow re-fetch if needed
}

const AppDataContext = createContext<AppDataContextType | undefined>(undefined);

export const AppDataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [productionLines, setProductionLines] = useState<ProductionLine[]>([]);
  const [schedules, setSchedules] = useState<ScheduledProductionRun[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const handleError = (operation: string, error: any) => {
    console.error(`AppDataContext: Error during ${operation}:`, error);
    setError(new Error(`Falha em ${operation}: ${error.message || 'Erro desconhecido'}`));
  };

  const fetchInitialData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [
        { data: eqData, error: eqError },
        { data: pData, error: pError },
        { data: plData, error: plError },
        { data: scData, error: scError }
      ] = await Promise.all([
        supabase.from('equipment').select('*').order('name', { ascending: true }),
        supabase.from('products').select('*').order('name', { ascending: true }),
        supabase.from('production_lines').select('*').order('name', { ascending: true }),
        supabase.from('scheduled_production_runs').select('*').order('start_time', { ascending: true })
      ]);

      if (eqError) throw eqError;
      if (pError) throw pError;
      if (plError) throw plError;
      if (scError) throw scError;

      setEquipment(eqData?.map(mapDbToEquipment) || []);
      setProducts(pData?.map(mapDbToProduct) || []);
      setProductionLines(plData?.map(mapDbToProductionLine) || []);
      setSchedules(scData?.map(mapDbToScheduledRun) || []);

    } catch (e: any) {
      handleError('fetchInitialData', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);
  
  // Auto-update schedule status (client-side, for simplicity here)
  useEffect(() => {
    const intervalId = setInterval(async () => {
      const currentTime = new Date().getTime();
      let schedulesToUpdate: ScheduledProductionRun[] = [];

      schedules.forEach(schedule => {
        const startTimeMs = new Date(schedule.startTime).getTime();
        const endTimeMs = new Date(schedule.endTime).getTime();
        let newStatus = schedule.status;

        if (schedule.status === 'Pendente' && currentTime >= startTimeMs && currentTime < endTimeMs) {
          newStatus = 'Em Progresso';
        } else if (schedule.status === 'Em Progresso' && currentTime >= endTimeMs) {
          newStatus = 'Concluído';
        }
        
        if (schedule.status !== 'Cancelado' && schedule.status !== 'Concluído' && newStatus !== schedule.status) {
          schedulesToUpdate.push({ ...schedule, status: newStatus });
        }
      });

      if (schedulesToUpdate.length > 0) {
        // Batch update might be better, but Supabase client handles one by one ok for small numbers
        for (const sched of schedulesToUpdate) {
          await updateScheduleOp(sched); // This will re-fetch or update local state
        }
      }
    }, 30000); // Check every 30 seconds

    return () => clearInterval(intervalId);
  }, [schedules]); // `updateScheduleOp` will be stable due to useCallback

  const getProductById = (id: string) => products.find(p => p.id === id);
  const getProductionLineById = (id: string) => productionLines.find(l => l.id === id);
  const getEquipmentById = (id: string) => equipment.find(e => e.id === id);
  const getScheduleById = (id: string) => schedules.find(s => s.id === id);


  // Equipment CRUD
  const addEquipmentOp = async (item: Omit<Equipment, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      const { data, error: insertError } = await supabase
        .from('equipment')
        .insert(mapEquipmentToDb(item))
        .select()
        .single();
      if (insertError) throw insertError;
      if (data) setEquipment(prev => [...prev, mapDbToEquipment(data)].sort((a, b) => a.name.localeCompare(b.name)));
    } catch (e) { handleError('addEquipment', e); }
  };
  const updateEquipmentOp = async (item: Equipment) => {
    try {
      const { data, error: updateError } = await supabase
        .from('equipment')
        .update(mapEquipmentToDb(item))
        .eq('id', item.id)
        .select()
        .single();
      if (updateError) throw updateError;
      if (data) setEquipment(prev => prev.map(eq => eq.id === item.id ? mapDbToEquipment(data) : eq).sort((a,b) => a.name.localeCompare(b.name)));
    } catch (e) { handleError('updateEquipment', e); }
  };
  const deleteEquipmentOp = async (id: string) => {
    try {
      // 1. Clean up equipment from products' processingTimes
      const affectedProducts = products.filter(p => p.processingTimes.some(pt => pt.equipmentId === id));
      for (const prod of affectedProducts) {
        const newProcessingTimes = prod.processingTimes.filter(pt => pt.equipmentId !== id);
        const { error: productUpdateError } = await supabase
          .from('products')
          .update({ processing_times: newProcessingTimes })
          .eq('id', prod.id);
        if (productUpdateError) throw new Error(`Failed to update product ${prod.name}: ${productUpdateError.message}`);
        setProducts(prev => prev.map(p => p.id === prod.id ? {...p, processingTimes: newProcessingTimes} : p));
      }

      // 2. Clean up equipment from production_lines' equipmentIds
      const affectedLines = productionLines.filter(l => l.equipmentIds.includes(id));
      for (const line of affectedLines) {
        const newEquipmentIds = line.equipmentIds.filter(eqId => eqId !== id);
        const { error: lineUpdateError } = await supabase
          .from('production_lines')
          .update({ equipment_ids: newEquipmentIds })
          .eq('id', line.id);
        if (lineUpdateError) throw new Error(`Failed to update line ${line.name}: ${lineUpdateError.message}`);
        setProductionLines(prev => prev.map(l => l.id === line.id ? {...l, equipmentIds: newEquipmentIds} : l));
      }

      // 3. Delete the equipment
      const { error: deleteError } = await supabase.from('equipment').delete().eq('id', id);
      if (deleteError) throw deleteError;
      setEquipment(prev => prev.filter(eq => eq.id !== id));
    } catch (e) { handleError('deleteEquipment', e); }
  };

  // Products CRUD
  const addProductOp = async (item: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      const { data, error: insertError } = await supabase
        .from('products')
        .insert(mapProductToDb(item))
        .select()
        .single();
      if (insertError) throw insertError;
      if (data) setProducts(prev => [...prev, mapDbToProduct(data)].sort((a,b) => a.name.localeCompare(b.name)));
    } catch (e) { handleError('addProduct', e); }
  };
  const updateProductOp = async (item: Product) => {
    try {
      const { data, error: updateError } = await supabase
        .from('products')
        .update(mapProductToDb(item))
        .eq('id', item.id)
        .select()
        .single();
      if (updateError) throw updateError;
      if (data) setProducts(prev => prev.map(p => p.id === item.id ? mapDbToProduct(data) : p).sort((a,b) => a.name.localeCompare(b.name)));
    } catch (e) { handleError('updateProduct', e); }
  };
  const deleteProductOp = async (id: string) => { // Schedules cascade via DB constraint
    try {
      const { error: deleteError } = await supabase.from('products').delete().eq('id', id);
      if (deleteError) throw deleteError;
      setProducts(prev => prev.filter(p => p.id !== id));
    } catch (e) { handleError('deleteProduct', e); }
  };

  // Production Lines CRUD
  const addProductionLineOp = async (item: Pick<ProductionLine, 'name' | 'description' | 'operatingHours'>): Promise<ProductionLine | null> => {
    try {
      const newLineData: Omit<ProductionLine, 'id' | 'createdAt' | 'updatedAt'> = {
        ...item,
        equipmentIds: [], // New lines start with no equipment
      };
      const { data, error: insertError } = await supabase
        .from('production_lines')
        .insert(mapProductionLineToDb(newLineData))
        .select()
        .single();
      if (insertError) throw insertError;
      if (data) {
        const newLine = mapDbToProductionLine(data);
        setProductionLines(prev => [...prev, newLine].sort((a,b) => a.name.localeCompare(b.name)));
        return newLine;
      }
      return null;
    } catch (e) { 
      handleError('addProductionLine', e);
      return null;
    }
  };
  const updateProductionLineOp = async (item: ProductionLine) => {
    try {
      const { data, error: updateError } = await supabase
        .from('production_lines')
        .update(mapProductionLineToDb(item))
        .eq('id', item.id)
        .select()
        .single();
      if (updateError) throw updateError;
      if (data) setProductionLines(prev => prev.map(l => l.id === item.id ? mapDbToProductionLine(data) : l).sort((a,b) => a.name.localeCompare(b.name)));
    } catch (e) { handleError('updateProductionLine', e); }
  };
  const deleteProductionLineOp = async (id: string) => { // Schedules cascade via DB constraint
    try {
      const { error: deleteError } = await supabase.from('production_lines').delete().eq('id', id);
      if (deleteError) throw deleteError;
      setProductionLines(prev => prev.filter(l => l.id !== id));
    } catch (e) { handleError('deleteProductionLine', e); }
  };

  // Schedules CRUD
  const addScheduleOp = async (item: Omit<ScheduledProductionRun, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      const { data, error: insertError } = await supabase
        .from('scheduled_production_runs')
        .insert(mapScheduledRunToDb(item))
        .select()
        .single();
      if (insertError) throw insertError;
      if (data) setSchedules(prev => [...prev, mapDbToScheduledRun(data)].sort((a,b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()));
    } catch (e) { handleError('addSchedule', e); }
  };
  const updateScheduleOp = async (item: ScheduledProductionRun) => {
    try {
      const { data, error: updateError } = await supabase
        .from('scheduled_production_runs')
        .update(mapScheduledRunToDb(item))
        .eq('id', item.id)
        .select()
        .single();
      if (updateError) throw updateError;
      if (data) setSchedules(prev => prev.map(s => s.id === item.id ? mapDbToScheduledRun(data) : s).sort((a,b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()));
    } catch (e) { handleError('updateSchedule', e); }
  };
  const deleteScheduleOp = async (id: string) => {
    try {
      const { error: deleteError } = await supabase.from('scheduled_production_runs').delete().eq('id', id);
      if (deleteError) throw deleteError;
      setSchedules(prev => prev.filter(s => s.id !== id));
    } catch (e) { handleError('deleteSchedule', e); }
  };
  
  const calculateProductDurationOnLine = (product: Product, line: ProductionLine, quantity: number): number => {
    if (!product || !line || quantity <= 0) return 0;
    if (!product.processingTimes || product.processingTimes.length === 0) return 0;
    if (!line.equipmentIds || line.equipmentIds.length === 0) return 0;

    let totalDurationForOneUnit = 0;
    for (const eqIdInLine of line.equipmentIds) {
      const productTimeForEq = product.processingTimes.find(pt => pt.equipmentId === eqIdInLine);
      if (productTimeForEq) {
        totalDurationForOneUnit += productTimeForEq.timePerUnitMinutes;
      }
    }
    return totalDurationForOneUnit * quantity;
  };

  const optimizeDaySchedulesOp = async (dateToOptimize: Date): Promise<{ optimizedCount: number; unoptimizedCount: number; details: string[] }> => {
    const targetDayStart = new Date(dateToOptimize);
    targetDayStart.setHours(0, 0, 0, 0);
    
    const currentSchedulesSnapshot = [...schedules];
    const details: string[] = [];
    
    const schedulesStartingOnTargetDay = currentSchedulesSnapshot.filter(s => {
        const sDate = new Date(s.startTime);
        return sDate.getFullYear() === targetDayStart.getFullYear() &&
               sDate.getMonth() === targetDayStart.getMonth() &&
               sDate.getDate() === targetDayStart.getDate();
    });
        
    let optimizedCount = 0;
    let unoptimizedCount = 0;
    const schedulesToUpdate: ScheduledProductionRun[] = [];

    const isToday = targetDayStart.toDateString() === new Date().toDateString();
    const now = new Date(); 

    const lineIdsToProcess = [...new Set(schedulesStartingOnTargetDay.map(s => s.lineId))];

    for (const lineId of lineIdsToProcess) {
        const line = getProductionLineById(lineId);
        if (!line) {
            details.push(`Linha ID ${lineId} não encontrada. Agendamentos para esta linha não foram processados.`);
            const unoptimizedForThisLine = schedulesStartingOnTargetDay.filter(s => s.lineId === lineId);
            unoptimizedCount += unoptimizedForThisLine.filter(s => getProductById(s.productId)?.classification === 'Normal' && s.status === 'Pendente').length;
            continue;
        }

        const schedulesForThisLineToday = schedulesStartingOnTargetDay.filter(s => s.lineId === lineId);
        const fixedSchedulesOnThisLine: ScheduledProductionRun[] = [];
        const normalPendingSchedulesForOptimization: ScheduledProductionRun[] = [];

        schedulesForThisLineToday.forEach(schedule => {
            const product = getProductById(schedule.productId);
            if (product?.classification === 'Top Seller' || (product?.classification === 'Normal' && schedule.status !== 'Pendente')) {
                fixedSchedulesOnThisLine.push(schedule);
                if (product?.classification === 'Normal') {
                    unoptimizedCount++;
                    details.push(`Produto ${product?.name || 'Desconhecido'} (Ag. ${schedule.id}) mantido: status '${schedule.status}'.`);
                }
            } else if (product?.classification === 'Normal' && schedule.status === 'Pendente') {
                normalPendingSchedulesForOptimization.push(schedule);
            } else {
                fixedSchedulesOnThisLine.push(schedule);
                unoptimizedCount++;
                details.push(`Agendamento ${schedule.id} (Produto ${product?.name || 'Desconhecido'}) com status/classificação inesperado, mantido original.`);
            }
        });
        
        fixedSchedulesOnThisLine.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
        let currentAvailableSlots: ScheduledProductionRun[] = [...fixedSchedulesOnThisLine]; // Slots already taken

        normalPendingSchedulesForOptimization.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

        for (const normalSchedule of normalPendingSchedulesForOptimization) {
            const product = getProductById(normalSchedule.productId);
            if (!product) {
                details.push(`Produto ID ${normalSchedule.productId} (Ag. ${normalSchedule.id}) não encontrado. Mantido original.`);
                unoptimizedCount++;
                continue;
            }

            const durationMinutes = calculateProductDurationOnLine(product, line, normalSchedule.quantity);
            if (durationMinutes <= 0) {
                details.push(`Produto ${product.name} (Ag. ${normalSchedule.id}) tem duração inválida na linha ${line.name}. Mantido original.`);
                unoptimizedCount++;
                continue;
            }

            let effectiveStartOfSearchWindow = new Date(targetDayStart);
            const dayOfWeekForOptimization = targetDayStart.getDay();
            const lineOpHoursForDay = line.operatingHours.find(oh => oh.dayOfWeek === dayOfWeekForOptimization);

            if (!lineOpHoursForDay || !lineOpHoursForDay.isActive) {
                details.push(`Linha ${line.name} não opera em ${daysOfWeekNames[dayOfWeekForOptimization]}. ${product.name} (Ag. ${normalSchedule.id}) não otimizado.`);
                unoptimizedCount++;
                continue;
            }

            const lineOpStartMinutes = timeToMinutes(lineOpHoursForDay.startTime);
            const lineOpEndMinutes = timeToMinutes(lineOpHoursForDay.endTime);
            effectiveStartOfSearchWindow.setHours(Math.floor(lineOpStartMinutes / 60), lineOpStartMinutes % 60, 0, 0);

            if (isToday) {
                const currentTimeToday = new Date(now);
                currentTimeToday.setSeconds(0, 0); 
                if (currentTimeToday > effectiveStartOfSearchWindow) {
                    effectiveStartOfSearchWindow = currentTimeToday; 
                }
            }
            
            if (effectiveStartOfSearchWindow.getHours() * 60 + effectiveStartOfSearchWindow.getMinutes() >= lineOpEndMinutes) {
                 details.push(`Horário de início da otimização para ${product.name} (Ag. ${normalSchedule.id}) na linha ${line.name} já passou do fim da operação do dia. Mantido original.`);
                 unoptimizedCount++;
                 continue;
            }

            let attemptStartTime = new Date(effectiveStartOfSearchWindow);
            let slotFound = false;

            while (true) { // Search for a slot
                const currentAttemptTimeMinutes = attemptStartTime.getHours() * 60 + attemptStartTime.getMinutes();
                if (attemptStartTime.getDate() !== targetDayStart.getDate() || currentAttemptTimeMinutes >= lineOpEndMinutes) break;

                const proposedStartTime = new Date(attemptStartTime);
                const proposedEndTime = new Date(proposedStartTime.getTime() + durationMinutes * 60000);
                const proposedEndTimeMinutes = proposedEndTime.getHours() * 60 + proposedEndTime.getMinutes();

                if (proposedEndTime.getDate() !== targetDayStart.getDate() || proposedEndTimeMinutes > lineOpEndMinutes) {
                     if (!(proposedEndTime.getDate() === targetDayStart.getDate() && proposedEndTimeMinutes === lineOpEndMinutes)) break;
                }
                
                let collision = false;
                for (const existingItem of currentAvailableSlots) { // Check against already placed items for this line today
                    const existingStart = new Date(existingItem.startTime).getTime();
                    const existingEnd = new Date(existingItem.endTime).getTime();
                    if (proposedStartTime.getTime() < existingEnd && proposedEndTime.getTime() > existingStart) {
                        collision = true;
                        attemptStartTime = new Date(Math.max(existingEnd, effectiveStartOfSearchWindow.getTime())); // Try after this collision or effective start
                        break; 
                    }
                }

                if (collision) continue; 

                const updatedNormalSchedule = { ...normalSchedule, startTime: proposedStartTime.toISOString(), endTime: proposedEndTime.toISOString() };
                schedulesToUpdate.push(updatedNormalSchedule);
                currentAvailableSlots.push(updatedNormalSchedule); // Add to occupied slots for subsequent checks
                currentAvailableSlots.sort((a,b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
                optimizedCount++;
                details.push(`Produto ${product.name} (Ag. ${normalSchedule.id}) otimizado para ${proposedStartTime.toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'})} na linha ${line.name}.`);
                slotFound = true;
                break; 
            } 
            if (!slotFound) {
                details.push(`Não foi possível otimizar ${product.name} (Ag. ${normalSchedule.id}) na linha ${line.name}. Mantido original.`);
                unoptimizedCount++;
            }
        }
    }
    
    if (schedulesToUpdate.length > 0) {
        setIsLoading(true);
        try {
            // Batch update can be complex with Supabase client, doing one by one for now
            for (const sched of schedulesToUpdate) {
                await updateScheduleOp(sched); // This will update state internally
            }
        } catch(e) {
            handleError('optimizeDaySchedules', e);
        } finally {
            setIsLoading(false);
        }
    } else {
       if (optimizedCount === 0 && unoptimizedCount === 0 && lineIdsToProcess.length > 0) {
            const hasNormalPendente = schedulesStartingOnTargetDay.some(s => getProductById(s.productId)?.classification === 'Normal' && s.status === 'Pendente');
            if (!hasNormalPendente && schedulesStartingOnTargetDay.length > 0) {
                details.push("Nenhum produto 'Normal' com status 'Pendente' agendado para hoje para otimizar.");
            } else if (schedulesStartingOnTargetDay.length === 0) {
                details.push("Nenhum produto agendado para hoje.");
            }
        }
    }

    return { optimizedCount, unoptimizedCount, details };
  };


  return (
    <AppDataContext.Provider value={{
      equipment, addEquipment: addEquipmentOp, updateEquipment: updateEquipmentOp, deleteEquipment: deleteEquipmentOp, getEquipmentById,
      products, addProduct: addProductOp, updateProduct: updateProductOp, deleteProduct: deleteProductOp, getProductById,
      productionLines, addProductionLine: addProductionLineOp, updateProductionLine: updateProductionLineOp, deleteProductionLine: deleteProductionLineOp, getProductionLineById,
      schedules, addSchedule: addScheduleOp, updateSchedule: updateScheduleOp, deleteSchedule: deleteScheduleOp, getScheduleById,
      optimizeDaySchedules: optimizeDaySchedulesOp,
      isLoading, error, fetchInitialData
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
