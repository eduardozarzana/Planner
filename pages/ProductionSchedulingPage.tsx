
import React, { useState, useMemo, useEffect } from 'react';
import { useAppData } from '../contexts/AppDataContext';
import { ScheduledProductionRun, Product, ProductionLine, SelectOption, ScheduleStatus, Equipment, OperatingDayTime } from '../types';
import Button from '../components/shared/Button';
import Modal from '../components/shared/Modal';
import Input from '../components/shared/Input';
import Select from '../components/shared/Select';
import Textarea from '../components/shared/Textarea';
import Card from '../components/shared/Card';
import Alert from '../components/shared/Alert';
import { PlusIcon, PencilIcon, TrashIcon, CogIcon } from '../components/icons'; // Added CogIcon

const daysOfWeekNamesShort = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

// Helper to convert HH:MM to minutes from midnight
const timeToMinutes = (timeStr: string): number => {
  if (!timeStr || !timeStr.includes(':')) return 0;
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
};

interface ScheduleFormProps {
  onSubmit: (schedule: Omit<ScheduledProductionRun, 'id'> | ScheduledProductionRun) => void;
  initialData?: ScheduledProductionRun;
  onClose: () => void;
  products: Product[];
  lines: ProductionLine[];
  schedules: ScheduledProductionRun[];
  getProductById: (id: string) => Product | undefined;
  getProductionLineById: (id: string) => ProductionLine | undefined;
  addWorkingTime: (baseDate: Date, minutesToAdd: number, line: ProductionLine) => Date; // Added
}

