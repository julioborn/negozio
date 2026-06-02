'use client';

import { Modal } from '@/components/ui/Modal';
import { ProductForm } from '@/components/products/ProductForm';
import { useProducts } from '@/hooks/useProducts';
import type { NewProductFormData } from '@/lib/validations/product';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  initialBarcode: string;
  establishmentId: string;
  onCreated: (barcode: string) => void;
}

export function NewProductModal({
  isOpen,
  onClose,
  initialBarcode,
  establishmentId,
  onCreated,
}: Props) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Nuevo producto" size="lg">
      <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
        El código <code className="font-mono font-medium">{initialBarcode}</code> no existe en
        tu catálogo. Completá los datos para crearlo.
      </p>
      <FormBody
        establishmentId={establishmentId}
        initialBarcode={initialBarcode}
        onCancel={onClose}
        onCreated={onCreated}
      />
    </Modal>
  );
}

// Componente interno que accede al hook de productos
interface FormBodyProps {
  establishmentId: string;
  initialBarcode: string;
  onCancel: () => void;
  onCreated: (barcode: string) => void;
}

function FormBody({ establishmentId, initialBarcode, onCancel, onCreated }: FormBodyProps) {
  const { createProduct } = useProducts(establishmentId);

  async function handleSave(data: NewProductFormData) {
    await createProduct(data);
    onCreated(data.barcode);
  }

  return (
    <ProductForm
      establishmentId={establishmentId}
      initialBarcode={initialBarcode}
      onSave={handleSave}
      onCancel={onCancel}
    />
  );
}
