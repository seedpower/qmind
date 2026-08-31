import { notFound } from "next/navigation";
import EditorShell from "@/components/editor/EditorShell";
import { getMap } from "@/lib/maps";

export const dynamic = "force-dynamic";

export default async function MapEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const map = await getMap(id);
  if (!map) notFound();
  return <EditorShell map={map} />;
}
