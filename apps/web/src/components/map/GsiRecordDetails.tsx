"use client";

import React, { useEffect, useState } from "react";
import { fetchHistoricalRecord, historicalValue, HistoricalRecord } from "@/lib/gsi-history";

export default function GsiRecordDetails({ id, onClose }: { id: number; onClose: () => void }) {
  const [record, setRecord] = useState<HistoricalRecord | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setRecord(null); setError("");
    fetchHistoricalRecord(id, controller.signal).then(data => { if (!controller.signal.aborted) setRecord(data); }).catch(err => { if (!controller.signal.aborted) setError(err.message); });
    return () => controller.abort();
  }, [id, retry]);
  return <aside aria-label="GSI historical record details" className="h-full w-full overflow-y-auto rounded-lg border border-violet-200 bg-white p-4 dark:border-violet-900 dark:bg-sentinel-900">
    <div className="flex items-center justify-between gap-2"><span className="rounded-full bg-violet-50 px-2 py-1 text-xs font-bold text-violet-700">GSI · HISTORICAL</span><button onClick={onClose} aria-label="Close GSI record" className="px-2 text-xl">×</button></div>
    {!record && !error && <p role="status" className="mt-4 text-sm">Loading historical record…</p>}
    {error && <div role="alert" className="mt-4 text-sm text-red-600">{error}<button className="ml-2 underline" onClick={() => setRetry(v => v + 1)}>Retry record</button></div>}
    {record && <><h2 className="mt-4 text-lg font-semibold">{historicalValue(record.slide_name)}</h2><p className="mt-1 break-all text-xs text-slate-500">{record.slide_no}</p>
      {record.coordinate_issue && <p role="note" className="mt-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">{record.coordinate_issue}</p>}
      <dl className="mt-4 space-y-3 text-sm">{[
        ["State", record.state], ["Historical district", historicalValue(record.district)], ["Location", historicalValue(record.road_or_location)],
        ["Date / history as published", historicalValue(record.history_raw)], ["Material", historicalValue(record.material_involved)], ["Movement", historicalValue(record.movement_type)],
        ["Source latitude", record.latitude ?? "Missing"], ["Source longitude", record.longitude ?? "Missing"], ["Source document", `landslide_report.pdf · page ${record.source_pdf_page} · serial ${record.inventory_serial_no}`],
      ].map(([label, value]) => <div key={label}><dt className="text-xs text-slate-500 dark:text-slate-400">{label}</dt><dd className="mt-1 break-words">{value}</dd></div>)}</dl>
      <p className="mt-4 border-t border-slate-200 pt-3 text-xs leading-relaxed text-slate-500">Source: Geological Survey of India (GSI), Bhusanket inventory. Snapshot checked 8 September 2026. Published history is preserved; no event date is inferred from the record ID. This historical record does not confirm current safety or a live incident.</p>
    </>}
  </aside>;
}
