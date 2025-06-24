
import React, { useState } from 'react';
import { useAppData } from '../contexts/AppDataContext';
import { ProductionLine, Equipment, OperatingDayTime } from '../types';
import Button from '../components/shared/Button';
import Modal from '../components/shared/Modal';
import Input from '../components/shared/Input';
import Textarea from '../components/shared/Textarea';
import Card from '../components/shared/Card';
import { PlusIcon, PencilIcon, TrashIcon, ChevronUpIcon, ChevronDownIcon, ArrowPathIcon, PlayIcon, PauseIcon } from '../components/icons';
import Alert from '../components/shared/Alert';

const daysOfWeekNames = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];

interface LineInfoFormProps {
  onSubmit: (data: Pick<ProductionLine, 'name' | 'description' | 'operatingHours'>) => void;
  initialData?: ProductionLine;
  onClose: () => void;
}

const LineInfoForm: React.FC<LineInfoFormProps> = ({ onSubmit, initialData, onClose }) => {
  const [name, setName] = useState(initialData?.name || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [operatingHours, setOperatingHours] = useState<OperatingDayTime[]>(
    initialData?.operatingHours 
    ? JSON.parse(JSON.stringify(initialData.operatingHours)) // Deep copy
    : Array.from({ length: 7 }, (_, i) => ({
        dayOfWeek: i, startTime: '08:00', endTime: '17:00', isActive: i >= 1 && i <= 5, // Mon-Fri active by default
      }))
  );
  const [timeErrors, setTimeErrors] = useState<Record<number, string | null>>({});

  const handleOperatingHoursChange = (dayIndex: number, field: keyof OperatingDayTime, value: string | boolean) => {
    const newOperatingHours = [...operatingHours];
    const dayToUpdate = { ...newOperatingHours[dayIndex] };
    
    if (field === 'isActive') {
        dayToUpdate.isActive = value as boolean;
    } else if (field === 'startTime' || field === 'endTime') {
        dayToUpdate[field] = value as string;
    }
    newOperatingHours[dayIndex] = dayToUpdate;
    setOperatingHours(newOperatingHours);

    // Validate times if day is active
    if (dayToUpdate.isActive) {
      if (dayToUpdate.startTime && dayToUpdate.endTime && dayToUpdate.startTime >= dayToUpdate.endTime && dayToUpdate.endTime !== "00:00") {
        setTimeErrors(prev => ({ ...prev, [dayIndex]: "Hora de fim deve ser após a hora de início (ou 00:00 para virar o dia)." }));
      } else {
        setTimeErrors(prev => ({ ...prev, [dayIndex]: null }));
      }
    } else {
      // Clear error if day is not active
      setTimeErrors(prev => ({ ...prev, [dayIndex]: null }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) { 
        alert('Nome da Linha é obrigatório.'); return; 
    }
    if (Object.values(timeErrors).some(error => error !== null)) {
      alert('Corrija os erros nos horários de operação antes de salvar.'); return;
    }
    onSubmit({ name, description, operatingHours });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6" aria-labelledby="form-title">
      <div>
        <Input label="Nome da Linha" id="lineName" value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div>
        <Textarea label="Descrição (Opcional)" id="lineDescription" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
      </div>
      <div className="space-y-4 pt-2 border-t border-green-200">
        <h4 className="text-md font-medium text-green-800">Horários de Operação Semanal:</h4>
        {operatingHours.map((dayOp, index) => (
          <div key={dayOp.dayOfWeek} className="p-3 border rounded-md bg-lime-50 space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor={`isActive-${dayOp.dayOfWeek}`} className="font-medium text-green-700">{daysOfWeekNames[dayOp.dayOfWeek]}</label>
              <input 
                type="checkbox" 
                id={`isActive-${dayOp.dayOfWeek}`} 
                checked={dayOp.isActive} 
                onChange={(e) => handleOperatingHoursChange(index, 'isActive', e.target.checked)} 
                className="form-checkbox h-5 w-5 text-yellow-500 border-green-300 rounded focus:ring-yellow-400" 
              />
            </div>
            {dayOp.isActive && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input type="time" label="Hora Início" id={`startTime-${dayOp.dayOfWeek}`} value={dayOp.startTime} onChange={(e) => handleOperatingHoursChange(index, 'startTime', e.target.value)} disabled={!dayOp.isActive} required={dayOp.isActive} />
                <Input type="time" label="Hora Fim" id={`endTime-${dayOp.dayOfWeek}`} value={dayOp.endTime} onChange={(e) => handleOperatingHoursChange(index, 'endTime', e.target.value)} disabled={!dayOp.isActive} required={dayOp.isActive} />
              </div>
            )}
             {timeErrors[index] && <p className="text-xs text-red-600 mt-1">{timeErrors[index]}</p>}
          </div>
        ))}
      </div>
      <div className="flex justify-end space-x-2 pt-4">
        <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
        <Button type="submit" variant="primary">{initialData ? 'Atualizar Linha' : 'Criar Linha'}</Button>
      </div>
    </form>
  );
};

interface LineEquipmentConfiguratorProps {
  line: ProductionLine;
  onSave: (updatedLine: ProductionLine) => void;
  onClose: () => void;
}

const LineEquipmentConfigurator: React.FC<LineEquipmentConfiguratorProps> = ({ line, onSave, onClose }) => {
  const { equipment: allEquipment, getEquipmentById } = useAppData();
  const [lineEquipmentIds, setLineEquipmentIds] = useState<string[]>(line.equipmentIds);

  const availableEquipment = allEquipment.filter(eq => !lineEquipmentIds.includes(eq.id));

  const addEquipmentToLine = (equipmentId: string) => {
    setLineEquipmentIds(prev => [...prev, equipmentId]);
  };

  const removeEquipmentFromLine = (equipmentId: string) => {
    setLineEquipmentIds(prev => prev.filter(id => id !== equipmentId));
  };

  const moveEquipment = (index: number, direction: 'up' | 'down') => {
    const newOrder = [...lineEquipmentIds];
    const item = newOrder.splice(index, 1)[0];
    if (direction === 'up') {
      newOrder.splice(Math.max(0, index - 1), 0, item);
    } else {
      newOrder.splice(Math.min(newOrder.length, index + 1), 0, item);
    }
    setLineEquipmentIds(newOrder);
  };
  
  const handleSave = () => {
    onSave({ ...line, equipmentIds: lineEquipmentIds });
  };

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-medium text-green-800" id="config-title">Configure Equipamentos para: <span className="font-bold text-yellow-500">{line.name}</span></h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card title="Equipamentos Disponíveis" className="max-h-96 overflow-y-auto">
          {allEquipment.length === 0 && <p className="text-sm text-green-500 py-4">Nenhum equipamento cadastrado no sistema.</p>}
          {allEquipment.length > 0 && availableEquipment.length === 0 && <p className="text-sm text-green-500 py-4">Todos os equipamentos já foram adicionados ou não há mais disponíveis.</p>}
          <ul className="space-y-2" aria-labelledby="available-equipment-title">
            {availableEquipment.map(eq => (
              <li key={eq.id} className="flex justify-between items-center p-2 border rounded-md hover:bg-lime-50">
                <span className="text-green-700">{eq.name} ({eq.type})</span>
                <Button size="sm" variant="ghost" onClick={() => addEquipmentToLine(eq.id)} leftIcon={<PlusIcon className="w-4 h-4" />} aria-label={`Adicionar ${eq.name} à linha`}>Adicionar</Button>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Equipamentos nesta Linha (Ordenado)" className="max-h-96 overflow-y-auto">
          {lineEquipmentIds.length === 0 && <p className="text-sm text-green-500 py-4">Nenhum equipamento atribuído a esta linha ainda.</p>}
          <ul className="space-y-2" aria-labelledby="line-equipment-title">
            {lineEquipmentIds.map((eqId, index) => {
              const eqDetails = getEquipmentById(eqId);
              return (
                <li key={eqId} className="flex justify-between items-center p-2 border rounded-md hover:bg-lime-50">
                  <div>
                    <span className="font-medium text-green-800">{index + 1}. {eqDetails?.name || 'Equip. Desconhecido'}</span>
                    <span className="text-xs text-green-500"> ({eqDetails?.type || 'N/D'})</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Button size="sm" variant="ghost" onClick={() => moveEquipment(index, 'up')} disabled={index === 0} aria-label={`Mover ${eqDetails?.name || 'equipamento'} para cima`}><ChevronUpIcon /></Button>
                    <Button size="sm" variant="ghost" onClick={() => moveEquipment(index, 'down')} disabled={index === lineEquipmentIds.length - 1} aria-label={`Mover ${eqDetails?.name || 'equipamento'} para baixo`}><ChevronDownIcon /></Button>
                    <Button size="sm" variant="danger" onClick={() => removeEquipmentFromLine(eqId)} aria-label={`Remover ${eqDetails?.name || 'equipamento'} da linha`}><TrashIcon className="w-4 h-4" /></Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>
      <div className="flex justify-end space-x-2 pt-4">
        <Button variant="secondary" onClick={onClose}>Cancelar</Button>
        <Button variant="primary" onClick={handleSave}>Salvar Configuração</Button>
      </div>
    </div>
  );
};

const formatOperatingHoursSummary = (operatingHours: OperatingDayTime[]): string => {
  const activeDays = operatingHours.filter(day => day.isActive);
  if (activeDays.length === 0) return "Não opera";
  const summary: string[] = [];
  let i = 0;
  while (i < activeDays.length) {
    let j = i;
    while (
      j + 1 < activeDays.length &&
      activeDays[j+1].dayOfWeek === (activeDays[j].dayOfWeek + 1) % 7 && 
      activeDays[j+1].startTime === activeDays[j].startTime &&
      activeDays[j+1].endTime === activeDays[j].endTime
    ) {
      j++;
    }
    const startDay = daysOfWeekNames[activeDays[i].dayOfWeek].substring(0,3);
    const endDay = daysOfWeekNames[activeDays[j].dayOfWeek].substring(0,3);
    const time = `${activeDays[i].startTime} - ${activeDays[i].endTime === "00:00" ? "24:00" : activeDays[i].endTime}`;
    if (i === j) {
      summary.push(`${startDay}: ${time}`);
    } else {
      summary.push(`${startDay}-${endDay}: ${time}`);
    }
    i = j + 1;
  }
  return summary.join('; ') || "Não opera";
};


const LineSetupPage: React.FC = () => {
  const { productionLines, addProductionLine, updateProductionLine, deleteProductionLine, getEquipmentById, pauseLine, resumeLine, isLoading } = useAppData();
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [editingLine, setEditingLine] = useState<ProductionLine | undefined>(undefined); 
  const [currentLineForConfig, setCurrentLineForConfig] = useState<ProductionLine | null>(null);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [lineToDelete, setLineToDelete] = useState<ProductionLine | null>(null);
  const [isPauseModalOpen, setIsPauseModalOpen] = useState(false);
  const [lineToPauseOrResume, setLineToPauseOrResume] = useState<ProductionLine | null>(null);
  const [pauseReason, setPauseReason] = useState('');
  const [feedbackMessage, setFeedbackMessage] = useState<{type: 'success' | 'error', message: string} | null>(null);

  const handleAddLine = () => {
    setFeedbackMessage(null);
    setEditingLine(undefined);
    setIsInfoModalOpen(true);
  };

  const handleEditLineInfo = (line: ProductionLine) => {
    setFeedbackMessage(null);
    setEditingLine(line);
    setIsInfoModalOpen(true);
  };

  const handleConfigureLineEquipment = (line: ProductionLine) => {
    setFeedbackMessage(null);
    setCurrentLineForConfig(line);
    setIsConfigModalOpen(true);
  };
  
  const openDeleteConfirmModal = (line: ProductionLine) => {
    setFeedbackMessage(null);
    setLineToDelete(line);
    setIsDeleteConfirmOpen(true);
  };

  const confirmDeleteAndCloseModal = () => {
    if (lineToDelete) {
      deleteProductionLine(lineToDelete.id);
      setFeedbackMessage({type: 'success', message: `Linha "${lineToDelete.name}" deletada.`});
    }
    setIsDeleteConfirmOpen(false);
    setLineToDelete(null);
  };

  const handleSubmitLineInfoForm = (data: Pick<ProductionLine, 'name' | 'description' | 'operatingHours'>) => {
    if (editingLine) {
      updateProductionLine({ ...editingLine, ...data });
      setFeedbackMessage({type: 'success', message: `Linha "${data.name}" atualizada.`});
    } else {
      addProductionLine(data).then(newLine => {
        if(newLine) setFeedbackMessage({type: 'success', message: `Linha "${newLine.name}" criada.`});
      });
    }
    setIsInfoModalOpen(false);
    setEditingLine(undefined);
  };
  
  const handleSaveLineConfiguration = (updatedLine: ProductionLine) => {
    updateProductionLine(updatedLine);
    setFeedbackMessage({type: 'success', message: `Configuração de equipamentos para "${updatedLine.name}" salva.`});
    setIsConfigModalOpen(false);
    setCurrentLineForConfig(null);
  };
  const handleOpenPauseModal = (line: ProductionLine) => {
    setFeedbackMessage(null);
    setLineToPauseOrResume(line);
    setPauseReason(''); 
    setIsPauseModalOpen(true);
  };

  const handleConfirmPause = async () => {
    if (lineToPauseOrResume && pauseReason.trim()) {
      const result = await pauseLine(lineToPauseOrResume.id, pauseReason.trim());
      if (result.success) {
        setFeedbackMessage({type: 'success', message: result.message || `Linha "${lineToPauseOrResume.name}" pausada com sucesso.`});
        setIsPauseModalOpen(false);
        setLineToPauseOrResume(null);
      } else {
        setFeedbackMessage({type: 'error', message: result.message || 'Falha ao pausar a linha.'});
      }
    } else if (!pauseReason.trim()) {
        setFeedbackMessage({type: 'error', message: "O motivo da pausa é obrigatório."});
    }
  };

  const handleResumeLine = async (line: ProductionLine) => {
    setFeedbackMessage(null);
    setLineToPauseOrResume(line); // Para controle do estado de isLoading do botão
    const result = await resumeLine(line.id);
    if (result.success) {
        setFeedbackMessage({type: 'success', message: result.message || `Linha "${line.name}" retomada com sucesso.`});
    } else {
        setFeedbackMessage({type: 'error', message: result.message || `Falha ao retomar linha "${line.name}".`});
    }
    setLineToPauseOrResume(null); // Limpa após a operação
  };
  
  const deleteModalMessageText = lineToDelete
    ? `Tem certeza que deseja deletar a linha de produção "${lineToDelete.name}"? Isso também a removerá de quaisquer agendamentos.`
    : 'Tem certeza que deseja deletar esta linha de produção?';


  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button onClick={handleAddLine} leftIcon={<PlusIcon className="w-5 h-5"/>} disabled={isLoading}>
          Criar Nova Linha
        </Button>
      </div>
      
      {feedbackMessage && <Alert type={feedbackMessage.type} message={feedbackMessage.message} onClose={() => setFeedbackMessage(null)} />}

      {isLoading && productionLines.length === 0 && <p className="text-center text-green-500 py-8">Carregando linhas...</p>}
      {!isLoading && productionLines.length === 0 && (
        <Card><p className="text-center text-green-500 py-8">Nenhuma linha de produção criada ainda. Clique em "Criar Nova Linha" para começar.</p></Card>
      )}

      {productionLines.length > 0 && (
        <div className="space-y-4">
          {productionLines.map((line) => (
            <Card 
                key={line.id} 
                title={line.name}
                className={line.isPaused ? 'border-2 border-amber-500 bg-amber-50 shadow-lg' : 'shadow-md'}
            >
              <div className="space-y-3">
                {line.isPaused && (
                    <div className="p-3 mb-3 bg-amber-100 text-amber-700 rounded-md border border-amber-300">
                        <p className="font-semibold text-amber-800">LINHA PAUSADA</p>
                        {line.currentPauseReason && <p className="text-sm">Motivo: {line.currentPauseReason}</p>}
                        {line.currentPauseStartTime && <p className="text-sm">Desde: {new Date(line.currentPauseStartTime).toLocaleString('pt-BR', { dateStyle:'short', timeStyle:'short'})}</p>}
                        {line.pausedByUserEmail && <p className="text-sm">Por: {line.pausedByUserEmail}</p>}
                    </div>
                )}
                {line.description && <p className="text-sm text-green-600">{line.description}</p>}
                <div>
                  <h4 className="text-sm font-medium text-green-700 mb-1">Horários de Operação:</h4>
                  <p className="text-sm text-green-600">{formatOperatingHoursSummary(line.operatingHours)}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-green-700 mb-1 mt-2">Sequência de Equipamentos:</h4>
                  {line.equipmentIds.length > 0 ? (
                    <ol className="list-decimal list-inside text-sm text-green-600 space-y-1">
                      {line.equipmentIds.map(eqId => {
                        const eq = getEquipmentById(eqId);
                        return <li key={eqId}>{eq ? `${eq.name} (${eq.type})` : 'Equipamento Desconhecido'}</li>;
                      })}
                    </ol>
                  ) : (
                    <p className="text-sm text-green-500">Nenhum equipamento atribuído ainda.</p>
                  )}
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-green-200 flex flex-wrap gap-2 justify-end">
                {line.isPaused ? (
                    <Button 
                        size="sm" 
                        variant="success" 
                        onClick={() => handleResumeLine(line)} 
                        leftIcon={<PlayIcon className="w-4 h-4"/>}
                        isLoading={isLoading && lineToPauseOrResume?.id === line.id}
                        disabled={isLoading && lineToPauseOrResume?.id !== line.id && lineToPauseOrResume !== null}
                    >
                        Retomar Linha
                    </Button>
                ) : (
                    <Button 
                        size="sm" 
                        variant="warning" 
                        onClick={() => handleOpenPauseModal(line)} 
                        leftIcon={<PauseIcon className="w-4 h-4"/>}
                        isLoading={isLoading && lineToPauseOrResume?.id === line.id}
                        disabled={isLoading && lineToPauseOrResume?.id !== line.id && lineToPauseOrResume !== null}
                    >
                        Pausar Linha
                    </Button>
                )}
                <Button aria-label={`Configurar equipamentos para ${line.name}`} size="sm" variant="ghost" onClick={() => handleConfigureLineEquipment(line)} leftIcon={<ArrowPathIcon className="w-4 h-4" />} disabled={isLoading || line.isPaused}>Configurar Equipamentos</Button>
                <Button aria-label={`Editar informações de ${line.name}`} size="sm" variant="ghost" onClick={() => handleEditLineInfo(line)} leftIcon={<PencilIcon className="w-4 h-4" />} disabled={isLoading || line.isPaused}>Editar Linha</Button>
                <Button aria-label={`Deletar ${line.name}`} size="sm" variant="danger" onClick={() => openDeleteConfirmModal(line)} leftIcon={<TrashIcon className="w-4 h-4" />} disabled={isLoading || line.isPaused}>Deletar Linha</Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {isInfoModalOpen && (<Modal isOpen={isInfoModalOpen} onClose={() => {setIsInfoModalOpen(false); setEditingLine(undefined);}} title={editingLine ? 'Editar Linha de Produção' : 'Criar Nova Linha de Produção'} size="lg"><LineInfoForm onSubmit={handleSubmitLineInfoForm} initialData={editingLine} onClose={() => {setIsInfoModalOpen(false); setEditingLine(undefined);}} /></Modal>)}
      {currentLineForConfig && (<Modal isOpen={isConfigModalOpen} onClose={() => {setIsConfigModalOpen(false); setCurrentLineForConfig(null);}} title={`Configurar Equipamentos para ${currentLineForConfig.name}`} size="xl"><LineEquipmentConfigurator line={currentLineForConfig} onSave={handleSaveLineConfiguration} onClose={() => {setIsConfigModalOpen(false); setCurrentLineForConfig(null);}} /></Modal>)}
      {isDeleteConfirmOpen && (<Modal isOpen={isDeleteConfirmOpen} onClose={() => {setIsDeleteConfirmOpen(false); setLineToDelete(null);}} title="Confirmar Exclusão de Linha de Produção"><p className="text-sm text-gray-700">{deleteModalMessageText}</p><div className="mt-6 flex justify-end space-x-3"><Button variant="secondary" onClick={() => {setIsDeleteConfirmOpen(false); setLineToDelete(null);}}>Cancelar</Button><Button variant="danger" onClick={confirmDeleteAndCloseModal}>Confirmar Exclusão</Button></div></Modal>)}

      {isPauseModalOpen && lineToPauseOrResume && (
        <Modal
          isOpen={isPauseModalOpen}
          onClose={() => { setIsPauseModalOpen(false); setLineToPauseOrResume(null); setFeedbackMessage(null);}}
          title={`Pausar Linha: ${lineToPauseOrResume.name}`}
        >
          <div className="space-y-4">
            {feedbackMessage && feedbackMessage.type === 'error' && <Alert type="error" message={feedbackMessage.message} onClose={() => setFeedbackMessage(null)} />}
            <Textarea
              label="Motivo da Pausa"
              id="pauseReason"
              value={pauseReason}
              onChange={(e) => setPauseReason(e.target.value)}
              rows={3}
              required
              placeholder="Ex: Manutenção não programada, Falta de material"
            />
            <div className="flex justify-end space-x-3">
              <Button variant="secondary" onClick={() => { setIsPauseModalOpen(false); setLineToPauseOrResume(null); setFeedbackMessage(null);}}>
                Cancelar
              </Button>
              <Button 
                variant="warning" 
                onClick={handleConfirmPause} 
                isLoading={isLoading && lineToPauseOrResume?.id === lineToPauseOrResume?.id}
                disabled={isLoading && lineToPauseOrResume?.id !== lineToPauseOrResume?.id && lineToPauseOrResume !== null}
              >
                Confirmar Pausa
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default LineSetupPage;
