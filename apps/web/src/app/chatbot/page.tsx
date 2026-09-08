"use client";

import React, { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, BookOpen, Database, Loader2, MapPin, MessageCircle, Send, ShieldCheck, Trash2 } from "lucide-react";
import { askLandslideAssistant, ChatAnswer, ChatCoverage, ChatRequest, getChatCoverage, safeCitationUrl } from "@/lib/chatbot";

type Message = { id: number; role: "user"; text: string } | { id: number; role: "assistant"; response: ChatAnswer };
const EXAMPLES = ["How many landslide records are in Assam?", "Which state has the most landslide records?", "Find GSI studies for Sikkim", "Landslide kyu hoti hai?"];

export default function ChatbotPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState("");
  const [state, setState] = useState("");
  const [source, setSource] = useState<ChatRequest["source"]>("auto");
  const [language, setLanguage] = useState<ChatRequest["language"]>("auto");
  const [coverage, setCoverage] = useState<ChatCoverage | null>(null);
  const [coverageError, setCoverageError] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const requestRef = useRef<AbortController | null>(null);
  const sequence = useRef(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    getChatCoverage(controller.signal).then(setCoverage).catch(() => {
      if (!controller.signal.aborted) setCoverageError(true);
    });
    return () => { controller.abort(); requestRef.current?.abort(); };
  }, []);

  useEffect(() => { bottomRef.current?.scrollIntoView?.({ behavior: "smooth", block: "nearest" }); }, [messages, busy]);

  async function send(text = question) {
    const cleaned = text.trim();
    if (!cleaned || busy || cleaned.length > 1000) return;
    const controller = new AbortController();
    requestRef.current = controller;
    // Keep only bounded user text in memory. Nothing is saved in localStorage.
    const previous = messages.filter((m): m is Extract<Message, { role: "user" }> => m.role === "user").slice(-4).map(m => m.text);
    setMessages(current => [...current.slice(-38), { id: ++sequence.current, role: "user", text: cleaned }]);
    setQuestion(""); setError(""); setBusy(true);
    const timeout = window.setTimeout(() => controller.abort(), 25000);
    try {
      const response = await askLandslideAssistant({ message: cleaned, language, source, state: state || null, previous_questions: previous }, controller.signal);
      if (!controller.signal.aborted) {
        setMessages(current => [...current, { id: ++sequence.current, role: "assistant", response }]);
      }
    } catch (e) {
      setError(controller.signal.aborted ? "The request took too long. Please try again." : e instanceof Error ? e.message : "The assistant is unavailable. Please try again.");
      setQuestion(cleaned);
    } finally {
      window.clearTimeout(timeout);
      setBusy(false);
      requestRef.current = null;
      inputRef.current?.focus();
    }
  }

  function submit(event: FormEvent) { event.preventDefault(); void send(); }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-7 md:px-8 md:py-10">
      <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-teal-700 dark:text-teal-300"><MessageCircle className="h-4 w-4" /> Sentinel knowledge</div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white md:text-4xl">Ask about landslides.</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">Explore historical records, compare places and find GSI studies. Every answer points back to its evidence.</p>
        </div>
        <Link href="/map" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold dark:border-slate-700 dark:bg-slate-900"><MapPin className="h-4 w-4" /> Open spatial map <ArrowUpRight className="h-4 w-4" /></Link>
      </div>

      <button type="button" aria-expanded={showFilters} aria-controls="knowledge-filters" onClick={() => setShowFilters(!showFilters)} className="mb-4 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold dark:border-slate-700 dark:bg-slate-900 lg:hidden">{showFilters ? "Hide" : "Show"} sources & filters</button>
      <div className="grid gap-5 lg:grid-cols-[250px_minmax(0,1fr)]">
        <aside id="knowledge-filters" className={`${showFilters ? "block" : "hidden"} space-y-4 lg:block`} aria-label="Knowledge sources and filters">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
            <h2 className="flex items-center gap-2 text-sm font-bold"><Database className="h-4 w-4 text-teal-600" /> Inside the knowledge base</h2>
            {coverage ? <>
              <p className="mt-5 text-3xl font-extrabold">{coverage.inventory_records.toLocaleString("en-IN")}</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Historical inventory records</p>
              <div className="mt-5 flex justify-between border-t border-slate-100 pt-4 text-sm dark:border-slate-800"><span>Study references</span><strong>{coverage.study_references}</strong></div>
              <div className="mt-3 flex justify-between text-sm"><span>Northeast states</span><strong>{coverage.states.length}</strong></div>
              <p className="mt-4 text-xs leading-5 text-slate-500 dark:text-slate-400">Snapshot: {coverage.snapshot_date}. Study titles and links are searchable; full PDF text is not included.</p>
            </> : <p role="status" className="mt-4 text-sm text-slate-500">{coverageError ? "Dataset status unavailable. Try a question or reload the page." : "Checking available sources…"}</p>}
          </div>
          <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
            <h2 className="text-sm font-bold">Focus your question</h2>
            <label className="block text-xs font-semibold">State
              <select aria-label="State filter" value={state} onChange={e => setState(e.target.value)} disabled={busy} className="mt-2 w-full rounded-lg border border-slate-200 bg-transparent p-2 text-sm dark:border-slate-600">
                <option value="">All Northeast states</option>
                {(coverage?.states || ["Arunachal Pradesh", "Assam", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Sikkim", "Tripura"]).map(s => <option key={s}>{s}</option>)}
              </select>
            </label>
            <label className="block text-xs font-semibold">Search in
              <select aria-label="Source filter" value={source} onChange={e => setSource(e.target.value as ChatRequest["source"])} disabled={busy} className="mt-2 w-full rounded-lg border border-slate-200 bg-transparent p-2 text-sm dark:border-slate-600">
                <option value="auto">Choose automatically</option><option value="inventory">Historical inventory</option><option value="reports">GSI studies</option><option value="guidance">Explanations & guidance</option>
              </select>
            </label>
            <label className="block text-xs font-semibold">Answer language
              <select aria-label="Answer language" value={language} onChange={e => setLanguage(e.target.value as ChatRequest["language"])} disabled={busy} className="mt-2 w-full rounded-lg border border-slate-200 bg-transparent p-2 text-sm dark:border-slate-600">
                <option value="auto">Match my question</option><option value="en">English</option><option value="hinglish">Hinglish</option>
              </select>
            </label>
          </div>
          <div className="rounded-2xl bg-teal-50 p-4 text-xs leading-5 text-teal-900 dark:bg-teal-950 dark:text-teal-200"><ShieldCheck className="mb-2 h-5 w-5" />Historical knowledge, not a live warning service. Record counts do not measure future risk. Chat stays in this tab and clears on refresh.</div>
        </aside>

        <section className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900" aria-label="Landslide assistant conversation">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
            <div className="flex items-center gap-2 text-sm font-bold"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-100"><MessageCircle className="h-4 w-4" /></span>Landslide Assistant</div>
            <button type="button" disabled={busy || !messages.length} onClick={() => { setMessages([]); setError(""); setQuestion(""); inputRef.current?.focus(); }} className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 disabled:opacity-40 dark:hover:text-white"><Trash2 className="h-3.5 w-3.5" /> Clear chat</button>
          </div>
          <div role="log" aria-label="Conversation" aria-live="polite" aria-relevant="additions" className="min-h-[390px] max-h-[650px] flex-1 space-y-6 overflow-y-auto p-5 md:p-7">
            {!messages.length && <div className="py-8">
              <BookOpen className="mb-5 h-9 w-9 text-teal-600" />
              <h2 className="text-xl font-bold">Start with a place or a question.</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">Try a state, district, road, slide ID or a topic. You can ask in English or Hinglish.</p>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">{EXAMPLES.map(example => <button key={example} disabled={busy} onClick={() => void send(example)} className="rounded-xl border border-slate-200 p-4 text-left text-sm leading-5 transition hover:border-teal-500 hover:bg-teal-50 disabled:opacity-40 dark:border-slate-700 dark:hover:bg-teal-950">{example}<ArrowUpRight className="mt-3 h-4 w-4 text-teal-600" /></button>)}</div>
            </div>}
            {messages.map(message => message.role === "user" ? (
              <div key={message.id} className="ml-auto max-w-[90%] rounded-2xl rounded-tr-sm bg-[#003580] px-4 py-3 text-sm leading-6 text-white"><span className="sr-only">You: </span>{message.text}</div>
            ) : <article key={message.id} className="space-y-4 text-sm leading-6" aria-label="Assistant answer">
              <div className="flex items-center gap-2 text-xs font-bold text-teal-700 dark:text-teal-300"><MessageCircle className="h-4 w-4" />{message.response.status === "no_evidence" ? "No matching evidence" : message.response.status === "limited" ? "What the data can tell us" : "From the knowledge base"}</div>
              <p className="whitespace-pre-wrap">{message.response.answer}</p>
              {!!message.response.breakdown.length && <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700"><table className="w-full text-left text-xs"><caption className="px-3 pt-3 text-left font-semibold">Historical rows in the matching set</caption><thead><tr className="text-slate-500"><th className="p-3">Place</th><th className="p-3 text-right">Rows</th></tr></thead><tbody>{message.response.breakdown.map(row => <tr key={row.label} className="border-t border-slate-100 dark:border-slate-800"><td className="px-3 py-2">{row.label}</td><td className="px-3 py-2 text-right font-semibold">{row.count.toLocaleString("en-IN")}</td></tr>)}</tbody></table></div>}
              {!!message.response.citations.length && <details className="rounded-xl border border-slate-200 dark:border-slate-700" open={message.response.citations.length === 1}>
                <summary className="cursor-pointer px-4 py-3 text-xs font-bold">Sources & matching records ({message.response.citations.length})</summary>
                <div className="space-y-3 border-t border-slate-100 px-4 py-3 dark:border-slate-800">{message.response.citations.map(citation => {
                  const url = safeCitationUrl(citation.url);
                  return <div key={citation.id} className="break-words"><p className="text-[10px] font-semibold uppercase tracking-wider text-teal-700 dark:text-teal-300">{citation.kind} · {citation.id}</p>{url ? <a href={url} target="_blank" rel="noopener noreferrer" className="font-semibold underline decoration-slate-300 underline-offset-4 hover:text-teal-700">{citation.title} ↗</a> : <p className="font-semibold">{citation.title}</p>}<p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{citation.detail}</p></div>;
                })}</div>
              </details>}
              {message.response.notes.map(note => <p key={note} className="text-xs leading-5 text-slate-500 dark:text-slate-400">{note}</p>)}
            </article>)}
            {busy && <p role="status" className="flex items-center gap-2 text-sm text-teal-700 dark:text-teal-300"><Loader2 className="h-4 w-4 animate-spin" /> Searching the knowledge base…</p>}
            <div ref={bottomRef} />
          </div>
          <form onSubmit={submit} className="border-t border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
            {error && <p role="alert" className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">{error}</p>}
            <label htmlFor="landslide-question" className="sr-only">Your landslide question</label>
            <div className="flex items-end gap-3 rounded-xl border border-slate-200 bg-white p-3 focus-within:border-teal-500 dark:border-slate-600 dark:bg-slate-900">
              <textarea id="landslide-question" ref={inputRef} value={question} onChange={e => setQuestion(e.target.value)} disabled={busy} maxLength={1000} rows={2} placeholder="Ask about a place, landslide or GSI study…" onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void send(); } }} className="min-w-0 flex-1 resize-none bg-transparent text-sm leading-6 outline-none placeholder:text-slate-400 disabled:opacity-50" />
              <button type="submit" aria-label="Send question" disabled={busy || !question.trim()} className="rounded-lg bg-teal-700 p-3 text-white transition hover:bg-teal-800 disabled:opacity-40"><Send className="h-4 w-4" /></button>
            </div>
            <div className="mt-2 flex justify-between gap-2 text-[11px] text-slate-500"><span>Enter to send · Shift + Enter for a new line</span><span>{question.length}/1000</span></div>
          </form>
        </section>
      </div>
    </div>
  );
}
