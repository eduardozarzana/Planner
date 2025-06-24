
import React, { useState, useEffect } from 'react';
import { useAppData } from '../contexts/AppDataContext';
import { Product, Equipment, SelectOption, ProductClassification } from '../types';
import Button from '../components/shared/Button';
import Modal from '../components/shared/Modal';
import Input from '../components/shared/Input';
import Textarea from '../components/shared/Textarea';
import Card from '../components/shared/Card';
// Alert component import was removed as it's not used after AI removal. If general errors need to be shown, it can be re-added.
import Select from '../components/shared/Select';
import { PlusIcon, PencilIcon, TrashIcon } from '../components/icons';
import { generateUUID } from '../utils/uuid';


interface ProductFormProps {
  onSubmit: (product: Product) => void;
  initialData?: Product;
  onClose: () => void;
  allEquipment: Equipment[];
}

const ProductForm: React.FC<ProductFormProps> = ({ onSubmit, initialData, onClose, allEquipment }) => {
  const [name, setName] = useState(initialData?.name || '');
  const [sku, setSku] = useState(initialData?.sku || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [manufacturedFor, setManufacturedFor] = useState(initialData?.manufacturedFor || ''); // New state
  const [classification, setClassification] = useState<ProductClassification>(initialData?.classification || 'Normal');
  const [currentProcessingTimes, setCurrentProcessingTimes] = useState<Array<{ equipmentId: string; timePerUnitMinutes: number; id: string }>>(
    initialData?.processingTimes.map(pt => ({ ...pt, id: generateUUID() })) || []
  );

  const equipmentOptions: SelectOption[] = allEquipment.map(eq => ({ value: eq.id, label: eq.name }));
  const classificationOptions: SelectOption[] = [
    { value: 'Normal', label: 'Produto Normal' },
    { value: 'Top Seller', label: 'Top Seller (Prioritário)' },
  ];

  const handleAddProcessingTime = () => {
    setCurrentProcessingTimes([...currentProcessingTimes, { equipmentId: '', timePerUnitMinutes: 0, id: generateUUID() }]);
  };

  const handleProcessingTimeChange = (
    index: number, 
    field: 'equipmentId' | 'timePerUnitMinutes', 
    value: string | number
  ) => {
    const updatedTimes = [...currentProcessingTimes];
    if (field === 'timePerUnitMinutes') {
      updatedTimes[index][field] = Number(value) >= 0 ? Number(value) : 0;
    } else {
      updatedTimes[index][field] = value as string;
    }
    setCurrentProcessingTimes(updatedTimes);
  };

  const handleRemoveProcessingTime = (idToRemove: string) => {
    setCurrentProcessingTimes(currentProcessingTimes.filter(pt => pt.id !== idToRemove));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !sku || !description) {
      alert('Nome, SKU e Descrição são obrigatórios.');
      return;
    }
    if (currentProcessingTimes.some(pt => !pt.equipmentId || pt.timePerUnitMinutes <= 0)) {
        alert('Todos os tempos de processamento devem ter um equipamento selecionado e um tempo maior que zero.');
        return;
    }

    const productData = {
      name,
      sku,
      description,
      manufacturedFor: manufacturedFor || undefined, // Store if provided
      classification,
      processingTimes: currentProcessingTimes.map(({id, ...rest}) => rest), // Remove temporary id
    };

    if (initialData) {
      onSubmit({ ...initialData, ...productData });
    } else {
      // For a new product, AppDataContext will generate the ID
      onSubmit({ id: '', ...productData } as Product); // Cast as Product, ID will be handled by context
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6" aria-labelledby="form-title">
      <Input label="Nome do Produto" id="productName" value={name} onChange={(e) => setName(e.target.value)} required />
      <Input label="SKU (Código)" id="productSku" value={sku} onChange={(e) => setSku(e.target.value)} required />
      <Textarea label="Descrição" id="productDescription" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} required />
      
      <Input 
        label="Fabricado para: (Opcional)" 
        id="manufacturedFor" 
        value={manufacturedFor} 
        onChange={(e) => setManufacturedFor(e.target.value)} 
      />

      <Select
        label="Classificação do Produto"
        id="productClassification"
        options={classificationOptions}
        value={classification}
        onChange={(e) => setClassification(e.target.value as ProductClassification)}
        required
      />
      
      <fieldset className="border border-green-300 p-4 rounded-md">
        <legend className="text-sm font-medium text-green-700 px-1">Tempos de Processamento por Equipamento</legend>
        {currentProcessingTimes.map((pt, index) => (
          <div key={pt.id} className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end p-2 mb-2 border-b border-green-200 last:border-b-0 last:mb-0">
            <Select
              label="Equipamento"
              options={equipmentOptions}
              value={pt.equipmentId}
              onChange={(e) => handleProcessingTimeChange(index, 'equipmentId', e.target.value)}
              required
              placeholder="Selecione..."
              className="col-span-1 sm:col-span-2"
            />
            <Input
              type="number"
              label="Tempo (min/unid)"
              value={pt.timePerUnitMinutes}
              onChange={(e) => handleProcessingTimeChange(index, 'timePerUnitMinutes', e.target.value)}
              min="0.1"
              step="0.1"
              required
              className="col-span-1"
            />
            <Button type="button" variant="danger" size="sm" onClick={() => handleRemoveProcessingTime(pt.id)} className="col-span-1 sm:col-span-3 mt-2 sm:mt-0 sm:ml-auto" leftIcon={<TrashIcon className="w-4 h-4"/>}>
              Remover Tempo
            </Button>
          </div>
        ))}
        <Button type="button" variant="secondary" size="sm" onClick={handleAddProcessingTime} className="mt-3" leftIcon={<PlusIcon className="w-4 h-4"/>}>
          Adicionar Tempo de Processamento
        </Button>
      </fieldset>

      <div className="flex justify-end space-x-2 pt-4">
        <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
        <Button type="submit" variant="primary">{initialData ? 'Atualizar' : 'Adicionar'} Produto</Button>
      </div>
    </form>
  );
};


