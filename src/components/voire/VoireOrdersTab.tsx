// ============================================================================
// PERSONAL OS — VOIRE Orders & Sales Tab
// Authoritative commercial transactions, multi-item orders, and historical COGS snapshots.
// ============================================================================

import { useState } from 'react';
import { ShoppingCart, Plus, Trash2, Edit2, CheckCircle2, AlertTriangle, Eye, ArrowRight } from 'lucide-react';
import type {
  VoireOrder,
  VoireOrderItem,
  VoireProduct,
  VoireDrop,
  VoireMarketingCampaign,
  VoirePaymentStatus,
  VoireFulfillmentStatus,
} from '../../types/pillars';
import { dbPut, dbDelete, dbGetByIndex, STORES } from '../../services/db';
import { logEvent, notifyDataChange } from '../../hooks/useDatabase';
import { showToast } from '../Toast';
import { formatINR, formatDate } from '../../utils/helpers';

interface VoireOrdersTabProps {
  orders: VoireOrder[];
  orderItems: VoireOrderItem[];
  products: VoireProduct[];
  drops: VoireDrop[];
  campaigns: VoireMarketingCampaign[];
}

interface DraftLineItem {
  productId: string;
  quantity: number;
  unitPrice: number;
  unitCost: number;
}

export function VoireOrdersTab({ orders, orderItems, products, drops, campaigns }: VoireOrdersTabProps) {
  const [showModal, setShowModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<VoireOrder | null>(null);

  // Form states
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<VoirePaymentStatus>('PAID');
  const [fulfillmentStatus, setFulfillmentStatus] = useState<VoireFulfillmentStatus>('UNFULFILLED');
  const [shippingFee, setShippingFee] = useState<number | ''>(0);
  const [discountAmount, setDiscountAmount] = useState<number | ''>(0);
  const [shippingCostActual, setShippingCostActual] = useState<number | ''>('');
  const [dropId, setDropId] = useState('');
  const [attributedCampaignId, setAttributedCampaignId] = useState('');
  
  // Line items state
  const [lineItems, setLineItems] = useState<DraftLineItem[]>([]);

  const openCreateModal = () => {
    setSelectedOrder(null);
    setCustomerName('');
    setCustomerEmail('');
    setPaymentStatus('PAID');
    setFulfillmentStatus('UNFULFILLED');
    setShippingFee(0);
    setDiscountAmount(0);
    setShippingCostActual('');
    setDropId('');
    setAttributedCampaignId('');
    
    // Default 1 line item if products exist
    if (products.length > 0) {
      setLineItems([
        {
          productId: products[0].id,
          quantity: 1,
          unitPrice: products[0].retailPrice,
          unitCost: products[0].baseCost,
        },
      ]);
    } else {
      setLineItems([]);
    }
    setShowModal(true);
  };

  const handleProductSelect = (index: number, prodId: string) => {
    const product = products.find((p) => p.id === prodId);
    if (!product) return;
    const updated = [...lineItems];
    updated[index] = {
      productId: prodId,
      quantity: updated[index]?.quantity || 1,
      unitPrice: product.retailPrice,
      unitCost: product.baseCost,
    };
    setLineItems(updated);
  };

  const handleQuantityChange = (index: number, quantity: number) => {
    const updated = [...lineItems];
    updated[index].quantity = Math.max(1, quantity);
    setLineItems(updated);
  };

  const addLineItem = () => {
    if (products.length === 0) return;
    setLineItems([
      ...lineItems,
      {
        productId: products[0].id,
        quantity: 1,
        unitPrice: products[0].retailPrice,
        unitCost: products[0].baseCost,
      },
    ]);
  };

  const removeLineItem = (index: number) => {
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  // Subtotal calculated from items
  const subtotal = lineItems.reduce((acc, item) => acc + item.unitPrice * item.quantity, 0);
  const totalAmount = Math.max(0, subtotal - (Number(discountAmount) || 0) + (Number(shippingFee) || 0));

  const handleSaveOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lineItems.length === 0) {
      showToast('Order must contain at least one item', 'warning');
      return;
    }

    const now = new Date().toISOString();
    const orderId = `vo_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const orderNumber = `VR-${Date.now().toString().slice(-6)}`;

    // 1. Create and persist Order Items with historical snapshot
    const itemRecords: VoireOrderItem[] = lineItems.map((item, idx) => {
      const prod = products.find((p) => p.id === item.productId);
      return {
        id: `voi_${Date.now()}_${idx}_${Math.random().toString(36).substr(2, 5)}`,
        orderId,
        productId: item.productId,
        productName: prod ? prod.name : 'Unknown Product',
        productSku: prod ? prod.sku : 'SKU-NONE',
        quantity: item.quantity,
        unitPriceAtSale: item.unitPrice,
        unitProductionCostAtSale: item.unitCost, // Snapshot invariant!
        totalPrice: item.unitPrice * item.quantity,
      };
    });

    for (const itemRecord of itemRecords) {
      await dbPut(STORES.VOIRE_ORDER_ITEMS, itemRecord);
    }

    // 2. Create and persist Parent Order
    const orderRecord: VoireOrder = {
      id: orderId,
      orderNumber,
      customerName: customerName.trim() || undefined,
      customerEmail: customerEmail.trim() || undefined,
      orderDate: now,
      fulfillmentStatus,
      paymentStatus,
      paidAt: paymentStatus === 'PAID' ? now : undefined,
      subtotal,
      discountAmount: Number(discountAmount) || 0,
      shippingFee: Number(shippingFee) || 0,
      shippingCostActual: typeof shippingCostActual === 'number' ? shippingCostActual : undefined,
      totalAmount,
      refundAmount: 0,
      dropId: dropId || undefined,
      attributedCampaignId: attributedCampaignId || undefined,
      createdAt: now,
      updatedAt: now,
    };

    await dbPut(STORES.VOIRE_ORDERS, orderRecord);

    // 3. Emit Activity Event
    await logEvent({
      pillarId: 'voire',
      eventType: 'VOIRE_ORDER_RECORDED',
      quantity: lineItems.length,
      unit: 'items',
      entityRef: {
        type: 'VoireOrder',
        id: orderId,
      },
      metadata: {
        orderNumber,
        totalAmount,
        paymentStatus,
        itemCount: lineItems.length,
        attributedCampaignId,
      },
    });

    notifyDataChange(STORES.VOIRE_ORDERS);
    notifyDataChange(STORES.VOIRE_ORDER_ITEMS);
    showToast(`Order #${orderNumber} recorded`, 'success');
    setShowModal(false);
  };

  const handleUpdatePaymentStatus = async (order: VoireOrder, newStatus: VoirePaymentStatus) => {
    const now = new Date().toISOString();
    const updatedOrder: VoireOrder = {
      ...order,
      paymentStatus: newStatus,
      paidAt: newStatus === 'PAID' && !order.paidAt ? now : order.paidAt,
      refundAmount: newStatus === 'REFUNDED' ? order.totalAmount : order.refundAmount,
      updatedAt: now,
    };

    await dbPut(STORES.VOIRE_ORDERS, updatedOrder);

    await logEvent({
      pillarId: 'voire',
      eventType: 'VOIRE_PAYMENT_STATUS_UPDATED',
      entityRef: {
        type: 'VoireOrder',
        id: order.id,
      },
      metadata: { orderNumber: order.orderNumber, oldStatus: order.paymentStatus, newStatus },
    });

    notifyDataChange(STORES.VOIRE_ORDERS);
    showToast(`Order #${order.orderNumber} updated to ${newStatus}`, 'info');
  };

  const handleDeleteOrder = async (order: VoireOrder) => {
    if (!window.confirm(`Delete order #${order.orderNumber}?`)) return;
    
    // Remove order items
    const relatedItems = orderItems.filter((item) => item.orderId === order.id);
    for (const item of relatedItems) {
      await dbDelete(STORES.VOIRE_ORDER_ITEMS, item.id);
    }
    await dbDelete(STORES.VOIRE_ORDERS, order.id);

    notifyDataChange(STORES.VOIRE_ORDERS);
    notifyDataChange(STORES.VOIRE_ORDER_ITEMS);
    showToast(`Order #${order.orderNumber} deleted`, 'info');
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f9fafb', margin: 0 }}>Orders & Transactions</h2>
          <p style={{ fontSize: '0.875rem', color: '#9ca3af', margin: '0.25rem 0 0 0' }}>
            Bottom-up commercial sales reality, multi-product line items, and payment reconciliation.
          </p>
        </div>
        <button className="voire-btn-primary" onClick={openCreateModal} disabled={products.length === 0}>
          <Plus size={16} /> Record Order
        </button>
      </div>

      {products.length === 0 && (
        <div style={{ padding: '0.75rem 1rem', background: 'rgba(234, 179, 8, 0.1)', border: '1px solid rgba(234, 179, 8, 0.3)', borderRadius: '0.5rem', color: '#fde047', fontSize: '0.875rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <AlertTriangle size={16} /> Add at least one product in the Products tab before recording orders.
        </div>
      )}

      {orders.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem 1rem', background: 'rgba(255,255,255,0.02)', borderRadius: '0.75rem', border: '1px dashed rgba(255,255,255,0.1)' }}>
          <ShoppingCart size={40} style={{ color: '#a855f7', opacity: 0.6, margin: '0 auto 1rem' }} />
          <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: '#f3f4f6', marginBottom: '0.5rem' }}>No Orders Recorded</h3>
          <p style={{ fontSize: '0.875rem', color: '#9ca3af', maxWidth: '24rem', margin: '0 auto 1.5rem' }}>
            Record customer orders with multi-item line items. Historical unit costs are preserved automatically.
          </p>
          <button className="voire-btn-primary" onClick={openCreateModal} disabled={products.length === 0}>
            <Plus size={16} /> Record First Order
          </button>
        </div>
      ) : (
        <div className="voire-table-wrapper">
          <table className="voire-table">
            <thead>
              <tr>
                <th>Order #</th>
                <th>Date</th>
                <th>Items</th>
                <th>Total Value</th>
                <th>Payment</th>
                <th>Fulfillment</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => {
                const itemsForThisOrder = orderItems.filter((it) => it.orderId === order.id);
                return (
                  <tr key={order.id}>
                    <td>
                      <div style={{ fontWeight: 600, color: '#ffffff', fontFamily: 'monospace' }}>{order.orderNumber}</div>
                      {order.customerName && <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{order.customerName}</div>}
                    </td>
                    <td style={{ fontSize: '0.8125rem', color: '#9ca3af' }}>{formatDate(order.orderDate)}</td>
                    <td>
                      <div style={{ fontSize: '0.8125rem', color: '#e5e7eb' }}>
                        {itemsForThisOrder.length > 0
                          ? itemsForThisOrder.map((i) => `${i.quantity}x ${i.productSku}`).join(', ')
                          : 'No items recorded'}
                      </div>
                    </td>
                    <td style={{ fontWeight: 700, color: '#34d399' }}>{formatINR(order.totalAmount)}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                        <span className={`voire-badge ${order.paymentStatus.toLowerCase().replace(/_/g, '-')}`}>
                          {order.paymentStatus}
                        </span>
                        {order.paymentStatus === 'PENDING' && (
                          <button
                            className="voire-btn-secondary"
                            style={{ padding: '0.125rem 0.375rem', fontSize: '0.6875rem' }}
                            onClick={() => handleUpdatePaymentStatus(order, 'PAID')}
                            title="Mark as Paid (Realized Cash)"
                          >
                            Mark Paid
                          </button>
                        )}
                      </div>
                    </td>
                    <td>
                      <span className={`voire-badge ${order.fulfillmentStatus.toLowerCase().replace(/_/g, '-')}`}>
                        {order.fulfillmentStatus}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button className="voire-btn-danger" onClick={() => handleDeleteOrder(order)}>
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
          <div className="voire-modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '42rem' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f9fafb', marginBottom: '1.25rem' }}>
              Record Customer Order
            </h3>
            <form onSubmit={handleSaveOrder}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="voire-form-group">
                  <label className="voire-form-label">Customer Name</label>
                  <input
                    type="text"
                    className="voire-form-input"
                    placeholder="e.g. Rahul Sharma"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                  />
                </div>
                <div className="voire-form-group">
                  <label className="voire-form-label">Customer Email</label>
                  <input
                    type="email"
                    className="voire-form-input"
                    placeholder="e.g. rahul@example.com"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ margin: '1rem 0', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <label className="voire-form-label" style={{ margin: 0 }}>Order Items (Line Items) *</label>
                  <button type="button" className="voire-btn-secondary" style={{ padding: '0.25rem 0.625rem', fontSize: '0.75rem' }} onClick={addLineItem}>
                    <Plus size={12} /> Add Item
                  </button>
                </div>

                {lineItems.map((item, idx) => (
                  <div key={idx} className="voire-order-item-row">
                    <select
                      className="voire-form-select"
                      value={item.productId}
                      onChange={(e) => handleProductSelect(idx, e.target.value)}
                    >
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.sku}) — {formatINR(p.retailPrice)}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min={1}
                      className="voire-form-input"
                      placeholder="Qty"
                      value={item.quantity}
                      onChange={(e) => handleQuantityChange(idx, Number(e.target.value))}
                    />
                    <div style={{ fontSize: '0.8125rem', color: '#9ca3af', textAlign: 'center' }}>
                      Unit: {formatINR(item.unitPrice)}
                    </div>
                    <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#34d399', textAlign: 'right' }}>
                      {formatINR(item.unitPrice * item.quantity)}
                    </div>
                    {lineItems.length > 1 && (
                      <button type="button" className="voire-btn-danger" onClick={() => removeLineItem(idx)}>
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', marginTop: '1rem' }}>
                <div className="voire-form-group">
                  <label className="voire-form-label">Discount (₹)</label>
                  <input
                    type="number"
                    className="voire-form-input"
                    value={discountAmount}
                    onChange={(e) => setDiscountAmount(e.target.value === '' ? '' : Number(e.target.value))}
                  />
                </div>
                <div className="voire-form-group">
                  <label className="voire-form-label">Shipping Charged (₹)</label>
                  <input
                    type="number"
                    className="voire-form-input"
                    value={shippingFee}
                    onChange={(e) => setShippingFee(e.target.value === '' ? '' : Number(e.target.value))}
                  />
                </div>
                <div className="voire-form-group">
                  <label className="voire-form-label">Actual Shipping Cost (₹)</label>
                  <input
                    type="number"
                    className="voire-form-input"
                    placeholder="e.g. 100"
                    value={shippingCostActual}
                    onChange={(e) => setShippingCostActual(e.target.value === '' ? '' : Number(e.target.value))}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="voire-form-group">
                  <label className="voire-form-label">Payment Status</label>
                  <select
                    className="voire-form-select"
                    value={paymentStatus}
                    onChange={(e) => setPaymentStatus(e.target.value as VoirePaymentStatus)}
                  >
                    <option value="PAID">PAID (Cash Realized)</option>
                    <option value="PENDING">PENDING (Accounts Receivable)</option>
                    <option value="FAILED">FAILED</option>
                    <option value="REFUNDED">REFUNDED</option>
                  </select>
                </div>
                <div className="voire-form-group">
                  <label className="voire-form-label">Fulfillment Status</label>
                  <select
                    className="voire-form-select"
                    value={fulfillmentStatus}
                    onChange={(e) => setFulfillmentStatus(e.target.value as VoireFulfillmentStatus)}
                  >
                    <option value="UNFULFILLED">UNFULFILLED</option>
                    <option value="IN_PRODUCTION">IN PRODUCTION</option>
                    <option value="SHIPPED">SHIPPED</option>
                    <option value="DELIVERED">DELIVERED</option>
                    <option value="CANCELLED">CANCELLED</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="voire-form-group">
                  <label className="voire-form-label">Associated Drop</label>
                  <select
                    className="voire-form-select"
                    value={dropId}
                    onChange={(e) => setDropId(e.target.value)}
                  >
                    <option value="">None (Evergreen / Direct)</option>
                    {drops.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="voire-form-group">
                  <label className="voire-form-label">Attributed Ad Campaign</label>
                  <select
                    className="voire-form-select"
                    value={attributedCampaignId}
                    onChange={(e) => setAttributedCampaignId(e.target.value)}
                  >
                    <option value="">None (Organic / Direct)</option>
                    {campaigns.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.channel})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ background: 'rgba(168, 85, 247, 0.1)', border: '1px solid rgba(168, 85, 247, 0.2)', padding: '0.75rem 1rem', borderRadius: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
                <span style={{ fontSize: '0.875rem', color: '#d8b4fe', fontWeight: 600 }}>Total Order Value:</span>
                <span style={{ fontSize: '1.25rem', color: '#ffffff', fontWeight: 700 }}>{formatINR(totalAmount)}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button type="button" className="voire-btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="voire-btn-primary">
                  Save Order
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
