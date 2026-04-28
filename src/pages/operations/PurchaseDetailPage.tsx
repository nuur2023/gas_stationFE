import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Printer } from "lucide-react";
import {
  useDeletePurchaseItemMutation,
  useGetBusinessesQuery,
  useGetFuelTypesQuery,
  useGetPurchaseQuery,
  useGetSuppliersQuery,
  useUpdatePurchaseItemMutation,
} from "../../app/api/apiSlice";
import { useAppSelector } from "../../app/hooks";
import { DataTable, type Column } from "../../components/DataTable";
import { FormSelect, type SelectOption } from "../../components/FormSelect";
import { Modal } from "../../components/Modal";
import { useDeleteConfirm } from "../../hooks/useDeleteConfirm";
import { usePagePermissionActions } from "../../hooks/usePagePermissionActions";
import { useDebouncedValue } from "../../lib/hooks";
import { openPurchaseInvoicePdf } from "../../lib/purchaseInvoicePdf";
import type { PurchaseItem, PurchaseLineWrite } from "../../types/models";
import { formatDecimal } from "../../lib/formatNumber";

function recalcLine(line: PurchaseLineWrite): PurchaseLineWrite {
  const L = Number.parseFloat(String(line.liters).replace(",", "."));
  const p = Number.parseFloat(String(line.pricePerLiter).replace(",", "."));
  if (!Number.isFinite(L) || !Number.isFinite(p) || L < 0 || p < 0) return line;
  const t = (L * p).toFixed(2);
  return { ...line, totalAmount: t };
}

function lineFromItem(i: PurchaseItem): PurchaseLineWrite {
  return {
    fuelTypeId: i.fuelTypeId,
    liters: String(i.liters),
    pricePerLiter: String(i.pricePerLiter),
    totalAmount: String(i.totalAmount),
  };
}

function isLineValid(line: PurchaseLineWrite): boolean {
  const L = Number.parseFloat(String(line.liters).replace(",", "."));
  const p = Number.parseFloat(String(line.pricePerLiter).replace(",", "."));
  return (
    line.fuelTypeId > 0 &&
    Number.isFinite(L) &&
    L > 0 &&
    Number.isFinite(p) &&
    p >= 0
  );
}

