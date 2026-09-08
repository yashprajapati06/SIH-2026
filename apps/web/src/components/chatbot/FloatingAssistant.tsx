"use client";

import Script from "next/script";
import { useEffect, useState } from "react";
import { MessageCircle } from "lucide-react";

/** The floating widget is maintained in yashprajapati06/sentinel-landslide-chatbot. */
export function FloatingAssistant() {
  const [url, setUrl] = useState<string | null>(null);
  const [fallback, setFallback] = useState(false);

  useEffect(() => {
    const local = ["localhost", "127.0.0.1"].includes(window.location.hostname);
    const configured = process.env.NEXT_PUBLIC_CHATBOT_URL || (local ? "http://127.0.0.1:8046" : "");
    try {
      const parsed = new URL(configured);
      if (parsed.protocol !== "https:" && !(local && parsed.protocol === "http:" && ["localhost", "127.0.0.1"].includes(parsed.hostname))) throw new Error("Invalid chatbot URL");
      setUrl(parsed.origin);
    } catch {
      setFallback(true);
    }
  }, []);

  return <>
    {url && <Script id="sentinel-floating-assistant" src={`${url}/static/embed.js`} strategy="afterInteractive" onError={() => setFallback(true)} />}
    {fallback && <a href="/chatbot" aria-label="Open landslide assistant" title="Open landslide assistant" className="fixed bottom-5 right-6 z-[9999] flex h-[60px] w-[60px] items-center justify-center rounded-full bg-[#7028f5] text-white shadow-xl"><MessageCircle size={28} /></a>}
  </>;
}
