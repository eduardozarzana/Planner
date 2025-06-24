
import React, { useState } from 'react';
import { useAppData } from '../contexts/AppDataContext';
import { Equipment } from '../types';
import Button from '../components/shared/Button';
import Modal from '../components/shared/Modal';
import Input from '../components/shared/Input';
import Card from '../components/shared/Card';
import { PlusIcon, PencilIcon, TrashIcon } from '../components/icons';

const EquipmentForm: React.FC<{
  onSubmit: (equipment: Omit<Equipment, 'id'> | Equipment) => void;
  initialData?: Equipment;
  onClose: () => void;
}> = ({ onSubmit, initialData, onClose }) => {
  const [name, setName] = useState(initialData?.name || '');
  const [type, setType] = useState(initialData?.type || '');
  const [maintenanceDate, setMaintenanceDate] = useState(initialData?.maintenanceDate || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !type) {
      alert('Nome e Tipo são obrigatórios.'); // Simple validation
      return;
    }
    const equipmentData = { name, type, maintenanceDate: maintenanceDate || undefined };
    if (initialData) {
      onSubmit({ ...initialData, ...equipmentData });
    } else {
      onSubmit(equipmentData);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4" aria-labelledby="form-title">
      <Input label="Nome do Equipamento" id="equipmentName" value={name} onChange={(e) => setName(e.target.value)} required />
      <Input label="Tipo do Equipamento (ex: Misturador, Forno)" id="equipmentType" value={type} onChange={(e) => setType(e.target.value)} required />
      <Input type="date" label="Data da Última Manutenção (Opcional)" id="maintenanceDate" value={maintenanceDate} onChange={(e) => setMaintenanceDate(e.target.value)} />
      <div className="flex justify-end space-x-2 pt-2">
        <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
        <Button type="submit" variant="primary">{initialData ? 'Atualizar' : 'Adicionar'} Equipamento</Button>
      </div>
    </form>
  );
};

const EquipmentManagementPage: React.FC = () => {
  const { equipment, addEquipment, updateEquipment, deleteEquipment } = useAppData();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEquipment, setEditingEquipment] = useState<Equipment | undefined>(undefined);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [equipmentToDelete, setEquipmentToDelete] = useState<Equipment | null>(null);

  const handleAddEquipment = () => {
    setEditingEquipment(undefined);
    setIsModalOpen(true);
  };

  const handleEditEquipment = (item: Equipment) => {
    setEditingEquipment(item);
    setIsModalOpen(true);
  };

  const openDeleteConfirmModal = (item: Equipment) => {
    setEquipmentToDelete(item);
    setIsDeleteConfirmOpen(true);
  };

  const confirmDeleteAndCloseModal = () => {
    if (equipmentToDelete) {
      deleteEquipment(equipmentToDelete.id);
    }
    setIsDeleteConfirmOpen(false);
    setEquipmentToDelete(null);
  };

  const handleSubmitForm = (data: Omit<Equipment, 'id'> | Equipment) => {
    if ('id' in data) { // Existing equipment
      updateEquipment(data as Equipment);
    } else { // New equipment
      addEquipment(data as Omit<Equipment, 'id'>);
    }
    setIsModalOpen(false);
    setEditingEquipment(undefined);
  };
  
  const deleteModalMessage = equipmentToDelete
    ? `Tem certeza que deseja deletar o equipamento "${equipmentToDelete.name}"? Esta ação também o removerá dos tempos de processamento de produtos e das listas de equipamentos em linhas.`
    : 'Tem certeza que deseja deletar este equipamento? Esta ação também o removerá dos tempos de processamento de produtos e das listas de equipamentos em linhas.';


  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button onClick={handleAddEquipment} leftIcon={<PlusIcon className="w-5 h-5"/>}>
          Adicionar Equipamento
        </Button>
      </div>

      {equipment.length === 0 ? (
        <Card>
          <p className="text-center text-green-500 py-8">Nenhum equipamento adicionado ainda. Clique em "Adicionar Equipamento" para começar.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {equipment.map((item) => (
            <Card key={item.id} title={item.name}>
              <div className="space-y-2 text-sm text-green-600">
                <p><strong className="text-green-800">Tipo:</strong> {item.type}</p>
                {item.maintenanceDate && <p><strong className="text-green-800">Última Manutenção:</strong> {new Date(item.maintenanceDate).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</p>}
              </div>
              <div className="mt-4 pt-4 border-t border-green-200 flex justify-end space-x-2">
                <Button aria-label={`Editar ${item.name}`} size="sm" variant="ghost" onClick={() => handleEditEquipment(item)} leftIcon={<PencilIcon className="w-4 h-4" />}>Editar</Button>
                <Button aria-label={`Deletar ${item.name}`} size="sm" variant="danger" onClick={() => openDeleteConfirmModal(item)} leftIcon={<TrashIcon className="w-4 h-4" />}>Deletar</Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setEditingEquipment(undefined); }}
        title={editingEquipment ? 'Editar Equipamento' : 'Adicionar Novo Equipamento'}
      >
        <EquipmentForm
          onSubmit={handleSubmitForm}
          initialData={editingEquipment}
          onClose={() => { setIsModalOpen(false); setEditingEquipment(undefined); }}
        />
      </Modal>

      <Modal
        isOpen={isDeleteConfirmOpen}
        onClose={() => { setIsDeleteConfirmOpen(false); setEquipmentToDelete(null); }}
        title="Confirmar Exclusão de Equipamento"
      >
        <p className="text-sm text-gray-700">{deleteModalMessage}</p>
        <div className="mt-6 flex justify-end space-x-3">
          <Button variant="secondary" onClick={() => { setIsDeleteConfirmOpen(false); setEquipmentToDelete(null); }}>
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

export default EquipmentManagementPage;
