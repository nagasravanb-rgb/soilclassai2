import type { Metadata } from "next";
import AnalyzeFlow from "@/components/AnalyzeFlow";

export const metadata: Metadata = { title: "Analyze Soil" };

export default function AnalyzePage() {
  return (
    <>
      <h1 className="page-title">Analyze soil</h1>
      <p className="lead">Add one clear, close-up photo of the soil surface and the city where it was taken.</p>
      <AnalyzeFlow />
    </>
  );
}
