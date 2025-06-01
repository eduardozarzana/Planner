
import React, { useState, useCallback, useMemo } from 'react';
import { ScheduledProductionRun, ProductionLine, Product, OperatingDayTime, ProductClassification, ScheduleStatus } from '../../types';
import { LockClosedIcon } from '../icons';
import { useAppData } from '../../contexts/AppDataContext'; // Get all schedules for conflict check

interface GanttChartProps {
  schedules: Array<ScheduledProductionRun & {
    productName: string;
    productClassification: ProductClassification;
    lineName: string;
    lineOperatingHours: OperatingDayTime[];
    // status: ScheduleStatus; // Status is already part of ScheduledProductionRun
  }>;
  lines: ProductionLine[];
  day: Date; // The specific day the Gantt chart is for
  currentTime: Date; // Added currentTime prop
  updateSchedule: (schedule: ScheduledProductionRun) => void;
  getProductById: (id: string) => Product | undefined; // For full product details if needed
  getProductionLineById: (id: string) => ProductionLine | undefined; // For full line details
  onUpdateFeedback: (message: string, type: 'success' | 'error' | 'info') => void;
}

const hourWidth = 120; // Doubled from 60 pixels for 1 hour
const totalHours = 24;
const chartWidth = hourWidth * totalHours;
const dayStartTime = 0; // Midnight

const timeToMinutes = (date: Date | string): number => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.getHours() * 60 + d.getMinutes();
};

const minutesToPixels = (minutes: number): number => {
  return (minutes / 60) * hourWidth;
};

const pixelsToMinutes = (pixels: number): number => {
  return (pixels / hourWidth) * 60;
};


