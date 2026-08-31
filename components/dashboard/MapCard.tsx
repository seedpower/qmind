"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { GitFork, Trash2 } from "lucide-react";
import type { MindMapSummary } from "@/lib/types";

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.max(0, Math.floor(diff / 60_000));
  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} 天前`;
  return new Date(iso).toLocaleDateString("zh-CN");
}

export default function MapCard({ map }: { map: MindMapSummary }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const when = useMemo(() => relativeTime(map.updatedAt), [map.updatedAt]);

  async function remove(event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setPending(true);
    const res = await fetch(`/api/maps/${map.id}`, { method: "DELETE" });
    if (res.ok) {
      router.refresh();
    } else {
      setPending(false);
      setConfirming(false);
    }
  }

  return (
    <article className="map-card">
      <Link href={`/maps/${map.id}`} className="map-card-link">
        <div className="map-card-preview" aria-hidden>
          <span className="orb root" />
          <span className="orb a" />
          <span className="orb b" />
          <span className="orb c" />
        </div>
        <h2>{map.title}</h2>
        <p>
          <GitFork size={13} />
          {map.nodeCount} 个节点 · {when}
        </p>
      </Link>
      <button
        type="button"
        className={`card-delete ${confirming ? "confirm" : ""}`}
        onClick={remove}
        disabled={pending}
      >
        <Trash2 size={14} />
        {confirming ? (pending ? "删除中" : "确认删除") : "删除"}
      </button>
    </article>
  );
}
