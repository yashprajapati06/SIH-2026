import { fetchFromAPI } from "./api";

export interface HistoricalPoint {
  id: number;
  name: string;
  state: string;
  district: string;
  latitude: number;
  longitude: number;
}
export interface HistoricalRecord {
  id: number;
  inventory_serial_no: number;
  slide_no: string;
  slide_name: string;
  state: string;
  district: string;
  road_or_location: string;
  latitude: number | null;
  longitude: number | null;
  coordinate_issue: string | null;
  coordinate_valid: boolean;
  material_involved: string;
  movement_type: string;
  history_raw: string;
  history_date_quality: string;
  source_pdf_page: number;
}
export interface HistoricalSnapshot {
  snapshot_date: string;
  source_name: string;
  source_url: string;
  historical_only: boolean;
  total: number;
  mapped: number;
  flagged: number;
  global_total: number;
  states: { name: string; total: number; mapped: number; flagged: number }[];
  districts: string[];
  points: HistoricalPoint[];
  flagged_records: HistoricalRecord[];
}
export async function fetchHistoricalSnapshot(state: string, district: string, signal?: AbortSignal) {
  const params = new URLSearchParams();
  if (state) params.set("state", state);
  if (district) params.set("district", district);
  const response = await fetchFromAPI<{ data: HistoricalSnapshot }>(`/api/v1/gsi-history?${params}`, { signal });
  return response.data;
}
export async function fetchHistoricalRecord(id: number, signal?: AbortSignal) {
  return (await fetchFromAPI<{ data: HistoricalRecord }>(`/api/v1/gsi-history/${id}`, { signal })).data;
}
export function historicalValue(value: string | null | undefined) {
  return !value || /^(na|n\/a|nil|none|-)$/.test(value.trim().toLowerCase()) ? "Not recorded in the source" : value;
}
