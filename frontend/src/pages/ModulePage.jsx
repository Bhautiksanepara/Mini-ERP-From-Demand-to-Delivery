import { Boxes, Menu, Plus, RefreshCw } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '../components/common/Button';
import { DataTable } from '../components/common/DataTable';
import { FormPreview } from '../components/modules/FormPreview';
import { KanbanBoard } from '../components/modules/KanbanBoard';
import { StatusStrip } from '../components/modules/StatusStrip';
import { getRowsFromPayload, apiRequest } from '../services/apiClient';

function buildEndpoint(config, status, searchTerm) {
  const params = new URLSearchParams();
  const statusFilter = config.statusFilters?.[status] || {};

  for (const [key, value] of Object.entries(statusFilter)) {
    if (value !== undefined && value !== null && value !== '') {
      params.set(key, String(value));
    }
  }

  if (searchTerm.trim()) {
    params.set('search', searchTerm.trim());
  }

  const query = params.toString();
  return query ? `${config.endpoint}?${query}` : config.endpoint;
}

function filterRowsForStatus(rows, status, config) {
  if (config.statusFilters?.[status]) {
    return rows;
  }

  if (status === 'All' || status === 'All Modules') {
    return rows;
  }

  if (status === 'Low Free Qty') {
    return rows.filter((row) => Number(row.free_to_use_qty) <= 0);
  }

  if (status === 'Procure on Demand') {
    return rows.filter((row) => Boolean(row.procure_on_demand));
  }

  return rows;
}

function countRowsForStatus(rows, label, activeStatus, activeRows, config) {
  if (label === activeStatus) {
    return activeRows.length;
  }

  if (label === 'All' || label === 'All Modules' || label === 'All Users') {
    return rows.length;
  }

  if (config.statusFilters?.[label]?.status) {
    return rows.filter((row) => row.status === label).length;
  }

  if (config.statusFilters?.[label]?.action) {
    return rows.filter((row) => row.action === label).length;
  }

  if (config.statusFilters?.[label]?.movement_direction) {
    return rows.filter((row) => row.movement_direction === config.statusFilters[label].movement_direction).length;
  }

  if (config.statusFilters?.[label]?.movement_type) {
    return rows.filter((row) => row.movement_type === config.statusFilters[label].movement_type).length;
  }

  return filterRowsForStatus(rows, label, config).length;
}

export function ModulePage({ moduleKey, config, searchTerm = '' }) {
  const [rows, setRows] = useState([]);
  const [sampleRows] = useState(config.sample);
  const [source, setSource] = useState('api');
  const [status, setStatus] = useState(config.statusLabels[0]);
  const [view, setView] = useState('list');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    apiRequest(buildEndpoint(config, status, searchTerm))
      .then((payload) => {
        const nextRows = getRowsFromPayload(payload, config.dataKey || moduleKey);
        if (!cancelled) {
          setRows(nextRows);
          setSource('api');
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setRows([]);
          setSource('error');
          setError(err.message || 'Could not load records from the API');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [config, moduleKey, reloadKey, searchTerm, status]);

  const displayRows = useMemo(() => {
    const liveRows = filterRowsForStatus(rows, status, config);
    return source === 'api' ? liveRows : sampleRows;
  }, [config, rows, sampleRows, source, status]);

  const counts = useMemo(() => config.statusLabels.map((label) => ({
    label,
    count: countRowsForStatus(rows, label, status, displayRows, config)
  })), [config, displayRows, rows, status]);

  return (
    <main className="grid gap-5 p-6 max-md:p-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button className="min-w-24"><Plus size={17} />New</Button>
        <Button disabled={loading} variant="subtle" onClick={() => setReloadKey((value) => value + 1)}>
          <RefreshCw size={17} className={loading ? 'animate-spin' : ''} />Refresh
        </Button>
        <div className="grid w-48 grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1">
          <button className={`inline-flex min-h-9 items-center justify-center gap-1 rounded-md text-sm font-extrabold ${view === 'list' ? 'bg-white text-enterprise-blueDark shadow-sm' : 'text-slate-500'}`} onClick={() => setView('list')}><Menu size={15} />List</button>
          <button className={`inline-flex min-h-9 items-center justify-center gap-1 rounded-md text-sm font-extrabold ${view === 'kanban' ? 'bg-white text-enterprise-blueDark shadow-sm' : 'text-slate-500'}`} onClick={() => setView('kanban')}><Boxes size={15} />Kanban</button>
        </div>
        <span className={`ml-auto rounded-full px-3 py-1.5 text-xs font-extrabold ${source === 'api' ? 'bg-blue-50 text-enterprise-blueDark' : 'bg-amber-50 text-amber-700'}`}>
          {loading ? 'Loading API' : source === 'api' ? 'Live API' : 'API needs attention'}
        </span>
      </div>
      {error && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
          {error}
        </div>
      )}
      <StatusStrip activeStatus={status} counts={counts} onChange={setStatus} />
      {view === 'kanban' ? (
        <KanbanBoard config={config} rows={displayRows} />
      ) : (
        <DataTable columns={config.columns} loading={loading} rows={displayRows} />
      )}
      <FormPreview config={config} moduleKey={moduleKey} onCreated={() => setReloadKey((value) => value + 1)} />
    </main>
  );
}
