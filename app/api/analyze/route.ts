import { NextRequest, NextResponse } from "next/server";
export const runtime = "nodejs";
const MAX_BYTES = 5 * 1024 * 1024;
const MIME = new Set(["image/jpeg","image/png","image/webp"]);
export async function POST(req: NextRequest) {
 try {
  const form = await req.formData(); const image = form.get("image");
  if (!(image instanceof File)) return NextResponse.json({error:"Please upload a soil image."},{status:400});
  if (!MIME.has(image.type)) return NextResponse.json({error:"Only JPG, PNG, and WebP images are supported."},{status:415});
  if (image.size === 0 || image.size > MAX_BYTES) return NextResponse.json({error:"Image must be non-empty and no larger than 5 MB."},{status:413});
  const area = String(form.get("area") || "Unspecified").slice(0,100);
  const district = String(form.get("district") || "").slice(0,100);
  const rawMeasurements = String(form.get("measurements") || "{}");
  let measurements: Record<string,string> = {};
  try { const parsed = JSON.parse(rawMeasurements); if (parsed && typeof parsed === "object") measurements = parsed; } catch {}
  const key = process.env.GEMINI_API_KEY;
  if (!key) return NextResponse.json({status:"AI provider not configured",error:"Real image analysis is not enabled yet because GEMINI_API_KEY is missing on the server. Your image was validated, but no prediction was generated. Configure the key in the deployment environment and redeploy."},{status:503});
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const bytes = Buffer.from(await image.arrayBuffer());
  const prompt = `You are a cautious soil-image observation assistant. Region provided by user: ${area}; area detail: ${district || "not provided"}. User-supplied measured values (not independently verified): ${JSON.stringify(measurements)}. Describe only visible evidence in the image, likely visual appearance/texture clues, and uncertainty. Do NOT claim the image measures moisture percentage, pH, NPK, mineral content, vitamins, salinity, or exact soil taxonomy. Do not infer exact chemical properties from region. Clearly separate visual observations, user-entered measurements, and what requires a lab or calibrated sensor. Provide safe next steps and say crop/fertilizer choices require local crop/season context and soil test. Return concise plain text, no fabricated confidence score.`;
  const endpoint = "https://generativelanguage.googleapis.com/v1beta/models/"+encodeURIComponent(model)+":generateContent?key="+encodeURIComponent(key);
  const response = await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({contents:[{parts:[{text:prompt},{inline_data:{mime_type:image.type,data:bytes.toString("base64")}}]}],generationConfig:{temperature:0.2,maxOutputTokens:700}}),signal:AbortSignal.timeout(25000)});
  const data = await response.json();
  if (!response.ok) return NextResponse.json({error:"The configured AI provider rejected the request. Check GEMINI_MODEL and the server-side API key; no result was generated."},{status:502});
  const analysis = data?.candidates?.[0]?.content?.parts?.map((p:{text?:string})=>p.text||"").join("\n").trim();
  if (!analysis) return NextResponse.json({error:"The AI provider returned no usable analysis."},{status:502});
  return NextResponse.json({status:"AI visual observations · not a lab test",source:model,analysis});
 } catch (e) { const message = e instanceof Error && e.name === "TimeoutError" ? "AI analysis timed out. Please try again." : "Analysis service failed. Please check provider configuration and try again."; return NextResponse.json({error:message},{status:502}); }
}
