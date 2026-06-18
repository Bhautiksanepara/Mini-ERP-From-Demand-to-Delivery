import { Boxes, Menu, Plus, RefreshCw, XCircle, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "../components/common/Button";
import { DataTable } from "../components/common/DataTable";
import { FormPreview } from "../components/modules/FormPreview";
import { KanbanBoard } from "../components/modules/KanbanBoard";
import { StatusStrip } from "../components/modules/StatusStrip";
import { getRowsFromPayload, apiRequest } from "../services/apiClient";

const SORT_STORAGE_PREFIX = "mini-erp:table-sort:";
const DEFAULT_PAGE_SIZE = 20;
const KANBAN_LIMIT = 200;

function loadSortPreference(moduleKey) {
  try {
    const raw = sessionStorage.getItem(`${SORT_STORAGE_PREFIX}${moduleKey}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.sort_by) {
      return { sort_by: parsed.sort_by, sort_dir: parsed.sort_dir === "asc" ? "asc" : "desc" };
    }
  } catch {
    // ignore malformed session storage entries
  }
  return null;
}

function saveSortPreference(moduleKey, sortBy, sortDir) {
  const key = `${SORT_STORAGE_PREFIX}${moduleKey}`;
  if (!sortBy) {
    sessionStorage.removeItem(key);
    return;
  }
  sessionStorage.setItem(key, JSON.stringify({ sort_by: sortBy, sort_dir: sortDir }));
}

function buildEndpoint(config, status, searchTerm, showMineOnly, page, limit, sortBy, sortDir, view) {
  const params = new URLSearchParams();

  if (searchTerm.trim()) {
    params.set("search", searchTerm.trim());
  }

  if (showMineOnly) {
    params.set("mine", "true");
  }

  if (view === "kanban") {
    params.set("limit", String(KANBAN_LIMIT));
  } else {
    if (page) params.set("page", String(page));
    if (limit) params.set("limit", String(limit));
  }

  if (sortBy) {
    params.set("sort_by", sortBy);
    params.set("sort_dir", sortDir || "desc");
  }

  // Pass status filters to the backend
  if (config.statusFilters?.[status]) {
    Object.entries(config.statusFilters[status]).forEach(([key, val]) => {
      params.set(key, String(val));
    });
  } else if (status === "Components") {
    params.set("bom_filter", "components");
  } else if (status === "Operations") {
    params.set("bom_filter", "operations");
  } else if (status === "System Users") {
    params.set("role_filter", "non_admin");
  } else if (status === "Administrators") {
    params.set("role_filter", "admin");
  } else if (status === "Procure on Demand") {
    params.set("product_filter", "procure_on_demand");
  } else if (status === "Low Free Qty") {
    params.set("product_filter", "low_free_qty");
  } else if (status && status !== "All" && status !== "All Modules" && status !== "All Users") {
    params.set("status", status);
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

function DeliveryModal({ modal, onClose, onSuccess }) {
  const { row, items, qtyKey, orderedKey, deliverPath } = modal;
  const isSales = qtyKey === 'delivered_qty';
  const actionLabel = isSales ? 'Delivery' : 'Receipt';
  const qtyLabel = isSales ? 'New Delivered Qty' : 'New Received Qty';

  // Check if every item is already fully done — nothing left to deliver
  const allFull = items.every(item => Number(item[qtyKey] || 0) >= Number(item[orderedKey] || 0));
  const fixStatus = isSales ? 'Fully Delivered' : 'Fully Received';
  const syncEndpoint = deliverPath.replace(/\/(deliver|receive)$/, '/sync-status');

  // Store raw string so the user can freely clear and retype; convert only on submit/blur
  const [qtys, setQtys] = useState(() =>
    Object.fromEntries(items.map(item => [item.id, String(Number(item[qtyKey] || 0))]))
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleFixStatus() {
    setSaving(true);
    setError('');
    try {
      await apiRequest(syncEndpoint, { method: 'POST' });
      onSuccess();
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to fix order status');
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmit() {
    // Validate each item before sending
    for (const item of items) {
      const current = Number(item[qtyKey] || 0);
      const ordered = Number(item[orderedKey] || 0);
      const newQty = Number(qtys[item.id] ?? current);
      if (newQty < current) {
        setError(`Quantity for "${item.product_name || 'item'}" cannot be less than already ${isSales ? 'delivered' : 'received'} (${current}).`);
        return;
      }
      if (newQty > ordered) {
        setError(`Quantity for "${item.product_name || 'item'}" cannot exceed ordered quantity (${ordered}).`);
        return;
      }
    }
    const hasIncrease = items.some(item => Number(qtys[item.id] ?? 0) > Number(item[qtyKey] || 0));
    if (!hasIncrease) {
      setError('At least one quantity must be higher than the already done amount.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payloadItems = items.map(item => ({
        item_id: item.id,
        [qtyKey]: Number(qtys[item.id] ?? Number(item[qtyKey] || 0))
      }));
      await apiRequest(deliverPath, { method: 'POST', body: JSON.stringify({ items: payloadItems }) });
      onSuccess();
      onClose();
    } catch (err) {
      setError(err.message || `Failed to record ${actionLabel.toLowerCase()}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-xl bg-white shadow-2xl border border-slate-200 z-10 overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-5 py-4">
          <h3 className="text-base font-extrabold text-slate-900">Record {actionLabel} — {row.reference}</h3>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition">
            <XCircle size={18} />
          </button>
        </div>

        {allFull ? (
          <div className="p-6 text-center">
            <p className="font-semibold text-slate-700 mb-1">All items are already fully {isSales ? 'delivered' : 'received'}.</p>
            <p className="text-sm text-slate-500 mt-1">
              The order status is still <span className="font-semibold text-amber-600">{row.status}</span> but all quantities are complete.
              Click <strong>Fix Status</strong> to correct it to <span className="font-semibold text-emerald-600">{fixStatus}</span>.
            </p>
            {error && <p className="mt-3 text-xs font-medium text-rose-600">{error}</p>}
          </div>
        ) : (
          <div className="p-5">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs font-semibold text-slate-500 uppercase tracking-wide border-b border-slate-100">
                  <th className="text-left pb-2 pr-4">Product</th>
                  <th className="text-right pb-2 px-2">Ordered</th>
                  <th className="text-right pb-2 px-2">Done</th>
                  <th className="text-right pb-2 pl-2">{qtyLabel}</th>
                </tr>
              </thead>
              <tbody>
                {items.map(item => {
                  const ordered = Number(item[orderedKey] || 0);
                  const current = Number(item[qtyKey] || 0);
                  const isFullyDone = current >= ordered;
                  return (
                    <tr key={item.id} className="border-b border-slate-50">
                      <td className="py-2.5 pr-4 font-medium text-slate-800">{item.product_name || item.name || 'Item'}</td>
                      <td className="py-2.5 px-2 text-right text-slate-500">{ordered}</td>
                      <td className="py-2.5 px-2 text-right text-slate-400">{current}</td>
                      <td className="py-2.5 pl-2 text-right">
                        {isFullyDone ? (
                          <span className="text-xs font-semibold text-emerald-600 px-2">Complete</span>
                        ) : (
                          <input
                            type="number"
                            min={current}
                            max={ordered}
                            step="1"
                            value={qtys[item.id] ?? current}
                            onChange={e => setQtys(q => ({ ...q, [item.id]: e.target.value }))}
                            onBlur={e => {
                              const v = Math.min(ordered, Math.max(current, Number(e.target.value) || current));
                              setQtys(q => ({ ...q, [item.id]: String(v) }));
                            }}
                            className="w-24 rounded border border-slate-300 px-2 py-1 text-right text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {error && <p className="mt-3 text-xs font-medium text-rose-600">{error}</p>}
          </div>
        )}

        <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50/50 px-5 py-3">
          <button type="button" onClick={onClose} disabled={saving} className="px-4 py-2 text-sm font-semibold rounded-md border border-slate-200 text-slate-700 hover:bg-slate-100 disabled:opacity-50 transition">
            Cancel
          </button>
          {allFull ? (
            <button type="button" onClick={handleFixStatus} disabled={saving} className="px-4 py-2 text-sm font-semibold rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition">
              {saving ? 'Fixing…' : `Fix Status → ${fixStatus}`}
            </button>
          ) : (
            <button type="button" onClick={handleSubmit} disabled={saving} className="px-4 py-2 text-sm font-semibold rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition">
              {saving ? 'Saving…' : `Confirm ${actionLabel}`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
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

  // Server-side pagination states
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE);
  const [pagination, setPagination] = useState(null);
  const [tabCounts, setTabCounts] = useState(null);

  // Sorting state
  const [sortBy, setSortBy] = useState(null);
  const [sortDir, setSortDir] = useState("desc");

  // Drawer states
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [activeRecord, setActiveRecord] = useState(null);
  const [drawerLoading, setDrawerLoading] = useState(false);

  // Delivery/receipt modal state
  const [deliveryModal, setDeliveryModal] = useState(null);

  useEffect(() => {
    setShowMineOnly(initialFilters?.mine ?? false);
    setStatus(initialFilters?.status ?? config.statusLabels[0]);
    const storedSort = loadSortPreference(moduleKey);
    setSortBy(storedSort?.sort_by ?? null);
    setSortDir(storedSort?.sort_dir ?? "desc");
  }, [config, moduleKey, initialFilters]);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchTerm(localSearchTerm);
    }, 300);
    return () => clearTimeout(handler);
  }, [localSearchTerm]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [status, debouncedSearchTerm, showMineOnly, sortBy, sortDir, moduleKey]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    apiRequest(buildEndpoint(config, status, debouncedSearchTerm, showMineOnly, page, limit, sortBy, sortDir, view))
      .then((payload) => {
        const nextRows = getRowsFromPayload(
          payload,
          config.dataKey || moduleKey,
        );
        if (!cancelled) {
          setRows(nextRows);
          setPagination(payload.meta?.pagination || payload.pagination || payload.data?.pagination || null);
          setTabCounts(payload.meta?.tab_counts || payload.tab_counts || payload.data?.tab_counts || null);
          setSource("api");
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setRows([]);
          setPagination(null);
          setTabCounts(null);
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
  }, [config, moduleKey, reloadKey, debouncedSearchTerm, status, showMineOnly, page, limit, sortBy, sortDir, view]);

  const displayRows = useMemo(() => {
    return source === "api" ? rows : sampleRows;
  }, [rows, sampleRows, source]);

  const counts = useMemo(() => {
    return config.statusLabels.map((label) => {
      if (tabCounts && tabCounts[label] !== undefined) {
        return { label, count: tabCounts[label] };
      }
      return {
        label,
        count: countRowsForStatus(rows, label, status, displayRows, config)
      };
    });
  }, [config, displayRows, rows, status, tabCounts]);

  const handleSortChange = (column, direction) => {
    setSortBy(column);
    setSortDir(direction);
    saveSortPreference(moduleKey, column, direction);
  };

  const handlePageSizeChange = (size) => {
    setLimit(size);
    setPage(1);
  };

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
        } else if (newStatus === 'Partially Delivered') {
          if (row.status === 'Draft') {
            await apiRequest(`/sales-orders/${row.id}/confirm`, { method: 'POST' });
          }
          const detailRes = await apiRequest(`/sales-orders/${row.id}`);
          const items = detailRes.data?.sales_order?.items || [];
          const allFull = items.every(item => Number(item.delivered_qty || 0) >= Number(item.ordered_qty || 0));
          if (allFull) {
            await apiRequest(`/sales-orders/${row.id}/sync-status`, { method: 'POST' });
            return;
          }
          setDeliveryModal({ row, items, qtyKey: 'delivered_qty', orderedKey: 'ordered_qty', deliverPath: `/sales-orders/${row.id}/deliver` });
          return;
        } else if (newStatus === 'Fully Delivered') {
          if (row.status === 'Draft') {
            await apiRequest(`/sales-orders/${row.id}/confirm`, { method: 'POST' });
          }
          const detailRes = await apiRequest(`/sales-orders/${row.id}`);
          const items = detailRes.data?.sales_order?.items || [];
          const payloadItems = items.map(item => ({ item_id: item.id, delivered_qty: Number(item.ordered_qty || 0) }));
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
        } else if (newStatus === 'Partially Received') {
          if (row.status === 'Draft') {
            await apiRequest(`/purchase-orders/${row.id}/confirm`, { method: 'POST' });
          }
          const detailRes = await apiRequest(`/purchase-orders/${row.id}`);
          const items = detailRes.data?.purchase_order?.items || [];
          const allFull = items.every(item => Number(item.received_qty || 0) >= Number(item.ordered_qty || 0));
          if (allFull) {
            await apiRequest(`/purchase-orders/${row.id}/sync-status`, { method: 'POST' });
            return;
          }
          setDeliveryModal({ row, items, qtyKey: 'received_qty', orderedKey: 'ordered_qty', deliverPath: `/purchase-orders/${row.id}/receive` });
          return;
        } else if (newStatus === 'Fully Received') {
          if (row.status === 'Draft') {
            await apiRequest(`/purchase-orders/${row.id}/confirm`, { method: 'POST' });
          }
          const detailRes = await apiRequest(`/purchase-orders/${row.id}`);
          const items = detailRes.data?.purchase_order?.items || [];
          const payloadItems = items.map(item => ({ item_id: item.id, received_qty: Number(item.ordered_qty || 0) }));
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
          sortableColumns={config.sortableColumns}
          loading={loading}
          rows={displayRows}
          onRowClick={handleRowClick}
          sortBy={sortBy}
          sortDir={sortDir}
          onSortChange={handleSortChange}
          pagination={pagination}
          onPageChange={setPage}
          onPageSizeChange={handlePageSizeChange}
        />
      )}

      {deliveryModal && (
        <DeliveryModal
          modal={deliveryModal}
          onClose={() => setDeliveryModal(null)}
          onSuccess={() => setReloadKey(v => v + 1)}
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
