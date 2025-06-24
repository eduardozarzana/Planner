
export interface Equipment {
  id: string;
  name: string;
  type: string; // e.g., Mixer, Oven, Packager -> ex: Misturador, Forno, Embaladora
  maintenanceDate?: string; // ISO date string
  createdAt?: string; // ISO datetime string
  updatedAt?: string; // ISO datetime string
}

export type ProductClassification = 'Normal' | 'Top Seller';

export interface Product {
  id: string;
  name: string;
  sku: string;
  description: string;
  ingredients?: string[]; // Optional
  processingTimes: Array<{ equipmentId: string; timePerUnitMinutes: number; }>;
  classification: ProductClassification; // Added classification
  manufacturedFor?: string; // Added new field
  createdAt?: string; // ISO datetime string
  updatedAt?: string; // ISO datetime string
}

export interface OperatingDayTime {
  dayOfWeek: number; // 0 for Sunday, 1 for Monday, ..., 6 for Saturday
  startTime: string; // HH:MM format
  endTime: string;   // HH:MM format
  isActive: boolean; // To enable/disable the day
}

export interface ProductionLine {
  id: string;
  name: string;
  description?: string;
  equipmentIds: string[]; // Ordered list of equipment IDs
  operatingHours: OperatingDayTime[]; // Array of 7, one for each day
  createdAt?: string; // ISO datetime string
  updatedAt?: string; // ISO datetime string
  // Fields for pause functionality
  isPaused?: boolean;
  currentPauseStartTime?: string | null; // ISO datetime string
  currentPauseReason?: string | null;
  pausedByUserEmail?: string | null;
}

export type ScheduleStatus = 'Pendente' | 'Em Progresso' | 'Concluído' | 'Cancelado';

export interface ScheduledProductionRun {
  id: string;
  productId: string;
  lineId: string;
  startTime: string; // ISO datetime string
  endTime: string; // ISO datetime string
  quantity: number;
  notes?: string;
  status: ScheduleStatus;
  createdAt?: string; // ISO datetime string
  updatedAt?: string; // ISO datetime string
  interruptionPauseStartTime?: string | null; // Start of the pause that interrupted this run
  interruptionPauseEndTime?: string | null;   // End of the pause that interrupted this run
}

export interface SelectOption {
  value: string;
  label: string;
}

export interface LinePauseHistoryEntry {
  id: string;
  lineId: string;
  pausedByUserEmail: string;
  pauseStartTime: string; // ISO datetime string
  pauseEndTime: string; // ISO datetime string
  pauseReason?: string | null;
  durationMinutes: number;
  createdAt: string; // ISO datetime string
}