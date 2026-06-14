import { CheckCircle2, Plus, RotateCcw, Save, Trash2, Upload, XCircle } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '../common/Button';
import { FormField } from '../common/FormField';
import { apiRequest, getRowsFromPayload } from '../../services/apiClient';

const emptyOrderLine = { product_id: '', ordered_qty: '1', unit_price: '', progress_qty: '0' };
const emptyComponentLine = { component_product_id: '', to_consume_qty: '1', consumed_qty: '0', unit: 'Units' };
const emptyOperationLine = { operation_name: '', work_center_id: '', expected_duration_minutes: '0', real_duration_minutes: '', sequence_no: '' };

function toApiDateTime(value) {
  if (!value) return null;
  return new Date(value).toISOString();
}

function getOptionLabel(option) {
  return option.name || option.full_name || option.reference || `#${option.id}`;
}

function selectClasses() {
  return 'w-full h-10 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-800 outline-none transition focus:border-enterprise-blue focus:ring-2 focus:ring-blue-100';
}

function numberOrUndefined(value) {
  if (value === '' || value === null || value === undefined) return undefined;
  return Number(value);
}

function normalizeApiErrors(apiErrors) {
  if (!Array.isArray(apiErrors)) return apiErrors || {};

  return apiErrors.reduce((nextErrors, issue) => {
    const path = String(issue.path || '').replace(/^body\./, '');
    if (path) nextErrors[path] = issue.message;
    return nextErrors;
  }, {});
}

