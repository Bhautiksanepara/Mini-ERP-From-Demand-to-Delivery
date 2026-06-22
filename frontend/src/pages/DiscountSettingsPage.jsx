import { Percent, Save, ShoppingCart, Truck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '../components/common/Button';
import { FormField } from '../components/common/FormField';
import { Skeleton } from '../components/common/Skeleton';
import { apiRequest } from '../services/apiClient';
import { cn } from '../utils/formatters';

const RULE_META = {
  sales_order: {
    title: 'Sales Order Discount',
    description: 'Automatically discount a customer\'s order subtotal once it crosses the threshold amount.',
    icon: ShoppingCart
  },
  purchase_order: {
    title: 'Purchase Order Discount',
    description: 'Automatically discount a purchase order subtotal once it crosses the threshold amount.',
    icon: Truck
  }
};

function RuleCardSkeleton() {
  return (
    <div className="grid gap-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      {/* Header: icon + title + description */}
      <div className="flex items-center gap-3">
        <Skeleton className="h-11 w-11 shrink-0 rounded-xl" />
        <div className="grid flex-1 gap-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-64 max-w-full" />
        </div>
      </div>

      {/* Two input fields */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Skeleton className="h-3 w-36" />
          <Skeleton className="h-10 w-full rounded-md" />
        </div>
        <div className="grid gap-1.5">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-10 w-full rounded-md" />
        </div>
      </div>

      {/* Checkbox row */}
      <div className="flex items-center gap-3">
        <Skeleton className="h-4 w-4 shrink-0" />
        <Skeleton className="h-3 w-44" />
      </div>

      {/* Info box */}
      <div className="flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
        <Skeleton className="h-3.5 w-3.5 shrink-0" />
        <Skeleton className="h-3 w-3/4" />
      </div>

      {/* Save button */}
      <div className="flex justify-end">
        <Skeleton className="h-10 w-32 rounded-lg" />
      </div>
    </div>
  );
}

function RuleCard({ rule, onSave, saving }) {
  const meta = RULE_META[rule.module_code];
  const Icon = meta.icon;
  const [form, setForm] = useState({
    threshold_amount: String(rule.threshold_amount ?? 0),
    discount_amount: String(rule.discount_amount ?? 0),
    is_active: Boolean(rule.is_active)
  });

  useEffect(() => {
    setForm({
      threshold_amount: String(rule.threshold_amount ?? 0),
      discount_amount: String(rule.discount_amount ?? 0),
      is_active: Boolean(rule.is_active)
    });
  }, [rule]);

  function update(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  return (
    <div className="grid gap-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-xl bg-enterprise-blue/10 text-enterprise-blue">
          <Icon size={20} />
        </div>
        <div>
          <h3 className="text-base font-extrabold text-slate-800">{meta.title}</h3>
          <p className="text-xs font-semibold text-slate-400">{meta.description}</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          label="Order Amount Threshold"
          type="number"
          value={form.threshold_amount}
          onChange={(value) => update('threshold_amount', value)}
        />
        <FormField
          label="Discount Amount (Flat)"
          type="number"
          value={form.discount_amount}
          onChange={(value) => update('discount_amount', value)}
        />
      </div>

      <label className="flex items-center gap-3 text-sm font-bold text-slate-700">
        <input
          type="checkbox"
          checked={form.is_active}
          onChange={(event) => update('is_active', event.target.checked)}
          className="h-4 w-4 rounded border-slate-300 text-enterprise-blue focus:ring-enterprise-blue"
        />
        Enable automatic discount
      </label>

      <p className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500">
        <Percent size={14} className="text-slate-400" />
        {form.is_active && Number(form.threshold_amount) > 0
          ? `Orders with a subtotal of ${Number(form.threshold_amount).toFixed(2)} or more get ${Number(form.discount_amount || 0).toFixed(2)} off automatically.`
          : 'Automatic discount is currently disabled for this order type.'}
      </p>

      <div className="flex justify-end">
        <Button
          type="button"
          disabled={saving}
          onClick={() => onSave(rule.module_code, {
            threshold_amount: Number(form.threshold_amount || 0),
            discount_amount: Number(form.discount_amount || 0),
            is_active: form.is_active
          })}
          className="px-6"
        >
          <Save size={16} />
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </div>
  );
}

export function DiscountSettingsPage() {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingCode, setSavingCode] = useState(null);
  const [message, setMessage] = useState('');

  async function load() {
    setLoading(true);
    try {
      const response = await apiRequest('/discount-rules');
      setRules(response.data?.discount_rules || []);
    } catch (error) {
      setMessage(error.message || 'Could not load discount rules');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSave(moduleCode, payload) {
    setSavingCode(moduleCode);
    setMessage('');
    try {
      const response = await apiRequest(`/discount-rules/${moduleCode}`, {
        method: 'PATCH',
        body: JSON.stringify(payload)
      });
      const updated = response.data?.discount_rule;
      setRules((current) => current.map((rule) => (rule.module_code === moduleCode ? updated : rule)));
      setMessage(response.message || 'Discount rule updated successfully');
    } catch (error) {
      setMessage(error.message || 'Could not update discount rule');
    } finally {
      setSavingCode(null);
    }
  }

  const isSuccess = message && /updated/i.test(message);

  return (
    <main className="grid gap-6 p-6 max-md:p-4 bg-enterprise-shell">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-800">Discount Rules</h1>
        <p className="text-sm font-semibold text-slate-400">Configure automatic discounts applied when an order's subtotal crosses a threshold.</p>
      </div>

      {message && (
        <div className={cn(
          'rounded-lg border px-4 py-2 text-sm font-bold',
          isSuccess ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-700'
        )}>
          {message}
        </div>
      )}

      {loading ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <RuleCardSkeleton />
          <RuleCardSkeleton />
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {rules.map((rule) => (
            <RuleCard key={rule.module_code} rule={rule} onSave={handleSave} saving={savingCode === rule.module_code} />
          ))}
        </div>
      )}
    </main>
  );
}
