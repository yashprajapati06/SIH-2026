import { fetchFromAPI } from "./api";

export interface ChatCitation {
  id: string;
  kind: "inventory" | "report" | "guidance" | "dataset";
  title: string;
  detail: string;
  url: string;
}

export interface ChatAnswer {
  answer: string;
  status: "answered" | "no_evidence" | "limited";
  language: "en" | "hinglish";
  snapshot_date: string;
  matched_records: number;
  citations: ChatCitation[];
  breakdown: { label: string; count: number }[];
  suggestions: string[];
  notes: string[];
}

export interface ChatCoverage {
  inventory_records: number;
  study_references: number;
  guidance_articles: number;
  states: string[];
  snapshot_date: string;
  source_url: string;
}

export interface ChatRequest {
  message: string;
  language: "auto" | "en" | "hinglish";
  state: string | null;
  source: "auto" | "inventory" | "reports" | "guidance";
  previous_questions: string[];
}

export async function askLandslideAssistant(query: ChatRequest, signal?: AbortSignal) {
  const response = await fetchFromAPI<{ data: ChatAnswer }>("/api/v1/chatbot/query", {
    method: "POST", body: JSON.stringify(query), signal,
  });
  return response.data;
}

export async function getChatCoverage(signal?: AbortSignal) {
  const response = await fetchFromAPI<{ data: ChatCoverage }>("/api/v1/chatbot/coverage", { signal });
  return response.data;
}

// Treat evidence links as data too; never allow executable or arbitrary URL schemes.
export function safeCitationUrl(raw: string): string | null {
  try {
    const url = new URL(raw);
    const hosts = ["github.com", "bhusanket.gsi.gov.in", "www.usgs.gov", "www.nidm.gov.in", "sachet.ndma.gov.in"];
    return url.protocol === "https:" && !url.username && !url.password && hosts.includes(url.hostname) ? url.href : null;
  } catch { return null; }
}