export function PurchaseDetailPage() {
  const { canUpdate: routeCanUpdate } = usePagePermissionActions();
  const { purchaseId } = useParams<{ purchaseId: string }>();
  const id = Number(purchaseId);
  const role = useAppSelector((s) => s.auth.role);
  const authBusinessId = useAppSelector((s) => s.auth.businessId);
  const isSuperAdmin = role === "SuperAdmin";

  const { requestDelete, dialog: deleteDialog } = useDeleteConfirm();
  const { data, isLoading, isError } = useGetPurchaseQuery(id, {
    skip: !Number.isFinite(id) || id <= 0,
  });
  const { data: businessesData } = useGetBusinessesQuery({
    page: 1,
    pageSize: 500,
    q: undefined,
  });
  const { data: fuelTypes = [] } = useGetFuelTypesQuery();

  const { data: suppliersData } = useGetSuppliersQuery(
    {
      page: 1,
      pageSize: 1000,
      q: undefined,
      businessId: isSuperAdmin
        ? data?.businessId
        : (authBusinessId ?? undefined),
    },
    {
      skip:
        !data ||
        (!isSuperAdmin && (authBusinessId == null || authBusinessId <= 0)),
    },
  );

  const [updateItem, { isLoading: updating }] = useUpdatePurchaseItemMutation();
  const [deleteItem, { isLoading: deleting }] = useDeletePurchaseItemMutation();
  const lineSaving = updating;

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 250);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const [lineModalOpen, setLineModalOpen] = useState(false);
  const [editingItemId, setEditingItemId] = useState<number | null>(null);
  const [draft, setDraft] = useState<PurchaseLineWrite | null>(null);

  const businessName = useMemo(() => {
    if (!data) return "";
    return (
      businessesData?.items.find((b) => b.id === data.businessId)?.name ??
      `Business #${data.businessId}`
    );
  }, [data, businessesData?.items]);

  const supplierRow = useMemo(() => {
    if (!data) return null;
    return suppliersData?.items.find((s) => s.id === data.supplierId) ?? null;
  }, [data, suppliersData?.items]);

  const supplierName =
    supplierRow?.name ?? (data ? `Supplier #${data.supplierId}` : "");
  const supplierPhone = supplierRow?.phone?.trim() ?? "";

  const fuelNameById = useMemo(() => {
    const m = new Map<number, string>();
    for (const f of fuelTypes) m.set(f.id, f.fuelName);
    return m;
  }, [fuelTypes]);

  const fuelOptions: SelectOption[] = useMemo(
    () => fuelTypes.map((f) => ({ value: String(f.id), label: f.fuelName })),
    [fuelTypes],
  );

  const fuelName = (fid: number) => fuelNameById.get(fid) ?? String(fid);


  const items = data?.items ?? [];
  const subtotal = useMemo(
    () =>
      items
        .filter((i) => !i.isDeleted)
        .reduce((s, i) => s + Number(i.totalAmount), 0),
    [items],
  );

  const lineModalMoneySuffix = " (Dollar)";

  const filteredItems = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => {
      const name = fuelName(i.fuelTypeId).toLowerCase();
      return name.includes(q) || String(i.id).includes(q);
    });
  }, [items, debouncedSearch, fuelNameById]);

  const pageRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredItems.slice(start, start + pageSize);
  }, [filteredItems, page, pageSize]);

  function openEditLine(row: PurchaseItem) {
    setEditingItemId(row.id);
    setDraft(lineFromItem(row));
    setLineModalOpen(true);
  }

  function closeLineModal() {
    if (lineSaving) return;
    setLineModalOpen(false);
    setDraft(null);
    setEditingItemId(null);
  }

  async function saveLineModal() {
    if (!draft || editingItemId == null || !isLineValid(recalcLine(draft)))
      return;
    const body = recalcLine(draft);
    try {
      await updateItem({
        purchaseId: id,
        itemId: editingItemId,
        body,
      }).unwrap();
      closeLineModal();
      setSelected(new Set());
    } catch {
      /* RTK */
    }
  }

  function confirmDeleteOne(itemId: number) {
    requestDelete({
      title: "Delete line item?",
      description: "This line will be removed from the purchase.",
      action: async () => {
        await deleteItem({ purchaseId: id, itemId }).unwrap();
        setSelected((prev) => {
          const n = new Set(prev);
          n.delete(itemId);
          return n;
        });
      },
    });
  }

  function confirmDeleteSelected() {
    const ids = [...selected];
    requestDelete({
      title: `Delete ${ids.length} line item(s)?`,
      description: "Selected lines will be removed from this purchase.",
      action: async () => {
        for (const itemId of ids) {
          await deleteItem({ purchaseId: id, itemId }).unwrap();
        }
        setSelected(new Set());
      },
    });
  }

  function handlePrintPdf() {
    if (!data) return;
    openPurchaseInvoicePdf(data, {
      supplierName,
      supplierPhone: supplierPhone || undefined,
      businessName,
      fuelName,
    });
  }

  const columns: Column<PurchaseItem>[] = useMemo(
    () => [
      { key: "id", header: "ID", align: "center" },
      {
        key: "fuelTypeId",
        header: "Fuel type",
        align: "center",
        render: (r) => (
          <span className="inline-flex flex-wrap items-center justify-center gap-2 font-medium text-slate-800">
            {fuelName(r.fuelTypeId)}
            {r.isDeleted ? (
              <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-900">
                Removed
              </span>
            ) : null}
          </span>
        ),
      },
      {
        key: "liters",
        header: "Liters",
        align: "center",
        render: (r) => (
          <span className="tabular-nums">{formatDecimal(r.liters)}</span>
        ),
      },
      {
        key: "pricePerLiter",
        header: "Price / L",
        align: "center",
        render: (r) => (
          <span className="tabular-nums">
            Dollar {formatDecimal(r.pricePerLiter)}
          </span>
        ),
      },
      {
        key: "totalAmount",
        header: "Subtotal",
        align: "center",
        render: (r) => (
          <span className="font-medium tabular-nums text-slate-900">
            Dollar {formatDecimal(r.totalAmount)}
          </span>
        ),
      },
    ],
    [fuelNameById],
  );

  if (!Number.isFinite(id) || id <= 0) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
        Invalid purchase link.{" "}
        <Link
          to="/purchases"
          className="font-semibold text-emerald-800 underline"
        >
          Back to purchases
        </Link>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-900">
        Purchase not found or you do not have access.{" "}
        <Link to="/purchases" className="font-semibold underline">
          Back to purchases
        </Link>
      </div>
    );
  }

  if (isLoading && !data) {
    return (
      <div className="p-8 text-center text-slate-600">Loading purchase…</div>
    );
  }

  if (!data) return null;

  return (
    <>
      {deleteDialog}
      <div className="mx-auto max-w-6xl space-y-3">
        <div>
          <Link
            to="/purchases"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Purchases
          </Link>
        </div>
       
            <DataTable<PurchaseItem>
              title="Purchase line items"
              rows={pageRows}
              totalCount={filteredItems.length}
              page={page}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              search={search}
              onSearchChange={(q) => {
                setSearch(q);
                setPage(1);
              }}
              isLoading={isLoading}
              selectedIds={selected}
              onSelectedIdsChange={setSelected}
              onEdit={openEditLine}
              onDeleteOne={confirmDeleteOne}
              onDeleteSelected={confirmDeleteSelected}
              columns={columns}
              rowClassName={(r) =>
                r.isDeleted ? "bg-slate-50/90 opacity-80" : undefined
              }
              extraToolbar={
                <button
                  type="button"
                  onClick={handlePrintPdf}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
                >
                  <Printer className="h-4 w-4" />
                </button>
              }
              belowTable={
                <div className="space-y-1 border-t border-slate-200 bg-slate-50 px-4 py-3 text-sm">
                  <div className="flex flex-wrap items-center justify-end gap-x-8 gap-y-1">
                    <span className="text-slate-600">Subtotal</span>
                    <span className="min-w-[10rem] text-center font-semibold tabular-nums text-slate-900">
                      Dollar {formatDecimal(subtotal)}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-x-8 gap-y-1 text-emerald-800">
                    <span className="font-semibold">Grand total</span>
                    <span className="min-w-[10rem] text-center text-base font-bold tabular-nums">
                      Dollar {formatDecimal(subtotal)}
                    </span>
                  </div>
                </div>
              }
            />
        

        <Modal
          open={lineModalOpen}
          title="Edit line item"
          onClose={closeLineModal}
          className="max-w-md"
        >
          {draft && (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                void saveLineModal();
              }}
            >
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Fuel type
                </label>
                <FormSelect
                  options={fuelOptions}
                  value={
                    fuelOptions.find(
                      (o) => o.value === String(draft.fuelTypeId),
                    ) ?? null
                  }
                  onChange={(o) =>
                    setDraft((d) => {
                      if (!d) return d;
                      const next: PurchaseLineWrite = {
                        ...d,
                        fuelTypeId: o ? Number(o.value) : 0,
                      };
                      return next;
                    })
                  }
                  placeholder="Select fuel"
                  isDisabled={lineSaving}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Liters
                  </label>
                  <input
                    value={draft.liters}
                    onChange={(e) =>
                      setDraft((d) => {
                        if (!d) return d;
                        return recalcLine({ ...d, liters: e.target.value });
                      })
                    }
                    disabled={lineSaving}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-right tabular-nums outline-none ring-emerald-500/30 focus:ring-2"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Price / L{lineModalMoneySuffix}
                  </label>
                  <input
                    value={draft.pricePerLiter}
                    onChange={(e) =>
                      setDraft((d) => {
                        if (!d) return d;
                        return recalcLine({
                          ...d,
                          pricePerLiter: e.target.value,
                        });
                      })
                    }
                    disabled={lineSaving}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-right tabular-nums outline-none ring-emerald-500/30 focus:ring-2"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Line subtotal{lineModalMoneySuffix}
                </label>
                <input
                  value={draft.totalAmount}
                  onChange={(e) =>
                    setDraft((d) => {
                      if (!d) return d;
                      const next: PurchaseLineWrite = {
                        ...d,
                        totalAmount: e.target.value,
                      };
                      return next;
                    })
                  }
                  disabled={lineSaving}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-right tabular-nums outline-none ring-emerald-500/30 focus:ring-2"
                />
              </div>
              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={closeLineModal}
                  disabled={lineSaving}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    !isLineValid(recalcLine(draft)) ||
                    lineSaving ||
                    deleting ||
                    !routeCanUpdate
                  }
                  title={!routeCanUpdate ? "No update permission" : undefined}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {lineSaving ? "Saving…" : "Save"}
                </button>
              </div>
            </form>
          )}
        </Modal>
      </div>
    </>
  );
}
