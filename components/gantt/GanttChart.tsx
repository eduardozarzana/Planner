
import React, { useState, useCallback, useMemo } from 'react';
import { ScheduledProductionRun, ProductionLine, Product, OperatingDayTime, ProductClassification, ScheduleStatus } from '../../types';
import { LockClosedIcon } from '../icons';
import { useAppData } from '../../contexts/AppDataContext'; 

interface GanttChartProps {
  schedules: Array<ScheduledProductionRun & {
    productName: string;
    productClassification: ProductClassification;
    lineName: string;
  }>;
  lines: ProductionLine[];
  day: Date; 
  currentTime: Date;
  updateSchedule: (schedule: ScheduledProductionRun) => void;
  getProductById: (id: string) => Product | undefined;
  getProductionLineById: (id: string) => ProductionLine | undefined;
  onUpdateFeedback: (message: string, type: 'success' | 'error' | 'info') => void;
  addWorkingTime: (baseDate: Date, minutesToAdd: number, line: ProductionLine) => Date; 
  calculateEffectiveWorkDuration: (startTime: Date, endTime: Date, line: ProductionLine) => number; 
}

const GANTT_DAYS_TO_DISPLAY = 6; 
const hourWidth = 120; 
const hoursPerDay = 24;
const totalHoursInView = hoursPerDay * GANTT_DAYS_TO_DISPLAY;
const chartWidth = hourWidth * totalHoursInView;


const timeToMinutesInDay = (date: Date | string): number => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.getHours() * 60 + d.getMinutes();
};

const minutesToPixels = (minutes: number): number => {
  return (minutes / 60) * hourWidth;
};

const pixelsToMinutes = (pixels: number): number => {
  return (pixels / hourWidth) * 60;
};

const timeStringToMinutesFromMidnight = (timeStr: string): number => {
    if (!timeStr || !timeStr.includes(':')) return 0; 
    const [hours, minutes] = timeStr.split(':').map(Number);
    if (isNaN(hours) || isNaN(minutes)) return 0;
    return hours * 60 + minutes;
};

