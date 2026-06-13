import { CheckCircle2, Plus, RotateCcw, Save, Trash2, XCircle } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
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
  return 'h-10 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-800 outline-none transition focus:border-enterprise-blue focus:ring-2 focus:ring-blue-100';
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

function FormShell({ children, config, message, onBack, onCancel, onConfirm, saving, selectedRecord, titleExtra = '' }) {
  return (
    <section className="rounded-lg border border-enterprise-line bg-white p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-extrabold text-slate-900">{config.title.replace(/s$/, '')} Form View{titleExtra}</h3>
          <p className="text-sm text-enterprise-muted">
            {selectedRecord?.reference ? `Active record: ${selectedRecord.reference}` : 'Enter values and save them to the database API.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="subtle" onClick={onBack}><RotateCcw size={17} />Back</Button>
          {onConfirm && (
            <Button type="button" variant="ghost" disabled={saving || !selectedRecord?.id} onClick={onConfirm}>
              <CheckCircle2 size={17} />Confirm
            </Button>
          )}
          {onCancel && (
            <Button type="button" variant="subtle" disabled={saving || !selectedRecord?.id} onClick={onCancel}>
              <XCircle size={17} />Cancel
            </Button>
          )}
        </div>
      </div>
      {message && (
        <div className="mb-4 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-semibold text-enterprise-blueDark">
          {message}
        </div>
      )}
      {children}
    </section>
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

function OrderEntryForm({ config, moduleKey, onCreated, onClose }) {
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
    items: [{ ...emptyOrderLine }]
  };

  const [form, setForm] = useState(initialForm);
  const [lookups, setLookups] = useState({ parties: [], users: [], products: [], salesOrders: [] });
  const [lookupError, setLookupError] = useState('');
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [selectedRecord, setSelectedRecord] = useState(null);

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

  const total = useMemo(() => form.items.reduce((sum, item) => {
    const qty = Number(item.ordered_qty || 0);
    const price = Number(item.unit_price || 0);
    return sum + qty * price;
  }, 0), [form.items]);

  function updateField(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
    setMessage('');
  }

  function updateLine(index, key, value) {
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
    onClose?.();
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

    setSaving(true);
    try {
      const response = await apiRequest(config.endpoint, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      const record = response.data?.[isSales ? 'sales_order' : 'purchase_order'];
      setSelectedRecord(record || null);
      setMessage(response.message || `${config.title.replace(/s$/, '')} saved successfully`);
      setForm(initialForm);
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
    <FormShell
      config={config}
      message={message}
      onBack={resetForm}
      onCancel={() => runLifecycle('cancel')}
      onConfirm={() => runLifecycle('confirm')}
      saving={saving}
      selectedRecord={selectedRecord}
    >
      <form className="grid gap-5" onSubmit={handleSubmit}>
        <LookupError message={lookupError} />
        <div className="grid grid-cols-4 gap-3 max-xl:grid-cols-3 max-md:grid-cols-1">
          <FormField label={partyLabel} error={errors[partyKey]}>
            <select className={selectClasses()} value={form[partyKey]} onChange={(event) => updateField(partyKey, event.target.value)}>
              <option value="">Select {partyLabel.toLowerCase()}</option>
              {lookups.parties.map((option) => (
                <option key={option.id} value={option.id}>{getOptionLabel(option)}</option>
              ))}
            </select>
          </FormField>
          <FormField label={addressLabel} value={form[addressKey]} onChange={(value) => updateField(addressKey, value)} />
          <FormField label={ownerLabel} error={errors[ownerKey]}>
            <select className={selectClasses()} value={form[ownerKey]} onChange={(event) => updateField(ownerKey, event.target.value)}>
              <option value="">Select user</option>
              {lookups.users.map((option) => (
                <option key={option.id} value={option.id}>{getOptionLabel(option)}</option>
              ))}
            </select>
          </FormField>
          <FormField label="Scheduled Date" type="datetime-local" value={form.scheduled_date} onChange={(value) => updateField('scheduled_date', value)} />
          {!isSales && (
            <FormField label="Source Sales Order">
              <select className={selectClasses()} value={form.source_sales_order_id} onChange={(event) => updateField('source_sales_order_id', event.target.value)}>
                <option value="">None</option>
                {lookups.salesOrders.map((option) => (
                  <option key={option.id} value={option.id}>{option.reference}</option>
                ))}
              </select>
            </FormField>
          )}
        </div>

        <div className="grid gap-3">
          <div className="flex items-center justify-between gap-3">
            <h4 className="text-sm font-extrabold text-slate-900">Products</h4>
            <Button type="button" variant="ghost" onClick={() => setForm((current) => ({ ...current, items: [...current.items, { ...emptyOrderLine }] }))}><Plus size={17} />Add Product</Button>
          </div>
          <div className="grid gap-3">
            {form.items.map((item, index) => (
              <div key={index} className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-3 rounded-lg border border-slate-200 p-3 max-lg:grid-cols-2 max-md:grid-cols-1">
                <FormField label="Product" error={errors[`items.${index}.product_id`]}>
                  <select className={selectClasses()} value={item.product_id} onChange={(event) => updateLine(index, 'product_id', event.target.value)}>
                    <option value="">Select product</option>
                    {lookups.products.map((option) => (
                      <option key={option.id} value={option.id}>{getOptionLabel(option)}</option>
                    ))}
                  </select>
                </FormField>
                <FormField label="Ordered Quantity" type="number" value={item.ordered_qty} onChange={(value) => updateLine(index, 'ordered_qty', value)} error={errors[`items.${index}.ordered_qty`]} />
                <FormField label={progressLabel} type="number" value={item.progress_qty} onChange={(value) => updateLine(index, 'progress_qty', value)} error={errors[`items.${index}.progress_qty`]} />
                <FormField label={priceLabel} type="number" value={item.unit_price} onChange={(value) => updateLine(index, 'unit_price', value)} error={errors[`items.${index}.unit_price`]} />
                <div className="flex items-end">
                  <Button type="button" variant="subtle" className="h-10 px-3" disabled={form.items.length === 1} onClick={() => setForm((current) => ({ ...current, items: current.items.filter((_, itemIndex) => itemIndex !== index) }))} title="Remove product">
                    <Trash2 size={17} />
                  </Button>
                </div>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-end gap-3">
            <div className="rounded-md bg-slate-50 px-4 py-2 text-sm font-extrabold text-slate-700">
              Total: {total.toFixed(2)}
            </div>
            <Button type="submit" disabled={saving}><Save size={17} />{saving ? 'Saving' : 'Submit'}</Button>
          </div>
        </div>
      </form>
    </FormShell>
  );
}

function ManufacturingOrderForm({ config, onCreated, onClose }) {
  const initialForm = {
    finished_product_id: '',
    quantity: '1',
    unit: 'Units',
    schedule_date: '',
    assignee_id: '',
    bom_id: '',
    source_sales_order_id: '',
    components: [],
    work_orders: []
  };

  const [form, setForm] = useState(initialForm);
  const [lookups, setLookups] = useState({ products: [], users: [], boms: [], salesOrders: [], workCenters: [] });
  const [lookupError, setLookupError] = useState('');
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [selectedRecord, setSelectedRecord] = useState(null);

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
    onClose?.();
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
      const response = await apiRequest(config.endpoint, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      const record = response.data?.manufacturing_order;
      setSelectedRecord(record || null);
      setForm(initialForm);
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
    <FormShell
      config={config}
      message={message}
      onBack={resetForm}
      onCancel={() => runLifecycle('cancel')}
      onConfirm={() => runLifecycle('confirm')}
      saving={saving}
      selectedRecord={selectedRecord}
    >
      <form className="grid gap-5" onSubmit={handleSubmit}>
        <LookupError message={lookupError} />
        <div className="grid grid-cols-4 gap-3 max-xl:grid-cols-3 max-md:grid-cols-1">
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
          <FormField label="Schedule Date" type="datetime-local" value={form.schedule_date} onChange={(value) => updateField('schedule_date', value)} />
          <FormField label="Assignee">
            <select className={selectClasses()} value={form.assignee_id} onChange={(event) => updateField('assignee_id', event.target.value)}>
              <option value="">None</option>
              {lookups.users.map((option) => (
                <option key={option.id} value={option.id}>{getOptionLabel(option)}</option>
              ))}
            </select>
          </FormField>
          <FormField label="Bill of Materials">
            <select className={selectClasses()} value={form.bom_id} onChange={(event) => updateField('bom_id', event.target.value)}>
              <option value="">Build manually</option>
              {lookups.boms.map((option) => (
                <option key={option.id} value={option.id}>{option.reference} - {option.finished_product_name}</option>
              ))}
            </select>
          </FormField>
          <FormField label="Source Sales Order">
            <select className={selectClasses()} value={form.source_sales_order_id} onChange={(event) => updateField('source_sales_order_id', event.target.value)}>
              <option value="">None</option>
              {lookups.salesOrders.map((option) => (
                <option key={option.id} value={option.id}>{option.reference}</option>
              ))}
            </select>
          </FormField>
        </div>

        <LineEditor
          title="Components"
          addLabel="Add Component"
          emptyLine={emptyComponentLine}
          items={form.components}
          onAdd={() => setForm((current) => ({ ...current, components: [...current.components, { ...emptyComponentLine }] }))}
          onRemove={(index) => setForm((current) => ({ ...current, components: current.components.filter((_, itemIndex) => itemIndex !== index) }))}
        >
          {(component, index) => (
            <div className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-3 max-lg:grid-cols-2 max-md:grid-cols-1">
              <FormField label="Component Product" error={errors[`components.${index}.component_product_id`]}>
                <select className={selectClasses()} value={component.component_product_id} onChange={(event) => updateList('components', index, 'component_product_id', event.target.value)}>
                  <option value="">Select product</option>
                  {lookups.products.map((option) => (
                    <option key={option.id} value={option.id}>{getOptionLabel(option)}</option>
                  ))}
                </select>
              </FormField>
              <FormField label="To Consume" type="number" value={component.to_consume_qty} onChange={(value) => updateList('components', index, 'to_consume_qty', value)} error={errors[`components.${index}.to_consume_qty`]} />
              <FormField label="Consumed" type="number" value={component.consumed_qty} onChange={(value) => updateList('components', index, 'consumed_qty', value)} error={errors[`components.${index}.consumed_qty`]} />
              <FormField label="Unit" value={component.unit} onChange={(value) => updateList('components', index, 'unit', value)} />
            </div>
          )}
        </LineEditor>

        <LineEditor
          title="Work Orders"
          addLabel="Add Work Order"
          emptyLine={emptyOperationLine}
          items={form.work_orders}
          onAdd={() => setForm((current) => ({ ...current, work_orders: [...current.work_orders, { ...emptyOperationLine }] }))}
          onRemove={(index) => setForm((current) => ({ ...current, work_orders: current.work_orders.filter((_, itemIndex) => itemIndex !== index) }))}
        >
          {(workOrder, index) => (
            <div className="grid grid-cols-[2fr_2fr_1fr_1fr_1fr_auto] gap-3 max-xl:grid-cols-3 max-md:grid-cols-1">
              <FormField label="Operation" value={workOrder.operation_name} onChange={(value) => updateList('work_orders', index, 'operation_name', value)} error={errors[`work_orders.${index}.operation_name`]} />
              <FormField label="Work Center" error={errors[`work_orders.${index}.work_center_id`]}>
                <select className={selectClasses()} value={workOrder.work_center_id} onChange={(event) => updateList('work_orders', index, 'work_center_id', event.target.value)}>
                  <option value="">Select work center</option>
                  {lookups.workCenters.map((option) => (
                    <option key={option.id} value={option.id}>{getOptionLabel(option)}</option>
                  ))}
                </select>
              </FormField>
              <FormField label="Expected Minutes" type="number" value={workOrder.expected_duration_minutes} onChange={(value) => updateList('work_orders', index, 'expected_duration_minutes', value)} />
              <FormField label="Real Minutes" type="number" value={workOrder.real_duration_minutes} onChange={(value) => updateList('work_orders', index, 'real_duration_minutes', value)} />
              <FormField label="Sequence" type="number" value={workOrder.sequence_no} onChange={(value) => updateList('work_orders', index, 'sequence_no', value)} />
            </div>
          )}
        </LineEditor>

        <div className="flex justify-end">
          <Button type="submit" disabled={saving}><Save size={17} />{saving ? 'Saving' : 'Submit'}</Button>
        </div>
      </form>
    </FormShell>
  );
}

function BomForm({ config, onCreated, onClose }) {
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
  const [selectedRecord, setSelectedRecord] = useState(null);

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
    onClose?.();
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
      const response = await apiRequest(config.endpoint, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      setSelectedRecord(response.data?.bom || null);
      setForm(initialForm);
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
    <FormShell
      config={config}
      message={message}
      onBack={resetForm}
      saving={saving}
      selectedRecord={selectedRecord}
    >
      <form className="grid gap-5" onSubmit={handleSubmit}>
        <LookupError message={lookupError} />
        <div className="grid grid-cols-4 gap-3 max-xl:grid-cols-3 max-md:grid-cols-1">
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

        <LineEditor
          title="Components"
          addLabel="Add Component"
          emptyLine={emptyComponentLine}
          items={form.components}
          onAdd={() => setForm((current) => ({ ...current, components: [...current.components, { ...emptyComponentLine }] }))}
          onRemove={(index) => setForm((current) => ({ ...current, components: current.components.filter((_, itemIndex) => itemIndex !== index) }))}
        >
          {(component, index) => (
            <div className="grid grid-cols-[2fr_1fr_1fr_auto] gap-3 max-lg:grid-cols-2 max-md:grid-cols-1">
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
            </div>
          )}
        </LineEditor>

        <LineEditor
          title="Operations"
          addLabel="Add Operation"
          emptyLine={emptyOperationLine}
          items={form.operations}
          onAdd={() => setForm((current) => ({ ...current, operations: [...current.operations, { ...emptyOperationLine }] }))}
          onRemove={(index) => setForm((current) => ({ ...current, operations: current.operations.filter((_, itemIndex) => itemIndex !== index) }))}
        >
          {(operation, index) => (
            <div className="grid grid-cols-[2fr_2fr_1fr_1fr_auto] gap-3 max-xl:grid-cols-3 max-md:grid-cols-1">
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
            </div>
          )}
        </LineEditor>

        <div className="flex justify-end">
          <Button type="submit" disabled={saving}><Save size={17} />{saving ? 'Saving' : 'Submit'}</Button>
        </div>
      </form>
    </FormShell>
  );
}

function LineEditor({ addLabel, children, items, onAdd, onRemove, title }) {
  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-sm font-extrabold text-slate-900">{title}</h4>
        <Button type="button" variant="ghost" onClick={onAdd}><Plus size={17} />{addLabel}</Button>
      </div>
      {items.length ? (
        <div className="grid gap-3">
          {items.map((item, index) => (
            <div key={index} className="rounded-lg border border-slate-200 p-3">
              <div className="grid grid-cols-[1fr_auto] gap-3 max-md:grid-cols-1">
                {children(item, index)}
                <div className="flex items-end">
                  <Button type="button" variant="subtle" className="h-10 px-3" onClick={() => onRemove(index)} title={`Remove ${title.toLowerCase()}`}>
                    <Trash2 size={17} />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm font-semibold text-slate-500">
          No {title.toLowerCase()} added.
        </div>
      )}
    </div>
  );
}

export function FormPreview({ config, moduleKey, onCreated, onClose }) {
  if (moduleKey === 'sales' || moduleKey === 'purchase') {
    return <OrderEntryForm config={config} moduleKey={moduleKey} onCreated={onCreated} onClose={onClose} />;
  }

  if (moduleKey === 'manufacturing') {
    return <ManufacturingOrderForm config={config} onCreated={onCreated} onClose={onClose} />;
  }

  if (moduleKey === 'boms') {
    return <BomForm config={config} onCreated={onCreated} onClose={onClose} />;
  }

  return null;
}
