import { useEffect, useMemo, useState } from "react";
import {
  useCreateLiterReceivedMutation,
  useDeleteLiterReceivedMutation,
  useGetBusinessesQuery,
  useGetFuelTypesQuery,
  useGetLiterReceivedsQuery,
  useGetPendingPoolTransfersForConfirmQuery,
  useGetStationsQuery,
  useUpdateLiterReceivedMutation,
} from "../../app/api/apiSlice";
import { useAppSelector } from "../../app/hooks";
import { DataTable, type Column } from "../../components/DataTable";
import { DateField } from "../../components/DateField";
import { FormSelect, type SelectOption } from "../../components/FormSelect";
import { Modal } from "../../components/Modal";
import { useDeleteConfirm } from "../../hooks/useDeleteConfirm";
import { useToast } from "../../components/ToastProvider";
import { useDebouncedValue } from "../../lib/hooks";
import {
  adminNeedsSettingsStation,
  SETTINGS_STATION_HINT,
  showBusinessColumnInTables,
  showBusinessPickerInForms,
  showStationColumnInTables,
  showStationPickerInForms,
  useEffectiveStationId,
} from "../../lib/stationContext";
import type {
  LiterFlowType,
  LiterReceived,
  LiterReceivedWriteRequest,
} from "../../types/models";
import { formatDecimal } from "../../lib/formatNumber";

const FLOW_OPTIONS: SelectOption[] = [
  { value: "In", label: "In (delivery)" },
  { value: "Out", label: "Out (transfer)" },
];

function normalizeFlowType(raw: string): LiterFlowType {
  const u = raw?.trim();
  if (u === "Out") return "Out";
  return "In";
}

function getApiErrorMessage(error: unknown): string {
  if (error && typeof error === "object" && "data" in error) {
    const data = (error as { data?: unknown }).data;
    if (typeof data === "string" && data.trim()) return data;
    if (data && typeof data === "object" && "message" in data) {
      const msg = (data as { message?: unknown }).message;
      if (typeof msg === "string" && msg.trim()) return msg;
    }
  }
  if (error && typeof error === "object" && "error" in error) {
    const msg = (error as { error?: unknown }).error;
    if (typeof msg === "string" && msg.trim()) return msg;
  }
  return "Request failed. Please try again.";
}

