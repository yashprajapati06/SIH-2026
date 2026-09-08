"use client";

import React, { useEffect, useState } from "react";
import { HistoricalSnapshot } from "@/lib/gsi-history";

interface Props {
  data: HistoricalSnapshot | null;
  loading: boolean;
  error: string | null;
  state: string;
  district: string;
  visible: boolean;
  onState: (value: string) => void;
  onDistrict: (value: string) => void;
  onSelect: (id: number) => void;
  onRetry: () => void;
}
const inputClass = "w-full rounded-md border border-slate-300 bg-white p-2 text-sm text-slate-800 dark:border-slate-600 dark:bg-sentinel-900 dark:text-slate-100";

export default function GsiHistoryPanel({ data, loading, error, state, district, visible, onState, onDistrict, onSelect, onRetry }: Props) {
  const [view, setView] = useState<"closed" | "mapped" | "flagged">("closed");
  const [page, setPage] = useState(0);
  useEffect(() => { setPage(0); }, [data, view]);
  const rows = view === "flagged" ? data?.flagged_records.map(r => ({ ...r, name: r.slide_name })) || [] : data?.points || [];
  const pageCount = Math.max(1, Math.ceil(rows.length / 20));
  const currentPage = Math.min(page, pageCount - 1);

  return <section aria-label="GSI historical inventory" className="rounded-xl border border-violet-200 bg-white p-4 shadow-sm dark:border-violet-900 dark:bg-sentinel-900">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 className="text-base font-bold text-slate-900 dark:text-white"><span className="mr-2 inline-block h-2.5 w-2.5 rounded-full bg-violet-600" />GSI historical landslides</h2>
        <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">8 Northeast states · Snapshot: 8 September 2026 · Historical records, not live warnings</p></div>
      <div className="flex flex-wrap gap-2 text-xs font-semibold" aria-live="polite">
        <span className="rounded-full bg-slate-100 px-3 py-1.5 text-slate-700 dark:bg-sentinel-800 dark:text-slate-200">{loading ? "Loading…" : data ? `${data.total.toLocaleString()} records` : "Data unavailable"}</span>
        {data && !loading && <><span data-testid="gsi-mapped-count" className="rounded-full bg-violet-50 px-3 py-1.5 text-violet-800">{data.mapped.toLocaleString()} mappable{!visible && " · layer hidden"}</span><button type="button" aria-expanded={view === "flagged"} onClick={() => setView(view === "flagged" ? "closed" : "flagged")} className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1.5 text-amber-900">{data.flagged} flagged coordinates</button></>}
      </div>
    </div>
    <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
      <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">GSI state<select aria-label="GSI state" className={`${inputClass} mt-1`} value={state} onChange={e => onState(e.target.value)}><option value="">All 8 states</option>{data?.states.map(s => <option key={s.name} value={s.name}>{s.name} ({s.total.toLocaleString()})</option>)}</select></label>
      <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">GSI historical district<select aria-label="GSI historical district" className={`${inputClass} mt-1`} value={district} disabled={loading || !data} onChange={e => onDistrict(e.target.value)}><option value="">All historical districts</option>{data?.districts.map(d => <option key={d}>{d}</option>)}</select></label>
      <button type="button" disabled={loading || !data} aria-expanded={view === "mapped"} onClick={() => setView(view === "mapped" ? "closed" : "mapped")} className="rounded-md border border-violet-300 px-4 py-2 text-sm font-semibold text-violet-700 disabled:opacity-50 dark:text-violet-300">Browse mapped records</button>
    </div>
    <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">These filters apply only to the GSI layer. District names are as published; coordinate checks do not confirm current boundaries or field accuracy.</p>
    {error && <div role="alert" className="mt-3 flex items-center justify-between gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-800"><span>{error}</span><button className="underline" onClick={onRetry}>Retry GSI data</button></div>}
    {view !== "closed" && data && !loading && !error && <div className="mt-4 border-t border-slate-200 pt-3 dark:border-slate-700">
      <h3 className="mb-2 text-sm font-semibold">{view === "flagged" ? "Flagged records · excluded from the map" : "Historical records · select one to view details"}</h3>
      {rows.length === 0 ? <p role="status" className="py-3 text-sm text-slate-500">{view === "flagged" ? "No flagged coordinates for this selection." : "No historical records match these filters."}</p> : <>
        <div className="max-h-80 overflow-auto"><table className="w-full text-left text-sm"><thead className="text-xs text-slate-500"><tr><th className="p-2">Record / place</th><th className="p-2">District / state</th>{view === "flagged" && <th className="p-2">Coordinate issue</th>}<th className="p-2">Details</th></tr></thead><tbody>{rows.slice(currentPage * 20, currentPage * 20 + 20).map(r => <tr key={r.id} className="border-t border-slate-100 dark:border-slate-800"><td className="p-2">{r.name}<span className="block text-xs text-slate-500">GSI #{r.id}</span></td><td className="p-2">{r.district}, {r.state}</td>{view === "flagged" && <td className="max-w-xs p-2 text-xs text-amber-800 dark:text-amber-200">{"coordinate_issue" in r ? String(r.coordinate_issue) : ""}</td>}<td className="p-2"><button type="button" aria-label={`View GSI record ${r.id}`} onClick={() => onSelect(r.id)} className="font-semibold text-violet-700 underline dark:text-violet-300">View details</button></td></tr>)}</tbody></table></div>
        <div className="mt-3 flex items-center justify-between text-xs"><span>{rows.length.toLocaleString()} records · Page {currentPage + 1} of {pageCount}</span><div className="flex gap-3"><button disabled={currentPage === 0} className="disabled:opacity-40" onClick={() => setPage(currentPage - 1)}>Previous records</button><button disabled={currentPage + 1 >= pageCount} className="disabled:opacity-40" onClick={() => setPage(currentPage + 1)}>Next records</button></div></div>
      </>}
    </div>}
  </section>;
}
