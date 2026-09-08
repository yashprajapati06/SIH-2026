import type { Metadata } from "next";
import React from "react";

export const metadata: Metadata = {
  title: "Landslide Knowledge Assistant",
  description: "Search Northeast India's historical landslide inventory, GSI study references and source-linked landslide guidance.",
};

export default function ChatbotLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
