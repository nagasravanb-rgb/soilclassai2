import type { Metadata, Viewport } from "next";
import NavBar from "@/components/NavBar";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "SoilClass AI", template: "%s · SoilClass AI" },
  description: "Photograph soil, get an AI visual classification, and responsible agricultural guidance with clear scientific limitations.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#25553a" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <a href="#main" className="skip-link">Skip to content</a>
        <NavBar />
        <main id="main" className="shell main">{children}</main>
        <footer className="footer no-print">
          <div className="shell">
            SoilClass AI provides AI-generated visual interpretations of soil photos. It is not a laboratory test. Verify important decisions with a soil test and qualified local advice.
          </div>
        </footer>
      </body>
    </html>
  );
}