const ScheduleForm: React.FC<ScheduleFormProps> = ({
    onSubmit,
    initialData,
    onClose,
    products,
    lines,
    schedules: allSchedules,
    getProductById,
    getProductionLineById,
    addWorkingTime // Added
}) => {
  const [productId, setProductId] = useState(initialData?.productId || '');
  const [lineId, setLineId] = useState(initialData?.lineId || '');
  const [startTime, setStartTime] = useState(initialData?.startTime ? initialData.startTime.substring(0, 16) : '');
  const [endTime, setEndTime] = useState(initialData?.endTime ? initialData.endTime.substring(0, 16) : '');
  const [quantity, setQuantity] = useState(initialData?.quantity || 1);
  const [status, setStatus] = useState<ScheduleStatus>(initialData?.status || 'Pendente');
  const [notes, setNotes] = useState(initialData?.notes || '');
  
  const [durationCalculationWarning, setDurationCalculationWarning] = useState<string | null>(null);
  const [schedulingConflictWarning, setSchedulingConflictWarning] = useState<string | null>(null);
  const [operatingHoursWarning, setOperatingHoursWarning] = useState<string | null>(null);


  const productOptions: SelectOption[] = products.map(p => ({ value: p.id, label: `${p.name} (${p.classification === 'Top Seller' ? 'Top Seller' : 'Normal'})`}));
  const lineOptions: SelectOption[] = lines.map(l => ({ value: l.id, label: l.name }));
  const statusOptions: SelectOption[] = [
    { value: 'Pendente', label: 'Pendente' },
    { value: 'Em Progresso', label: 'Em Progresso' },
    { value: 'Concluído', label: 'Concluído' },
    { value: 'Cancelado', label: 'Cancelado' },
  ];

  useEffect(() => {
    setDurationCalculationWarning(null);
    setSchedulingConflictWarning(null);
    setOperatingHoursWarning(null);
    
    if (!productId) {
      setDurationCalculationWarning("Selecione um produto.");
      setEndTime('');
      return;
    }
    if (!lineId) {
      setDurationCalculationWarning("Selecione uma linha de produção.");
      setEndTime('');
      return;
    }
    if (!startTime) {
      setDurationCalculationWarning("Insira um horário de início.");
      setEndTime('');
      return;
    }
    if (quantity <= 0) {
      setDurationCalculationWarning("A quantidade deve ser maior que zero.");
      setEndTime('');
      return;
    }

    const startDateObj = new Date(startTime);
    if (isNaN(startDateObj.getTime())) {
      setDurationCalculationWarning("Horário de início inválido. Verifique o formato.");
      setEndTime('');
      return;
    }

    const product = getProductById(productId);
    const line = getProductionLineById(lineId);

    if (!product) {
      setDurationCalculationWarning("Produto selecionado não pôde ser encontrado.");
      setEndTime('');
      return;
    }
    if (!line) {
      setDurationCalculationWarning("Linha de produção selecionada não pôde ser encontrada.");
      setEndTime('');
      return;
    }

    const formatDateTimeLocal = (date: Date) => {
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        return `${year}-${month}-${day}T${hours}:${minutes}`;
    };
    
    let calculatedEndTimeObj = startDateObj; 

    if (!product.processingTimes || product.processingTimes.length === 0) {
      setDurationCalculationWarning(`O produto "${product.name}" não possui tempos de processamento definidos. Duração será zero.`);
      calculatedEndTimeObj = startDateObj; // End time is same as start time
    } else if (!line.equipmentIds || line.equipmentIds.length === 0) {
      setDurationCalculationWarning(`A linha "${line.name}" não possui equipamentos configurados. Duração será zero.`);
      calculatedEndTimeObj = startDateObj; // End time is same as start time
    } else {
        let totalDurationForOneUnit = 0;
        for (const eqIdInLine of line.equipmentIds) {
          const productTimeForEq = product.processingTimes.find(pt => pt.equipmentId === eqIdInLine);
          if (productTimeForEq) {
            totalDurationForOneUnit += productTimeForEq.timePerUnitMinutes;
          }
        }

        if (totalDurationForOneUnit <= 0) {
          setDurationCalculationWarning("Atenção: A configuração atual de produto e linha resulta em uma duração de produção de zero minutos.");
          calculatedEndTimeObj = startDateObj; // End time is same as start time
        } else {
           const totalDurationForAllUnitsMinutes = totalDurationForOneUnit * quantity;
           // Use addWorkingTime to calculate the end time
           calculatedEndTimeObj = addWorkingTime(new Date(startDateObj), totalDurationForAllUnitsMinutes, line);
           if (calculatedEndTimeObj.getTime() === new Date(8640000000000000).getTime()) { // Safety break
                setDurationCalculationWarning("Não foi possível calcular o horário de fim. A linha pode não ter horários de operação suficientes para a duração total.");
           } else {
                setDurationCalculationWarning(null); 
           }
        }
    }
    setEndTime(formatDateTimeLocal(calculatedEndTimeObj));


    // Operating Hours Check
    let opHoursMsg = "";
    const checkDateAgainstOperatingHours = (dateToCheck: Date, lineToCheck: ProductionLine, checkType: "início" | "fim"): string | null => {
        const dayOfWeek = dateToCheck.getDay(); 
        const timeOfDayMinutes = dateToCheck.getHours() * 60 + dateToCheck.getMinutes();
        const opDay = lineToCheck.operatingHours.find(oh => oh.dayOfWeek === dayOfWeek);

        if (!opDay || !opDay.isActive) {
            return `A linha "${lineToCheck.name}" não opera em ${daysOfWeekNamesShort[dayOfWeek]} (data de ${checkType}).`;
        }
        const opStartTimeMinutes = timeToMinutes(opDay.startTime);
        const opEndTimeMinutes = opDay.endTime === "00:00" ? 24*60 : timeToMinutes(opDay.endTime);


        if (timeOfDayMinutes < opStartTimeMinutes || (timeOfDayMinutes > opEndTimeMinutes && opDay.endTime !== "00:00") ) {
            // Allow ending exactly at operating end time if it's not 00:00
            if (checkType === "fim" && timeOfDayMinutes === opEndTimeMinutes && opDay.endTime !== "00:00") {
                 // Valid
            } else {
                 return `O horário de ${checkType} (${dateToCheck.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})} em ${daysOfWeekNamesShort[dayOfWeek]}) está fora do horário de operação da linha (${opDay.startTime} - ${opDay.endTime === "00:00" ? "24:00" : opDay.endTime}).`;
            }
        }
        return null;
    };
    
    const startOperatingHoursIssue = checkDateAgainstOperatingHours(startDateObj, line, "início");
    if (startOperatingHoursIssue) opHoursMsg += startOperatingHoursIssue + " ";

    const endOperatingHoursIssue = checkDateAgainstOperatingHours(calculatedEndTimeObj, line, "fim");
     if (endOperatingHoursIssue && !(calculatedEndTimeObj.getTime() === startDateObj.getTime() && startOperatingHoursIssue === null)) {
         // Only add end issue if it's different from a start issue on a zero-duration task
        if (opHoursMsg && !opHoursMsg.endsWith("\n")) opHoursMsg += "\n";
        opHoursMsg += endOperatingHoursIssue + " ";
    }


    // Check intermediate days if production spans multiple days
    if (calculatedEndTimeObj > startDateObj && startDateObj.toDateString() !== calculatedEndTimeObj.toDateString()) {
        let currentDateIter = new Date(startDateObj);
        currentDateIter.setDate(currentDateIter.getDate() + 1); // Start checking from the day after start
        currentDateIter.setHours(0,0,0,0);


        while (currentDateIter < calculatedEndTimeObj && currentDateIter.toDateString() !== calculatedEndTimeObj.toDateString()) {
            const dayOfWeek = currentDateIter.getDay();
            const opDay = line.operatingHours.find(oh => oh.dayOfWeek === dayOfWeek);
            if (!opDay || !opDay.isActive) {
                const msg = `A produção atravessa ${daysOfWeekNamesShort[dayOfWeek]} (${currentDateIter.toLocaleDateString('pt-BR')}), mas a linha não opera neste dia.`;
                if (opHoursMsg && !opHoursMsg.endsWith("\n")) opHoursMsg += "\n";
                opHoursMsg += msg;
                break; 
            }
            currentDateIter.setDate(currentDateIter.getDate() + 1);
        }
    }
    
    setOperatingHoursWarning(opHoursMsg.trim() || null);

    // Conflict Check (existing schedules)
    const currentStartTimeMs = startDateObj.getTime();
    const currentEndTimeMs = calculatedEndTimeObj.getTime();

    for (const existingSchedule of allSchedules) {
      if (existingSchedule.lineId === lineId) {
        if (initialData && initialData.id === existingSchedule.id) {
          continue; 
        }
        const existingStartTimeMs = new Date(existingSchedule.startTime).getTime();
        const existingEndTimeMs = new Date(existingSchedule.endTime).getTime();
        
        const currentProductIsTopSeller = product.classification === 'Top Seller';
        const existingProductIsTopSeller = getProductById(existingSchedule.productId)?.classification === 'Top Seller';

        if (currentStartTimeMs < existingEndTimeMs && existingStartTimeMs < currentEndTimeMs) {
          const conflictingProduct = getProductById(existingSchedule.productId);
          const lineDetails = getProductionLineById(lineId);
          let conflictMsg = `Conflito! A linha "${lineDetails?.name || 'Desconhecida'}" já está ocupada ` +
                              `pelo produto "${conflictingProduct?.name || 'Desconhecido'}" de ` +
                              `${new Date(existingSchedule.startTime).toLocaleTimeString('pt-BR', { day:'2-digit', month:'2-digit', hour: '2-digit', minute: '2-digit' })} até ` +
                              `${new Date(existingSchedule.endTime).toLocaleTimeString('pt-BR', {  day:'2-digit', month:'2-digit',hour: '2-digit', minute: '2-digit' })}. `;
          if (currentProductIsTopSeller && existingProductIsTopSeller) {
            conflictMsg += `Não é possível agendar um produto Top Seller sobre outro Top Seller.`
          } else {
            // conflictMsg += `Ajuste o horário ou a linha.`; // Removed for brevity, main msg is enough
          }
          setSchedulingConflictWarning(conflictMsg);
          return; 
        }
      }
    }

  }, [productId, lineId, startTime, quantity, getProductById, getProductionLineById, allSchedules, initialData, addWorkingTime]);


  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (schedulingConflictWarning) {
        alert("Não é possível agendar devido a um conflito de horário: " + schedulingConflictWarning);
        return;
    }
    if (operatingHoursWarning) {
        alert("Não é possível agendar devido a restrições de horário de operação: " + operatingHoursWarning);
        return;
    }
    
    if (!endTime && durationCalculationWarning && !durationCalculationWarning.includes("duração de produção de zero minutos")){
         alert("Não é possível agendar: " + durationCalculationWarning + " O horário de fim não pôde ser calculado.");
         return;
    }
     if (endTime && new Date(endTime).getTime() === new Date(8640000000000000).getTime()){
        alert("Não é possível agendar: " + (durationCalculationWarning || "O horário de fim não pôde ser calculado devido a restrições de operação."));
        return;
    }


    if (!productId || !lineId || !startTime || !endTime || quantity <= 0) {
      alert('Todos os campos (Produto, Linha, Horário de Início, Quantidade) são obrigatórios, o Horário de Fim é calculado e a quantidade deve ser positiva.');
      return;
    }

    const currentStartTimeObj = new Date(startTime);
    const currentEndTimeObj = new Date(endTime);

    if (isNaN(currentStartTimeObj.getTime()) || isNaN(currentEndTimeObj.getTime())) {
        alert('Os horários de início ou fim são inválidos. Por favor, verifique os valores.');
        return;
    }
    
    if (currentEndTimeObj < currentStartTimeObj) {
        alert('O Horário de Fim não pode ser anterior ao Horário de Início.');
        return;
    }

    if (durationCalculationWarning && durationCalculationWarning.includes("duração de produção de zero minutos")) {
        if (!window.confirm(
            `${durationCalculationWarning}\n\nDeseja continuar e agendar esta produção?`
        )) {
            return; 
        }
    }

    const scheduleData = {
      productId,
      lineId,
      startTime: currentStartTimeObj.toISOString(),
      endTime: currentEndTimeObj.toISOString(),
      quantity,
      status,
      notes
    };

    if (initialData) {
      onSubmit({ ...initialData, ...scheduleData });
    } else {
      onSubmit(scheduleData);
    }
  };
  
  const isSubmitDisabled = !!schedulingConflictWarning || !!operatingHoursWarning ||
                         (!!durationCalculationWarning && !durationCalculationWarning.includes("duração de produção de zero minutos") && (endTime === '' || (endTime && new Date(endTime).getTime() === new Date(8640000000000000).getTime()) )) ||
                         (endTime && new Date(endTime).getTime() === new Date(8640000000000000).getTime());


  return (
    <form onSubmit={handleSubmit} className="space-y-4" aria-labelledby="form-title">
      <Select label="Produto" id="scheduleProduct" options={productOptions} value={productId} onChange={(e) => setProductId(e.target.value)} required placeholder="Selecione um produto" />
      <Select label="Linha de Produção" id="scheduleLine" options={lineOptions} value={lineId} onChange={(e) => setLineId(e.target.value)} required placeholder="Selecione uma linha" />
      <Input type="datetime-local" label="Horário de Início" id="scheduleStartTime" value={startTime} onChange={(e) => setStartTime(e.target.value)} required />
      <Input type="datetime-local" label="Horário de Fim (Calculado)" id="scheduleEndTime" value={endTime} readOnly disabled className="bg-green-100 border-green-300" />
      
      {durationCalculationWarning && (
        <Alert type="warning" message={durationCalculationWarning} onClose={() => setDurationCalculationWarning(null)} />
      )}
      {operatingHoursWarning && (
        <Alert type="error" message={<div className="whitespace-pre-line">{operatingHoursWarning}</div>} onClose={() => setOperatingHoursWarning(null)} />
      )}
      {schedulingConflictWarning && (
        <Alert type="error" message={schedulingConflictWarning} onClose={() => setSchedulingConflictWarning(null)} />
      )}


      <Input type="number" label="Quantidade" id="scheduleQuantity" value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} min="1" required />
      <Select label="Status" id="scheduleStatus" options={statusOptions} value={status} onChange={(e) => setStatus(e.target.value as ScheduleStatus)} required 
        disabled={initialData?.status === 'Concluído' || initialData?.status === 'Cancelado'}
      />
      <Textarea label="Observações (Opcional)" id="scheduleNotes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
      <div className="flex justify-end space-x-2 pt-2">
        <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
        <Button type="submit" variant="primary" disabled={isSubmitDisabled || initialData?.status === 'Concluído' || initialData?.status === 'Cancelado'}>
            {initialData ? 'Atualizar' : 'Adicionar'} Agendamento
        </Button>
      </div>
    </form>
  );
};

