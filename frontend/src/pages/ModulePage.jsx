import { Boxes, Menu, Plus, RefreshCw, XCircle, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "../components/common/Button";
import { DataTable } from "../components/common/DataTable";
import { FormPreview } from "../components/modules/FormPreview";
import { KanbanBoard } from "../components/modules/KanbanBoard";
import { StatusStrip } from "../components/modules/StatusStrip";
import { getRowsFromPayload, apiRequest } from "../services/apiClient";

function buildEndpoint(config, status, searchTerm, showMineOnly) {
  const params = new URLSearchParams();

  if (searchTerm.trim()) {
    params.set("search", searchTerm.trim());
  }

  if (showMineOnly) {
    params.set("mine", "true");
  }

  const query = params.toString();
  return query ? `${config.endpoint}?${query}` : config.endpoint;
}

function filterRowsForStatus(rows, status, config) {
  if (status === "All" || status === "All Modules" || status === "All Users") {
    return rows;
  }

  if (status === "Low Free Qty") {
    return rows.filter((row) => Number(row.free_to_use_qty) <= 0);
  }

  if (status === "Procure on Demand") {
    return rows.filter((row) => Boolean(row.procure_on_demand));
  }

  if (status === "System Users") {
    return rows.filter((row) => {
      const roles = row.role_codes ? (typeof row.role_codes === 'string' ? row.role_codes.split(',') : row.role_codes) : (row.roles ? row.roles.map(r => typeof r === 'object' ? r.code : r) : []);
      return !roles.includes('admin');
    });
  }

  if (status === "Administrators") {
    return rows.filter((row) => {
      const roles = row.role_codes ? (typeof row.role_codes === 'string' ? row.role_codes.split(',') : row.role_codes) : (row.roles ? row.roles.map(r => typeof r === 'object' ? r.code : r) : []);
      return roles.includes('admin');
    });
  }

  if (config.dataKey === 'boms') {
    if (status === 'Components') {
      return rows.filter((row) => Number(row.component_count || 0) > 0 && Number(row.operation_count || 0) === 0);
    }
    if (status === 'Operations') {
      return rows.filter((row) => Number(row.operation_count || 0) > 0);
    }
  }

  if (config.statusFilters?.[status]) {
    const filter = config.statusFilters[status];
    return rows.filter((row) => {
      if (filter.status && row.status !== filter.status) return false;
      if (filter.action && row.action !== filter.action) return false;
      if (filter.movement_direction && row.movement_direction !== filter.movement_direction) return false;
      if (filter.movement_type && row.movement_type !== filter.movement_type) return false;
      if (filter.late) {
        const schedDate = row.scheduled_date || row.schedule_date;
        return row.status === 'Confirmed' && schedDate && new Date(schedDate) < new Date();
      }
      return true;
    });
  }

  return rows.filter((row) => row.status === status || row.action === status);
}

function countRowsForStatus(rows, label, activeStatus, activeRows, config) {
  if (label === "All" || label === "All Modules" || label === "All Users") {
    return rows.length;
  }
  return filterRowsForStatus(rows, label, config).length;
}

export function ModulePage({ moduleKey, config, initialFilters, user }) {
  const [rows, setRows] = useState([]);
  const [sampleRows] = useState(config.sample || []);
  const [source, setSource] = useState("api");
  const [status, setStatus] = useState(initialFilters?.status ?? config.statusLabels[0]);
  const [view, setView] = useState("list");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  // Search and filter states
  const [localSearchTerm, setLocalSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [showMineOnly, setShowMineOnly] = useState(initialFilters?.mine ?? false);

  // Drawer states
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [activeRecord, setActiveRecord] = useState(null);
  const [drawerLoading, setDrawerLoading] = useState(false);

  useEffect(() => {
    setShowMineOnly(initialFilters?.mine ?? false);
    setStatus(initialFilters?.status ?? config.statusLabels[0]);
  }, [config, moduleKey, initialFilters]);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchTerm(localSearchTerm);
    }, 300);
    return () => clearTimeout(handler);
  }, [localSearchTerm]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    apiRequest(buildEndpoint(config, status, debouncedSearchTerm, showMineOnly))
      .then((payload) => {
        const nextRows = getRowsFromPayload(
          payload,
          config.dataKey || moduleKey,
        );
        if (!cancelled) {
          setRows(nextRows);
          setSource("api");
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setRows([]);
          setSource("error");
          setError(err.message || "Could not load records from the API");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [config, moduleKey, reloadKey, debouncedSearchTerm, status, showMineOnly]);

  const displayRows = useMemo(() => {
    const liveRows = filterRowsForStatus(rows, status, config);
    return source === "api" ? liveRows : sampleRows;
  }, [config, rows, sampleRows, source, status]);

  const counts = useMemo(
    () =>
      config.statusLabels.map((label) => ({
        label,
        count: countRowsForStatus(rows, label, status, displayRows, config),
      })),
    [config, displayRows, rows, status],
  );

  const handleRowClick = (row) => {
    if (moduleKey === 'inventory' || moduleKey === 'audit') {
      setActiveRecord(row);
      setIsDrawerOpen(true);
      return;
    }

    setDrawerLoading(true);
    setIsDrawerOpen(true);
    setActiveRecord(null);

    apiRequest(`${config.endpoint}/${row.id}`)
      .then((res) => {
        const detail = res.data?.[moduleKey.replace(/s$/, '')] || res.data?.sales_order || res.data?.purchase_order || res.data?.manufacturing_order || res.data?.bom || res.data?.product || res.data?.user || row;
        setActiveRecord(detail);
      })
      .catch((err) => {
        console.error("Could not fetch record details", err);
        setActiveRecord(row);
      })
      .finally(() => {
        setDrawerLoading(false);
      });
  };

  const handleCardDrop = async (row, newStatus) => {
    const isLate = row.status === 'Confirmed' && (row.scheduled_date || row.schedule_date) && new Date(row.scheduled_date || row.schedule_date) < new Date();
    const currentColumn = isLate ? 'Late' : (row.status || row.action);

    if (currentColumn === newStatus) return;

    setLoading(true);
    setError("");
    try {
      if (moduleKey === 'sales') {
        if (newStatus === 'Confirmed') {
          if (currentColumn === 'Late') {
            const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
            await apiRequest(`/sales-orders/${row.id}`, {
              method: 'PATCH',
              body: JSON.stringify({ scheduled_date: tomorrow })
            });
          } else {
            await apiRequest(`/sales-orders/${row.id}/confirm`, { method: 'POST' });
          }
        } else if (newStatus === 'Partially Delivered' || newStatus === 'Fully Delivered') {
          if (row.status === 'Draft') {
            await apiRequest(`/sales-orders/${row.id}/confirm`, { method: 'POST' });
          }
          const detailRes = await apiRequest(`/sales-orders/${row.id}`);
          const items = detailRes.data?.sales_order?.items || [];
          const payloadItems = items.map(item => {
            const ordered = Number(item.ordered_qty || 0);
            const current = Number(item.delivered_qty || 0);
            const nextQty = newStatus === 'Fully Delivered'
              ? ordered
              : Math.min(ordered, current + Math.max(1, Math.ceil((ordered - current) / 2)));
            return { item_id: item.id, delivered_qty: nextQty };
          });
          await apiRequest(`/sales-orders/${row.id}/deliver`, {
            method: 'POST',
            body: JSON.stringify({ items: payloadItems })
          });
        } else if (newStatus === 'Late') {
          const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
          if (row.status === 'Draft') {
            await apiRequest(`/sales-orders/${row.id}`, {
              method: 'PATCH',
              body: JSON.stringify({ scheduled_date: yesterday })
            });
            await apiRequest(`/sales-orders/${row.id}/confirm`, { method: 'POST' });
          } else if (row.status === 'Confirmed') {
            throw new Error('Only Draft orders can be scheduled in the past to become Late');
          }
        } else if (newStatus === 'Cancelled') {
          await apiRequest(`/sales-orders/${row.id}/cancel`, { method: 'POST' });
        } else {
          throw new Error(`Invalid status transition to ${newStatus}`);
        }
      } else if (moduleKey === 'purchase') {
        if (newStatus === 'Confirmed') {
          if (currentColumn === 'Late') {
            const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
            await apiRequest(`/purchase-orders/${row.id}`, {
              method: 'PATCH',
              body: JSON.stringify({ scheduled_date: tomorrow })
            });
          } else {
            await apiRequest(`/purchase-orders/${row.id}/confirm`, { method: 'POST' });
          }
        } else if (newStatus === 'Partially Received' || newStatus === 'Fully Received') {
          if (row.status === 'Draft') {
            await apiRequest(`/purchase-orders/${row.id}/confirm`, { method: 'POST' });
          }
          const detailRes = await apiRequest(`/purchase-orders/${row.id}`);
          const items = detailRes.data?.purchase_order?.items || [];
          const payloadItems = items.map(item => {
            const ordered = Number(item.ordered_qty || 0);
            const current = Number(item.received_qty || 0);
            const nextQty = newStatus === 'Fully Received'
              ? ordered
              : Math.min(ordered, current + Math.max(1, Math.ceil((ordered - current) / 2)));
            return { item_id: item.id, received_qty: nextQty };
          });
          await apiRequest(`/purchase-orders/${row.id}/receive`, {
            method: 'POST',
            body: JSON.stringify({ items: payloadItems })
          });
        } else if (newStatus === 'Late') {
          const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
          if (row.status === 'Draft') {
            await apiRequest(`/purchase-orders/${row.id}`, {
              method: 'PATCH',
              body: JSON.stringify({ scheduled_date: yesterday })
            });
            await apiRequest(`/purchase-orders/${row.id}/confirm`, { method: 'POST' });
          } else if (row.status === 'Confirmed') {
            throw new Error('Only Draft orders can be scheduled in the past to become Late');
          }
        } else if (newStatus === 'Cancelled') {
          await apiRequest(`/purchase-orders/${row.id}/cancel`, { method: 'POST' });
        } else {
          throw new Error(`Invalid status transition to ${newStatus}`);
        }
      } else if (moduleKey === 'manufacturing') {
        if (newStatus === 'Confirmed') {
          if (currentColumn === 'Late') {
            const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
            await apiRequest(`/manufacturing-orders/${row.id}`, {
              method: 'PATCH',
              body: JSON.stringify({ schedule_date: tomorrow })
            });
          } else {
            await apiRequest(`/manufacturing-orders/${row.id}/confirm`, { method: 'POST' });
          }
        } else if (newStatus === 'In Progress') {
          if (row.status === 'Draft') {
            await apiRequest(`/manufacturing-orders/${row.id}/confirm`, { method: 'POST' });
          }
          await apiRequest(`/manufacturing-orders/${row.id}/start`, { method: 'POST' });
        } else if (newStatus === 'Done' || newStatus === 'To Close') {
          if (row.status === 'Draft') {
            await apiRequest(`/manufacturing-orders/${row.id}/confirm`, { method: 'POST' });
          }
          if (row.status === 'Draft' || row.status === 'Confirmed') {
            await apiRequest(`/manufacturing-orders/${row.id}/start`, { method: 'POST' });
          }
          await apiRequest(`/manufacturing-orders/${row.id}/produce`, { method: 'POST', body: '{}' });
        } else if (newStatus === 'Cancelled') {
          await apiRequest(`/manufacturing-orders/${row.id}/cancel`, { method: 'POST' });
        } else if (newStatus === 'Late') {
          const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
          if (row.status === 'Draft') {
            await apiRequest(`/manufacturing-orders/${row.id}`, {
              method: 'PATCH',
              body: JSON.stringify({ schedule_date: yesterday })
            });
            await apiRequest(`/manufacturing-orders/${row.id}/confirm`, { method: 'POST' });
          } else if (row.status === 'Confirmed') {
            throw new Error('Only Draft orders can be scheduled in the past to become Late');
          }
        } else {
          throw new Error(`Invalid status transition to ${newStatus}`);
        }
      } else if (moduleKey === 'products') {
        if (newStatus === 'Procure on Demand') {
          await apiRequest(`/products/${row.id}`, {
            method: 'PATCH',
            body: JSON.stringify({ procure_on_demand: true, procurement_method: row.procurement_method || 'purchase' })
          });
        } else if (newStatus === 'All') {
          await apiRequest(`/products/${row.id}`, {
            method: 'PATCH',
            body: JSON.stringify({ procure_on_demand: false })
          });
        }
      } else if (moduleKey === 'boms') {
        if (newStatus === 'Components') {
          const detailRes = await apiRequest(`/boms/${row.id}`);
          const details = detailRes.data?.bom || {};
          const components = details.components || [];
          if (components.length === 0) {
            components.push({ component_product_id: 3, to_consume_qty: 1, unit: 'Units' });
          }
          await apiRequest(`/boms/${row.id}`, {
            method: 'PATCH',
            body: JSON.stringify({
              components: components.map(c => ({
                component_product_id: c.component_product_id,
                to_consume_qty: c.to_consume_qty,
                unit: c.unit
              })),
              operations: []
            })
          });
        } else if (newStatus === 'Operations') {
          const detailRes = await apiRequest(`/boms/${row.id}`);
          const details = detailRes.data?.bom || {};
          const operations = details.operations || [];
          if (operations.length === 0) {
            operations.push({ operation_name: 'Assembly', work_center_id: 1, expected_duration_minutes: 60 });
          }
          await apiRequest(`/boms/${row.id}`, {
            method: 'PATCH',
            body: JSON.stringify({
              components: [],
              operations: operations.map(o => ({
                operation_name: o.operation_name,
                work_center_id: o.work_center_id,
                expected_duration_minutes: o.expected_duration_minutes,
                sequence_no: o.sequence_no
              }))
            })
          });
        } else if (newStatus === 'All') {
          // Allowed but no-op
        }
      } else if (moduleKey === 'users') {
        const currentRoles = row.role_codes ? (typeof row.role_codes === 'string' ? row.role_codes.split(',') : row.role_codes) : (row.roles ? row.roles.map(r => typeof r === 'object' ? r.code : r) : []);
        if (newStatus === 'Administrators') {
          if (!currentRoles.includes('admin')) {
            await apiRequest(`/users/${row.id}`, {
              method: 'PATCH',
              body: JSON.stringify({ role_codes: [...currentRoles, 'admin'] })
            });
          }
        } else if (newStatus === 'System Users') {
          if (currentRoles.includes('admin')) {
            await apiRequest(`/users/${row.id}`, {
              method: 'PATCH',
              body: JSON.stringify({ role_codes: currentRoles.filter(r => r !== 'admin') })
            });
          }
        }
      }
      setReloadKey((val) => val + 1);
    } catch (err) {
      setError(err.message || 'Failed to update record status via Drag and Drop');
    } finally {
      setLoading(false);
    }
  };

  const handleNewClick = () => {
    setActiveRecord(null);
    setIsDrawerOpen(true);
  };

  const showNewButton = moduleKey !== 'inventory' && moduleKey !== 'audit';

  return (
    <main className="grid gap-5 p-6 max-md:p-4">
      <div className="flex flex-wrap items-center gap-3">
        {showNewButton && (
          <Button className="min-w-24" onClick={handleNewClick}>
            <Plus size={17} />
            New
          </Button>
        )}
        <Button
          disabled={loading}
          variant="subtle"
          onClick={() => setReloadKey((value) => value + 1)}
        >
          <RefreshCw size={17} className={loading ? "animate-spin" : ""} />
          Refresh
        </Button>
        <label className="flex h-10 w-[min(300px,100%)] items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-slate-500 max-md:w-full">
          <Search size={16} />
          <input
            className="h-8 w-full border-0 bg-transparent text-sm font-medium outline-none text-slate-800"
            onChange={(event) => setLocalSearchTerm(event.target.value)}
            placeholder={`Search ${config.title || "records"}...`}
            value={localSearchTerm}
          />
        </label>
        {["sales", "purchase", "manufacturing"].includes(moduleKey) && (
          <label className="flex h-10 items-center gap-2 rounded-md border border-slate-300 bg-slate-50 px-3 text-slate-700 cursor-pointer hover:bg-slate-100 select-none">
            <input
              type="checkbox"
              className="h-4 w-4 text-enterprise-blue rounded border-slate-300 focus:ring-enterprise-blue cursor-pointer"
              checked={showMineOnly}
              onChange={(e) => setShowMineOnly(e.target.checked)}
            />
            <span className="text-sm font-bold">My Orders Only</span>
          </label>
        )}
        <div className="grid w-48 grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1">
          <button
            className={`inline-flex min-h-9 items-center justify-center gap-1 rounded-md text-sm font-extrabold ${view === "list" ? "bg-white text-enterprise-blueDark shadow-sm" : "text-slate-500"}`}
            onClick={() => setView("list")}
          >
            <Menu size={15} />
            List
          </button>
          <button
            className={`inline-flex min-h-9 items-center justify-center gap-1 rounded-md text-sm font-extrabold ${view === "kanban" ? "bg-white text-enterprise-blueDark shadow-sm" : "text-slate-500"}`}
            onClick={() => setView("kanban")}
          >
            <Boxes size={15} />
            Kanban
          </button>
        </div>
        <span
          className={`ml-auto rounded-full px-3 py-1.5 text-xs font-extrabold ${source === "api" ? "bg-blue-50 text-enterprise-blueDark" : "bg-amber-50 text-amber-700"}`}
        >
          {loading
            ? "Loading API"
            : source === "api"
              ? "Live API"
              : "API needs attention"}
        </span>
      </div>
      {error && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
          {error}
        </div>
      )}
      <StatusStrip activeStatus={status} counts={counts} onChange={setStatus} />
      {view === "kanban" ? (
        <KanbanBoard config={config} rows={displayRows} onCardClick={handleRowClick} onCardDrop={handleCardDrop} />
      ) : (
        <DataTable
          columns={config.columns}
          loading={loading}
          rows={displayRows}
          onRowClick={handleRowClick}
        />
      )}

      {/* Modal popup layout */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
            onClick={() => setIsDrawerOpen(false)}
          />
          {/* Modal Body */}
          <div className="relative w-full max-w-5xl rounded-xl bg-white shadow-2xl border border-slate-200 flex flex-col max-h-[90vh] z-50 animate-modal-enter overflow-hidden">
            {drawerLoading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-500 bg-slate-50 h-[300px]">
                <div className="animate-spin rounded-full h-8 w-8 border-4 border-slate-300 border-t-enterprise-blue" />
                <span className="text-sm font-semibold text-slate-600">Loading details from database...</span>
              </div>
            ) : (
              <FormPreview
                config={config}
                moduleKey={moduleKey}
                selectedRecord={activeRecord}
                user={user}
                onClose={() => setIsDrawerOpen(false)}
                onCreated={() => {
                  setReloadKey((value) => value + 1);
                  setIsDrawerOpen(false);
                }}
              />
            )}
          </div>
        </div>
      )}
    </main>
  );
}
