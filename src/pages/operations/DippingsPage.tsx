import { useEffect, useMemo, useState } from "react";
import {
  useCreateDippingMutation,
  useDeleteDippingMutation,
  useGetBusinessesQuery,
  useGetDippingsQuery,
  useGetFuelTypesQuery,
  useGetStationsQuery,
  useUpdateDippingMutation,
} from "../../app/api/apiSlice";
import { useAppSelector } from "../../app/hooks";
import { DataTable } from "../../components/DataTable";
import { FormSelect, type SelectOption } from "../../components/FormSelect";
import { Modal } from "../../components/Modal";
import { useDeleteConfirm } from "../../hooks/useDeleteConfirm";
import { useDebouncedValue } from "../../lib/hooks";
import { formatDecimal } from "../../lib/formatNumber";
import {
  adminNeedsSettingsStation,
  resolveFormStationId,
  SETTINGS_STATION_HINT,
  showBusinessColumnInTables,
  showBusinessPickerInForms,
  showStationColumnInTables,
  showStationPickerInForms,
  useEffectiveStationId,
} from "../../lib/stationContext";
import type { Column } from "../../components/DataTable";
import type { Dipping, DippingWriteRequest } from "../../types/models";

export function DippingsPage() {
  const role = useAppSelector((s) => s.auth.role);
  const authBusinessId = useAppSelector((s) => s.auth.businessId);
  const effectiveStationId = useEffectiveStationId();
  const showBizPicker = showBusinessPickerInForms(role);
  const showStationPicker = showStationPickerInForms(role);

  const { requestDelete, dialog: deleteDialog } = useDeleteConfirm();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [search, setSearch] = useState("");
  const debounced = useDebouncedValue(search, 350);
  const { data, isFetching } = useGetDippingsQuery({
    page,
    pageSize,
    q: debounced || undefined,
    ...(effectiveStationId != null && effectiveStationId > 0
      ? { filterStationId: effectiveStationId }
      : {}),
  });
  const { data: fuelTypes = [] } = useGetFuelTypesQuery();
  const { data: businessesData } = useGetBusinessesQuery({
    page: 1,
    pageSize: 500,
    q: undefined,
  });
  const { data: stationsForTable } = useGetStationsQuery({
    page: 1,
    pageSize: 2000,
    q: undefined,
  });

  const [formBusinessId, setFormBusinessId] = useState<number | null>(null);
  const effectiveFormBusinessId = showBizPicker
    ? formBusinessId
    : authBusinessId;

  const { data: stationsForForm } = useGetStationsQuery(
    {
      page: 1,
      pageSize: 500,
      q: undefined,
      businessId: effectiveFormBusinessId ?? undefined,
    },
    { skip: effectiveFormBusinessId == null || effectiveFormBusinessId <= 0 },
  );

  const [createDipping] = useCreateDippingMutation();
  const [updateDipping] = useUpdateDippingMutation();
  const [deleteDipping] = useDeleteDippingMutation();

  const businessOptions: SelectOption[] = useMemo(() => {
    const items = businessesData?.items ?? [];
    if (showBizPicker) {
      return items.map((b) => ({ value: String(b.id), label: b.name }));
    }
    if (authBusinessId != null) {
      const b = items.find((x) => x.id === authBusinessId);
      return b ? [{ value: String(b.id), label: b.name }] : [];
    }
    return [];
  }, [businessesData?.items, showBizPicker, authBusinessId]);

  const stationOptionsBase: SelectOption[] = useMemo(
    () =>
      (stationsForForm?.items ?? []).map((s) => ({
        value: String(s.id),
        label: s.name,
      })),
    [stationsForForm?.items],
  );

  const fuelOptions: SelectOption[] = useMemo(
    () => fuelTypes.map((f) => ({ value: String(f.id), label: f.fuelName })),
    [fuelTypes],
  );

  const fuelNameById = useMemo(() => {
    const m = new Map<number, string>();
    for (const f of fuelTypes) m.set(f.id, f.fuelName);
    return m;
  }, [fuelTypes]);

  const stationNameById = useMemo(() => {
    const m = new Map<number, string>();
    for (const s of stationsForTable?.items ?? []) m.set(s.id, s.name);
    return m;
  }, [stationsForTable?.items]);

  const businessNameById = useMemo(() => {
    const m = new Map<number, string>();
    for (const b of businessesData?.items ?? []) m.set(b.id, b.name);
    return m;
  }, [businessesData?.items]);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Dipping | null>(null);
  const [form, setForm] = useState<DippingWriteRequest>({
    name: "",
    fuelTypeId: 0,
    amountLiter: "0",
    stationId: 0,
  });
  const [selected, setSelected] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (
      !open ||
      !showStationPicker ||
      formBusinessId == null ||
      formBusinessId <= 0
    )
      return;
    const items = stationsForForm?.items ?? [];
    if (items.length === 0) return;
    setForm((f) => {
      if (items.some((s) => s.id === f.stationId)) return f;
      return { ...f, stationId: items[0].id };
    });
  }, [open, showStationPicker, formBusinessId, stationsForForm?.items]);

  useEffect(() => {
    if (!open || showStationPicker) return;
    const sid =
      effectiveStationId != null && effectiveStationId > 0
        ? effectiveStationId
        : 0;
    setForm((f) => (f.stationId === sid ? f : { ...f, stationId: sid }));
  }, [open, showStationPicker, effectiveStationId]);

  const businessSel =
    businessOptions.find((o) => o.value === String(formBusinessId ?? "")) ??
    null;
  const fuelSel =
    fuelOptions.find((o) => o.value === String(form.fuelTypeId)) ?? null;
  const stationSel =
    stationOptionsBase.find((o) => o.value === String(form.stationId)) ?? null;

  function openCreate() {
    setEditing(null);
    if (showBizPicker) {
      setFormBusinessId(null);
    }
    const firstFuel = fuelTypes[0]?.id ?? 0;
    const defaultStation =
      effectiveStationId != null && effectiveStationId > 0
        ? effectiveStationId
        : (stationsForForm?.items[0]?.id ?? 0);
    setForm({
      name: "",
      fuelTypeId: firstFuel,
      amountLiter: "0",
      stationId: defaultStation,
    });
    setOpen(true);
  }

  function openEdit(row: Dipping) {
    setEditing(row);
    if (showBizPicker) {
      setFormBusinessId(row.businessId);
    }
    setForm({
      name: row.name ?? "",
      fuelTypeId: row.fuelTypeId,
      amountLiter: String(row.amountLiter),
      stationId: row.stationId,
    });
    setOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const stationId = resolveFormStationId(
      role,
      form.stationId,
      effectiveStationId,
    );
    if (!form.name.trim() || !form.fuelTypeId || !stationId) return;
    if (
      showBizPicker &&
      !editing &&
      (formBusinessId == null || formBusinessId <= 0)
    )
      return;
    if (!showBizPicker && (authBusinessId == null || authBusinessId <= 0))
      return;

    const body: DippingWriteRequest =
      showBizPicker && !editing && formBusinessId != null
        ? { ...form, stationId, businessId: formBusinessId }
        : { ...form, stationId };

    if (editing) {
      await updateDipping({ id: editing.id, body }).unwrap();
    } else {
      await createDipping(body).unwrap();
    }
    setOpen(false);
    setSelected(new Set());
  }

  function handleDeleteOne(id: number) {
    requestDelete({
      title: "Delete this dipping record?",
      description: "This record will be removed.",
      action: async () => {
        await deleteDipping(id).unwrap();
        setSelected((prev) => {
          const n = new Set(prev);
          n.delete(id);
          return n;
        });
      },
    });
  }

  function handleDeleteSelected() {
    const ids = [...selected];
    requestDelete({
      title: `Delete ${ids.length} row(s)?`,
      description: "Selected records will be permanently removed.",
      action: async () => {
        for (const id of ids) {
          await deleteDipping(id).unwrap();
        }
        setSelected(new Set());
      },
    });
  }

  const needsBusiness = showBizPicker
    ? formBusinessId == null || formBusinessId <= 0
    : authBusinessId == null || authBusinessId <= 0;
  const needsWorkspaceStation = adminNeedsSettingsStation(
    role,
    effectiveStationId,
  );
  const resolvedStation = resolveFormStationId(
    role,
    form.stationId,
    effectiveStationId,
  );
  const canSave =
    !needsBusiness &&
    !needsWorkspaceStation &&
    !!form.name.trim() &&
    !!form.fuelTypeId &&
    resolvedStation > 0;

  const tableColumns: Column<Dipping>[] = useMemo(() => {
    const idCol: Column<Dipping> = { key: "id", header: "ID" };
    const businessCol: Column<Dipping> = {
      key: "businessId",
      header: "Business",
      render: (r) => businessNameById.get(r.businessId) ?? r.businessId,
    };
    const middle: Column<Dipping>[] = [
      {
        key: "name",
        header: "Name",
        render: (r) => r.name || "—",
      },
      {
        key: "fuelTypeId",
        header: "Fuel type",
        render: (r) => fuelNameById.get(r.fuelTypeId) ?? r.fuelTypeId,
      },
      {
        key: "amountLiter",
        header: "Liters",
        render: (r) => formatDecimal(Number(r.amountLiter)),
      },
    ];
    const stationCol: Column<Dipping> = {
      key: "stationId",
      header: "Station",
      render: (r) => stationNameById.get(r.stationId) ?? r.stationId,
    };
    const out: Column<Dipping>[] = [idCol];
    if (showBusinessColumnInTables(role)) out.push(businessCol);
    out.push(...middle);
    if (showStationColumnInTables(role)) out.push(stationCol);
    return out;
  }, [role, fuelNameById, stationNameById, businessNameById]);

  return (
    <>
      {deleteDialog}
      <DataTable<Dipping>
        title="Dipping"
        addLabel="Add dipping"
        rows={data?.items ?? []}
        totalCount={data?.totalCount ?? 0}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        search={search}
        onSearchChange={setSearch}
        isLoading={isFetching}
        selectedIds={selected}
        onSelectedIdsChange={setSelected}
        onAdd={openCreate}
        onEdit={openEdit}
        onDeleteOne={handleDeleteOne}
        onDeleteSelected={handleDeleteSelected}
        columns={tableColumns}
      />
      <Modal
        open={open}
        title={editing ? "Edit dipping" : "Add dipping"}
        onClose={() => setOpen(false)}
      >
        <form onSubmit={handleSave} className="space-y-4">
          {showBizPicker && (
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Business
              </label>
              <FormSelect
                options={businessOptions}
                value={businessSel}
                onChange={(o) => {
                  setFormBusinessId(o ? Number(o.value) : null);
                  setForm((f) => ({ ...f, stationId: 0 }));
                }}
                placeholder="Select business"
              />
            </div>
          )}
          {needsBusiness && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {showBizPicker
                ? "Select a business to load stations for this dipping."
                : "No business assigned to your account."}
            </div>
          )}
          {needsWorkspaceStation && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {SETTINGS_STATION_HINT}
            </div>
          )}
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Name
            </label>
            <input
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Morning dip — Tank A"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none ring-emerald-500/30 focus:ring-2"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Fuel type
            </label>
            <FormSelect
              options={fuelOptions}
              value={fuelSel}
              onChange={(o) =>
                setForm((f) => ({ ...f, fuelTypeId: o ? Number(o.value) : 0 }))
              }
              placeholder="Select fuel type"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Amount (liters)
            </label>
            <input
              required
              value={form.amountLiter}
              onChange={(e) =>
                setForm((f) => ({ ...f, amountLiter: e.target.value }))
              }
              className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none ring-emerald-500/30 focus:ring-2"
            />
          </div>
          {showStationPicker && (
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Station
              </label>
              <FormSelect
                options={stationOptionsBase}
                value={stationSel}
                onChange={(o) =>
                  setForm((f) => ({ ...f, stationId: o ? Number(o.value) : 0 }))
                }
                placeholder={
                  needsBusiness ? "Select business first" : "Select station"
                }
                isDisabled={needsBusiness || stationOptionsBase.length === 0}
              />
            </div>
          )}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSave}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              Save
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
