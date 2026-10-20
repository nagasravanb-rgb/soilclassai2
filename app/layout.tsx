import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "SoilSense AI | Soil insights, honestly", description: "Explore soil appearance, area context, measured properties, and evidence-aware crop guidance." };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }
