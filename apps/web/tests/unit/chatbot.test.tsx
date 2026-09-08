import React from "react";
import "@testing-library/jest-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import ChatbotPage from "@/app/chatbot/page";
import { askLandslideAssistant, getChatCoverage, safeCitationUrl } from "@/lib/chatbot";

vi.mock("@/lib/chatbot", async importOriginal => ({
  ...await importOriginal<typeof import("@/lib/chatbot")>(),
  askLandslideAssistant: vi.fn(), getChatCoverage: vi.fn(),
}));
const reply = {
  answer: "Assam has 857 historical inventory rows in this snapshot.", status: "answered" as const,
  language: "en" as const, snapshot_date: "2026-09-08", matched_records: 857,
  citations: [{ id: "gsi-snapshot", kind: "dataset" as const, title: "GSI source", detail: "Historical snapshot, not a live alert", url: "https://bhusanket.gsi.gov.in/statewiseLandslideReport.html" }],
  breakdown: [{ label: "Assam", count: 857 }], suggestions: [], notes: ["Counts are not predictions."],
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getChatCoverage).mockResolvedValue({ inventory_records: 11022, study_references: 428, guidance_articles: 8, states: ["Assam", "Sikkim"], snapshot_date: "2026-09-08", source_url: "https://bhusanket.gsi.gov.in/" });
  vi.mocked(askLandslideAssistant).mockResolvedValue(reply);
});
afterEach(cleanup);

describe("Landslide chatbot", () => {
  it("loads corpus coverage and answers a suggested question with source links", async () => {
    render(<ChatbotPage />);
    expect(await screen.findByText("11,022")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /How many landslide records are in Assam/i }));
    expect(await screen.findByText(reply.answer)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /GSI source/ })).toHaveAttribute("href", reply.citations[0].url);
    expect(askLandslideAssistant).toHaveBeenCalledWith(expect.objectContaining({state:null, previous_questions:[]}), expect.any(AbortSignal));
  });

  it("sends language/source/state filters and bounded user context then clears the conversation", async () => {
    render(<ChatbotPage />);
    await screen.findByText("11,022");
    fireEvent.change(screen.getByLabelText("State filter"), { target:{value:"Assam"} });
    fireEvent.change(screen.getByLabelText("Answer language"), { target:{value:"hinglish"} });
    const input = screen.getByLabelText("Your landslide question");
    fireEvent.change(input, { target:{value:"Assam mein kitne records hain?"} });
    fireEvent.click(screen.getByRole("button", {name:"Send question"}));
    await screen.findByText(reply.answer);
    fireEvent.change(input, { target:{value:"Show GSI studies there"} });
    fireEvent.keyDown(input, {key:"Enter"});
    await waitFor(() => expect(askLandslideAssistant).toHaveBeenCalledTimes(2));
    expect(askLandslideAssistant).toHaveBeenLastCalledWith(expect.objectContaining({ state:"Assam", language:"hinglish", previous_questions:["Assam mein kitne records hain?"] }), expect.any(AbortSignal));
    await waitFor(() => expect(screen.getByRole("button", {name:/Clear chat/})).toBeEnabled());
    fireEvent.click(screen.getByRole("button", {name:/Clear chat/}));
    expect(screen.queryByText(reply.answer)).not.toBeInTheDocument();
  });

  it("shows a backend error and preserves the question for retry", async () => {
    vi.mocked(askLandslideAssistant).mockRejectedValue(new Error("Knowledge service is unavailable"));
    render(<ChatbotPage />);
    fireEvent.change(screen.getByLabelText("Your landslide question"), {target:{value:"Assam records"}});
    fireEvent.click(screen.getByRole("button", {name:"Send question"}));
    expect(await screen.findByRole("alert")).toHaveTextContent("Knowledge service is unavailable");
    expect(screen.getByLabelText("Your landslide question")).toHaveValue("Assam records");
  });

  it("renders source text as text and blocks executable source URLs", async () => {
    vi.mocked(askLandslideAssistant).mockResolvedValue({...reply, answer:"<script>alert('test')</script>", citations:[{...reply.citations[0], url:"javascript:alert(1)"}]});
    render(<ChatbotPage />);
    fireEvent.click(screen.getByRole("button", {name:/How many landslide records are in Assam/i}));
    expect(await screen.findByText("<script>alert('test')</script>")).toBeInTheDocument();
    expect(screen.queryByRole("link", {name:/GSI source/})).not.toBeInTheDocument();
    expect(safeCitationUrl("https://evil.example/redirect")).toBeNull();
    expect(safeCitationUrl("https://github.com@evil.example/path")).toBeNull();
  });
});