const ProductionSchedulingPage: React.FC = () => {
  const {
    schedules, addSchedule, updateSchedule, deleteSchedule,
    optimizeDaySchedules, 
    products, getProductById,
    productionLines, getProductionLineById,
    addWorkingTime // Destructure addWorkingTime from context
  } = useAppData();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<ScheduledProductionRun | undefined>(undefined);
  const [pageError, setPageError] = useState<string | null>(null);
  const [optimizationResult, setOptimizationResult] = useState<{ message: string; type: 'success' | 'warning' | 'error' | 'info' } | null>(null);
  
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [scheduleToDelete, setScheduleToDelete] = useState<ScheduledProductionRun | null>(null);
  const [isOptimizeConfirmOpen, setIsOptimizeConfirmOpen] = useState(false);


  const sortedSchedules = useMemo(() => {
    return [...schedules].sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  }, [schedules]);

  const activeSchedules = useMemo(() => {
    return sortedSchedules.filter(s => s.status === 'Pendente' || s.status === 'Em Progresso');
  }, [sortedSchedules]);

  const historicalSchedules = useMemo(() => {
    return sortedSchedules.filter(s => s.status === 'Concluído' || s.status === 'Cancelado');
  }, [sortedSchedules]);


  const handleAddSchedule = () => {
    setPageError(null); 
    setOptimizationResult(null);

    if (products.length === 0) {
      setPageError("Nenhum produto cadastrado. Adicione produtos antes de agendar.");
      return;
    }
    if (productionLines.length === 0) {
      setPageError("Nenhuma linha de produção cadastrada. Adicione linhas antes de agendar.");
      return;
    }

    const productsWithAnyProcessingTimes = products.some(p => p.processingTimes && p.processingTimes.length > 0);
    if (!productsWithAnyProcessingTimes) {
        setPageError("Nenhum produto possui 'Tempos de Processamento por Equipamento' definidos. Configure-os no cadastro de produtos.");
        return;
    }
    
    const linesWithAnyEquipment = productionLines.some(l => l.equipmentIds && l.equipmentIds.length > 0);
    if (!linesWithAnyEquipment) {
        setPageError("Nenhuma linha de produção possui equipamentos configurados em sua sequência. Configure as linhas primeiro.");
        return;
    }
    
    const linesWithAnyOperatingHours = productionLines.some(l => l.operatingHours && l.operatingHours.some(oh => oh.isActive));
    if (!linesWithAnyOperatingHours) {
        setPageError("Nenhuma linha de produção possui horários de operação ativos definidos. Configure-os na edição da linha.");
        return;
    }

    setEditingSchedule(undefined);
    setIsModalOpen(true);
  };

  const handleEditSchedule = (item: ScheduledProductionRun) => {
    setPageError(null); 
    setOptimizationResult(null);
    setEditingSchedule(item);
    setIsModalOpen(true);
  };

  const openDeleteConfirmModal = (item: ScheduledProductionRun) => {
    setOptimizationResult(null);
    setScheduleToDelete(item);
    setIsDeleteConfirmOpen(true);
  };

  const confirmDeleteAndCloseModal = () => {
    if (scheduleToDelete) {
      deleteSchedule(scheduleToDelete.id);
    }
    setIsDeleteConfirmOpen(false);
    setScheduleToDelete(null);
  };

  const handleOpenOptimizeConfirm = () => {
    setPageError(null);
    setOptimizationResult(null);
    const todaySchedules = schedules.filter(s => {
        const sDate = new Date(s.startTime);
        const today = new Date();
        return sDate.getFullYear() === today.getFullYear() &&
               sDate.getMonth() === today.getMonth() &&
               sDate.getDate() === today.getDate();
    });
    if (todaySchedules.length === 0) {
        setOptimizationResult({ message: "Nenhum agendamento para hoje. Nada a otimizar.", type: 'info' });
        return;
    }
     if (!todaySchedules.some(s => getProductById(s.productId)?.classification === 'Normal')) {
        setOptimizationResult({ message: "Nenhum produto 'Normal' agendado para hoje. Nada a otimizar.", type: 'info' });
        return;
    }
    setIsOptimizeConfirmOpen(true);
  };

  const confirmOptimizeAndCloseModal = async () => {
    const today = new Date();
    const result = await optimizeDaySchedules(today);
    let message = `Otimização concluída para ${today.toLocaleDateString('pt-BR')}: ${result.optimizedCount} agendamento(s) 'Normal' otimizado(s).`;
    if (result.unoptimizedCount > 0) {
        message += ` ${result.unoptimizedCount} agendamento(s) 'Normal' não puderam ser otimizados e mantiveram seus horários.`;
    }
    if (result.details.length > 0) {
        message += ` Detalhes: ${result.details.slice(0, 2).join('; ')}${result.details.length > 2 ? '...' : ''}`; // Show first few details
    }
    setOptimizationResult({
      message,
      type: result.optimizedCount > 0 ? 'success' : (result.unoptimizedCount > 0 ? 'warning' : 'info')
    });
    setIsOptimizeConfirmOpen(false);
  };


  const handleSubmitForm = (data: Omit<ScheduledProductionRun, 'id'> | ScheduledProductionRun) => {
    if ('id' in data) {
      updateSchedule(data as ScheduledProductionRun);
    } else {
      addSchedule(data as Omit<ScheduledProductionRun, 'id'>);
    }
    setIsModalOpen(false);
    setEditingSchedule(undefined);
  };

  const getStatusColor = (status: ScheduleStatus) => {
    switch(status) {
      case 'Pendente': return 'bg-yellow-100 text-yellow-800';
      case 'Em Progresso': return 'bg-sky-100 text-sky-800';
      case 'Concluído': return 'bg-emerald-100 text-emerald-800';
      case 'Cancelado': return 'bg-red-100 text-red-800';
      default: return 'bg-green-100 text-green-800';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('pt-BR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
  };

  const deleteModalProduct = scheduleToDelete ? getProductById(scheduleToDelete.productId) : null;
  const deleteModalMessage = scheduleToDelete 
    ? `Tem certeza que deseja deletar o agendamento para o produto "${deleteModalProduct?.name || 'Desconhecido'}" programado para ${formatDate(scheduleToDelete.startTime)}? Esta ação não pode ser desfeita.`
    : 'Tem certeza que deseja deletar este agendamento? Esta ação não pode ser desfeita.';

  const renderSchedulesTable = (
    schedulesToRender: Array<ScheduledProductionRun>, 
    tableTitle: string, 
    emptyMessage: string
  ) => {
    return (
      <>
        <h3 className="text-xl font-semibold text-green-700 mt-6 mb-3">{tableTitle}</h3>
        {schedulesToRender.length === 0 ? (
          <Card>
            <p className="text-center text-green-500 py-8">{emptyMessage}</p>
          </Card>
        ) : (
          <div className="overflow-x-auto bg-white shadow-md rounded-lg">
            <table className="min-w-full divide-y divide-green-200">
              <thead className="bg-green-100">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-green-600 uppercase tracking-wider">Produto (Class.)</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-green-600 uppercase tracking-wider">Linha</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-green-600 uppercase tracking-wider">Início</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-green-600 uppercase tracking-wider">Fim</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-green-600 uppercase tracking-wider">Qtde.</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-green-600 uppercase tracking-wider">Status</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-green-600 uppercase tracking-wider">Ações</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-green-200">
                {schedulesToRender.map((item) => {
                  const product = getProductById(item.productId);
                  const line = getProductionLineById(item.lineId);
                  const canEdit = item.status === 'Pendente' || item.status === 'Em Progresso';
                  const productClassificationLabel = product?.classification === 'Top Seller' ? 'Top Seller' : 'Normal';

                  return (
                    <tr key={item.id} className="hover:bg-lime-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-900">
                          {product?.name || 'N/D'}
                          <span className={`text-xs ml-1 ${product?.classification === 'Top Seller' ? 'text-amber-600 font-semibold' : 'text-blue-600'}`}>
                              ({productClassificationLabel})
                          </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600">{line?.name || 'N/D'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600">{formatDate(item.startTime)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600">{formatDate(item.endTime)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 text-center">{item.quantity}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(item.status)}`}>
                          {item.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-1">
                        {canEdit && (
                          <Button aria-label={`Editar agendamento de ${product?.name || 'produto'}`} size="sm" variant="ghost" onClick={() => handleEditSchedule(item)} leftIcon={<PencilIcon className="w-4 h-4" />}>Editar</Button>
                        )}
                        <Button aria-label={`Deletar agendamento de ${product?.name || 'produto'}`} size="sm" variant="danger" onClick={() => openDeleteConfirmModal(item)} leftIcon={<TrashIcon className="w-4 h-4" />}>Deletar</Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </>
    );
  };


  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2 justify-end">
        <Button onClick={handleOpenOptimizeConfirm} variant="secondary" leftIcon={<CogIcon className="w-5 h-5"/>}>
          Otimizar Horários (Hoje)
        </Button>
        <Button onClick={handleAddSchedule} leftIcon={<PlusIcon className="w-5 h-5"/>}>
          Agendar Nova Produção
        </Button>
      </div>
      
      {pageError && (
        <div className="my-4"> 
          <Alert type="error" message={pageError} onClose={() => setPageError(null)} />
        </div>
      )}
      {optimizationResult && (
         <div className="my-4">
            <Alert type={optimizationResult.type} message={optimizationResult.message} onClose={() => setOptimizationResult(null)} />
        </div>
      )}

      {renderSchedulesTable(activeSchedules, "Produções Ativas (Pendentes / Em Progresso)", "Nenhuma produção pendente ou em progresso.")}
      {renderSchedulesTable(historicalSchedules, "Histórico de Produções (Concluídas / Canceladas)", "Nenhum histórico de produções concluídas ou canceladas.")}

      {sortedSchedules.length === 0 && !pageError && !optimizationResult && (
         <Card>
            <p className="text-center text-green-500 py-8">Nenhuma produção agendada ainda. Clique em "Agendar Nova Produção" para começar.</p>
        </Card>
      )}


      {isModalOpen && (
         <Modal
          isOpen={isModalOpen}
          onClose={() => { setIsModalOpen(false); setEditingSchedule(undefined); }}
          title={editingSchedule ? 'Editar Produção Agendada' : 'Agendar Nova Produção'}
          size="lg"
        >
          <ScheduleForm
            onSubmit={handleSubmitForm}
            initialData={editingSchedule}
            onClose={() => { setIsModalOpen(false); setEditingSchedule(undefined); }}
            products={products}
            lines={productionLines}
            schedules={schedules} 
            getProductById={getProductById}
            getProductionLineById={getProductionLineById}
            addWorkingTime={addWorkingTime} // Pass addWorkingTime
          />
        </Modal>
      )}

      <Modal
        isOpen={isDeleteConfirmOpen}
        onClose={() => { setIsDeleteConfirmOpen(false); setScheduleToDelete(null); }}
        title="Confirmar Exclusão de Agendamento"
      >
        <p className="text-sm text-gray-700">{deleteModalMessage}</p>
        <div className="mt-6 flex justify-end space-x-3">
          <Button variant="secondary" onClick={() => { setIsDeleteConfirmOpen(false); setScheduleToDelete(null); }}>
            Cancelar
          </Button>
          <Button variant="danger" onClick={confirmDeleteAndCloseModal}>
            Confirmar Exclusão
          </Button>
        </div>
      </Modal>

      <Modal
        isOpen={isOptimizeConfirmOpen}
        onClose={() => setIsOptimizeConfirmOpen(false)}
        title="Confirmar Otimização de Horários"
      >
        <p className="text-sm text-gray-700">
          Tem certeza que deseja otimizar os horários para os produtos normais de <strong>hoje ({new Date().toLocaleDateString('pt-BR')})</strong>?
          <br />
          Produtos 'Top Seller' não serão alterados. Esta ação pode reorganizar múltiplos agendamentos 'Normal'.
        </p>
        <div className="mt-6 flex justify-end space-x-3">
          <Button variant="secondary" onClick={() => setIsOptimizeConfirmOpen(false)}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={confirmOptimizeAndCloseModal}>
            Otimizar Agora
          </Button>
        </div>
      </Modal>

    </div>
  );
};

export default ProductionSchedulingPage;
