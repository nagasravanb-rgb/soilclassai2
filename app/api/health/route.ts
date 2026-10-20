import { getServerConfig } from "@/lib/config";
import { json } from "@/lib/http";
import { getProviderStatus } from "@/lib/providers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const config = getServerConfig();
  const provider = getProviderStatus(config);
  return json({
    status: "ok",
    app: "SoilClass AI",
    time: new Date().toISOString(),
    provider,
    analysisAvailable: provider.configured,
    historyStorage: config.historyStorage,
    limits: { maxUploadBytes: config.maxUploadBytes, acceptedTypes: ["image/jpeg", "image/png", "image/webp"] },
  });
}
