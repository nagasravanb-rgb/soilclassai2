import type { Metadata } from "next";
import SettingsView from "@/components/SettingsView";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <>
      <h1 className="page-title">Settings</h1>
      <SettingsView />
    </>
  );
}
