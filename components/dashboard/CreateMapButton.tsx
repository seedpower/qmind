"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Plus } from "lucide-react";

export default function CreateMapButton({
  variant = "primary",
}: {
  variant?: "primary" | "ghost";
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function createMap() {
    if (pending) return;
    setPending(true);
    try {
      const res = await fetch("/api/maps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "未命名脑图" }),
      });
      if (!res.ok) throw new Error("create failed");
      const map = (await res.json()) as { id: string };
      router.push(`/maps/${map.id}`);
    } catch {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      className={variant === "primary" ? "create-btn" : "create-btn ghost"}
      onClick={createMap}
      disabled={pending}
    >
      <Plus size={16} />
      {pending ? "创建中…" : "新建脑图"}
    </button>
  );
}
