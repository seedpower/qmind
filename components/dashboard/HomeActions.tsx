"use client";

import { useState } from "react";
import { Settings } from "lucide-react";
import CreateMapButton from "./CreateMapButton";
import SettingsDialog from "@/components/settings/SettingsDialog";

export default function HomeActions() {
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <div className="home-actions">
      <button
        type="button"
        className="create-btn ghost"
        onClick={() => setSettingsOpen(true)}
      >
        <Settings size={16} />
        Settings
      </button>
      <CreateMapButton />
      {settingsOpen ? (
        <SettingsDialog onClose={() => setSettingsOpen(false)} />
      ) : null}
    </div>
  );
}
