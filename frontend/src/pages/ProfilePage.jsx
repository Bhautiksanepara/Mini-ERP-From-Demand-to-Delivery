import { Camera, Save, ShieldCheck, User as UserIcon } from 'lucide-react';
import { useRef, useState } from 'react';
import { Button } from '../components/common/Button';
import { FormField } from '../components/common/FormField';
import { apiRequest } from '../services/apiClient';
import { cn } from '../utils/formatters';

function normalizeApiErrors(apiErrors) {
  if (!Array.isArray(apiErrors)) return apiErrors || {};

  return apiErrors.reduce((nextErrors, issue) => {
    const path = String(issue.path || '').replace(/^body\./, '');
    if (path) nextErrors[path] = issue.message;
    return nextErrors;
  }, {});
}

export function ProfilePage({ user, onUserUpdate }) {
  const [form, setForm] = useState({
    full_name: user?.full_name || '',
    mobile_number: user?.mobile_number || '',
    address: user?.address || ''
  });
  const [photo, setPhoto] = useState(
    user?.profile_photo ? `data:${user.profile_photo_mime || 'image/jpeg'};base64,${user.profile_photo}` : null
  );
  const [photoChanged, setPhotoChanged] = useState(false);
  const [photoBase64, setPhotoBase64] = useState('');
  const [photoMime, setPhotoMime] = useState(null);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const fileInputRef = useRef(null);

  function updateField(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
    setMessage('');
  }

  function handlePhotoChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result);
      setPhoto(dataUrl);
      setPhotoBase64(dataUrl.split(',')[1] || '');
      setPhotoMime(file.type);
      setPhotoChanged(true);
      setMessage('');
    };
    reader.readAsDataURL(file);
  }

  function handleRemovePhoto() {
    setPhoto(null);
    setPhotoBase64('');
    setPhotoMime(null);
    setPhotoChanged(true);
    setMessage('');
  }

  function validate() {
    const nextErrors = {};
    if (!form.full_name.trim()) nextErrors.full_name = 'Name is required';
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage('');
    if (!validate()) return;

    setSaving(true);
    try {
      const payload = {
        full_name: form.full_name.trim(),
        address: form.address.trim() || null,
        mobile_number: form.mobile_number.trim() || null
      };

      if (photoChanged) {
        payload.profile_photo = photoBase64;
        payload.profile_photo_mime = photoBase64 ? photoMime : null;
      }

      const response = await apiRequest(`/users/${user.id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload)
      });

      onUserUpdate?.(response.data?.user);
      setPhotoChanged(false);
      setMessage(response.message || 'Profile updated successfully');
    } catch (error) {
      setMessage(error.message || 'Could not update profile');
      if (error.errors) setErrors(normalizeApiErrors(error.errors));
    } finally {
      setSaving(false);
    }
  }

  const roleNames = (user?.roles || []).map((role) => (typeof role === 'object' ? role.name || role.code : role));
  const isSuccess = message && /updated/i.test(message);

  return (
    <main className="grid gap-6 p-6 max-md:p-4 bg-enterprise-shell">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-800">My Profile</h1>
        <p className="text-sm font-semibold text-slate-400">View and update your personal information.</p>
      </div>

      <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <div className="flex h-fit flex-col items-center gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="relative">
            <div className="grid h-32 w-32 place-items-center overflow-hidden rounded-full border-4 border-slate-100 bg-slate-100 text-slate-400">
              {photo ? <img src={photo} alt="Profile" className="h-full w-full object-cover" /> : <UserIcon size={56} />}
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="absolute bottom-0 right-0 grid h-9 w-9 place-items-center rounded-full border-2 border-white bg-enterprise-blue text-white shadow-sm transition hover:bg-enterprise-blueDark active:scale-95"
              title="Change photo"
            >
              <Camera size={16} />
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
          </div>

          <div className="text-center">
            <p className="text-base font-extrabold text-slate-800">{user?.full_name}</p>
            <p className="text-sm font-semibold text-slate-400">@{user?.login_id}</p>
          </div>

          {roleNames.length > 0 && (
            <div className="flex flex-wrap justify-center gap-2">
              {roleNames.map((role) => (
                <span key={role} className="flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
                  <ShieldCheck size={12} />
                  {role}
                </span>
              ))}
            </div>
          )}

          {photo && (
            <button type="button" onClick={handleRemovePhoto} className="text-xs font-bold text-red-500 hover:underline">
              Remove photo
            </button>
          )}
        </div>

        <div className="grid gap-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          {message && (
            <div className={cn(
              'rounded-lg border px-4 py-2 text-sm font-bold',
              isSuccess ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-700'
            )}>
              {message}
            </div>
          )}

          <div>
            <h3 className="mb-4 border-b border-slate-100 pb-2 text-sm font-black uppercase tracking-wider text-slate-800">Account Information</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Login ID" value={user?.login_id || ''} disabled />
              <FormField label="Email" value={user?.email || ''} disabled />
              <FormField label="Position" value={user?.position || '-'} disabled />
            </div>
          </div>

          <div>
            <h3 className="mb-4 border-b border-slate-100 pb-2 text-sm font-black uppercase tracking-wider text-slate-800">Personal Details</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Full Name" value={form.full_name} onChange={(value) => updateField('full_name', value)} error={errors.full_name} />
              <FormField label="Mobile Number" value={form.mobile_number} onChange={(value) => updateField('mobile_number', value)} error={errors.mobile_number} />
              <div className="sm:col-span-2">
                <FormField label="Address" value={form.address} onChange={(value) => updateField('address', value)} error={errors.address} />
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={saving} className="px-6">
              <Save size={16} />
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </form>
    </main>
  );
}
