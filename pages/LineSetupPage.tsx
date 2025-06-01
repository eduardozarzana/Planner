
import React, { useState } from 'react';
import { useAppData } from '../contexts/AppDataContext';
import { ProductionLine, Equipment, OperatingDayTime } from '../types';
import Button from '../components/shared/Button';
import Modal from '../components/shared/Modal';
import Input from '../components/shared/Input';
import Textarea from '../components/shared/Textarea';
import Card from '../components/shared/Card';
import { PlusIcon, PencilIcon, TrashIcon, ChevronUpIcon, ChevronDownIcon, ArrowPathIcon } from '../components/icons';

const daysOfWeekNames = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];

// Form for creating/editing a production line's basic info including operating hours
const LineInfoForm: React.FC<{
  onSubmit: (lineInfo: Pick<ProductionLine, 'name' | 'description' | 'operatingHours'>) => void;
  initialData?: ProductionLine; // Expect full ProductionLine for initialData
  onClose: () => void;
}> = ({ onSubmit, initialData, onClose }) => {
  const [name, setName] = useState(initialData?.name || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [operatingHours, setOperatingHours] = useState<OperatingDayTime[]>(
    initialData?.operatingHours 
    ? JSON.parse(JSON.stringify(initialData.operatingHours)) // Deep copy
    : Array.from({ length: 7 }, (_, i) => ({ // Default if no initialData (new line scenario, though context provides defaults)
        dayOfWeek: i,
        startTime: '08:00',
        endTime: '17:00',
        isActive: i >= 1 && i <= 5,
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
      const start = dayToUpdate.startTime;
      const end = dayToUpdate.endTime;
      if (start && end && start >= end) {
        setTimeErrors(prev => ({ ...prev, [dayIndex]: "Hora de fim deve ser após a hora de início." }));
      } else {
        setTimeErrors(prev => ({ ...prev, [dayIndex]: null }));
      }
    } else {
      setTimeErrors(prev => ({ ...prev, [dayIndex]: null })); // Clear error if day is inactive
    }
  };


  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) {
      alert('Nome da Linha é obrigatório.');
      return;
    }
    // Check for any time errors before submitting
    if (Object.values(timeErrors).some(error => error !== null)) {
      alert('Corrija os erros nos horários de operação antes de salvar.');
      return;
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
              <label htmlFor={`isActive-${dayOp.dayOfWeek}`} className="font-medium text-green-700">
                {daysOfWeekNames[dayOp.dayOfWeek]}
              </label>
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
                <Input
                  type="time"
                  label="Hora Início"
                  id={`startTime-${dayOp.dayOfWeek}`}
                  value={dayOp.startTime}
                  onChange={(e) => handleOperatingHoursChange(index, 'startTime', e.target.value)}
                  disabled={!dayOp.isActive}
                  required={dayOp.isActive}
                />
                <Input
                  type="time"
                  label="Hora Fim"
                  id={`endTime-${dayOp.dayOfWeek}`}
                  value={dayOp.endTime}
                  onChange={(e) => handleOperatingHoursChange(index, 'endTime', e.target.value)}
                  disabled={!dayOp.isActive}
                  required={dayOp.isActive}
                />
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

// Component to configure equipment for a selected line (no changes needed here for operating hours)
const LineEquipmentConfigurator: React.FC<{
  line: ProductionLine;
  onSave: (updatedLine: ProductionLine) => void;
  onClose: () => void;
}> = ({ line, onSave, onClose }) => {
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
          {availableEquipment.length === 0 && <p className="text-sm text-green-500">Nenhum outro equipamento disponível para adicionar.</p>}
          {allEquipment.length === 0 && <p className="text-sm text-green-500">Nenhum equipamento cadastrado no sistema.</p>}
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
          {lineEquipmentIds.length === 0 && <p className="text-sm text-green-500">Nenhum equipamento atribuído a esta linha ainda.</p>}
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

  // Group consecutive days with same times
  const summary: string[] = [];
  let i = 0;
  while (i < activeDays.length) {
    let j = i;
    while (
      j + 1 < activeDays.length &&
      activeDays[j+1].dayOfWeek === activeDays[j].dayOfWeek + 1 &&
      activeDays[j+1].startTime === activeDays[j].startTime &&
      activeDays[j+1].endTime === activeDays[j].endTime
    ) {
      j++;
    }
    const startDay = daysOfWeekNames[activeDays[i].dayOfWeek].substring(0,3);
    const endDay = daysOfWeekNames[activeDays[j].dayOfWeek].substring(0,3);
    const time = `${activeDays[i].startTime} - ${activeDays[i].endTime}`;
    if (i === j) {
      summary.push(`${startDay}: ${time}`);
    } else {
      summary.push(`${startDay}-${endDay}: ${time}`);
    }
    i = j + 1;
  }
  return summary.join(', ') || "Não opera";
};


const LineSetupPage: React.FC = () => {
  const { productionLines, addProductionLine, updateProductionLine, deleteProductionLine, getEquipmentById } = useAppData();
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [editingLine, setEditingLine] = useState<ProductionLine | undefined>(undefined); 
  const [currentLineForConfig, setCurrentLineForConfig] = useState<ProductionLine | null>(null);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [lineToDelete, setLineToDelete] = useState<ProductionLine | null>(null);


  const handleAddLine = () => {
    setEditingLine(undefined); // For a new line, initialData will be undefined in LineInfoForm
    setIsInfoModalOpen(true);
  };

  const handleEditLineInfo = (line: ProductionLine) => {
    setEditingLine(line);
    setIsInfoModalOpen(true);
  };

  const handleConfigureLineEquipment = (line: ProductionLine) => {
    setCurrentLineForConfig(line);
    setIsConfigModalOpen(true);
  };
  
  const openDeleteConfirmModal = (line: ProductionLine) => {
    setLineToDelete(line);
    setIsDeleteConfirmOpen(true);
  };

  const confirmDeleteAndCloseModal = () => {
    if (lineToDelete) {
      deleteProductionLine(lineToDelete.id);
    }
    setIsDeleteConfirmOpen(false);
    setLineToDelete(null);
  };

  const handleSubmitLineInfoForm = (data: Pick<ProductionLine, 'name' | 'description' | 'operatingHours'>) => {
    if (editingLine) {
      updateProductionLine({ ...editingLine, ...data });
    } else {
      // addProductionLine expects Omit<ProductionLine, 'id' | 'equipmentIds' | 'operatingHours'>
      // but we have name, description, operatingHours. The context handles the rest.
      const { name, description, operatingHours } = data;
      addProductionLine({ name, description, operatingHours });
    }
    setIsInfoModalOpen(false);
    setEditingLine(undefined);
  };
  
  const handleSaveLineConfiguration = (updatedLine: ProductionLine) => {
    updateProductionLine(updatedLine);
    setIsConfigModalOpen(false);
    setCurrentLineForConfig(null);
  };
  
  const deleteModalMessage = lineToDelete
    ? `Tem certeza que deseja deletar a linha de produção "${lineToDelete.name}"? Isso também a removerá de quaisquer agendamentos.`
    : 'Tem certeza que deseja deletar esta linha de produção? Isso também a removerá de quaisquer agendamentos.';


  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button onClick={handleAddLine} leftIcon={<PlusIcon className="w-5 h-5"/>}>
          Criar Nova Linha
        </Button>
      </div>

      {productionLines.length === 0 ? (
        <Card>
          <p className="text-center text-green-500 py-8">Nenhuma linha de produção criada ainda. Clique em "Criar Nova Linha" para começar.</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {productionLines.map((line) => (
            <Card key={line.id} title={line.name}>
              <div className="space-y-3">
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
                <Button aria-label={`Configurar equipamentos para ${line.name}`} size="sm" variant="ghost" onClick={() => handleConfigureLineEquipment(line)} leftIcon={<ArrowPathIcon className="w-4 h-4" />}>Configurar Equipamentos</Button>
                <Button aria-label={`Editar informações de ${line.name}`} size="sm" variant="ghost" onClick={() => handleEditLineInfo(line)} leftIcon={<PencilIcon className="w-4 h-4" />}>Editar Linha</Button>
                <Button aria-label={`Deletar ${line.name}`} size="sm" variant="danger" onClick={() => openDeleteConfirmModal(line)} leftIcon={<TrashIcon className="w-4 h-4" />}>Deletar Linha</Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {isInfoModalOpen && (
        <Modal
          isOpen={isInfoModalOpen}
          onClose={() => { setIsInfoModalOpen(false); setEditingLine(undefined); }}
          title={editingLine ? 'Editar Linha de Produção' : 'Criar Nova Linha de Produção'}
          size="lg" // Increased size to accommodate operating hours
        >
          <LineInfoForm
            onSubmit={handleSubmitLineInfoForm}
            initialData={editingLine} // Pass the full line object or undefined
            onClose={() => { setIsInfoModalOpen(false); setEditingLine(undefined); }}
          />
        </Modal>
      )}

      {currentLineForConfig && (
        <Modal
          isOpen={isConfigModalOpen}
          onClose={() => { setIsConfigModalOpen(false); setCurrentLineForConfig(null); }}
          title={`Configurar Equipamentos para ${currentLineForConfig.name}`}
          size="xl" 
        >
          <LineEquipmentConfigurator
            line={currentLineForConfig}
            onSave={handleSaveLineConfiguration}
            onClose={() => { setIsConfigModalOpen(false); setCurrentLineForConfig(null); }}
          />
        </Modal>
      )}

      <Modal
        isOpen={isDeleteConfirmOpen}
        onClose={() => { setIsDeleteConfirmOpen(false); setLineToDelete(null); }}
        title="Confirmar Exclusão de Linha de Produção"
      >
        <p className="text-sm text-gray-700">{deleteModalMessage}</p>
        <div className="mt-6 flex justify-end space-x-3">
          <Button variant="secondary" onClick={() => { setIsDeleteConfirmOpen(false); setLineToDelete(null); }}>
            Cancelar
          </Button>
          <Button variant="danger" onClick={confirmDeleteAndCloseModal}>
            Confirmar Exclusão
          </Button>
        </div>
      </Modal>

    </div>
  );
};

export default LineSetupPage;
