import { describe, expect, it } from "vitest";
import { runSoilAnalysis } from "@/lib/analysis";
import { getServerConfig } from "@/lib/config";
import { escapeHtml, renderReportHtml, reportFileName } from "@/lib/report";
import { makePng } from "../helpers";

async function result(city = "Pune") {
  return runSoilAnalysis({ imageBytes: makePng(), city, config: getServerConfig({ AI_PROVIDER: "mock" }) });
}

describe("report generation", () => {
  it("renders a complete standalone report", async () => {
    const r = await result();
    const html = renderReportHtml(r, "data:image/jpeg;base64,AAAA");
    expect(html).toMatch(/^<!doctype html>/);
    for (const text of ["Loamy soil", "Pune", "Laboratory test required", "Scientific limitations", "Suggested follow-up tests", "DEMO RESULT", r.id]) {
      expect(html).toContain(text);
    }
    expect(html).toContain('<img src="data:image/jpeg;base64,AAAA"');
  });

  it("escapes untrusted content and ignores unsafe image URLs", async () => {
    const r = await result();
    r.summary = '<script>alert("x")</script>';
    const html = renderReportHtml(r, "javascript:alert(1)");
    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("javascript:");
    expect(escapeHtml(`&<>"'`)).toBe("&amp;&lt;&gt;&quot;&#39;");
  });

  it("builds a safe file name", async () => {
    const r = await result("São Paulo");
    expect(reportFileName(r)).toMatch(/^soilclass-report-s-o-paulo-\d{4}-\d{2}-\d{2}\.html$/);
  });
});
