import type { Metadata } from "next";
import HistoryDetail from "@/components/HistoryDetail";

export const metadata: Metadata = { title: "Saved analysis" };

export default async function HistoryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <>
      <h1 className="page-title no-print">Saved analysis</h1>
      <HistoryDetail id={id} />
    </>
  );
}