export function LiterReceivedsPage() {
  const role = useAppSelector((s) => s.auth.role);
  const authBusinessId = useAppSelector((s) => s.auth.businessId);
  const effectiveStationId = useEffectiveStationId();
  const showBizPicker = showBusinessPickerInForms(role);
  const showStationPicker = showStationPickerInForms(role);

  const { requestDelete, dialog: deleteDialog } = useDeleteConfirm();
  const { showError, showSuccess } = useToast();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [search, setSearch] = useState("");
  const debounced = useDebouncedValue(search, 350);
  const { data, isFetching } = useGetLiterReceivedsQuery({
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

  const [createLiterReceived] = useCreateLiterReceivedMutation();
  const [updateLiterReceived] = useUpdateLiterReceivedMutation();
  const [deleteLiterReceived] = useDeleteLiterReceivedMutation();

  const fuelOptions: SelectOption[] = useMemo(
    () => fuelTypes.map((f) => ({ value: String(f.id), label: f.fuelName })),
    [fuelTypes],
  );

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

  /** For Out (staff): other stations in the business (not the assigned one). */
  const destinationStationOptions: SelectOption[] = useMemo(() => {
    if (effectiveStationId == null || effectiveStationId <= 0)
      return stationOptionsBase;
    return stationOptionsBase.filter(
      (o) => o.value !== String(effectiveStationId),
    );
  }, [stationOptionsBase, effectiveStationId]);

  const businessSel =
    businessOptions.find((o) => o.value === String(formBusinessId ?? "")) ??
    null;

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
  const [editing, setEditing] = useState<LiterReceived | null>(null);
  const [form, setForm] = useState<{
    type: LiterFlowType;
    targo: string;
    driverName: string;
    fuelTypeId: number;
    receivedLiter: string;
    stationId: number;
    toStationId: number;
    /** In (delivery) optional origin; 0 = none */
    fromStationId: number;
    confirmPoolTransferReceived: boolean;
    /** Selected pending business pool transfer id (Out). */
    confirmTransferInventoryId: number;
  }>({
    type: "In",
    targo: "",
    driverName: "",
    fuelTypeId: 0,
    receivedLiter: "0",
    stationId: 0,
    toStationId: 0,
    fromStationId: 0,
    confirmPoolTransferReceived: false,
    confirmTransferInventoryId: 0,
  });

  const pendingTransfersSkip =
    effectiveFormBusinessId == null ||
    effectiveFormBusinessId <= 0 ||
    form.type !== "Out" ||
    form.toStationId <= 0 ||
    form.fuelTypeId <= 0;

  const { data: pendingPoolTransfers = [] } = useGetPendingPoolTransfersForConfirmQuery(
    {
      businessId: effectiveFormBusinessId ?? 0,
      toStationId: form.toStationId,
      fuelTypeId: form.fuelTypeId,
    },
    { skip: pendingTransfersSkip },
  );

  const pendingTransferOptions: SelectOption[] = useMemo(
    () =>
      pendingPoolTransfers.map((p) => ({
        value: String(p.id),
        label: `${formatDecimal(p.liters)} L · ${new Date(p.date).toLocaleDateString()} (#${p.id})`,
      })),
    [pendingPoolTransfers],
  );

  const pendingTransferSel: SelectOption | null =
    pendingTransferOptions.find(
      (o) => o.value === String(form.confirmTransferInventoryId),
    ) ?? null;

  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [recordDate, setRecordDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );

  useEffect(() => {
    if (
      !open ||
      !showBizPicker ||
      formBusinessId == null ||
      formBusinessId <= 0
    )
      return;
    const items = stationsForForm?.items ?? [];
    if (items.length === 0) return;
    setForm((f) => {
      if (f.type === "In" && items.some((s) => s.id === f.stationId)) return f;
      if (
        f.type === "Out" &&
        items.some((s) => s.id === f.stationId) &&
        items.some((s) => s.id === f.toStationId)
      )
        return f;
      const first = items[0].id;
      return {
        ...f,
        stationId:
          f.stationId > 0 && items.some((s) => s.id === f.stationId)
            ? f.stationId
            : first,
        toStationId:
          f.toStationId > 0 &&
          items.some((s) => s.id === f.toStationId) &&
          f.toStationId !== first
            ? f.toStationId
            : items.length > 1
              ? (items.find((s) => s.id !== first)?.id ?? 0)
              : 0,
        confirmTransferInventoryId: 0,
      };
    });
  }, [open, showBizPicker, formBusinessId, stationsForForm?.items]);

  useEffect(() => {
    if (!open || showStationPicker) return;
    const sid =
      effectiveStationId != null && effectiveStationId > 0
        ? effectiveStationId
        : 0;
    setForm((f) => (f.stationId === sid ? f : { ...f, stationId: sid }));
  }, [open, showStationPicker, effectiveStationId]);

  const staffHasStation = effectiveStationId != null && effectiveStationId > 0;

  const flowSel =
    FLOW_OPTIONS.find((o) => o.value === form.type) ?? FLOW_OPTIONS[0];
  const fuelSel =
    fuelOptions.find((o) => o.value === String(form.fuelTypeId)) ?? null;
  const stationInSel =
    stationOptionsBase.find((o) => o.value === String(form.stationId)) ?? null;
  const outSendingStationSel =
    stationOptionsBase.find((o) => o.value === String(form.stationId)) ?? null;

  const receivingStationIdForInFilter = useMemo(() => {
    if (form.type !== "In") return 0;
    if (showStationPicker) return form.stationId;
    if (staffHasStation && effectiveStationId != null && effectiveStationId > 0)
      return effectiveStationId;
    return form.stationId;
  }, [
    form.type,
    form.stationId,
    showStationPicker,
    staffHasStation,
    effectiveStationId,
  ]);

  const inFromStationOptions: SelectOption[] = useMemo(() => {
    if (form.type !== "In") return stationOptionsBase;
    if (receivingStationIdForInFilter <= 0) return stationOptionsBase;
    return stationOptionsBase.filter(
      (o) => Number(o.value) !== receivingStationIdForInFilter,
    );
  }, [stationOptionsBase, form.type, receivingStationIdForInFilter]);

  const inFromStationSel =
    form.fromStationId > 0
      ? (inFromStationOptions.find(
          (o) => o.value === String(form.fromStationId),
        ) ?? null)
      : null;

  const toStationSel =
    (form.type === "Out"
      ? showStationPicker
        ? stationOptionsBase
        : destinationStationOptions
      : stationOptionsBase
    ).find((o) => o.value === String(form.toStationId)) ?? null;

  const needsBusiness = showBizPicker
    ? formBusinessId == null || formBusinessId <= 0
    : authBusinessId == null || authBusinessId <= 0;
  const needsWorkspaceStation = adminNeedsSettingsStation(
    role,
    effectiveStationId,
  );

  const canSave = useMemo(() => {
    if (needsBusiness || needsWorkspaceStation || form.fuelTypeId <= 0)
      return false;
    if (!form.targo.trim() || !form.driverName.trim()) return false;
    const L = Number.parseFloat(String(form.receivedLiter).replace(",", "."));
    if (!Number.isFinite(L) || L <= 0) return false;

    if (form.type === "In") {
      if (showStationPicker) return form.stationId > 0;
      return staffHasStation || form.stationId > 0;
    }

    // Out
    if (form.toStationId <= 0) return false;
    const sourceId = showStationPicker
      ? form.stationId
      : (effectiveStationId ?? 0);
    if (sourceId <= 0) return false;
    if (form.toStationId === sourceId) return false;
    if (showStationPicker && form.stationId <= 0) return false;
    if (
      form.confirmPoolTransferReceived &&
      (!form.confirmTransferInventoryId || form.confirmTransferInventoryId <= 0)
    )
      return false;
    return true;
  }, [
    needsBusiness,
    needsWorkspaceStation,
    form,
    showStationPicker,
    staffHasStation,
    effectiveStationId,
  ]);

  useEffect(() => {
    if (form.type !== "Out") {
      setForm((f) =>
        f.confirmPoolTransferReceived || f.confirmTransferInventoryId
          ? {
              ...f,
              confirmPoolTransferReceived: false,
              confirmTransferInventoryId: 0,
            }
          : f,
      );
    }
  }, [form.type]);

  function openCreate() {
    setEditing(null);
    const firstFuel = fuelTypes[0]?.id ?? 0;
    if (showBizPicker) {
      setFormBusinessId(null);
      setForm({
        type: "In",
        targo: "",
        driverName: "",
        fuelTypeId: firstFuel,
        receivedLiter: "0",
        stationId: 0,
        toStationId: 0,
        fromStationId: 0,
        confirmPoolTransferReceived: false,
        confirmTransferInventoryId: 0,
      });
      setRecordDate(new Date().toISOString().slice(0, 10));
      setOpen(true);
      return;
    }
    const defaultSt =
      effectiveStationId != null && effectiveStationId > 0
        ? effectiveStationId
        : (stationsForForm?.items[0]?.id ?? 0);
    setForm({
      type: "In",
      targo: "",
      driverName: "------------",
      fuelTypeId: firstFuel,
      receivedLiter: "0",
      stationId: defaultSt,
      toStationId: 0,
      fromStationId: 0,
      confirmPoolTransferReceived: false,
      confirmTransferInventoryId: 0,
    });
    setRecordDate(new Date().toISOString().slice(0, 10));
    setOpen(true);
  }

  function openEdit(row: LiterReceived) {
    setEditing(row);
    if (showBizPicker) {
      setFormBusinessId(row.businessId);
    }
    const flow = normalizeFlowType(row.type);
    setForm({
      type: flow,
      targo: row.targo ?? "",
      driverName: row.driverName ?? row.name ?? "",
      fuelTypeId: row.fuelTypeId,
      receivedLiter: String(row.receivedLiter),
      stationId: row.stationId,
      toStationId: row.toStationId ?? 0,
      fromStationId: row.fromStationId ?? 0,
      confirmPoolTransferReceived: false,
      confirmTransferInventoryId: 0,
    });
    setRecordDate(
      row.date
        ? row.date.slice(0, 10)
        : row.createdAt
          ? row.createdAt.slice(0, 10)
          : new Date().toISOString().slice(0, 10),
    );
    setOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!canSave) return;

    const stationPayload =
      form.type === "In"
        ? showStationPicker
          ? form.stationId
          : staffHasStation
            ? 0
            : form.stationId
        : showStationPicker
          ? form.stationId
          : 0;

    const body: LiterReceivedWriteRequest = {
      type: form.type,
      targo: form.targo.trim(),
      driverName: form.driverName.trim(),
      fuelTypeId: form.fuelTypeId,
      receivedLiter: form.receivedLiter,
      stationId: stationPayload,
      ...(form.type === "Out" ? { toStationId: form.toStationId } : {}),
      ...(form.type === "In"
        ? { fromStationId: form.fromStationId > 0 ? form.fromStationId : null }
        : {}),
      ...(showBizPicker && formBusinessId != null
        ? { businessId: formBusinessId }
        : {}),
      recordedAt: `${recordDate}T12:00:00.000Z`,
      ...(form.type === "Out"
        ? {
            confirmBusinessPoolTransferReceived: form.confirmPoolTransferReceived,
            ...(form.confirmPoolTransferReceived && form.confirmTransferInventoryId > 0
              ? { confirmTransferInventoryId: form.confirmTransferInventoryId }
              : {}),
          }
        : {}),
    };

    try {
      if (editing) {
        await updateLiterReceived({ id: editing.id, body }).unwrap();
        showSuccess("Liter received updated.");
      } else {
        await createLiterReceived(body).unwrap();
        showSuccess("Liter received created.");
      }
      setOpen(false);
      setSelected(new Set());
    } catch (error) {
      showError(getApiErrorMessage(error));
    }
  }

  function handleDeleteOne(id: number) {
    requestDelete({
      title: "Delete this record?",
      description:
        "This liter received entry will be removed and dipping will be adjusted.",
      action: async () => {
        await deleteLiterReceived(id).unwrap();
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
      description: "Selected records will be removed and dipping adjusted.",
      action: async () => {
        for (const id of ids) {
          await deleteLiterReceived(id).unwrap();
        }
        setSelected(new Set());
      },
    });
  }

  const tableColumns: Column<LiterReceived>[] = useMemo(() => {
    const idCol: Column<LiterReceived> = { key: "id", header: "ID" };
    const businessCol: Column<LiterReceived> = {
      key: "businessId",
      header: "Business",
      render: (r) => businessNameById.get(r.businessId) ?? r.businessId,
    };
    const middle: Column<LiterReceived>[] = [
      {
        key: "type",
        header: "Flow",
        render: (r) => {
          const f = normalizeFlowType(r.type);
          return f === "Out" ? "Out" : r.type === "In" ? "In" : `${r.type}`;
        },
      },
      {
        key: "fromStationId",
        header: "From",
        render: (r) =>
          normalizeFlowType(r.type) === "In" && r.fromStationId
            ? (stationNameById.get(r.fromStationId) ?? `#${r.fromStationId}`)
            : "—",
      },
      { key: "targo", header: "Targo", render: (r) => r.targo || "—" },
      {
        key: "driverName",
        header: "Driver",
        render: (r) => r.driverName || r.name || "—",
      },
      {
        key: "fuelTypeId",
        header: "Fuel type",
        render: (r) => fuelNameById.get(r.fuelTypeId) ?? r.fuelTypeId,
      },
      {
        key: "receivedLiter",
        header: "Liters",
        render: (r) => formatDecimal(r.receivedLiter),
      },
    ];
    const stationCol: Column<LiterReceived> = {
      key: "stationId",
      header: "Station / transfer",
      render: (r) => {
        const from = stationNameById.get(r.stationId) ?? `#${r.stationId}`;
        if (normalizeFlowType(r.type) === "Out" && r.toStationId) {
          const to =
            stationNameById.get(r.toStationId) ?? `#${r.toStationId}`;
          return `${from} → ${to}`;
        }
        return from;
      },
    };
    const tail: Column<LiterReceived>[] = [
      {
        key: "createdAt",
        header: "Recorded",
        render: (r) =>
          r.createdAt ? new Date(r.createdAt).toLocaleString() : "—",
      },
    ];
    const out: Column<LiterReceived>[] = [idCol];
    if (showBusinessColumnInTables(role)) out.push(businessCol);
    out.push(...middle);
    if (showStationColumnInTables(role)) out.push(stationCol);
    out.push(...tail);
    return out;
  }, [role, fuelNameById, stationNameById, businessNameById]);

  const showReceivingStation = form.type === "In" && showStationPicker;
  const showOutSendingStation = form.type === "Out" && showStationPicker;
  const showToStation = form.type === "Out";
  const showInOptionalFromStation = form.type === "In" && !needsBusiness;

  return (
    <>
      {deleteDialog}
      <DataTable<LiterReceived>
        title="Liter received"
        addLabel="Add record"
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
        title={editing ? "Edit liter received" : "Add liter received"}
        onClose={() => setOpen(false)}
        className="max-w-4xl"
      >
        <form onSubmit={handleSave} className="space-y-4">
          {showBizPicker && (
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Business
              </label>
              <FormSelect
                options={businessOptions}
                value={businessSel}
                onChange={(o) => {
                  setFormBusinessId(o ? Number(o.value) : null);
                  setForm((f) => ({ ...f, stationId: 0, toStationId: 0 }));
                }}
                placeholder="Select business"
                isDisabled={!!editing}
              />
            </div>
          )}

          {needsBusiness && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {showBizPicker
                ? "Select a business to load stations."
                : "No business assigned to your account."}
            </div>
          )}
          {needsWorkspaceStation && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {SETTINGS_STATION_HINT}
            </div>
          )}

          <DateField value={recordDate} onChange={setRecordDate} />

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Type
              </label>
              <FormSelect
                options={FLOW_OPTIONS}
                value={flowSel}
                onChange={(o) => {
                  const v = (
                    o?.value === "Out" ? "Out" : "In"
                  ) as LiterFlowType;
                  setForm((f) => ({
                    ...f,
                    type: v,
                    toStationId: v === "In" ? 0 : f.toStationId,
                    fromStationId: v === "Out" ? 0 : f.fromStationId,
                    confirmPoolTransferReceived: false,
                    confirmTransferInventoryId: 0,
                  }));
                }}
                placeholder="Select flow"
              />
              {form.type === "In" && !showStationPicker && staffHasStation && (
                // <p className="mt-1 text-xs text-slate-500">
                //   Fuel is received at your assigned station (no station pick).
                // </p>
                <></>
              )}
            </div>

            {showReceivingStation && (
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Receiving station
                </label>
                <FormSelect
                  options={stationOptionsBase}
                  value={stationInSel}
                  onChange={(o) => {
                    const nextId = o ? Number(o.value) : 0;
                    setForm((f) => ({
                      ...f,
                      stationId: nextId,
                      fromStationId:
                        f.fromStationId > 0 && f.fromStationId === nextId
                          ? 0
                          : f.fromStationId,
                    }));
                  }}
                  placeholder={
                    needsBusiness ? "Select business first" : "Select station"
                  }
                  isDisabled={needsBusiness || stationOptionsBase.length === 0}
                />
              </div>
            )}

            {showInOptionalFromStation && (
              <div className={showReceivingStation ? "md:col-span-2" : ""}>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  From station (optional)
                </label>
                <FormSelect
                  options={inFromStationOptions}
                  value={inFromStationSel}
                  onChange={(o) =>
                    setForm((f) => ({
                      ...f,
                      fromStationId: o ? Number(o.value) : 0,
                    }))
                  }
                  placeholder="None"
                  isClearable
                  isDisabled={
                    needsBusiness || inFromStationOptions.length === 0
                  }
                />
                {/* <p className="mt-1 text-xs text-slate-500">
                  Where the delivery originated (same business). Leave empty if
                  unknown.
                </p> */}
              </div>
            )}

            {showOutSendingStation && (
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  From station (sending)
                </label>
                <FormSelect
                  options={stationOptionsBase}
                  value={outSendingStationSel}
                  onChange={(o) =>
                    setForm((f) => ({
                      ...f,
                      stationId: o ? Number(o.value) : 0,
                      toStationId:
                        f.toStationId > 0 &&
                        o &&
                        Number(o.value) === f.toStationId
                          ? 0
                          : f.toStationId,
                    }))
                  }
                  placeholder={
                    needsBusiness ? "Select business first" : "Select station"
                  }
                  isDisabled={needsBusiness || stationOptionsBase.length === 0}
                />
              </div>
            )}

            {showToStation && (
              <div className={showOutSendingStation ? "" : "md:grid-cols-2"}>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  To station (receiving)
                </label>
                <FormSelect
                  options={
                    showStationPicker
                      ? stationOptionsBase
                      : destinationStationOptions
                  }
                  value={toStationSel}
                  onChange={(o) =>
                    setForm((f) => ({
                      ...f,
                      toStationId: o ? Number(o.value) : 0,
                      confirmTransferInventoryId: 0,
                    }))
                  }
                  placeholder={
                    needsBusiness
                      ? "Select business first"
                      : !showStationPicker &&
                          destinationStationOptions.length === 0
                        ? "No other stations in business"
                        : "Select destination"
                  }
                  isDisabled={
                    needsBusiness ||
                    (showStationPicker
                      ? stationOptionsBase.length < 2
                      : destinationStationOptions.length === 0)
                  }
                />
              </div>
            )}

            {form.type === "Out" && !needsBusiness && effectiveFormBusinessId != null && effectiveFormBusinessId > 0 ? (
              <div className="md:col-span-2 space-y-3 rounded-lg border border-slate-200 bg-slate-50/80 p-3">
                <label className="flex cursor-pointer items-start gap-2 text-sm text-slate-800">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={form.confirmPoolTransferReceived}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        confirmPoolTransferReceived: e.target.checked,
                        confirmTransferInventoryId: e.target.checked
                          ? f.confirmTransferInventoryId
                          : 0,
                      }))
                    }
                  />
                  <span>
                    Confirm a matching <strong>business pool transfer</strong> was received at the destination
                    station (same fuel, liters, and destination as this Out record).
                  </span>
                </label>
                {form.confirmPoolTransferReceived ? (
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">
                      Pending pool transfer
                    </label>
                    <FormSelect
                      options={pendingTransferOptions}
                      value={pendingTransferSel}
                      onChange={(o) =>
                        setForm((f) => ({
                          ...f,
                          confirmTransferInventoryId: o ? Number(o.value) : 0,
                        }))
                      }
                      placeholder={
                        pendingTransfersSkip
                          ? "Select destination and fuel first"
                          : pendingTransferOptions.length === 0
                            ? "No pending transfers for this destination and fuel"
                            : "Select pending transfer"
                      }
                      isDisabled={pendingTransferOptions.length === 0}
                    />
                    <p className="mt-1 text-xs text-slate-500">
                      Liters on this Out entry must match the pool transfer exactly. A notification is sent to your team
                      when confirmed.
                    </p>
                  </div>
                ) : null}
              </div>
            ) : null}

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Targo
              </label>
              <input
                required
                value={form.targo}
                onChange={(e) =>
                  setForm((f) => ({ ...f, targo: e.target.value }))
                }
                placeholder="Targo Number."
                className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none ring-emerald-500/30 focus:ring-2"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Driver name
              </label>
              <input
                required
                value={form.driverName}
                onChange={(e) =>
                  setForm((f) => ({ ...f, driverName: e.target.value }))
                }
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
                  setForm((f) => ({
                    ...f,
                    fuelTypeId: o ? Number(o.value) : 0,
                    confirmTransferInventoryId: 0,
                  }))
                }
                placeholder="Select fuel type"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Received liters
              </label>
              <input
                required
                value={form.receivedLiter}
                onChange={(e) =>
                  setForm((f) => ({ ...f, receivedLiter: e.target.value }))
                }
                className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none ring-emerald-500/30 focus:ring-2"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
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
