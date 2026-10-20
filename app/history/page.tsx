import type { Metadata } from "next";
import HistoryView from "@/components/HistoryView";

export const metadata: Metadata = { title: "Analysis History" };

export default function HistoryPage() {
  return (
    <>
      <h1 className="page-title">Analysis history</h1>
      <HistoryView />
    </>
  );
}
