import { useState } from 'react';
import { BrandMark } from '../components/common/BrandMark';
import { Button } from '../components/common/Button';
import { FormField } from '../components/common/FormField';

const initialForm = {
  login_id: '',
  password: '',
  email: '',
  full_name: '',
  mobile_number: '',
  address: '',
  position: '',
  role_codes: ['sales_user']
};

export function AuthPage({ onSignIn, onSignUp }) {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }));
  const getFieldError = (field) => fieldErrors[field] || fieldErrors[`body.${field}`] || '';

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setFieldErrors({});
    try {
      if (mode === 'login') {
        await onSignIn({ login_id: form.login_id, password: form.password });
      } else {
        await onSignUp(form);
      }
    } catch (err) {
      if (Array.isArray(err.errors) && err.errors.length) {
        const errorsByField = {};
        err.errors.forEach((issue) => {
          errorsByField[issue.path] = issue.message;
        });
        setFieldErrors(errorsByField);
        setError('Please fix the highlighted fields.');
      } else {
        setError(err.message || 'Something went wrong');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-screen grid-cols-[minmax(360px,1fr)_minmax(360px,480px)] bg-[linear-gradient(90deg,rgba(255,255,255,.9),rgba(255,255,255,.62)),url('https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&w=1600&q=80')] bg-cover bg-center max-md:grid-cols-1">
      <section className="flex flex-col justify-between p-12 text-slate-900 max-md:min-h-[360px] max-md:p-7">
        <div className="flex items-center gap-3">
          <BrandMark />
          <div>
            <strong className="block text-lg">Mini ERP</strong>
            <span className="text-sm text-enterprise-muted">Demand to Delivery</span>
          </div>
        </div>
        <div>
          <h1 className="mb-3 text-5xl font-extrabold tracking-normal max-md:text-4xl">{mode === 'login' ? 'Login Page' : 'Sign up Page'}</h1>
          <p className="max-w-xl text-base leading-7 text-slate-600">Centralized operations for sales, purchase, manufacturing, BoM, stock, and audit traceability.</p>
        </div>
        <div className="grid max-w-3xl grid-cols-4 gap-2 max-md:grid-cols-2">
          {['Sales', 'Purchase', 'Manufacturing', 'Inventory'].map((item) => (
            <span key={item} className="rounded-lg border border-slate-300 bg-white/80 px-4 py-3 text-sm font-extrabold text-slate-700">{item}</span>
          ))}
        </div>
      </section>

      <form className="m-6 self-center rounded-lg border border-slate-200 bg-white p-6 shadow-panel max-md:mx-auto max-md:w-[calc(100%-32px)]" onSubmit={submit}>
        <div className="mb-5 grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1">
          <button type="button" className={`min-h-10 rounded-md text-sm font-extrabold ${mode === 'login' ? 'bg-white text-enterprise-blueDark shadow-sm' : 'text-slate-500'}`} onClick={() => setMode('login')}>SIGN IN</button>
          <button type="button" className={`min-h-10 rounded-md text-sm font-extrabold ${mode === 'signup' ? 'bg-white text-enterprise-blueDark shadow-sm' : 'text-slate-500'}`} onClick={() => setMode('signup')}>SIGN UP</button>
        </div>
        <div className="grid gap-3">
          <FormField label="Login Id" value={form.login_id} onChange={(value) => update('login_id', value)} error={getFieldError('login_id')} />
          {mode === 'signup' && (
            <>
              <FormField label="Email ID" type="email" value={form.email} onChange={(value) => update('email', value)} error={getFieldError('email')} />
              <FormField label="Name" value={form.full_name} onChange={(value) => update('full_name', value)} error={getFieldError('full_name')} />
              <FormField label="Mobile Number" value={form.mobile_number} onChange={(value) => update('mobile_number', value)} error={getFieldError('mobile_number')} />
              <FormField label="Position" value={form.position} onChange={(value) => update('position', value)} error={getFieldError('position')} />
            </>
          )}
          <FormField label="Password" type="password" value={form.password} onChange={(value) => update('password', value)} error={getFieldError('password')} />
          {mode === 'signup' && (
            <FormField label="Login as">
              <select className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-800 outline-none focus:border-enterprise-blue focus:ring-2 focus:ring-blue-100" value={form.role_codes[0]} onChange={(event) => update('role_codes', [event.target.value])}>
                <option value="sales_user">Sales User</option>
                <option value="purchase_user">Purchase User</option>
                <option value="manufacturing_user">Manufacturing User</option>
                <option value="inventory_manager">Inventory Manager</option>
                <option value="business_owner">Business Owner</option>
              </select>
            </FormField>
          )}
          {error && <p className="rounded-md bg-rose-50 px-3 py-2 text-sm font-bold text-rose-700">{error}</p>}
          <Button disabled={busy} type="submit">{busy ? 'Please wait' : mode === 'login' ? 'Sign In' : 'Create User'}</Button>
          <Button type="button" variant="ghost" onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}>
            {mode === 'login' ? 'Forget Password ? | Sign Up' : 'Already have login credentials?'}
          </Button>
        </div>
      </form>
    </main>
  );
}