function FormShell({ children, config, message, onBack, onCancel, onConfirm, saving, selectedRecord, titleExtra = '', footer, titleOverride }) {
  const isEdit = Boolean(selectedRecord);
  const statusColors = {
    Draft: 'bg-slate-100 text-slate-700 border-slate-200',
    Confirmed: 'bg-blue-50 text-blue-700 border-blue-200',
    'In Progress': 'bg-amber-50 text-amber-700 border-amber-200',
    Done: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    'Partially Delivered': 'bg-sky-50 text-sky-700 border-sky-200',
    'Fully Delivered': 'bg-emerald-50 text-emerald-700 border-emerald-200',
    'Partially Received': 'bg-sky-50 text-sky-700 border-sky-200',
    'Fully Received': 'bg-emerald-50 text-emerald-700 border-emerald-200',
    Cancelled: 'bg-rose-50 text-rose-700 border-rose-200',
  };

  const statusClass = selectedRecord?.status ? (statusColors[selectedRecord.status] || 'bg-slate-50 text-slate-600') : '';
  const bodyRef = useRef(null);

  useEffect(() => {
    if (message && bodyRef.current) {
      bodyRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [message]);

  const isError = /failed|error|permission|unauthorized|not authorized|could not|cannot/i.test(message || '');

  return (
    <div className="flex flex-col h-full bg-slate-50 text-left">
      {/* Sticky Header */}
      <header className="sticky top-0 bg-white border-b border-slate-200 z-10 px-6 py-4 flex items-center justify-between shadow-xs">
        <div className="grid gap-0.5">
          <h2 className="text-lg font-black text-slate-900 tracking-tight">
            {titleOverride || (isEdit ? `View & Edit ${config.title.replace(/s$/, '')}` : `New ${config.title.replace(/s$/, '')}`)}
            {titleExtra}
          </h2>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            {selectedRecord?.reference && (
              <span className="font-extrabold text-xs text-slate-500 bg-slate-100 border border-slate-200 rounded px-1.5 py-0.5">
                {selectedRecord.reference}
              </span>
            )}
            {selectedRecord?.status && (
              <span className={`text-xs font-black border rounded px-1.5 py-0.5 ${statusClass}`}>
                {selectedRecord.status}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onConfirm && (
            <Button type="button" variant="ghost" disabled={saving || !selectedRecord?.id} onClick={onConfirm} className="h-9 text-xs font-extrabold gap-1.5">
              <CheckCircle2 size={15} />Confirm
            </Button>
          )}
          {onCancel && (
            <Button type="button" variant="subtle" disabled={saving || !selectedRecord?.id} onClick={onCancel} className="h-9 text-xs font-extrabold gap-1.5 text-rose-600 border-rose-200 bg-rose-50/50 hover:bg-rose-50">
              <XCircle size={15} />Cancel
            </Button>
          )}
          <button
            type="button"
            onClick={onBack}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-150 hover:text-slate-700 transition"
            title="Close Drawer"
          >
            <XCircle size={22} />
          </button>
        </div>
      </header>

      {/* Main scrollable body */}
      <main ref={bodyRef} className="flex-1 overflow-y-auto p-6 space-y-6">
        {message && (
          <div className={`rounded-xl border px-4 py-3 text-sm font-bold shadow-xs flex items-center gap-2 ${isError
              ? 'border-rose-200 bg-rose-50 text-rose-800'
              : 'border-blue-200 bg-blue-50 text-enterprise-blueDark'
            }`}>
            {isError ? <XCircle size={16} className="text-rose-600" /> : <CheckCircle2 size={16} className="text-enterprise-blue" />}
            {message}
          </div>
        )}
        {children}
      </main>

      {/* Sticky Footer */}
      {footer && (
        <footer className="sticky bottom-0 bg-white border-t border-slate-200 px-6 py-4 flex justify-end gap-3 z-10">
          {footer}
        </footer>
      )}
    </div>
  );
}

function LookupError({ message }) {
  if (!message) return null;

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
      {message}
    </div>
  );
}

function buildLookupPath(path, params = {}) {
  const query = new URLSearchParams({ limit: '200', ...params }).toString();
  return `/lookups/${path}?${query}`;
}

async function fetchLookup(path, targetKey, dataKey, params) {
  const payload = await apiRequest(buildLookupPath(path, params));
  return [targetKey, getRowsFromPayload(payload, dataKey)];
}

function collectLookupResults(results, initialLookups) {
  const nextLookups = { ...initialLookups };
  const errors = [];

  for (const result of results) {
    if (result.status === 'fulfilled') {
      const [key, rows] = result.value;
      nextLookups[key] = rows;
    } else {
      errors.push(result.reason?.message || 'Could not load a lookup field');
    }
  }

  return {
    errors,
    lookups: nextLookups
  };
}

function OrderEntryForm({ config, moduleKey, onCreated, selectedRecord: initialSelectedRecord, onClose, user }) {
  const isSales = moduleKey === 'sales';
  const partyKey = isSales ? 'customer_id' : 'vendor_id';
  const addressKey = isSales ? 'customer_address' : 'vendor_address';
  const ownerKey = isSales ? 'sales_person_id' : 'responsible_user_id';
  const unitPriceKey = isSales ? 'sales_unit_price' : 'cost_price';
  const progressLabel = isSales ? 'Delivered Quantity' : 'Received Quantity';
  const partyLabel = isSales ? 'Customer' : 'Vendor';
  const addressLabel = isSales ? 'Customer Address' : 'Vendor Address';
  const ownerLabel = isSales ? 'Sales Person' : 'Responsible Person';
  const priceLabel = isSales ? 'Sales Unit Price' : 'Cost Unit Price';

  const initialForm = {
    [partyKey]: '',
    [addressKey]: '',
    [ownerKey]: '',
    scheduled_date: '',
    source_sales_order_id: '',
    status: '',
    items: [{ ...emptyOrderLine }]
  };

  const [form, setForm] = useState(initialForm);
  const [lookups, setLookups] = useState({ parties: [], users: [], products: [], salesOrders: [] });
  const [lookupError, setLookupError] = useState('');
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [selectedRecord, setSelectedRecord] = useState(initialSelectedRecord || null);

  useEffect(() => {
    setSelectedRecord(initialSelectedRecord || null);
  }, [initialSelectedRecord]);

  useEffect(() => {
    let cancelled = false;
    setLookupError('');

    const requests = [
      fetchLookup(isSales ? 'customers' : 'vendors', 'parties', isSales ? 'customers' : 'vendors'),
      fetchLookup('users', 'users', 'users'),
      fetchLookup('products', 'products', 'products')
    ];

    if (!isSales) {
      requests.push(fetchLookup('sales-orders', 'salesOrders', 'sales_orders'));
    }

    Promise.allSettled(requests)
      .then((results) => {
        if (cancelled) return;
        const { errors: lookupErrors, lookups: nextLookups } = collectLookupResults(
          results,
          { parties: [], users: [], products: [], salesOrders: [] }
        );
        setLookups(nextLookups);
        setLookupError(lookupErrors.join(' '));
      });

    return () => {
      cancelled = true;
    };
  }, [isSales]);

  useEffect(() => {
    if (selectedRecord) {
      setForm({
        [partyKey]: selectedRecord[partyKey] || '',
        [addressKey]: selectedRecord[addressKey] || '',
        [ownerKey]: selectedRecord[ownerKey] || '',
        scheduled_date: selectedRecord.scheduled_date ? new Date(selectedRecord.scheduled_date).toISOString().slice(0, 16) : '',
        source_sales_order_id: selectedRecord.source_sales_order_id || '',
        status: selectedRecord.status || '',
        items: selectedRecord.items?.length ? selectedRecord.items.map(item => ({
          product_id: item.product_id || '',
          ordered_qty: String(item.ordered_qty || '1'),
          unit_price: String(item.sales_unit_price || item.cost_price || ''),
          progress_qty: String(item.delivered_qty || item.received_qty || '0')
        })) : [{ ...emptyOrderLine }]
      });
    } else {
      setForm(initialForm);
    }
    setErrors({});
    setMessage('');
  }, [selectedRecord, isSales, partyKey, addressKey, ownerKey]);

  const isAdmin = user?.roles?.some(r => r === 'admin' || r.code === 'admin' || (typeof r === 'string' && r === 'admin'));
  const isReadOnly = selectedRecord && selectedRecord.status !== 'Draft' && !isAdmin;

  const total = useMemo(() => form.items.reduce((sum, item) => {
    const qty = Number(item.ordered_qty || 0);
    const price = Number(item.unit_price || 0);
    return sum + qty * price;
  }, 0), [form.items]);

  function updateField(key, value) {
    if (isReadOnly) return;
    setForm((current) => ({ ...current, [key]: value }));
    setMessage('');
  }

  function updateLine(index, key, value) {
    if (isReadOnly) return;
    setForm((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) => (
        itemIndex === index ? { ...item, [key]: value } : item
      ))
    }));
    setMessage('');
  }

  function resetForm() {
    setForm(initialForm);
    setErrors({});
    setMessage('');
    setSelectedRecord(null);
    if (onClose) onClose();
  }

  function validate() {
    const nextErrors = {};
    if (!form[partyKey]) nextErrors[partyKey] = `${partyLabel} is required`;
    if (!form[ownerKey]) nextErrors[ownerKey] = `${ownerLabel} is required`;

    form.items.forEach((item, index) => {
      if (!item.product_id) nextErrors[`items.${index}.product_id`] = 'Product is required';
      if (!Number(item.ordered_qty || 0)) nextErrors[`items.${index}.ordered_qty`] = 'Quantity must be greater than 0';
      if (item.unit_price !== '' && Number(item.unit_price) < 0) nextErrors[`items.${index}.unit_price`] = 'Price cannot be negative';
      if (Number(item.progress_qty || 0) < 0) nextErrors[`items.${index}.progress_qty`] = 'Quantity cannot be negative';
    });

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (isReadOnly) return;
    setMessage('');
    if (!validate()) return;

    const payload = {
      [partyKey]: Number(form[partyKey]),
      [addressKey]: form[addressKey].trim() || null,
      [ownerKey]: Number(form[ownerKey]),
      scheduled_date: toApiDateTime(form.scheduled_date),
      items: form.items.map((item) => ({
        product_id: Number(item.product_id),
        ordered_qty: Number(item.ordered_qty),
        [isSales ? 'delivered_qty' : 'received_qty']: Number(item.progress_qty || 0),
        [unitPriceKey]: numberOrUndefined(item.unit_price)
      }))
    };

    if (!isSales) {
      payload.source_sales_order_id = form.source_sales_order_id ? Number(form.source_sales_order_id) : null;
    }

    if (isAdmin && form.status) {
      payload.status = form.status;
    }

    setSaving(true);
    try {
      const method = selectedRecord ? 'PATCH' : 'POST';
      const url = selectedRecord ? `${config.endpoint}/${selectedRecord.id}` : config.endpoint;
      const response = await apiRequest(url, {
        method,
        body: JSON.stringify(payload)
      });
      const record = response.data?.[isSales ? 'sales_order' : 'purchase_order'];
      setSelectedRecord(record || null);
      setMessage(response.message || `${config.title.replace(/s$/, '')} saved successfully`);
      if (!selectedRecord) {
        setForm(initialForm);
      }
      setErrors({});
      onCreated?.();
    } catch (error) {
      setMessage(error.message || 'Could not save order');
      if (error.errors) setErrors(normalizeApiErrors(error.errors));
    } finally {
      setSaving(false);
    }
  }

  async function runLifecycle(action) {
    if (!selectedRecord?.id) return;
    setSaving(true);
    setMessage('');
    try {
      const response = await apiRequest(`${config.endpoint}/${selectedRecord.id}/${action}`, { method: 'POST' });
      const record = response.data?.[isSales ? 'sales_order' : 'purchase_order'];
      setSelectedRecord(record || selectedRecord);
      setMessage(response.message || `${config.title.replace(/s$/, '')} ${action}ed successfully`);
      onCreated?.();
    } catch (error) {
      setMessage(error.message || `Could not ${action} order`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col h-full overflow-hidden">
      <FormShell
        config={config}
        message={message}
        onBack={resetForm}
        onCancel={() => runLifecycle('cancel')}
        onConfirm={() => runLifecycle('confirm')}
        saving={saving}
        selectedRecord={selectedRecord}
        footer={
          !isReadOnly && (
            <div className="flex gap-2 w-full justify-end">
              <Button type="button" variant="subtle" onClick={resetForm}>Close</Button>
              <Button type="submit" disabled={saving} className="px-6">
                <Save size={16} />
                {saving ? 'Saving' : 'Save Changes'}
              </Button>
            </div>
          )
        }
      >
        <LookupError message={lookupError} />

        {/* Card 1: Order Details */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs grid gap-4">
          <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2">Order Details</h3>
          <div className="grid grid-cols-4 gap-4 max-xl:grid-cols-2 max-md:grid-cols-1">
            <FormField label={partyLabel} error={errors[partyKey]}>
              <select className={selectClasses()} value={form[partyKey]} onChange={(event) => updateField(partyKey, event.target.value)} disabled={isReadOnly}>
                <option value="">Select {partyLabel.toLowerCase()}</option>
                {lookups.parties.map((option) => (
                  <option key={option.id} value={option.id}>{getOptionLabel(option)}</option>
                ))}
              </select>
            </FormField>
            <FormField label={addressLabel} value={form[addressKey]} onChange={(value) => updateField(addressKey, value)} disabled={isReadOnly} />
            <FormField label={ownerLabel} error={errors[ownerKey]}>
              <select className={selectClasses()} value={form[ownerKey]} onChange={(event) => updateField(ownerKey, event.target.value)} disabled={isReadOnly}>
                <option value="">Select user</option>
                {lookups.users.map((option) => (
                  <option key={option.id} value={option.id}>{getOptionLabel(option)}</option>
                ))}
              </select>
            </FormField>
            <FormField label="Scheduled Date" type="datetime-local" value={form.scheduled_date} onChange={(value) => updateField('scheduled_date', value)} disabled={isReadOnly} />
            {!isSales && (
              <FormField label="Source Sales Order">
                <select className={selectClasses()} value={form.source_sales_order_id} onChange={(event) => updateField('source_sales_order_id', event.target.value)} disabled={isReadOnly}>
                  <option value="">None</option>
                  {lookups.salesOrders.map((option) => (
                    <option key={option.id} value={option.id}>{option.reference}</option>
                  ))}
                </select>
              </FormField>
            )}
            {isAdmin && (
              <FormField label="Status" error={errors.status}>
                <select className={selectClasses()} value={form.status} onChange={(event) => updateField('status', event.target.value)}>
                  <option value="">Select status</option>
                  {isSales ? (
                    <>
                      <option value="Draft">Draft</option>
                      <option value="Confirmed">Confirmed</option>
                      <option value="Partially Delivered">Partially Delivered</option>
                      <option value="Fully Delivered">Fully Delivered</option>
                      <option value="Cancelled">Cancelled</option>
                    </>
                  ) : (
                    <>
                      <option value="Draft">Draft</option>
                      <option value="Confirmed">Confirmed</option>
                      <option value="Partially Received">Partially Received</option>
                      <option value="Fully Received">Fully Received</option>
                      <option value="Cancelled">Cancelled</option>
                    </>
                  )}
                </select>
              </FormField>
            )}
          </div>
        </div>

        {/* Card 2: Products List */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs grid gap-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">Product Items</h3>
            {!isReadOnly && (
              <Button type="button" variant="ghost" onClick={() => setForm((current) => ({ ...current, items: [...current.items, { ...emptyOrderLine }] }))} className="h-8 text-xs">
                <Plus size={15} />Add Item
              </Button>
            )}
          </div>

          <div className="grid gap-3">
            {form.items.map((item, index) => (
              <div key={index} className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-3 rounded-lg border border-slate-150 p-3 bg-slate-50/50 max-lg:grid-cols-2 max-md:grid-cols-1 items-end">
                <FormField label="Product" error={errors[`items.${index}.product_id`]}>
                  <select
                    className={selectClasses()}
                    value={item.product_id}
                    onChange={(event) => {
                      const prodId = event.target.value;
                      const selectedProduct = lookups.products.find(p => Number(p.id) === Number(prodId));
                      const defaultPrice = selectedProduct ? (isSales ? selectedProduct.sales_price : selectedProduct.cost_price) : '';
                      setForm((current) => ({
                        ...current,
                        items: current.items.map((it, itemIndex) => (
                          itemIndex === index
                            ? {
                              ...it,
                              product_id: prodId,
                              unit_price: String(defaultPrice !== undefined && defaultPrice !== null ? defaultPrice : '')
                            }
                            : it
                        ))
                      }));
                      setMessage('');
                    }}
                    disabled={isReadOnly}
                  >
                    <option value="">Select product</option>
                    {lookups.products.map((option) => (
                      <option key={option.id} value={option.id}>{getOptionLabel(option)}</option>
                    ))}
                  </select>
                </FormField>
                <FormField label="Ordered Qty" type="number" value={item.ordered_qty} onChange={(value) => updateLine(index, 'ordered_qty', value)} error={errors[`items.${index}.ordered_qty`]} disabled={isReadOnly} />
                <FormField label={progressLabel} type="number" value={item.progress_qty} onChange={(value) => updateLine(index, 'progress_qty', value)} error={errors[`items.${index}.progress_qty`]} disabled={isReadOnly} />
                <FormField label={priceLabel} type="number" value={item.unit_price} onChange={(value) => updateLine(index, 'unit_price', value)} error={errors[`items.${index}.unit_price`]} disabled={isReadOnly} />
                <div>
                  <Button type="button" variant="subtle" className="h-10 px-3 border border-slate-200 text-rose-600 hover:bg-rose-50 hover:border-rose-200" disabled={isReadOnly || form.items.length === 1} onClick={() => setForm((current) => ({ ...current, items: current.items.filter((_, itemIndex) => itemIndex !== index) }))} title="Remove product">
                    <Trash2 size={16} />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end pt-2">
            {isSales ? (
              <div className="grid grid-cols-[140px_140px] gap-x-2 gap-y-1 text-right text-sm bg-slate-50 border border-slate-200 rounded-lg p-4">
                <span className="text-slate-500 font-bold">Subtotal:</span>
                <span className="text-slate-800 font-extrabold">{total.toFixed(2)}</span>

                <span className="text-slate-500 font-bold">GST (18%):</span>
                <span className="text-slate-800 font-extrabold">{(total * 0.18).toFixed(2)}</span>

                <span className="text-slate-700 font-black pt-1.5 border-t border-slate-200">Total (incl. GST):</span>
                <span className="text-enterprise-blue font-black pt-1.5 border-t border-slate-200 text-base">{(total * 1.18).toFixed(2)}</span>
              </div>
            ) : (
              <div className="rounded-lg bg-slate-100 border border-slate-200 px-4 py-2 text-sm font-black text-slate-800">
                Total Order Amount: {total.toFixed(2)}
              </div>
            )}
          </div>
        </div>
      </FormShell>
    </form>
  );
}

function ManufacturingOrderForm({ config, onCreated, selectedRecord: initialSelectedRecord, onClose, user }) {
  const initialForm = {
    finished_product_id: '',
    quantity: '1',
    unit: 'Units',
    schedule_date: '',
    assignee_id: '',
    bom_id: '',
    source_sales_order_id: '',
    status: '',
    components: [],
    work_orders: []
  };

  const [form, setForm] = useState(initialForm);
  const [lookups, setLookups] = useState({ products: [], users: [], boms: [], salesOrders: [], workCenters: [] });
  const [lookupError, setLookupError] = useState('');
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [selectedRecord, setSelectedRecord] = useState(initialSelectedRecord || null);

  useEffect(() => {
    setSelectedRecord(initialSelectedRecord || null);
  }, [initialSelectedRecord]);

  useEffect(() => {
    let cancelled = false;
    setLookupError('');

    Promise.allSettled([
      fetchLookup('products', 'products', 'products'),
      fetchLookup('users', 'users', 'users'),
      fetchLookup('boms', 'boms', 'boms'),
      fetchLookup('sales-orders', 'salesOrders', 'sales_orders'),
      fetchLookup('work-centers', 'workCenters', 'work_centers')
    ])
      .then((results) => {
        if (cancelled) return;
        const { errors: lookupErrors, lookups: nextLookups } = collectLookupResults(
          results,
          { products: [], users: [], boms: [], salesOrders: [], workCenters: [] }
        );
        setLookups(nextLookups);
        setLookupError(lookupErrors.join(' '));
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (selectedRecord) {
      setForm({
        finished_product_id: selectedRecord.finished_product_id || '',
        quantity: String(selectedRecord.quantity || '1'),
        unit: selectedRecord.unit || 'Units',
        schedule_date: selectedRecord.schedule_date ? new Date(selectedRecord.schedule_date).toISOString().slice(0, 16) : '',
        assignee_id: selectedRecord.assignee_id || '',
        bom_id: selectedRecord.bom_id || '',
        source_sales_order_id: selectedRecord.source_sales_order_id || '',
        status: selectedRecord.status || '',
        components: selectedRecord.components?.length ? selectedRecord.components.map(c => ({
          component_product_id: c.component_product_id || '',
          to_consume_qty: String(c.to_consume_qty || '1'),
          consumed_qty: String(c.consumed_qty || '0'),
          unit: c.unit || 'Units'
        })) : [],
        work_orders: selectedRecord.work_orders?.length ? selectedRecord.work_orders.map(w => ({
          operation_name: w.operation_name || '',
          work_center_id: w.work_center_id || '',
          expected_duration_minutes: String(w.expected_duration_minutes || '0'),
          real_duration_minutes: w.real_duration_minutes !== null ? String(w.real_duration_minutes) : '',
          sequence_no: String(w.sequence_no || '')
        })) : []
      });
    } else {
      setForm(initialForm);
    }
    setErrors({});
    setMessage('');
  }, [selectedRecord]);

  const isAdmin = user?.roles?.some(r => r === 'admin' || r.code === 'admin' || (typeof r === 'string' && r === 'admin'));
  const isReadOnly = selectedRecord && !['Draft', 'Confirmed', 'In Progress'].includes(selectedRecord.status) && !isAdmin;

  function updateField(key, value) {
    if (isReadOnly) return;
    setForm((current) => ({ ...current, [key]: value }));
    setMessage('');
  }

  // When BoM changes, automatically pull components and operations from BoM details!
  useEffect(() => {
    if (!form.bom_id || selectedRecord) return;

    apiRequest(`/boms/${form.bom_id}`)
      .then((res) => {
        const bom = res.data?.bom;
        if (!bom) return;

        setForm((current) => ({
          ...current,
          components: bom.components?.map(c => ({
            component_product_id: c.component_product_id || '',
            to_consume_qty: String(c.to_consume_qty || '1'),
            consumed_qty: '0',
            unit: c.unit || 'Units'
          })) || [],
          work_orders: bom.operations?.map(o => ({
            operation_name: o.operation_name || '',
            work_center_id: o.work_center_id || '',
            expected_duration_minutes: String(o.expected_duration_minutes || '0'),
            real_duration_minutes: '',
            sequence_no: String(o.sequence_no || '')
          })) || []
        }));
      })
      .catch((err) => console.error("Could not fetch BoM details", err));
  }, [form.bom_id, selectedRecord]);

  function updateList(listKey, index, key, value) {
    if (isReadOnly) return;
    setForm((current) => ({
      ...current,
      [listKey]: current[listKey].map((item, itemIndex) => (
        itemIndex === index ? { ...item, [key]: value } : item
      ))
    }));
    setMessage('');
  }

  function resetForm() {
    setForm(initialForm);
    setErrors({});
    setMessage('');
    setSelectedRecord(null);
    if (onClose) onClose();
  }

  function validate() {
    const nextErrors = {};
    if (!form.finished_product_id) nextErrors.finished_product_id = 'Finished product is required';
    if (!Number(form.quantity || 0)) nextErrors.quantity = 'Quantity must be greater than 0';

    form.components.forEach((component, index) => {
      if (!component.component_product_id) nextErrors[`components.${index}.component_product_id`] = 'Component is required';
      if (Number(component.to_consume_qty || 0) < 0) nextErrors[`components.${index}.to_consume_qty`] = 'Quantity cannot be negative';
      if (Number(component.consumed_qty || 0) < 0) nextErrors[`components.${index}.consumed_qty`] = 'Quantity cannot be negative';
    });

    form.work_orders.forEach((workOrder, index) => {
      if (!workOrder.operation_name.trim()) nextErrors[`work_orders.${index}.operation_name`] = 'Operation is required';
      if (!workOrder.work_center_id) nextErrors[`work_orders.${index}.work_center_id`] = 'Work center is required';
    });

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (isReadOnly) return;
    setMessage('');
    if (!validate()) return;

    const payload = {
      finished_product_id: Number(form.finished_product_id),
      quantity: Number(form.quantity),
      unit: form.unit.trim() || 'Units',
      schedule_date: toApiDateTime(form.schedule_date),
      assignee_id: form.assignee_id ? Number(form.assignee_id) : null,
      bom_id: form.bom_id ? Number(form.bom_id) : null,
      source_sales_order_id: form.source_sales_order_id ? Number(form.source_sales_order_id) : null
    };

    if (isAdmin && form.status) {
      payload.status = form.status;
    }

    if (form.components.length) {
      payload.components = form.components.map((component) => ({
        component_product_id: Number(component.component_product_id),
        to_consume_qty: Number(component.to_consume_qty || 0),
        consumed_qty: Number(component.consumed_qty || 0),
        unit: component.unit.trim() || 'Units'
      }));
    }

    if (form.work_orders.length) {
      payload.work_orders = form.work_orders.map((workOrder, index) => ({
        operation_name: workOrder.operation_name.trim(),
        work_center_id: Number(workOrder.work_center_id),
        expected_duration_minutes: Number(workOrder.expected_duration_minutes || 0),
        real_duration_minutes: numberOrUndefined(workOrder.real_duration_minutes),
        sequence_no: numberOrUndefined(workOrder.sequence_no) || index + 1
      }));
    }

    setSaving(true);
    try {
      const method = selectedRecord ? 'PATCH' : 'POST';
      const url = selectedRecord ? `${config.endpoint}/${selectedRecord.id}` : config.endpoint;
      const response = await apiRequest(url, {
        method,
        body: JSON.stringify(payload)
      });
      const record = response.data?.manufacturing_order;
      setSelectedRecord(record || null);
      if (!selectedRecord) {
        setForm(initialForm);
      }
      setErrors({});
      setMessage(response.message || 'Manufacturing Order saved successfully');
      onCreated?.();
    } catch (error) {
      setMessage(error.message || 'Could not save manufacturing order');
      if (error.errors) setErrors(normalizeApiErrors(error.errors));
    } finally {
      setSaving(false);
    }
  }

  async function runLifecycle(action) {
    if (!selectedRecord?.id) return;
    setSaving(true);
    setMessage('');
    try {
      const response = await apiRequest(`${config.endpoint}/${selectedRecord.id}/${action}`, { method: 'POST' });
      setSelectedRecord(response.data?.manufacturing_order || selectedRecord);
      setMessage(response.message || `Manufacturing Order ${action}ed successfully`);
      onCreated?.();
    } catch (error) {
      setMessage(error.message || `Could not ${action} manufacturing order`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col h-full overflow-hidden">
      <FormShell
        config={config}
        message={message}
        onBack={resetForm}
        onCancel={() => runLifecycle('cancel')}
        onConfirm={() => runLifecycle('confirm')}
        saving={saving}
        selectedRecord={selectedRecord}
        footer={
          !isReadOnly && (
            <div className="flex gap-2 w-full justify-end">
              <Button type="button" variant="subtle" onClick={resetForm}>Close</Button>
              <Button type="submit" disabled={saving} className="px-6">
                <Save size={16} />
                {saving ? 'Saving' : 'Save Changes'}
              </Button>
            </div>
          )
        }
      >
        <LookupError message={lookupError} />

        {/* Card 1: Production Details */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs grid gap-4">
          <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2">Production Details</h3>
          <div className="grid grid-cols-4 gap-4 max-xl:grid-cols-2 max-md:grid-cols-1">
            <FormField label="Finished Product" error={errors.finished_product_id}>
              <select className={selectClasses()} value={form.finished_product_id} onChange={(event) => updateField('finished_product_id', event.target.value)} disabled={isReadOnly}>
                <option value="">Select product</option>
                {lookups.products.map((option) => (
                  <option key={option.id} value={option.id}>{getOptionLabel(option)}</option>
                ))}
              </select>
            </FormField>
            <FormField label="Quantity" type="number" value={form.quantity} onChange={(value) => updateField('quantity', value)} error={errors.quantity} disabled={isReadOnly} />
            <FormField label="Unit" value={form.unit} onChange={(value) => updateField('unit', value)} disabled={isReadOnly} />
            <FormField label="Schedule Date" type="datetime-local" value={form.schedule_date} onChange={(value) => updateField('schedule_date', value)} disabled={isReadOnly} />
            <FormField label="Assignee">
              <select className={selectClasses()} value={form.assignee_id} onChange={(event) => updateField('assignee_id', event.target.value)} disabled={isReadOnly}>
                <option value="">None</option>
                {lookups.users.map((option) => (
                  <option key={option.id} value={option.id}>{getOptionLabel(option)}</option>
                ))}
              </select>
            </FormField>
            <FormField label="Bill of Materials">
              <select className={selectClasses()} value={form.bom_id} onChange={(event) => updateField('bom_id', event.target.value)} disabled={isReadOnly}>
                <option value="">Build manually</option>
                {lookups.boms.map((option) => (
                  <option key={option.id} value={option.id}>{option.reference} - {option.finished_product_name}</option>
                ))}
              </select>
            </FormField>
            <FormField label="Source Sales Order">
              <select className={selectClasses()} value={form.source_sales_order_id} onChange={(event) => updateField('source_sales_order_id', event.target.value)} disabled={isReadOnly}>
                <option value="">None</option>
                {lookups.salesOrders.map((option) => (
                  <option key={option.id} value={option.id}>{option.reference}</option>
                ))}
              </select>
            </FormField>
            {isAdmin && (
              <FormField label="Status" error={errors.status}>
                <select className={selectClasses()} value={form.status} onChange={(event) => updateField('status', event.target.value)}>
                  <option value="">Select status</option>
                  <option value="Draft">Draft</option>
                  <option value="Confirmed">Confirmed</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Done">Done</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
              </FormField>
            )}
          </div>
        </div>

        {/* Card 2: Components List */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs grid gap-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">Components</h3>
            {!isReadOnly && (
              <Button type="button" variant="ghost" onClick={() => setForm((current) => ({ ...current, components: [...current.components, { ...emptyComponentLine }] }))} className="h-8 text-xs">
                <Plus size={15} />Add Component
              </Button>
            )}
          </div>

          {form.components.length ? (
            <div className="grid gap-3">
              {form.components.map((component, index) => (
                <div key={index} className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-3 rounded-lg border border-slate-150 p-3 bg-slate-50/50 max-lg:grid-cols-2 max-md:grid-cols-1 items-end">
                  <FormField label="Component Product" error={errors[`components.${index}.component_product_id`]}>
                    <select className={selectClasses()} value={component.component_product_id} onChange={(event) => updateList('components', index, 'component_product_id', event.target.value)} disabled={isReadOnly}>
                      <option value="">Select product</option>
                      {lookups.products.map((option) => (
                        <option key={option.id} value={option.id}>{getOptionLabel(option)}</option>
                      ))}
                    </select>
                  </FormField>
                  <FormField label="To Consume" type="number" value={component.to_consume_qty} onChange={(value) => updateList('components', index, 'to_consume_qty', value)} error={errors[`components.${index}.to_consume_qty`]} disabled={isReadOnly} />
                  <FormField label="Consumed" type="number" value={component.consumed_qty} onChange={(value) => updateList('components', index, 'consumed_qty', value)} error={errors[`components.${index}.consumed_qty`]} disabled={isReadOnly} />
                  <FormField label="Unit" value={component.unit} onChange={(value) => updateList('components', index, 'unit', value)} disabled={isReadOnly} />
                  <div>
                    <Button type="button" variant="subtle" className="h-10 px-3 border border-slate-200 text-rose-600 hover:bg-rose-50 hover:border-rose-200" disabled={isReadOnly} onClick={() => setForm((current) => ({ ...current, components: current.components.filter((_, itemIndex) => itemIndex !== index) }))} title="Remove Component">
                      <Trash2 size={16} />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm font-semibold text-slate-400">
              No components configured.
            </div>
          )}
        </div>

        {/* Card 3: Work Orders */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs grid gap-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">Work Orders / Operations</h3>
            {!isReadOnly && (
              <Button type="button" variant="ghost" onClick={() => setForm((current) => ({ ...current, work_orders: [...current.work_orders, { ...emptyOperationLine }] }))} className="h-8 text-xs">
                <Plus size={15} />Add Work Order
              </Button>
            )}
          </div>

          {form.work_orders.length ? (
            <div className="grid gap-3">
              {form.work_orders.map((workOrder, index) => (
                <div key={index} className="grid grid-cols-[2fr_2fr_1fr_1fr_1fr_auto] gap-3 rounded-lg border border-slate-150 p-3 bg-slate-50/50 max-xl:grid-cols-3 max-md:grid-cols-1 items-end">
                  <FormField label="Operation" value={workOrder.operation_name} onChange={(value) => updateList('work_orders', index, 'operation_name', value)} error={errors[`work_orders.${index}.operation_name`]} disabled={isReadOnly} />
                  <FormField label="Work Center" error={errors[`work_orders.${index}.work_center_id`]}>
                    <select className={selectClasses()} value={workOrder.work_center_id} onChange={(event) => updateList('work_orders', index, 'work_center_id', event.target.value)} disabled={isReadOnly}>
                      <option value="">Select work center</option>
                      {lookups.workCenters.map((option) => (
                        <option key={option.id} value={option.id}>{getOptionLabel(option)}</option>
                      ))}
                    </select>
                  </FormField>
                  <FormField label="Expected Min" type="number" value={workOrder.expected_duration_minutes} onChange={(value) => updateList('work_orders', index, 'expected_duration_minutes', value)} disabled={isReadOnly} />
                  <FormField label="Real Min" type="number" value={workOrder.real_duration_minutes} onChange={(value) => updateList('work_orders', index, 'real_duration_minutes', value)} disabled={isReadOnly} />
                  <FormField label="Seq" type="number" value={workOrder.sequence_no} onChange={(value) => updateList('work_orders', index, 'sequence_no', value)} disabled={isReadOnly} />
                  <div>
                    <Button type="button" variant="subtle" className="h-10 px-3 border border-slate-200 text-rose-600 hover:bg-rose-50 hover:border-rose-200" disabled={isReadOnly} onClick={() => setForm((current) => ({ ...current, work_orders: current.work_orders.filter((_, itemIndex) => itemIndex !== index) }))} title="Remove Work Order">
                      <Trash2 size={16} />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm font-semibold text-slate-400">
              No work orders configured.
            </div>
          )}
        </div>
      </FormShell>
    </form>
  );
}

function BomForm({ config, onCreated, selectedRecord: initialSelectedRecord, onClose }) {
  const initialForm = {
    finished_product_id: '',
    quantity: '1',
    unit: 'Units',
    components: [],
    operations: []
  };

  const [form, setForm] = useState(initialForm);
  const [lookups, setLookups] = useState({ products: [], workCenters: [] });
  const [lookupError, setLookupError] = useState('');
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [selectedRecord, setSelectedRecord] = useState(initialSelectedRecord || null);

  useEffect(() => {
    setSelectedRecord(initialSelectedRecord || null);
  }, [initialSelectedRecord]);

  useEffect(() => {
    let cancelled = false;
    setLookupError('');

    Promise.allSettled([
      fetchLookup('products', 'products', 'products'),
      fetchLookup('work-centers', 'workCenters', 'work_centers')
    ])
      .then((results) => {
        if (cancelled) return;
        const { errors: lookupErrors, lookups: nextLookups } = collectLookupResults(
          results,
          { products: [], workCenters: [] }
        );
        setLookups(nextLookups);
        setLookupError(lookupErrors.join(' '));
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (selectedRecord) {
      setForm({
        finished_product_id: selectedRecord.finished_product_id || '',
        quantity: String(selectedRecord.quantity || '1'),
        unit: selectedRecord.unit || 'Units',
        components: selectedRecord.components?.length ? selectedRecord.components.map(c => ({
          component_product_id: c.component_product_id || '',
          to_consume_qty: String(c.to_consume_qty || '1'),
          unit: c.unit || 'Units'
        })) : [],
        operations: selectedRecord.operations?.length ? selectedRecord.operations.map(o => ({
          operation_name: o.operation_name || '',
          work_center_id: o.work_center_id || '',
          expected_duration_minutes: String(o.expected_duration_minutes || '0'),
          sequence_no: String(o.sequence_no || '')
        })) : []
      });
    } else {
      setForm(initialForm);
    }
    setErrors({});
    setMessage('');
  }, [selectedRecord]);

  function updateField(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
    setMessage('');
  }

  function updateList(listKey, index, key, value) {
    setForm((current) => ({
      ...current,
      [listKey]: current[listKey].map((item, itemIndex) => (
        itemIndex === index ? { ...item, [key]: value } : item
      ))
    }));
    setMessage('');
  }

  function resetForm() {
    setForm(initialForm);
    setErrors({});
    setMessage('');
    setSelectedRecord(null);
    if (onClose) onClose();
  }

  function validate() {
    const nextErrors = {};
    if (!form.finished_product_id) nextErrors.finished_product_id = 'Finished product is required';
    if (!Number(form.quantity || 0)) nextErrors.quantity = 'Quantity must be greater than 0';

    form.components.forEach((component, index) => {
      if (!component.component_product_id) nextErrors[`components.${index}.component_product_id`] = 'Component is required';
      if (Number(component.to_consume_qty || 0) < 0) nextErrors[`components.${index}.to_consume_qty`] = 'Quantity cannot be negative';
    });

    form.operations.forEach((operation, index) => {
      if (!operation.operation_name.trim()) nextErrors[`operations.${index}.operation_name`] = 'Operation is required';
      if (!operation.work_center_id) nextErrors[`operations.${index}.work_center_id`] = 'Work center is required';
    });

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage('');
    if (!validate()) return;

    const payload = {
      finished_product_id: Number(form.finished_product_id),
      quantity: Number(form.quantity),
      unit: form.unit.trim() || 'Units'
    };

    if (form.components.length) {
      payload.components = form.components.map((component) => ({
        component_product_id: Number(component.component_product_id),
        to_consume_qty: Number(component.to_consume_qty || 0),
        unit: component.unit.trim() || 'Units'
      }));
    }

    if (form.operations.length) {
      payload.operations = form.operations.map((operation, index) => ({
        operation_name: operation.operation_name.trim(),
        work_center_id: Number(operation.work_center_id),
        expected_duration_minutes: Number(operation.expected_duration_minutes || 0),
        sequence_no: numberOrUndefined(operation.sequence_no) || index + 1
      }));
    }

    setSaving(true);
    try {
      const method = selectedRecord ? 'PATCH' : 'POST';
      const url = selectedRecord ? `${config.endpoint}/${selectedRecord.id}` : config.endpoint;
      const response = await apiRequest(url, {
        method,
        body: JSON.stringify(payload)
      });
      setSelectedRecord(response.data?.bom || null);
      if (!selectedRecord) {
        setForm(initialForm);
      }
      setErrors({});
      setMessage(response.message || 'Bill of Materials saved successfully');
      onCreated?.();
    } catch (error) {
      setMessage(error.message || 'Could not save bill of materials');
      if (error.errors) setErrors(normalizeApiErrors(error.errors));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col h-full overflow-hidden">
      <FormShell
        config={config}
        message={message}
        onBack={resetForm}
        saving={saving}
        selectedRecord={selectedRecord}
        footer={
          <div className="flex gap-2 w-full justify-end">
            <Button type="button" variant="subtle" onClick={resetForm}>Close</Button>
            <Button type="submit" disabled={saving} className="px-6">
              <Save size={16} />
              {saving ? 'Saving' : 'Save Changes'}
            </Button>
          </div>
        }
      >
        <LookupError message={lookupError} />

        {/* Card 1: BoM General Information */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs grid gap-4">
          <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2">BoM Details</h3>
          <div className="grid grid-cols-3 gap-4 max-md:grid-cols-1">
            <FormField label="Finished Product" error={errors.finished_product_id}>
              <select className={selectClasses()} value={form.finished_product_id} onChange={(event) => updateField('finished_product_id', event.target.value)}>
                <option value="">Select product</option>
                {lookups.products.map((option) => (
                  <option key={option.id} value={option.id}>{getOptionLabel(option)}</option>
                ))}
              </select>
            </FormField>
            <FormField label="Quantity" type="number" value={form.quantity} onChange={(value) => updateField('quantity', value)} error={errors.quantity} />
            <FormField label="Unit" value={form.unit} onChange={(value) => updateField('unit', value)} />
          </div>
        </div>

        {/* Card 2: Components List */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs grid gap-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">Components</h3>
            <Button type="button" variant="ghost" onClick={() => setForm((current) => ({ ...current, components: [...current.components, { ...emptyComponentLine }] }))} className="h-8 text-xs">
              <Plus size={15} />Add Component
            </Button>
          </div>
          {form.components.length ? (
            <div className="grid gap-3">
              {form.components.map((component, index) => (
                <div key={index} className="grid grid-cols-[2fr_1fr_1fr_auto] gap-3 rounded-lg border border-slate-150 p-3 bg-slate-50/50 max-lg:grid-cols-2 max-md:grid-cols-1 items-end">
                  <FormField label="Component Product" error={errors[`components.${index}.component_product_id`]}>
                    <select className={selectClasses()} value={component.component_product_id} onChange={(event) => updateList('components', index, 'component_product_id', event.target.value)}>
                      <option value="">Select product</option>
                      {lookups.products.map((option) => (
                        <option key={option.id} value={option.id}>{getOptionLabel(option)}</option>
                      ))}
                    </select>
                  </FormField>
                  <FormField label="To Consume" type="number" value={component.to_consume_qty} onChange={(value) => updateList('components', index, 'to_consume_qty', value)} error={errors[`components.${index}.to_consume_qty`]} />
                  <FormField label="Unit" value={component.unit} onChange={(value) => updateList('components', index, 'unit', value)} />
                  <div>
                    <Button type="button" variant="subtle" className="h-10 px-3 border border-slate-200 text-rose-600 hover:bg-rose-50 hover:border-rose-200" onClick={() => setForm((current) => ({ ...current, components: current.components.filter((_, itemIndex) => itemIndex !== index) }))} title="Remove Component">
                      <Trash2 size={16} />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm font-semibold text-slate-400">
              No components configured.
            </div>
          )}
        </div>

        {/* Card 3: Operations List */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs grid gap-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">Operations</h3>
            <Button type="button" variant="ghost" onClick={() => setForm((current) => ({ ...current, operations: [...current.operations, { ...emptyOperationLine }] }))} className="h-8 text-xs">
              <Plus size={15} />Add Operation
            </Button>
          </div>
          {form.operations.length ? (
            <div className="grid gap-3">
              {form.operations.map((operation, index) => (
                <div key={index} className="grid grid-cols-[2fr_2fr_1fr_1fr_auto] gap-3 rounded-lg border border-slate-150 p-3 bg-slate-50/50 max-xl:grid-cols-3 max-md:grid-cols-1 items-end">
                  <FormField label="Operation" value={operation.operation_name} onChange={(value) => updateList('operations', index, 'operation_name', value)} error={errors[`operations.${index}.operation_name`]} />
                  <FormField label="Work Center" error={errors[`operations.${index}.work_center_id`]}>
                    <select className={selectClasses()} value={operation.work_center_id} onChange={(event) => updateList('operations', index, 'work_center_id', event.target.value)}>
                      <option value="">Select work center</option>
                      {lookups.workCenters.map((option) => (
                        <option key={option.id} value={option.id}>{getOptionLabel(option)}</option>
                      ))}
                    </select>
                  </FormField>
                  <FormField label="Expected Minutes" type="number" value={operation.expected_duration_minutes} onChange={(value) => updateList('operations', index, 'expected_duration_minutes', value)} />
                  <FormField label="Sequence" type="number" value={operation.sequence_no} onChange={(value) => updateList('operations', index, 'sequence_no', value)} />
                  <div>
                    <Button type="button" variant="subtle" className="h-10 px-3 border border-slate-200 text-rose-600 hover:bg-rose-50 hover:border-rose-200" onClick={() => setForm((current) => ({ ...current, operations: current.operations.filter((_, itemIndex) => itemIndex !== index) }))} title="Remove Operation">
                      <Trash2 size={16} />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm font-semibold text-slate-400">
              No operations configured.
            </div>
          )}
        </div>
      </FormShell>
    </form>
  );
}

function ProductForm({ config, onCreated, selectedRecord: initialSelectedRecord, onClose }) {
  const initialForm = {
    name: '',
    sales_price: '0',
    cost_price: '0',
    on_hand_qty: '0',
    procure_on_demand: false,
    procurement_method: '',
    vendor_id: '',
    bom_id: ''
  };

  const [form, setForm] = useState(initialForm);
  const [lookups, setLookups] = useState({ vendors: [], boms: [] });
  const [lookupError, setLookupError] = useState('');
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [selectedRecord, setSelectedRecord] = useState(initialSelectedRecord || null);

  useEffect(() => {
    setSelectedRecord(initialSelectedRecord || null);
  }, [initialSelectedRecord]);

  useEffect(() => {
    let cancelled = false;
    setLookupError('');

    Promise.allSettled([
      fetchLookup('vendors', 'vendors', 'vendors'),
      fetchLookup('boms', 'boms', 'boms')
    ])
      .then((results) => {
        if (cancelled) return;
        const { errors: lookupErrors, lookups: nextLookups } = collectLookupResults(
          results,
          { vendors: [], boms: [] }
        );
        setLookups(nextLookups);
        setLookupError(lookupErrors.join(' '));
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (selectedRecord) {
      setForm({
        name: selectedRecord.name || '',
        sales_price: String(selectedRecord.sales_price || '0'),
        cost_price: String(selectedRecord.cost_price || '0'),
        on_hand_qty: String(selectedRecord.on_hand_qty || '0'),
        procure_on_demand: Boolean(selectedRecord.procure_on_demand),
        procurement_method: selectedRecord.procurement_method || '',
        vendor_id: selectedRecord.vendor_id || '',
        bom_id: selectedRecord.bom_id || ''
      });
    } else {
      setForm(initialForm);
    }
    setErrors({});
    setMessage('');
  }, [selectedRecord]);

  function updateField(key, value) {
    setForm((current) => {
      const next = { ...current, [key]: value };
      if (key === 'procure_on_demand' && !value) {
        next.procurement_method = '';
        next.vendor_id = '';
        next.bom_id = '';
      }
      if (key === 'procurement_method') {
        if (value === 'purchase') next.bom_id = '';
        if (value === 'manufacturing') next.vendor_id = '';
      }
      return next;
    });
    setMessage('');
  }

  function resetForm() {
    setForm(initialForm);
    setErrors({});
    setMessage('');
    setSelectedRecord(null);
    if (onClose) onClose();
  }

  function validate() {
    const nextErrors = {};
    if (!form.name.trim()) nextErrors.name = 'Product name is required';
    if (Number(form.sales_price || 0) < 0) nextErrors.sales_price = 'Sales price cannot be negative';
    if (Number(form.cost_price || 0) < 0) nextErrors.cost_price = 'Cost price cannot be negative';
    if (Number(form.on_hand_qty || 0) < 0) nextErrors.on_hand_qty = 'On hand quantity cannot be negative';

    if (form.procure_on_demand) {
      if (!form.procurement_method) {
        nextErrors.procurement_method = 'Procurement method is required';
      } else if (form.procurement_method === 'purchase' && !form.vendor_id) {
        nextErrors.vendor_id = 'Vendor is required when method is purchase';
      } else if (form.procurement_method === 'manufacturing' && !form.bom_id) {
        nextErrors.bom_id = 'BoM is required when method is manufacturing';
      }
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage('');
    if (!validate()) return;

    const payload = {
      name: form.name.trim(),
      sales_price: Number(form.sales_price),
      cost_price: Number(form.cost_price),
      on_hand_qty: Number(form.on_hand_qty),
      procure_on_demand: Boolean(form.procure_on_demand),
      procurement_method: form.procurement_method || null,
      vendor_id: form.vendor_id ? Number(form.vendor_id) : null,
      bom_id: form.bom_id ? Number(form.bom_id) : null
    };

    setSaving(true);
    try {
      const method = selectedRecord ? 'PATCH' : 'POST';
      const url = selectedRecord ? `${config.endpoint}/${selectedRecord.id}` : config.endpoint;
      const response = await apiRequest(url, {
        method,
        body: JSON.stringify(payload)
      });
      const record = response.data?.product;
      setSelectedRecord(record || null);
      if (!selectedRecord) {
        setForm(initialForm);
      }
      setErrors({});
      setMessage(response.message || 'Product saved successfully');
      onCreated?.();
    } catch (error) {
      setMessage(error.message || 'Could not save product');
      if (error.errors) setErrors(normalizeApiErrors(error.errors));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col h-full overflow-hidden">
      <FormShell
        config={config}
        message={message}
        onBack={resetForm}
        saving={saving}
        selectedRecord={selectedRecord}
        footer={
          <div className="flex gap-2 w-full justify-end">
            <Button type="button" variant="subtle" onClick={resetForm}>Close</Button>
            <Button type="submit" disabled={saving} className="px-6">
              <Save size={16} />
              {saving ? 'Saving' : 'Save Changes'}
            </Button>
          </div>
        }
      >
        <LookupError message={lookupError} />

        {/* Card 1: Product Info & Pricing */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs grid gap-4">
          <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2">Product Info & Pricing</h3>
          <div className="grid grid-cols-2 gap-4 max-md:grid-cols-1">
            <FormField label="Product Name" value={form.name} onChange={(value) => updateField('name', value)} error={errors.name} />
            <FormField label="Sales Price" type="number" value={form.sales_price} onChange={(value) => updateField('sales_price', value)} error={errors.sales_price} />
            <FormField label="Cost Price" type="number" value={form.cost_price} onChange={(value) => updateField('cost_price', value)} error={errors.cost_price} />
            <FormField label="On Hand Quantity" type="number" value={form.on_hand_qty} onChange={(value) => updateField('on_hand_qty', value)} error={errors.on_hand_qty} />
          </div>
        </div>

        {/* Card 2: Procurement Configuration */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs grid gap-4">
          <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2">Procurement Settings</h3>
          <label className="flex items-center gap-2 text-sm font-bold text-slate-700">
            <input
              type="checkbox"
              checked={form.procure_on_demand}
              onChange={(e) => updateField('procure_on_demand', e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-enterprise-blue focus:ring-blue-500"
            />
            Procure on Demand
          </label>

          {form.procure_on_demand && (
            <div className="grid grid-cols-2 gap-4 max-md:grid-cols-1 mt-2">
              <FormField label="Procurement Method" error={errors.procurement_method}>
                <select className={selectClasses()} value={form.procurement_method} onChange={(e) => updateField('procurement_method', e.target.value)}>
                  <option value="">Select method</option>
                  <option value="purchase">Purchase</option>
                  <option value="manufacturing">Manufacturing</option>
                </select>
              </FormField>

              {form.procurement_method === 'purchase' && (
                <FormField label="Vendor" error={errors.vendor_id}>
                  <select className={selectClasses()} value={form.vendor_id} onChange={(e) => updateField('vendor_id', e.target.value)}>
                    <option value="">Select vendor</option>
                    {lookups.vendors.map((option) => (
                      <option key={option.id} value={option.id}>{getOptionLabel(option)}</option>
                    ))}
                  </select>
                </FormField>
              )}

              {form.procurement_method === 'manufacturing' && (
                <FormField label="Bill of Materials" error={errors.bom_id}>
                  <select className={selectClasses()} value={form.bom_id} onChange={(e) => updateField('bom_id', e.target.value)}>
                    <option value="">Select BoM</option>
                    {lookups.boms.map((option) => (
                      <option key={option.id} value={option.id}>{option.reference} - {option.finished_product_name}</option>
                    ))}
                  </select>
                </FormField>
              )}
            </div>
          )}
        </div>
      </FormShell>
    </form>
  );
}

const ALL_ROLES = [
  { code: 'admin', name: 'System Administrator' },
  { code: 'sales_user', name: 'Sales User' },
  { code: 'purchase_user', name: 'Purchase User' },
  { code: 'manufacturing_user', name: 'Manufacturing User' },
  { code: 'inventory_manager', name: 'Inventory Manager' },
  { code: 'business_owner', name: 'Business Owner' }
];

function UserForm({ config, onCreated, selectedRecord: initialSelectedRecord, onClose }) {
  const initialForm = {
    login_id: '',
    password: '',
    full_name: '',
    email: '',
    mobile_number: '',
    address: '',
    position: '',
    is_active: true,
    role_codes: []
  };

  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [selectedRecord, setSelectedRecord] = useState(initialSelectedRecord || null);

  useEffect(() => {
    setSelectedRecord(initialSelectedRecord || null);
  }, [initialSelectedRecord]);

  useEffect(() => {
    if (selectedRecord) {
      setForm({
        login_id: selectedRecord.login_id || '',
        password: '',
        full_name: selectedRecord.full_name || '',
        email: selectedRecord.email || '',
        mobile_number: selectedRecord.mobile_number || '',
        address: selectedRecord.address || '',
        position: selectedRecord.position || '',
        is_active: Boolean(selectedRecord.is_active),
        role_codes: selectedRecord.roles ? selectedRecord.roles.map(r => typeof r === 'object' ? r.code : r) : []
      });
    } else {
      setForm(initialForm);
    }
    setErrors({});
    setMessage('');
  }, [selectedRecord]);

  function updateField(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
    setMessage('');
  }

  function resetForm() {
    setForm(initialForm);
    setErrors({});
    setMessage('');
    setSelectedRecord(null);
    if (onClose) onClose();
  }

  function validate() {
    const nextErrors = {};
    if (!selectedRecord) {
      if (!form.login_id.trim()) nextErrors.login_id = 'Login ID is required';
      else if (form.login_id.length < 6 || form.login_id.length > 12) nextErrors.login_id = 'Login ID must be 6 to 12 characters';
      if (!form.password) nextErrors.password = 'Password is required';
      else if (form.password.length < 9) nextErrors.password = 'Password must be at least 9 characters';
    }
    if (!form.full_name.trim()) nextErrors.full_name = 'Name is required';
    if (!form.email.trim()) nextErrors.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(form.email)) nextErrors.email = 'Email is invalid';

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage('');
    if (!validate()) return;

    setSaving(true);
    try {
      if (selectedRecord) {
        const payload = {
          full_name: form.full_name.trim(),
          address: form.address.trim() || null,
          mobile_number: form.mobile_number.trim() || null,
          position: form.position.trim() || null,
          is_active: Boolean(form.is_active),
          role_codes: form.role_codes
        };

        const response = await apiRequest(`/users/${selectedRecord.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload)
        });
        const updatedUser = response.data?.user;
        setSelectedRecord(updatedUser || null);
        setMessage(response.message || 'User profile updated successfully');
      } else {
        const payload = {
          login_id: form.login_id.trim(),
          password: form.password,
          email: form.email.trim().toLowerCase(),
          full_name: form.full_name.trim(),
          address: form.address.trim() || undefined,
          mobile_number: form.mobile_number.trim() || undefined,
          position: form.position.trim() || undefined,
          role_codes: form.role_codes
        };

        const response = await apiRequest('/auth/signup', {
          method: 'POST',
          body: JSON.stringify(payload)
        });

        setForm(initialForm);
        setErrors({});
        setMessage('User registered successfully');
      }
      onCreated?.();
    } catch (error) {
      setMessage(error.message || 'Could not save user');
      if (error.errors) setErrors(normalizeApiErrors(error.errors));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col h-full overflow-hidden">
      <FormShell
        config={config}
        message={message}
        onBack={resetForm}
        saving={saving}
        selectedRecord={selectedRecord}
        titleExtra={selectedRecord ? ` (${selectedRecord.login_id})` : ''}
        footer={
          <div className="flex gap-2 w-full justify-end">
            <Button type="button" variant="subtle" onClick={resetForm}>Close</Button>
            <Button type="submit" disabled={saving} className="px-6">
              <Save size={16} />
              {saving ? 'Saving' : 'Save Changes'}
            </Button>
          </div>
        }
      >
        {/* Card 1: Account Credentials (only when creating new user) */}
        {!selectedRecord && (
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs grid gap-4">
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2">Account Credentials</h3>
            <div className="grid grid-cols-2 gap-4 max-md:grid-cols-1">
              <FormField label="Login ID" value={form.login_id} onChange={(value) => updateField('login_id', value)} error={errors.login_id} />
              <FormField label="Password" type="password" value={form.password} onChange={(value) => updateField('password', value)} error={errors.password} />
            </div>
          </div>
        )}

        {/* Card 2: Profile details */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs grid gap-4">
          <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2">Profile Details</h3>
          <div className="grid grid-cols-2 gap-4 max-md:grid-cols-1">
            <FormField label="Full Name" value={form.full_name} onChange={(value) => updateField('full_name', value)} error={errors.full_name} />
            <FormField label="Email ID" type="email" value={form.email} onChange={(value) => updateField('email', value)} error={errors.email} disabled={Boolean(selectedRecord)} />
            <FormField label="Mobile Number" value={form.mobile_number} onChange={(value) => updateField('mobile_number', value)} error={errors.mobile_number} />
            <FormField label="Position" value={form.position} onChange={(value) => updateField('position', value)} error={errors.position} />
            <FormField label="Address" value={form.address} onChange={(value) => updateField('address', value)} error={errors.address} />
            {selectedRecord && (
              <div className="flex items-center gap-2 py-2">
                <label className="flex items-center gap-2 text-sm font-bold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.is_active}
                    onChange={(e) => updateField('is_active', e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-enterprise-blue focus:ring-blue-500"
                  />
                  Is Active Account
                </label>
              </div>
            )}
          </div>
        </div>

        {/* Card 3: Access Permissions */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs grid gap-4">
          <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2">Assigned Roles</h3>
          {errors.role_codes && (
            <span className="text-xs font-semibold text-rose-600">{errors.role_codes}</span>
          )}
          <div className="grid grid-cols-2 gap-2 border border-slate-200 rounded-lg p-3.5 bg-slate-50/50 max-md:grid-cols-1">
            {ALL_ROLES.map((role) => (
              <label key={role.code} className="flex items-center gap-2 text-sm font-medium text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.role_codes.includes(role.code)}
                  onChange={(event) => {
                    const checked = event.target.checked;
                    setForm((current) => ({
                      ...current,
                      role_codes: checked
                        ? [...current.role_codes, role.code]
                        : current.role_codes.filter(c => c !== role.code)
                    }));
                  }}
                  className="h-4 w-4 rounded border-slate-300 text-enterprise-blue focus:ring-blue-500"
                />
                {role.name}
              </label>
            ))}
          </div>
        </div>
      </FormShell>
    </form>
  );
}

function ReadOnlyDetailView({ config, moduleKey, selectedRecord, onClose }) {
  if (!selectedRecord) return null;

  const title = moduleKey === 'inventory' ? 'Stock Ledger Movement' : 'Audit Log Detail';

  const details = [];
  if (moduleKey === 'inventory') {
    details.push({ key: 'Created At', value: selectedRecord.created_at || 'N/A' });
    details.push({ key: 'Product Name', value: selectedRecord.product_name || 'N/A' });
    details.push({ key: 'Movement Type', value: selectedRecord.movement_type || 'N/A' });
    details.push({
      key: 'Quantity Change',
      value: (
        <span className={`font-bold ${parseFloat(selectedRecord.quantity_change) > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
          {selectedRecord.quantity_change}
        </span>
      )
    });
    details.push({ key: 'Reference Type', value: selectedRecord.reference_type || 'N/A' });
    details.push({ key: 'Note', value: selectedRecord.note || 'N/A' });
  } else if (moduleKey === 'audit') {
    details.push({ key: 'Created At', value: selectedRecord.created_at || 'N/A' });
    details.push({ key: 'User', value: selectedRecord.user_name || 'N/A' });
    details.push({ key: 'Module', value: selectedRecord.module_code || 'N/A' });
    details.push({ key: 'Record Type', value: selectedRecord.record_type || 'N/A' });
    details.push({ key: 'Record ID', value: selectedRecord.record_id || 'N/A' });
    details.push({
      key: 'Action',
      value: (
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-extrabold ${selectedRecord.action === 'Created' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
            selectedRecord.action === 'Deleted' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
              'bg-blue-50 text-blue-700 border border-blue-200'
          }`}>
          {selectedRecord.action || 'N/A'}
        </span>
      )
    });
    details.push({ key: 'Field Changed', value: selectedRecord.field_changed || 'N/A' });
    details.push({ key: 'Old Value', value: selectedRecord.old_value || 'N/A' });
    details.push({ key: 'New Value', value: selectedRecord.new_value || 'N/A' });
  }

  return (
    <FormShell
      config={config}
      onBack={onClose}
      selectedRecord={null}
      titleOverride={title}
      footer={
        <div className="flex gap-2 w-full justify-end">
          <Button type="button" variant="subtle" onClick={onClose}>Close Detail</Button>
        </div>
      }
    >
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs grid gap-4">
        <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2">Record Details</h3>
        <div className="grid grid-cols-2 gap-x-8 gap-y-4 max-md:grid-cols-1">
          {details.map((item) => (
            <div key={item.key} className="flex flex-col border-b border-slate-100 pb-2.5 last:border-0 last:pb-0">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">{item.key}</span>
              <span className="text-sm font-semibold text-slate-800">{item.value}</span>
            </div>
          ))}
        </div>
      </div>
    </FormShell>
  );
}

export function FormPreview({ config, moduleKey, onCreated, selectedRecord, onClose, user }) {
  if (moduleKey === 'sales' || moduleKey === 'purchase') {
    return <OrderEntryForm config={config} moduleKey={moduleKey} onCreated={onCreated} selectedRecord={selectedRecord} onClose={onClose} user={user} />;
  }

  if (moduleKey === 'manufacturing') {
    return <ManufacturingOrderForm config={config} onCreated={onCreated} selectedRecord={selectedRecord} onClose={onClose} user={user} />;
  }

  if (moduleKey === 'boms') {
    return <BomForm config={config} onCreated={onCreated} selectedRecord={selectedRecord} onClose={onClose} />;
  }

  if (moduleKey === 'products') {
    return <ProductForm config={config} onCreated={onCreated} selectedRecord={selectedRecord} onClose={onClose} />;
  }

  if (moduleKey === 'users') {
    return <UserForm config={config} onCreated={onCreated} selectedRecord={selectedRecord} onClose={onClose} />;
  }

  if (moduleKey === 'inventory' || moduleKey === 'audit') {
    return <ReadOnlyDetailView config={config} moduleKey={moduleKey} selectedRecord={selectedRecord} onClose={onClose} />;
  }

  return null;
}