// Helper function to get operational segments
function getOperationalSegments(
  scheduleStartTime: Date,
  scheduleEndTime: Date,
  line: ProductionLine,
  interruptionPauseStartTimeParam?: Date | string | null,
  interruptionPauseEndTimeParam?: Date | string | null
): Array<{ segmentStart: Date; segmentEnd: Date }> {
  if (scheduleEndTime <= scheduleStartTime) return [];

  const interruptionPauseStart = interruptionPauseStartTimeParam ? new Date(interruptionPauseStartTimeParam) : null;
  const interruptionPauseEnd = interruptionPauseEndTimeParam ? new Date(interruptionPauseEndTimeParam) : null;

  const rawSegments: Array<{ start: Date; end: Date }> = [];
  
  let currentDateIter = new Date(scheduleStartTime.getFullYear(), scheduleStartTime.getMonth(), scheduleStartTime.getDate());

  while (currentDateIter < scheduleEndTime) {
    const dayOfWeek = currentDateIter.getDay();
    const operatingDayConf = line.operatingHours.find(oh => oh.dayOfWeek === dayOfWeek);

    if (operatingDayConf && operatingDayConf.isActive) {
      const opDayStart = new Date(currentDateIter);
      const [opStartH, opStartM] = operatingDayConf.startTime.split(':').map(Number);
      opDayStart.setHours(opStartH, opStartM, 0, 0);

      const opDayEnd = new Date(currentDateIter);
      if (operatingDayConf.endTime === "00:00") {
        opDayEnd.setDate(opDayEnd.getDate() + 1);
        opDayEnd.setHours(0, 0, 0, 0);
      } else {
        const [opEndH, opEndM] = operatingDayConf.endTime.split(':').map(Number);
        opDayEnd.setHours(opEndH, opEndM, 0, 0);
      }

      let effectiveStartForDay = scheduleStartTime > opDayStart ? scheduleStartTime : opDayStart;
      let effectiveEndForDay = scheduleEndTime < opDayEnd ? scheduleEndTime : opDayEnd;

      // Ensure the segment is within the current iteration day's bounds and also the overall schedule
      effectiveStartForDay = effectiveStartForDay < currentDateIter ? currentDateIter : effectiveStartForDay;
      
      const nextDayStart = new Date(currentDateIter);
      nextDayStart.setDate(currentDateIter.getDate() + 1);
      nextDayStart.setHours(0,0,0,0);
      effectiveEndForDay = effectiveEndForDay > nextDayStart ? nextDayStart : effectiveEndForDay;


      if (effectiveStartForDay < effectiveEndForDay) {
        let blockToProcess = { start: new Date(effectiveStartForDay), end: new Date(effectiveEndForDay) };

        if (interruptionPauseStart && interruptionPauseEnd &&
            interruptionPauseStart < blockToProcess.end && interruptionPauseEnd > blockToProcess.start) {
          
          const prePauseStart = new Date(blockToProcess.start);
          const prePauseEnd = interruptionPauseStart < blockToProcess.end ? new Date(interruptionPauseStart) : new Date(blockToProcess.end);

          const postPauseStart = interruptionPauseEnd > blockToProcess.start ? new Date(interruptionPauseEnd) : new Date(blockToProcess.start);
          const postPauseEnd = new Date(blockToProcess.end);

          if (prePauseStart < prePauseEnd && prePauseStart >= scheduleStartTime && prePauseEnd <= scheduleEndTime) {
             rawSegments.push({ start: prePauseStart, end: prePauseEnd });
          }
          if (postPauseStart < postPauseEnd && postPauseStart >= scheduleStartTime && postPauseEnd <= scheduleEndTime) {
             rawSegments.push({ start: postPauseStart, end: postPauseEnd });
          }
        } else {
          if (blockToProcess.start >= scheduleStartTime && blockToProcess.end <= scheduleEndTime) {
            rawSegments.push(blockToProcess);
          }
        }
      }
    }
    currentDateIter.setDate(currentDateIter.getDate() + 1);
    currentDateIter.setHours(0,0,0,0); // Ensure we start at the beginning of the next day
  }

  if (rawSegments.length === 0) return [];

  rawSegments.sort((a, b) => a.start.getTime() - b.start.getTime());
  const mergedSegments: Array<{ segmentStart: Date; segmentEnd: Date }> = [];
  if (rawSegments.length > 0) {
    let currentMerge = { segmentStart: new Date(rawSegments[0].start), segmentEnd: new Date(rawSegments[0].end) };
    for (let i = 1; i < rawSegments.length; i++) {
        const nextSegment = rawSegments[i];
        if (nextSegment.start.getTime() === currentMerge.segmentEnd.getTime()) { // Contiguous
            currentMerge.segmentEnd = new Date(nextSegment.end);
        } else if (nextSegment.start < currentMerge.segmentEnd) { // Overlapping
            currentMerge.segmentEnd = nextSegment.end > currentMerge.segmentEnd ? new Date(nextSegment.end) : currentMerge.segmentEnd;
        } else { // Gap
            mergedSegments.push(currentMerge);
            currentMerge = { segmentStart: new Date(nextSegment.start), segmentEnd: new Date(nextSegment.end) };
        }
    }
    mergedSegments.push(currentMerge);
  }
  return mergedSegments.filter(s => s.segmentStart < s.segmentEnd);
}