const GanttChart: React.FC<GanttChartProps> = ({
    schedules,
    lines,
    day,
    currentTime, 
    updateSchedule,
    getProductById,
    getProductionLineById,
    onUpdateFeedback
}) => {
  const { schedules: allSchedules } = useAppData(); 
  const [draggedItem, setDraggedItem] = useState<{ schedule: ScheduledProductionRun, offsetMinutes: number } | null>(null);
  const [dropTargetLineId, setDropTargetLineId] = useState<string | null>(null);
  const [isDropValid, setIsDropValid] = useState<boolean | null>(null);

  const linesWithSchedulesToday = useMemo(() => {
    return lines.filter(line => schedules.some(s => s.lineId === line.id));
  }, [lines, schedules]);

  const getLineOperatingHoursForDay = (lineId: string): OperatingDayTime | undefined => {
    const line = getProductionLineById(lineId);
    if (!line) return undefined;
    return line.operatingHours.find(oh => oh.dayOfWeek === day.getDay());
  };

  const timeStringToMinutesFromMidnight = (timeStr: string): number => {
    if (!timeStr || !timeStr.includes(':')) return 0;
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  };

  const isChartForToday = useMemo(() => {
    const todayDate = new Date();
    return day.getFullYear() === todayDate.getFullYear() &&
           day.getMonth() === todayDate.getMonth() &&
           day.getDate() === todayDate.getDate();
  }, [day]);

  const currentTimeIndicatorPosition = useMemo(() => {
    if (!isChartForToday) return null;
    const currentMinutes = timeToMinutes(currentTime);
    return minutesToPixels(currentMinutes);
  }, [currentTime, isChartForToday]);


  const checkDropValidity = (
    item: ScheduledProductionRun,
    targetLineId: string,
    newStartTime: Date
  ): { valid: boolean; message: string | null } => {
    const product = getProductById(item.productId);
    const targetLine = getProductionLineById(targetLineId);
    if (!product || !targetLine) return { valid: false, message: "Produto ou linha não encontrado." };

    // Item status check - cannot move if not 'Pendente' (already handled by draggable and handleDragStart, but good defense)
    if (item.status !== 'Pendente') {
        return { valid: false, message: `Produto ${product.name} com status '${item.status}' não pode ser movido.` };
    }

    const durationMinutes = (new Date(item.endTime).getTime() - new Date(item.startTime).getTime()) / 60000;
    const newEndTime = new Date(newStartTime.getTime() + durationMinutes * 60000);

    // 1. Check Line Operating Hours
    const lineOpHours = getLineOperatingHoursForDay(targetLineId);
    if (!lineOpHours || !lineOpHours.isActive) {
      return { valid: false, message: `Linha ${targetLine.name} não opera neste dia.` };
    }
    const opStartMinutes = timeStringToMinutesFromMidnight(lineOpHours.startTime);
    const opEndMinutes = timeStringToMinutesFromMidnight(lineOpHours.endTime);
    const newItemStartMinutes = timeToMinutes(newStartTime);
    const newItemEndMinutes = timeToMinutes(newEndTime);

    if (newStartTime.getDate() !== day.getDate() || newItemStartMinutes < opStartMinutes ||
        newEndTime.getDate() !== day.getDate() || newItemEndMinutes > opEndMinutes) {
      if(newEndTime.getDate() === day.getDate() && newItemEndMinutes === opEndMinutes && newItemStartMinutes >= opStartMinutes){
        // Ends exactly at opEnd, this is fine
      } else {
        return { valid: false, message: `Fora do horário de operação da linha (${lineOpHours.startTime}-${lineOpHours.endTime}).` };
      }
    }

    // 2. Check if dragging to a past time on the current day
    if (isChartForToday) {
      const comparableCurrentTime = new Date(currentTime);
      comparableCurrentTime.setSeconds(0, 0); 

      if (newStartTime.getTime() < comparableCurrentTime.getTime()) {
        return {
          valid: false,
          message: `Não é possível mover para um horário anterior ao atual (${comparableCurrentTime.toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'})}).`
        };
      }
    }

    // 3. Check for conflicts with Top Sellers and other Normal products on the target line
    const schedulesOnTargetDayAndLine = allSchedules.filter(s => {
        const sDate = new Date(s.startTime);
        return s.lineId === targetLineId &&
               s.id !== item.id && 
               sDate.getFullYear() === day.getFullYear() &&
               sDate.getMonth() === day.getMonth() &&
               sDate.getDate() === day.getDate();
    });


    for (const existingSchedule of schedulesOnTargetDayAndLine) {
      const existingProduct = getProductById(existingSchedule.productId);
      if (!existingProduct) continue;

      const existingStart = new Date(existingSchedule.startTime);
      const existingEnd = new Date(existingSchedule.endTime);

      if (newStartTime < existingEnd && newEndTime > existingStart) { // Overlap
        if (existingProduct.classification === 'Top Seller') {
          return { valid: false, message: `Conflito com Top Seller: ${existingProduct.name}.` };
        }
        // For Normal products, current logic prevents any overlap.
        // If smart-shifting of other normals was implemented, this would change.
        return { valid: false, message: `Conflito com produto Normal: ${existingProduct.name}.` };
      }
    }
    return { valid: true, message: null };
  };


  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, scheduleItem: ScheduledProductionRun) => {
    const product = getProductById(scheduleItem.productId);
    
    if (product?.classification === 'Top Seller' || scheduleItem.status !== 'Pendente') {
      onUpdateFeedback(
        `Não é possível mover: ${product?.name || 'Produto desconhecido'} ${product?.classification === 'Top Seller' ? 'é Top Seller' : `está com status '${scheduleItem.status}'`}.`,
        'error'
      );
      e.preventDefault();
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const clickOffsetPixels = e.clientX - rect.left;
    const clickOffsetMinutes = pixelsToMinutes(clickOffsetPixels);

    setDraggedItem({ schedule: scheduleItem, offsetMinutes: clickOffsetMinutes });
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", scheduleItem.id); // Store ID for identification
    
    // Custom drag image (optional, for better visual feedback)
    const ghost = e.currentTarget.cloneNode(true) as HTMLDivElement;
    ghost.style.opacity = "0.5";
    ghost.style.position = "absolute"; 
    ghost.style.top = "-1000px"; // Position off-screen
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, clickOffsetPixels, e.currentTarget.offsetHeight / 2);
    setTimeout(() => document.body.removeChild(ghost), 0); // Clean up ghost element
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, lineId: string) => {
    e.preventDefault();
    if (!draggedItem) return;

    setDropTargetLineId(lineId);
    const lineRowElement = e.currentTarget;
    const rect = lineRowElement.getBoundingClientRect();
    const xOnLine = e.clientX - rect.left;

    const currentPointerMinutes = Math.max(0, pixelsToMinutes(xOnLine) - draggedItem.offsetMinutes);
    const snappedMinutes = Math.round(currentPointerMinutes / 15) * 15; // Snap to 15-minute intervals

    const newStartTime = new Date(day);
    newStartTime.setHours(Math.floor(snappedMinutes / 60), snappedMinutes % 60, 0, 0);

    const validityCheck = checkDropValidity(draggedItem.schedule, lineId, newStartTime);
    setIsDropValid(validityCheck.valid);
    
    // Debounce or manage feedback frequency if it becomes too noisy
    if(!validityCheck.valid && validityCheck.message) {
        const feedbackKey = `feedback-${lineId}-${newStartTime.getTime()}`; // Unique key for this specific potential drop
        // This simple check helps avoid flooding with the same error message on every pixel move
        if ((draggedItem as any).lastFeedbackKey !== feedbackKey) { 
           onUpdateFeedback(validityCheck.message, 'error');
          (draggedItem as any).lastFeedbackKey = feedbackKey; 
        }
    }
  };

  const handleDragLeaveLine = (e: React.DragEvent<HTMLDivElement>) => {
    // Visual feedback is primarily handled by handleDragOver on the new target line.
    // No explicit action usually needed here unless specific visual reset is required.
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, targetLineId: string) => {
    e.preventDefault();
    if (!draggedItem || !isDropValid) {
      onUpdateFeedback(isDropValid === false ? 'Não é possível soltar aqui. Posição inválida.' : 'Item arrastado não encontrado ou drop inválido.', 'error');
      setDraggedItem(null);
      setDropTargetLineId(null);
      setIsDropValid(null);
      return;
    }

    const lineRowElement = e.currentTarget;
    const rect = lineRowElement.getBoundingClientRect();
    const xOnLine = e.clientX - rect.left;

    const droppedAtMinutes = Math.max(0, pixelsToMinutes(xOnLine) - draggedItem.offsetMinutes);
    const snappedMinutes = Math.round(droppedAtMinutes / 15) * 15;

    const newStartTime = new Date(day);
    newStartTime.setHours(Math.floor(snappedMinutes / 60), snappedMinutes % 60, 0, 0);

    const durationMinutes = (new Date(draggedItem.schedule.endTime).getTime() - new Date(draggedItem.schedule.startTime).getTime()) / 60000;
    const newEndTime = new Date(newStartTime.getTime() + durationMinutes * 60000);

    const updatedScheduleData = {
      ...draggedItem.schedule,
      startTime: newStartTime.toISOString(),
      endTime: newEndTime.toISOString(),
      lineId: targetLineId,
    };

    updateSchedule(updatedScheduleData);
    onUpdateFeedback(`Agendamento para ${getProductById(updatedScheduleData.productId)?.name} atualizado.`, 'success');

    setDraggedItem(null);
    setDropTargetLineId(null);
    setIsDropValid(null);
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
    setDropTargetLineId(null);
    setIsDropValid(null);
  };

  const renderTimeHeaders = () => {
    const headers = [];
    for (let i = 0; i < totalHours * 2; i++) { // 48 segments for 30-min intervals
      const hour = Math.floor(i / 2);
      const minute = (i % 2) * 30;
      const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
      headers.push(
        <div 
          key={`time-${i}`} 
          style={{ minWidth: `${hourWidth / 2}px`, width: `${hourWidth / 2}px` }} 
          className="h-8 flex items-center justify-center border-r border-b border-gray-200 text-xs text-gray-500 bg-gray-50"
        >
          {timeString}
        </div>
      );
    }
    return <div className="flex sticky top-0 z-30">{headers}</div>;
  };

  return (
    <div className="overflow-x-auto relative bg-white rounded shadow" style={{ width: '100%' }}>
      <div style={{ width: `${chartWidth}px` }} className="relative">
        {renderTimeHeaders()}
        {currentTimeIndicatorPosition !== null && (
          <>
            <div
              className="absolute top-0 h-full w-0.5 bg-red-500 z-20"
              style={{ left: `${currentTimeIndicatorPosition}px` }}
              title={`Agora: ${currentTime.toLocaleTimeString('pt-BR')}`}
            >
            </div>
            <div
              className="absolute -top-1 text-xxs bg-red-500 text-white px-1 py-0.5 rounded z-30"
              style={{ left: `${currentTimeIndicatorPosition + 2}px`, transform: 'translateY(-100%)' }}
            >
              AGORA
            </div>
          </>
        )}
        <div className="relative">
          {linesWithSchedulesToday.map(line => {
            const lineSchedules = schedules.filter(s => s.lineId === line.id);
            const lineOpHours = getLineOperatingHoursForDay(line.id);
            let lineDropClass = "border-gray-200";
            if (dropTargetLineId === line.id) {
                lineDropClass = isDropValid === true ? "border-green-400 ring-2 ring-green-300" : (isDropValid === false ? "border-red-400 ring-2 ring-red-300" : "border-gray-200");
            }

            return (
              <div
                key={line.id}
                data-line-id={line.id}
                className={`h-20 border-b ${lineDropClass} relative bg-white hover:bg-lime-50 transition-colors duration-150`}
                onDragOver={(e) => handleDragOver(e, line.id)}
                onDrop={(e) => handleDrop(e, line.id)}
                onDragLeave={handleDragLeaveLine}
              >
                <div className="absolute left-0 top-0 h-full w-32 bg-lime-100 border-r border-gray-200 p-2 z-10 flex items-center">
                  <span className="text-xs font-medium text-green-700 truncate" title={line.name}>{line.name}</span>
                </div>
                {lineOpHours && lineOpHours.isActive && (
                    <div
                        className="absolute top-0 h-full bg-green-50 opacity-50 z-0"
                        style={{
                            left: `${minutesToPixels(timeStringToMinutesFromMidnight(lineOpHours.startTime))}px`,
                            width: `${minutesToPixels(timeStringToMinutesFromMidnight(lineOpHours.endTime) - timeStringToMinutesFromMidnight(lineOpHours.startTime))}px`,
                        }}
                    ></div>
                )}


                {lineSchedules.map(scheduleItem => {
                  const product = getProductById(scheduleItem.productId);
                  const startMinutes = timeToMinutes(new Date(scheduleItem.startTime));
                  const endMinutes = timeToMinutes(new Date(scheduleItem.endTime));
                  const itemWidth = Math.max(minutesToPixels(endMinutes - startMinutes), 5); 
                  const itemLeft = minutesToPixels(startMinutes - dayStartTime);
                  
                  const isTopSeller = product?.classification === 'Top Seller';
                  const isDraggable = !isTopSeller && scheduleItem.status === 'Pendente';
                  const isLocked = isTopSeller || scheduleItem.status !== 'Pendente';

                  let bgColor = 'bg-sky-500 hover:bg-sky-600';
                  if (isTopSeller) {
                    bgColor = 'bg-amber-500';
                  } else if (scheduleItem.status !== 'Pendente') {
                    bgColor = 'bg-slate-400'; // Non-Pendente Normals
                  }
                  if (draggedItem?.schedule.id === scheduleItem.id) bgColor = 'opacity-50 bg-slate-400';


                  return (
                    <div
                      key={scheduleItem.id}
                      draggable={isDraggable}
                      onDragStart={(e) => isDraggable && handleDragStart(e, scheduleItem)}
                      onDragEnd={handleDragEnd}
                      title={`${product?.name || 'Produto Desconhecido'} (${product?.classification}, ${scheduleItem.status})\n${new Date(scheduleItem.startTime).toLocaleTimeString('pt-BR', {hour:'2-digit',minute:'2-digit'})} - ${new Date(scheduleItem.endTime).toLocaleTimeString('pt-BR', {hour:'2-digit',minute:'2-digit'})}`}
                      className={`absolute top-1/2 -translate-y-1/2 h-12 rounded shadow-md p-2 text-white text-xs overflow-hidden flex items-center justify-between cursor-${isLocked ? 'not-allowed' : 'grab'} ${bgColor} z-20`}
                      style={{
                        left: `${itemLeft}px`,
                        width: `${itemWidth}px`,
                      }}
                    >
                      <span className="truncate flex-grow">{product?.name || 'Produto Desconhecido'}</span>
                      {isLocked && <LockClosedIcon className="w-3 h-3 ml-1 flex-shrink-0" />}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default GanttChart;