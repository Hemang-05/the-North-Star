// ============================================================================
// PERSONAL OS — VOIRE Products & Catalog Tab
// Commercial SKUs, retail pricing, base unit costs, and inventory.
// ============================================================================

import { useState } from 'react';
import { Package, Plus, Trash2, Edit2, Tag } from 'lucide-react';
import type { VoireProduct, VoireProductCategory, VoireProductStatus, VoireDesign } from '../../types/pillars';
import { dbPut, dbDelete, STORES } from '../../services/db';
import { logEvent, notifyDataChange } from '../../hooks/useDatabase';
import { showToast } from '../Toast';
import { formatINR } from '../../utils/helpers';

interface VoireProductsTabProps {
  products: VoireProduct[];
  designs: VoireDesign[];
}

export function VoireProductsTab({ products, designs }: VoireProductsTabProps) {
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<VoireProduct | null>(null);

  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [category, setCategory] = useState<VoireProductCategory>('HOODIE');
  const [status, setStatus] = useState<VoireProductStatus>('ACTIVE');
  const [retailPrice, setRetailPrice] = useState<number | ''>('');
  const [baseCost, setBaseCost] = useState<number | ''>('');
  const [shippingCostEst, setShippingCostEst] = useState<number | ''>('');
  const [inventoryCount, setInventoryCount] = useState<number | ''>('');
  const [designId, setDesignId] = useState('');

  const openCreateModal = () => {
    setEditingProduct(null);
    setName('');
    setSku('');
    setCategory('HOODIE');
    setStatus('ACTIVE');
    setRetailPrice('');
    setBaseCost('');
    setShippingCostEst('');
    setInventoryCount('');
    setDesignId('');
    setShowModal(true);
  };

  const openEditModal = (product: VoireProduct) => {
    setEditingProduct(product);
    setName(product.name);
    setSku(product.sku);
    setCategory(product.category);
    setStatus(product.status);
    setRetailPrice(product.retailPrice);
    setBaseCost(product.baseCost);
    setShippingCostEst(product.shippingCostEst || '');
    setInventoryCount(product.inventoryCount ?? '');
    setDesignId(product.designId || '');
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !sku.trim()) {
      showToast('Product name and SKU are required', 'warning');
      return;
    }
    if (typeof retailPrice !== 'number' || retailPrice < 0) {
      showToast('Valid retail price is required', 'warning');
      return;
    }
    if (typeof baseCost !== 'number' || baseCost < 0) {
      showToast('Valid base cost is required', 'warning');
      return;
    }

    const now = new Date().toISOString();
    const productId = editingProduct ? editingProduct.id : `vp_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

    const productRecord: VoireProduct = {
      id: productId,
      name: name.trim(),
      sku: sku.trim().toUpperCase(),
      category,
      status,
      retailPrice,
      baseCost,
      shippingCostEst: typeof shippingCostEst === 'number' ? shippingCostEst : undefined,
      inventoryCount: typeof inventoryCount === 'number' ? inventoryCount : undefined,
      designId: designId.trim() || undefined,
      createdAt: editingProduct ? editingProduct.createdAt : now,
      updatedAt: now,
    };

    await dbPut(STORES.VOIRE_PRODUCTS, productRecord);

    // Activity Event Emission
    await logEvent({
      pillarId: 'voire',
      eventType: editingProduct ? 'VOIRE_PRODUCT_UPDATED' : 'VOIRE_PRODUCT_CREATED',
      entityRef: {
        type: 'VoireProduct',
        id: productId,
      },
      metadata: { sku, retailPrice, baseCost, category, status, name },
    });

    notifyDataChange(STORES.VOIRE_PRODUCTS);
    showToast(editingProduct ? 'Product SKU updated' : 'Product SKU added', 'success');
    setShowModal(false);
  };

  const handleDelete = async (id: string, prodName: string) => {
    if (!window.confirm(`Delete product "${prodName}"?`)) return;
    await dbDelete(STORES.VOIRE_PRODUCTS, id);
    notifyDataChange(STORES.VOIRE_PRODUCTS);
    showToast('Product deleted', 'info');
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f9fafb', margin: 0 }}>Product Catalog & SKUs</h2>
          <p style={{ fontSize: '0.875rem', color: '#9ca3af', margin: '0.25rem 0 0 0' }}>
            Finished merchandise, unit economics baseline, and catalog readiness.
          </p>
        </div>
        <button className="voire-btn-primary" onClick={openCreateModal}>
          <Plus size={16} /> Add Product
        </button>
      </div>

      {products.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem 1rem', background: 'rgba(255,255,255,0.02)', borderRadius: '0.75rem', border: '1px dashed rgba(255,255,255,0.1)' }}>
          <Package size={40} style={{ color: '#a855f7', opacity: 0.6, margin: '0 auto 1rem' }} />
          <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: '#f3f4f6', marginBottom: '0.5rem' }}>No Products in Catalog</h3>
          <p style={{ fontSize: '0.875rem', color: '#9ca3af', maxWidth: '24rem', margin: '0 auto 1.5rem' }}>
            Convert sampled designs into commercially priced apparel SKUs with defined unit production costs.
          </p>
          <button className="voire-btn-primary" onClick={openCreateModal}>
            <Plus size={16} /> Add First Product
          </button>
        </div>
      ) : (
        <div className="voire-table-wrapper">
          <table className="voire-table">
            <thead>
              <tr>
                <th>SKU / Product</th>
                <th>Category</th>
                <th>Retail Price</th>
                <th>Base Unit Cost</th>
                <th>Gross Margin</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => {
                const margin = product.retailPrice > 0 ? ((product.retailPrice - product.baseCost) / product.retailPrice) * 100 : 0;
                return (
                  <tr key={product.id}>
                    <td>
                      <div style={{ fontWeight: 600, color: '#ffffff' }}>{product.name}</div>
                      <div style={{ fontSize: '0.75rem', color: '#a855f7', fontFamily: 'monospace' }}>{product.sku}</div>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.8125rem', color: '#d1d5db' }}>{product.category}</span>
                    </td>
                    <td style={{ fontWeight: 600, color: '#10b981' }}>{formatINR(product.retailPrice)}</td>
                    <td style={{ color: '#9ca3af' }}>{formatINR(product.baseCost)}</td>
                    <td>
                      <span style={{ fontWeight: 600, color: margin >= 50 ? '#34d399' : margin > 20 ? '#fbbf24' : '#f87171' }}>
                        {margin.toFixed(1)}%
                      </span>
                    </td>
                    <td>
                      <span className={`voire-badge ${product.status.toLowerCase()}`}>
                        {product.status}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button className="voire-btn-secondary" style={{ padding: '0.375rem 0.5rem' }} onClick={() => openEditModal(product)}>
                          <Edit2 size={14} />
                        </button>
                        <button className="voire-btn-danger" onClick={() => handleDelete(product.id, product.name)}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="voire-modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="voire-modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f9fafb', marginBottom: '1.25rem' }}>
              {editingProduct ? 'Edit Product SKU' : 'New Product SKU'}
            </h3>
            <form onSubmit={handleSave}>
              <div className="voire-form-group">
                <label className="voire-form-label">Product Name *</label>
                <input
                  type="text"
                  className="voire-form-input"
                  placeholder="e.g. Voidwalker Heavyweight Hoodie"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="voire-form-group">
                  <label className="voire-form-label">SKU Identifier *</label>
                  <input
                    type="text"
                    className="voire-form-input"
                    placeholder="e.g. VOI-HD-001-BLK"
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    required
                  />
                </div>

                <div className="voire-form-group">
                  <label className="voire-form-label">Category</label>
                  <select
                    className="voire-form-select"
                    value={category}
                    onChange={(e) => setCategory(e.target.value as VoireProductCategory)}
                  >
                    <option value="HOODIE">HOODIE</option>
                    <option value="TEE">TEE</option>
                    <option value="HEADWEAR">HEADWEAR</option>
                    <option value="ACCESSORY">ACCESSORY</option>
                    <option value="PRINT">PRINT</option>
                    <option value="OTHER">OTHER</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="voire-form-group">
                  <label className="voire-form-label">Retail Selling Price (₹) *</label>
                  <input
                    type="number"
                    className="voire-form-input"
                    placeholder="e.g. 2499"
                    value={retailPrice}
                    onChange={(e) => setRetailPrice(e.target.value === '' ? '' : Number(e.target.value))}
                    required
                  />
                </div>

                <div className="voire-form-group">
                  <label className="voire-form-label">Base Unit Production Cost (₹) *</label>
                  <input
                    type="number"
                    className="voire-form-input"
                    placeholder="e.g. 750"
                    value={baseCost}
                    onChange={(e) => setBaseCost(e.target.value === '' ? '' : Number(e.target.value))}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="voire-form-group">
                  <label className="voire-form-label">Est. Shipping Per Unit (₹)</label>
                  <input
                    type="number"
                    className="voire-form-input"
                    placeholder="e.g. 100"
                    value={shippingCostEst}
                    onChange={(e) => setShippingCostEst(e.target.value === '' ? '' : Number(e.target.value))}
                  />
                </div>

                <div className="voire-form-group">
                  <label className="voire-form-label">Stock Units (Optional)</label>
                  <input
                    type="number"
                    className="voire-form-input"
                    placeholder="e.g. 50 (or leave blank for POD)"
                    value={inventoryCount}
                    onChange={(e) => setInventoryCount(e.target.value === '' ? '' : Number(e.target.value))}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="voire-form-group">
                  <label className="voire-form-label">Catalog Status</label>
                  <select
                    className="voire-form-select"
                    value={status}
                    onChange={(e) => setStatus(e.target.value as VoireProductStatus)}
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="DRAFT">DRAFT</option>
                    <option value="PAUSED">PAUSED</option>
                    <option value="ARCHIVED">ARCHIVED</option>
                  </select>
                </div>

                <div className="voire-form-group">
                  <label className="voire-form-label">Linked Design Concept</label>
                  <select
                    className="voire-form-select"
                    value={designId}
                    onChange={(e) => setDesignId(e.target.value)}
                  >
                    <option value="">None (Independent)</option>
                    {designs.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.status})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button type="button" className="voire-btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="voire-btn-primary">
                  {editingProduct ? 'Save Product' : 'Add to Catalog'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
