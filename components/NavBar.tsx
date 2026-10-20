"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/analyze", label: "Analyze Soil" },
  { href: "/history", label: "Analysis History" },
  { href: "/about", label: "About" },
  { href: "/settings", label: "Settings" },
];

export default function NavBar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <header className="topbar no-print">
      <div className="shell topbar-inner">
        <Link href="/" className="brand" onClick={() => setOpen(false)}>
          <span className="brand-mark" aria-hidden="true">🌱</span>
          <span>SoilClass <span className="brand-accent">AI</span></span>
        </Link>
        <button
          type="button"
          className="menu-btn"
          aria-expanded={open}
          aria-controls="main-nav"
          onClick={() => setOpen(o => !o)}
        >
          <span className="visually-hidden">Toggle navigation</span>
          <span aria-hidden="true">☰</span>
        </button>
        <nav id="main-nav" aria-label="Main" className={open ? "nav open" : "nav"}>
          {LINKS.map(link => (
            <Link
              key={link.href}
              href={link.href}
              className={isActive(link.href) ? "nav-link active" : "nav-link"}
              aria-current={isActive(link.href) ? "page" : undefined}
              onClick={() => setOpen(false)}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