const ProductRegistrationPage: React.FC = () => {
  const { products, addProduct, updateProduct, deleteProduct, equipment, getEquipmentById } = useAppData();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | undefined>(undefined);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);


  const handleAddProduct = () => {
    if (equipment.length === 0) {
        alert("Nenhum equipamento cadastrado. Adicione equipamentos antes de cadastrar produtos, pois eles são necessários para definir os tempos de processamento.");
        return;
    }
    setEditingProduct(undefined);
    setIsModalOpen(true);
  };

  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);
    setIsModalOpen(true);
  };

  const openDeleteConfirmModal = (item: Product) => {
    setProductToDelete(item);
    setIsDeleteConfirmOpen(true);
  };

  const confirmDeleteAndCloseModal = () => {
    if (productToDelete) {
      deleteProduct(productToDelete.id);
    }
    setIsDeleteConfirmOpen(false);
    setProductToDelete(null);
  };


  const handleSubmitForm = (data: Product) => {
    if (data.id && products.find(p => p.id === data.id)) { // Check if it's an existing product by ID
      updateProduct(data);
    } else {
      addProduct(data); // Let AppDataContext handle ID generation for new products
    }
    setIsModalOpen(false);
    setEditingProduct(undefined);
  };
  
  const deleteModalMessage = productToDelete
    ? `Tem certeza que deseja deletar o produto "${productToDelete.name}"? Isso também o removerá de quaisquer agendamentos.`
    : 'Tem certeza que deseja deletar este produto? Isso também o removerá de quaisquer agendamentos.';

  const getClassificationBadgeColor = (classification: ProductClassification) => {
    switch (classification) {
        case 'Top Seller': return 'bg-amber-100 text-amber-800';
        case 'Normal':
        default:
            return 'bg-sky-100 text-sky-800';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button onClick={handleAddProduct} leftIcon={<PlusIcon className="w-5 h-5"/>}>
          Adicionar Produto
        </Button>
      </div>

      {products.length === 0 ? (
        <Card>
          <p className="text-center text-green-500 py-8">Nenhum produto adicionado ainda. Clique em "Adicionar Produto" para começar.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map((product) => (
            <Card key={product.id} title={product.name} actions={
              <span className={`px-2 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full ${getClassificationBadgeColor(product.classification)}`}>
                  {product.classification === 'Top Seller' ? 'Top Seller' : 'Normal'}
              </span>
            }>
              <div className="space-y-2 text-sm text-green-600">
                <p><strong className="text-green-800">SKU:</strong> {product.sku}</p>
                <p className="truncate" title={product.description}><strong className="text-green-800">Descrição:</strong> {product.description}</p>
                {product.manufacturedFor && (
                  <p><strong className="text-green-800">Fabricado para:</strong> {product.manufacturedFor}</p>
                )}
                <div>
                  <strong className="text-green-800">Tempos de Processamento:</strong>
                  {product.processingTimes.length > 0 ? (
                    <ul className="list-disc list-inside ml-4">
                      {product.processingTimes.map((pt, index) => {
                        const equip = getEquipmentById(pt.equipmentId);
                        return (
                          <li key={index}>
                            {equip?.name || 'Equip. Desconhecido'}: {pt.timePerUnitMinutes} min/unid
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="text-xs text-green-500">Nenhum tempo definido.</p>
                  )}
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-green-200 flex justify-end space-x-2">
                 <Button aria-label={`Editar ${product.name}`} size="sm" variant="ghost" onClick={() => handleEditProduct(product)} leftIcon={<PencilIcon className="w-4 h-4" />}>Editar</Button>
                <Button aria-label={`Deletar ${product.name}`} size="sm" variant="danger" onClick={() => openDeleteConfirmModal(product)} leftIcon={<TrashIcon className="w-4 h-4" />}>Deletar</Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {isModalOpen && (
        <Modal
          isOpen={isModalOpen}
          onClose={() => { setIsModalOpen(false); setEditingProduct(undefined); }}
          title={editingProduct ? 'Editar Produto' : 'Adicionar Novo Produto'}
          size="lg"
        >
          <ProductForm
            onSubmit={handleSubmitForm}
            initialData={editingProduct}
            onClose={() => { setIsModalOpen(false); setEditingProduct(undefined); }}
            allEquipment={equipment}
          />
        </Modal>
      )}

       <Modal
        isOpen={isDeleteConfirmOpen}
        onClose={() => { setIsDeleteConfirmOpen(false); setProductToDelete(null); }}
        title="Confirmar Exclusão de Produto"
      >
        <p className="text-sm text-gray-700">{deleteModalMessage}</p>
        <div className="mt-6 flex justify-end space-x-3">
          <Button variant="secondary" onClick={() => { setIsDeleteConfirmOpen(false); setProductToDelete(null); }}>
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

export default ProductRegistrationPage;