const GanttChart: React.FC<GanttChartProps> = ({
    schedules,
    lines,
    day: startDayOfView, 
    currentTime, 
    updateSchedule,
    getProductById,
    getProductionLineById,
    onUpdateFeedback,
    addWorkingTime, 
    calculateEffectiveWorkDuration 
}) => {
  const { schedules: allSchedules } = useAppData(); 
  const [draggedItem, setDraggedItem] = useState<{
    schedule: ScheduledProductionRun;
    offsetMinutesInView: number;
    effectiveWorkDurationMinutes: number; 
    lastFeedbackKey?: string;
    lastFeedbackMessage?: string | null;
  } | null>(null);
  const [dropTargetLineId, setDropTargetLineId] = useState<string | null>(null);
  const [isDropValid, setIsDropValid] = useState<boolean | null>(null);

  const linesWithSchedulesInView = useMemo(() => {
    return lines.filter(line => schedules.some(s => s.lineId === line.id));
  }, [lines, schedules]);


  const isCurrentTimeInView = useMemo(() => {
    const viewStart = new Date(startDayOfView);
    viewStart.setHours(0,0,0,0);
    const viewEnd = new Date(startDayOfView);
    viewEnd.setDate(startDayOfView.getDate() + GANTT_DAYS_TO_DISPLAY);
    return currentTime >= viewStart && currentTime < viewEnd;
  }, [startDayOfView, currentTime]);

  const currentTimeIndicatorPosition = useMemo(() => {
    if (!isCurrentTimeInView) return null;
    
    const diffDays = Math.floor((currentTime.getTime() - startDayOfView.getTime()) / (1000 * 60 * 60 * 24));
    const minutesInCurrentDay = timeToMinutesInDay(currentTime);
    const totalMinutesFromViewStart = (diffDays * hoursPerDay * 60) + minutesInCurrentDay;
    return minutesToPixels(totalMinutesFromViewStart);
  }, [currentTime, startDayOfView, isCurrentTimeInView]);


 const checkDropValidity = useCallback((
    item: ScheduledProductionRun,
    targetLineId: string,
    newProposedStartTimeFromMouse: Date, 
    effectiveWorkDurationMinutes: number
): { valid: boolean; message: string | null; actualCalculatedStartTime?: Date, actualCalculatedEndTime?: Date } => {
    const product = getProductById(item.productId);
    const targetLine = getProductionLineById(targetLineId);
    if (!product || !targetLine) return { valid: false, message: "Produto ou linha não encontrado." };

    if (item.status !== 'Pendente') {
        return { valid: false, message: `Produto ${product.name} com status '${item.status}' não pode ser movido.` };
    }

    newProposedStartTimeFromMouse.setSeconds(0,0);

    const actualCalculatedStartTime = addWorkingTime(new Date(newProposedStartTimeFromMouse), 0, targetLine);
    actualCalculatedStartTime.setSeconds(0,0);

    if (actualCalculatedStartTime.getTime() === new Date(8640000000000000).getTime()) {
        return { valid: false, message: "Não foi possível encontrar um horário de início válido na linha devido aos horários de operação." };
    }

    const viewWindowStart = new Date(startDayOfView);
    viewWindowStart.setHours(0,0,0,0);
    const viewWindowEndBoundary = new Date(startDayOfView);
    viewWindowEndBoundary.setDate(startDayOfView.getDate() + GANTT_DAYS_TO_DISPLAY);

    if (actualCalculatedStartTime < viewWindowStart || actualCalculatedStartTime >= viewWindowEndBoundary ) {
         return { valid: false, message: "Início do agendamento (calculado) fora da janela de visualização do Gantt." };
    }
    
    const actualCalculatedEndTime = addWorkingTime(new Date(actualCalculatedStartTime), effectiveWorkDurationMinutes, targetLine);
    actualCalculatedEndTime.setSeconds(0,0);
    
    if (actualCalculatedEndTime.getTime() === new Date(8640000000000000).getTime()) {
        return { valid: false, message: "Não foi possível encontrar um horário de término válido para toda a duração da produção devido aos horários de operação." };
    }

    const schedulesOnTargetLineInView = allSchedules.filter(s => { 
        const sStart = new Date(s.startTime);
        const sEnd = new Date(s.endTime);
        return s.lineId === targetLineId &&
               s.id !== item.id && 
               sStart < viewWindowEndBoundary && sEnd > viewWindowStart;
    });

    for (const existingSchedule of schedulesOnTargetLineInView) {
      const existingProduct = getProductById(existingSchedule.productId);
      if (!existingProduct) continue;

      const existingStart = new Date(existingSchedule.startTime);
      const existingEnd = new Date(existingSchedule.endTime);

      if (actualCalculatedStartTime < existingEnd && actualCalculatedEndTime > existingStart) { 
        let conflictMsg = `Conflito com produto: ${existingProduct.name} (${existingStart.toLocaleTimeString('pt-BR')} - ${existingEnd.toLocaleTimeString('pt-BR')}).`;
        if (existingProduct.classification === 'Top Seller') {
           conflictMsg = `Conflito com Top Seller: ${existingProduct.name}. Agendamentos 'Top Seller' são fixos.`;
        }
        return { valid: false, message: conflictMsg };
      }
    }
    
    const actualCurrentTime = new Date(); 
    if (actualCalculatedStartTime.getFullYear() === actualCurrentTime.getFullYear() &&
        actualCalculatedStartTime.getMonth() === actualCurrentTime.getMonth() &&
        actualCalculatedStartTime.getDate() === actualCurrentTime.getDate()) {
      
      const comparableCurrentTime = new Date(actualCurrentTime); 
      comparableCurrentTime.setSeconds(0, 0); 

      if (actualCalculatedStartTime.getTime() < comparableCurrentTime.getTime()) {
        return {
          valid: false,
          message: `Não é possível mover para um horário anterior ao atual (${comparableCurrentTime.toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'})}) no dia de hoje.`
        };
      }
    }
    
    return { valid: true, message: null, actualCalculatedStartTime, actualCalculatedEndTime };
  }, [getProductById, getProductionLineById, startDayOfView, allSchedules, addWorkingTime]);


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

    const lineDetails = getProductionLineById(scheduleItem.lineId);
    if (!lineDetails) {
      onUpdateFeedback('Detalhes da linha não encontrados para o item arrastado.', 'error');
      e.preventDefault();
      return;
    }

    const effectiveDuration = calculateEffectiveWorkDuration(
      new Date(scheduleItem.startTime),
      new Date(scheduleItem.endTime),
      lineDetails
    );

    if (effectiveDuration <= 0 && (new Date(scheduleItem.endTime).getTime() - new Date(scheduleItem.startTime).getTime()) > 0) {
      onUpdateFeedback(`A duração de trabalho efetiva para "${product?.name}" é zero ou negativa. Verifique os horários de operação da linha.`, 'error');
      e.preventDefault();
      return;
    }

    const itemBoundingRect = e.currentTarget.getBoundingClientRect();
    const clickOffsetXInItemPixels = e.clientX - itemBoundingRect.left;
        
    const itemStartTime = new Date(scheduleItem.startTime);
    const daysFromViewStart = Math.floor((itemStartTime.getTime() - startDayOfView.getTime()) / (1000 * 60 * 60 * 24));
    const minutesInItemStartDay = timeToMinutesInDay(itemStartTime);
    const itemStartMinutesFromViewStart = (daysFromViewStart * hoursPerDay * 60) + minutesInItemStartDay;
    
    const chartContainerRect = e.currentTarget.closest('.gantt-chart-container')!.getBoundingClientRect();
    const pointerXRelativeToChart = e.clientX - chartContainerRect.left;
    const pointerMinutesFromViewStart = pixelsToMinutes(pointerXRelativeToChart);
    
    const currentOffsetMinutesInView = pointerMinutesFromViewStart - itemStartMinutesFromViewStart;

    setDraggedItem({ schedule: scheduleItem, offsetMinutesInView: currentOffsetMinutesInView, effectiveWorkDurationMinutes: effectiveDuration });
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", scheduleItem.id); 
    
    const ghost = e.currentTarget.cloneNode(true) as HTMLDivElement;
    ghost.style.opacity = "0.5";
    ghost.style.position = "absolute"; 
    ghost.style.top = "-10000px"; 
    ghost.style.left = "-10000px";
    ghost.style.width = `${itemBoundingRect.width}px`; 
    ghost.style.height = `${itemBoundingRect.height}px`; 
    document.body.appendChild(ghost);
    
    e.dataTransfer.setDragImage(ghost, clickOffsetXInItemPixels, itemBoundingRect.height / 2);
    
    setTimeout(() => { 
        if(document.body.contains(ghost)) {
            document.body.removeChild(ghost);
        }
    }, 0);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, lineId: string) => {
    e.preventDefault();
    if (!draggedItem) return;

    setDropTargetLineId(lineId);
    const lineRowElement = e.currentTarget; 
    const chartContainerRect = lineRowElement.closest('.gantt-chart-container')!.getBoundingClientRect();
    const xOnChart = e.clientX - chartContainerRect.left; 

    const currentPointerMinutesFromViewStart = pixelsToMinutes(xOnChart);
    const newProposedItemStartMinutesFromViewStart = Math.max(0, currentPointerMinutesFromViewStart - draggedItem.offsetMinutesInView);
    const snappedMinutesFromViewStart = Math.round(newProposedItemStartMinutesFromViewStart / 15) * 15; 

    const dayIndexInWindow = Math.floor(snappedMinutesFromViewStart / (hoursPerDay * 60));
    const minutesWithinDay = snappedMinutesFromViewStart % (hoursPerDay * 60);

    const newStartTimeCandidateFromMouse = new Date(startDayOfView);
    newStartTimeCandidateFromMouse.setDate(startDayOfView.getDate() + dayIndexInWindow);
    newStartTimeCandidateFromMouse.setHours(Math.floor(minutesWithinDay / 60), minutesWithinDay % 60, 0, 0);

    const validityCheck = checkDropValidity(draggedItem.schedule, lineId, newStartTimeCandidateFromMouse, draggedItem.effectiveWorkDurationMinutes);
    setIsDropValid(validityCheck.valid);
    
    const feedbackKey = `feedback-${lineId}-${newStartTimeCandidateFromMouse.getTime()}`;
    if(!validityCheck.valid && validityCheck.message) {
      if (draggedItem.lastFeedbackKey !== feedbackKey || draggedItem.lastFeedbackMessage !== validityCheck.message) {
          onUpdateFeedback(validityCheck.message, 'error');
          setDraggedItem(prev => prev ? {...prev, lastFeedbackKey: feedbackKey, lastFeedbackMessage: validityCheck.message} : null);
      }
    } else if (validityCheck.valid && draggedItem.lastFeedbackMessage) {
        setDraggedItem(prev => prev ? {...prev, lastFeedbackMessage: null} : null);
    }
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
    
    const targetLineDetails = getProductionLineById(targetLineId);
    if(!targetLineDetails) {
        onUpdateFeedback('Linha de destino não encontrada.', 'error');
        setDraggedItem(null); setDropTargetLineId(null); setIsDropValid(null);
        return;
    }

    const lineRowElement = e.currentTarget; 
    const chartContainerRect = lineRowElement.closest('.gantt-chart-container')!.getBoundingClientRect();
    const xOnChart = e.clientX - chartContainerRect.left;

    const droppedAtPointerMinutesFromViewStart = pixelsToMinutes(xOnChart);
    const newItemStartMinutesFromViewStart = Math.max(0, droppedAtPointerMinutesFromViewStart - draggedItem.offsetMinutesInView);
    const snappedItemStartMinutes = Math.round(newItemStartMinutesFromViewStart / 15) * 15;

    const dayIndexInWindow = Math.floor(snappedItemStartMinutes / (hoursPerDay * 60));
    const minutesWithinDay = snappedItemStartMinutes % (hoursPerDay * 60);

    const proposedStartTimeFromDrop = new Date(startDayOfView);
    proposedStartTimeFromDrop.setDate(startDayOfView.getDate() + dayIndexInWindow);
    proposedStartTimeFromDrop.setHours(Math.floor(minutesWithinDay / 60), minutesWithinDay % 60, 0, 0);

    const actualFinalNewStartTime = addWorkingTime(new Date(proposedStartTimeFromDrop), 0, targetLineDetails);
    actualFinalNewStartTime.setSeconds(0,0); 

    const actualFinalNewEndTime = addWorkingTime(new Date(actualFinalNewStartTime), draggedItem.effectiveWorkDurationMinutes, targetLineDetails);
    actualFinalNewEndTime.setSeconds(0,0); 
    
    if (actualFinalNewStartTime.getTime() === new Date(8640000000000000).getTime() ||
        actualFinalNewEndTime.getTime() === new Date(8640000000000000).getTime()) {
        onUpdateFeedback('Erro ao calcular horários finais. A linha pode não ter horários de operação suficientes ou válidos para o início/fim.', 'error');
        setDraggedItem(null); setDropTargetLineId(null); setIsDropValid(null);
        return;
    }

    const updatedScheduleData: ScheduledProductionRun = {
      ...draggedItem.schedule,
      startTime: actualFinalNewStartTime.toISOString(),
      endTime: actualFinalNewEndTime.toISOString(),
      lineId: targetLineId,
      interruptionPauseStartTime: null, 
      interruptionPauseEndTime: null,
    };

    updateSchedule(updatedScheduleData);
    onUpdateFeedback(`Agendamento para ${getProductById(updatedScheduleData.productId)?.name} atualizado.`, 'success');

    setDraggedItem(null);
    setDropTargetLineId(null);
    setIsDropValid(null);
  };

  const handleDragEnd = () => {
    const ghost = document.querySelector('.drag-ghost-image');
    if (ghost && ghost.parentElement) {
      ghost.parentElement.removeChild(ghost);
    }
    setDraggedItem(null);
    setDropTargetLineId(null);
    setIsDropValid(null);
  };

  const renderTimeHeaders = () => {
    const headers = [];
    for (let dayIdx = 0; dayIdx < GANTT_DAYS_TO_DISPLAY; dayIdx++) {
      const currentDate = new Date(startDayOfView);
      currentDate.setDate(startDayOfView.getDate() + dayIdx);
      const dateLabel = currentDate.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', weekday: 'short' });
      
      headers.push(
        <div key={`day-header-${dayIdx}`} 
             style={{ minWidth: `${hourWidth * hoursPerDay}px`, width: `${hourWidth * hoursPerDay}px`}}
             className="h-8 flex items-center justify-center border-r border-b border-gray-300 text-sm font-semibold text-gray-700 bg-gray-100 sticky top-0 z-30">
          {dateLabel}
        </div>
      );
    }
    const timeSlots = [];
    for (let i = 0; i < totalHoursInView * 2; i++) { 
      const hourInView = Math.floor(i / 2); 
      const minute = (i % 2) * 30;
      const hourInDay = hourInView % hoursPerDay; 
      const timeString = `${hourInDay.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
      timeSlots.push(
        <div 
          key={`time-${i}`} 
          style={{ minWidth: `${hourWidth / 2}px`, width: `${hourWidth / 2}px` }} 
          className="h-6 flex items-center justify-center border-r border-b border-gray-200 text-xs text-gray-500 bg-gray-50"
        >
          {timeString}
        </div>
      );
    }
    return (
        <>
            <div className="flex sticky top-0 z-30">{headers}</div>
            <div className="flex sticky top-8 z-30">{timeSlots}</div>
        </>
    );
  };

  return (
    <div className="overflow-x-auto relative bg-white rounded shadow gantt-chart-container" style={{ width: '100%' }}>
      <div style={{ width: `${chartWidth}px` }} className="relative">
        {renderTimeHeaders()}
        {currentTimeIndicatorPosition !== null && (
          <>
            <div
              className="absolute top-14 h-[calc(100%-3.5rem)] w-0.5 bg-red-500 z-20" 
              style={{ left: `${currentTimeIndicatorPosition}px` }}
              title={`Agora: ${currentTime.toLocaleTimeString('pt-BR')}`}
            ></div>
            <div
              className="absolute top-12 text-xxs bg-red-500 text-white px-1 py-0.5 rounded z-30" 
              style={{ left: `${currentTimeIndicatorPosition + 2}px`}}
            >
              AGORA
            </div>
          </>
        )}
        <div className="relative pt-14"> 
          {linesWithSchedulesInView.map(line => {
            const lineSchedulesToRender = schedules.filter(s => s.lineId === line.id);
            let lineDropClass = "border-gray-200";
            if (dropTargetLineId === line.id) {
                lineDropClass = isDropValid === true ? "border-green-400 ring-2 ring-green-300" : (isDropValid === false ? "border-red-400 ring-2 ring-red-300" : "border-gray-200");
            }

            const dailyOpBands = [];
            for (let d = 0; d < GANTT_DAYS_TO_DISPLAY; d++) {
                const currentDateForBand = new Date(startDayOfView);
                currentDateForBand.setDate(startDayOfView.getDate() + d);
                const opHoursForThisDay = line.operatingHours.find(oh => oh.dayOfWeek === currentDateForBand.getDay());
                if (opHoursForThisDay && opHoursForThisDay.isActive) {
                    const bandStartMinutesInDay = timeStringToMinutesFromMidnight(opHoursForThisDay.startTime);
                    let bandEndMinutesInDay = timeStringToMinutesFromMidnight(opHoursForThisDay.endTime);
                    if (opHoursForThisDay.endTime === "00:00" || opHoursForThisDay.endTime === "23:59") { 
                        bandEndMinutesInDay = 24 * 60;
                    }

                    const bandStartMinutesFromViewStart = (d * hoursPerDay * 60) + bandStartMinutesInDay;
                    const bandDurationMinutes = bandEndMinutesInDay - bandStartMinutesInDay;

                    if (bandDurationMinutes > 0) {
                      dailyOpBands.push(
                          <div
                              key={`${line.id}-op-${d}`}
                              className="absolute top-0 h-full bg-lime-200 opacity-40 z-0" 
                              style={{
                                  left: `${minutesToPixels(bandStartMinutesFromViewStart)}px`,
                                  width: `${minutesToPixels(bandDurationMinutes)}px`,
                              }}
                              title={`Operação: ${opHoursForThisDay.startTime} - ${opHoursForThisDay.endTime === "00:00" ? "24:00" : opHoursForThisDay.endTime}`}
                          ></div>
                      );
                    }
                }
            }

            return (
              <div
                key={line.id}
                data-line-id={line.id}
                className={`h-20 border-b ${lineDropClass} relative bg-white hover:bg-lime-50 transition-colors duration-150`}
                onDragOver={(e) => handleDragOver(e, line.id)}
                onDrop={(e) => handleDrop(e, line.id)}
              >
                <div className="sticky left-0 h-full w-32 bg-lime-100 border-r border-gray-200 p-2 z-[25] flex items-center justify-center"> 
                  <span className="text-xs font-medium text-green-700 truncate text-center" title={line.name}>{line.name}</span>
                </div>
                {dailyOpBands}

                {lineSchedulesToRender.map(scheduleItem => {
                  const product = getProductById(scheduleItem.productId);
                  const itemStartTime = new Date(scheduleItem.startTime);
                  const itemEndTime = new Date(scheduleItem.endTime);

                  const diffMsStartFromView = itemStartTime.getTime() - startDayOfView.getTime();
                  const totalMinutesToItemStartFromViewStart = Math.max(0, diffMsStartFromView / (1000 * 60));
                  const overallItemLeftPixels = minutesToPixels(totalMinutesToItemStartFromViewStart);
                  
                  const overallDurationMinutes = (itemEndTime.getTime() - itemStartTime.getTime()) / (1000 * 60);
                  const overallItemWidthPixels = Math.max(minutesToPixels(overallDurationMinutes), 5);
                  
                  const isTopSeller = product?.classification === 'Top Seller';
                  const isDraggable = !isTopSeller && scheduleItem.status === 'Pendente';
                  const isLocked = isTopSeller || scheduleItem.status !== 'Pendente';

                  let baseBgColor = 'bg-sky-500';
                  if (isTopSeller) baseBgColor = 'bg-amber-500';
                  else if (scheduleItem.status === 'Em Progresso') baseBgColor = 'bg-blue-500';
                  else if (scheduleItem.status === 'Concluído') baseBgColor = 'bg-emerald-500';
                  else if (scheduleItem.status === 'Cancelado') baseBgColor = 'bg-red-400';
                  else if (scheduleItem.status !== 'Pendente') baseBgColor = 'bg-slate-400';
                  
                  const operationalSegments = getOperationalSegments(
                    itemStartTime, 
                    itemEndTime, 
                    line, 
                    scheduleItem.interruptionPauseStartTime, 
                    scheduleItem.interruptionPauseEndTime
                  );

                  return (
                    <div
                      key={scheduleItem.id}
                      draggable={isDraggable}
                      onDragStart={(e) => isDraggable && handleDragStart(e, scheduleItem)}
                      onDragEnd={handleDragEnd}
                      title={`${product?.name || 'Prod Desc.'} (${product?.classification}, ${scheduleItem.status})\nInício: ${itemStartTime.toLocaleString('pt-BR')}\nFim: ${itemEndTime.toLocaleString('pt-BR')}${scheduleItem.interruptionPauseStartTime ? `\nPausa: ${new Date(scheduleItem.interruptionPauseStartTime).toLocaleTimeString('pt-BR')} - ${new Date(scheduleItem.interruptionPauseEndTime!).toLocaleTimeString('pt-BR')}` : ''}`}
                      className={`absolute top-1/2 -translate-y-1/2 h-12 ${draggedItem?.schedule.id === scheduleItem.id ? 'opacity-30' : ''} cursor-${isLocked ? 'not-allowed' : 'grab'} z-20`}
                      style={{
                        left: `${overallItemLeftPixels}px`,
                        width: `${overallItemWidthPixels}px`,
                      }}
                    >
                      {operationalSegments.map((segment, index) => {
                          const segmentStartRelativeToItemStartMs = segment.segmentStart.getTime() - itemStartTime.getTime();
                          const segmentStartMinutesRelativeToItem = segmentStartRelativeToItemStartMs / (1000 * 60);
                          const segmentLeftPixelsRelativeToParent = minutesToPixels(segmentStartMinutesRelativeToItem);

                          const segmentDurationMinutes = (segment.segmentEnd.getTime() - segment.segmentStart.getTime()) / (1000 * 60);
                          const segmentWidthPixels = minutesToPixels(segmentDurationMinutes);
                          
                          if (segmentWidthPixels <= 0) return null;

                          return (
                            <div
                                key={index}
                                className={`absolute top-0 h-full rounded shadow-md p-2 text-white text-xs overflow-hidden flex items-center justify-between ${baseBgColor} ${isDraggable ? 'hover:brightness-110' : ''}`}
                                style={{
                                    left: `${segmentLeftPixelsRelativeToParent}px`,
                                    width: `${segmentWidthPixels}px`,
                                }}
                            >
                                {index === 0 && ( /* Show text only on the first segment */
                                    <>
                                        <span className="truncate flex-grow">{product?.name || 'Produto Desconhecido'}</span>
                                        {isLocked && <LockClosedIcon className="w-3 h-3 ml-1 flex-shrink-0" />}
                                    </>
                                )}
                            </div>
                          );
                      })}
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
