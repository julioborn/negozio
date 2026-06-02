'use client';

import { useState } from 'react';

import { Check, Loader2, Pencil, Plus, X } from 'lucide-react';

import { type CategoryFormData, useCategories } from '@/hooks/useCategories';
import { cn } from '@/lib/utils';

const PRESET_COLORS = [
  '#f59e0b','#3b82f6','#8b5cf6','#ef4444','#f97316',
  '#10b981','#06b6d4','#ec4899','#14b8a6','#84cc16',
  '#a855f7','#9ca3af',
];

export function CategoriesTab() {
  const { categories, isLoading, createCategory, updateCategory } = useCategories();
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#6366f1');
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    if (!newName.trim()) return;
    setCreating(true);
    setError(null);
    try {
      await createCategory({ name: newName.trim(), color: newColor });
      setNewName('');
      setNewColor('#6366f1');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear');
    }
    setCreating(false);
  }

  function startEdit(id: string, name: string, color: string) {
    setEditingId(id);
    setEditName(name);
    setEditColor(color ?? '#6366f1');
  }

  async function saveEdit() {
    if (!editingId || !editName.trim()) return;
    setSavingId(editingId);
    const data: CategoryFormData = { name: editName.trim(), color: editColor };
    await updateCategory(editingId, data);
    setSavingId(null);
    setEditingId(null);
  }

  return (
    <div className="flex flex-col gap-5 max-w-xl">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">{error}</div>
      )}

      {/* Formulario nueva categoría */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold text-slate-900">Nueva categoría</h3>
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            placeholder="Nombre de la categoría…"
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2.5 text-sm
                       focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {/* Selector de color */}
          <div className="relative">
            <input
              type="color"
              value={newColor}
              onChange={(e) => setNewColor(e.target.value)}
              className="h-10 w-10 cursor-pointer rounded-lg border border-slate-300 p-0.5"
              title="Color"
            />
          </div>
          <button
            onClick={handleCreate}
            disabled={creating || !newName.trim()}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2.5 text-sm
                       font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Agregar
          </button>
        </div>

        {/* Colores predefinidos */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {PRESET_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setNewColor(c)}
              className={cn(
                'h-6 w-6 rounded-full transition-transform hover:scale-110',
                newColor === c && 'ring-2 ring-blue-500 ring-offset-1'
              )}
              style={{ backgroundColor: c }}
              title={c}
            />
          ))}
        </div>
      </div>

      {/* Lista de categorías */}
      {isLoading ? (
        <div className="py-8 text-center text-sm text-slate-400">Cargando…</div>
      ) : (
        <div className="flex flex-col gap-2">
          {categories.map((cat) => (
            <div key={cat.id}
              className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
              <div
                className="h-4 w-4 shrink-0 rounded-full"
                style={{ backgroundColor: cat.color ?? '#6366f1' }}
              />

              {editingId === cat.id ? (
                <div className="flex flex-1 items-center gap-2">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && saveEdit()}
                    autoFocus
                    className="flex-1 rounded-lg border border-blue-400 px-2 py-1 text-sm
                               focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="color"
                    value={editColor}
                    onChange={(e) => setEditColor(e.target.value)}
                    className="h-8 w-8 cursor-pointer rounded border border-slate-300 p-0.5"
                  />
                  <button onClick={saveEdit} disabled={savingId === cat.id}
                    className="rounded-lg p-1.5 text-green-600 hover:bg-green-50">
                    {savingId === cat.id
                      ? <Loader2 className="h-4 w-4 animate-spin" />
                      : <Check className="h-4 w-4" />
                    }
                  </button>
                  <button onClick={() => setEditingId(null)}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <>
                  <span className="flex-1 text-sm font-medium text-slate-900">{cat.name}</span>
                  <button
                    onClick={() => startEdit(cat.id, cat.name, cat.color ?? '#6366f1')}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
