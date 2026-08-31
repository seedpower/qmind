import { NextResponse } from "next/server";
import { deleteMap, getMap, updateMap } from "@/lib/maps";

export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const map = await getMap(id);
    if (!map) {
      return NextResponse.json({ error: "脑图不存在" }, { status: 404 });
    }
    return NextResponse.json(map);
  } catch (error) {
    console.error("GET /api/maps/[id]", error);
    return NextResponse.json({ error: "无法读取脑图" }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();
    const map = await updateMap(id, body);
    if (!map) {
      return NextResponse.json({ error: "脑图不存在" }, { status: 404 });
    }
    return NextResponse.json(map);
  } catch (error) {
    if (error instanceof Error && error.message === "MAP_EMPTY") {
      return NextResponse.json(
        { error: "脑图至少需要一个节点" },
        { status: 400 },
      );
    }
    console.error("PUT /api/maps/[id]", error);
    return NextResponse.json({ error: "无法保存脑图" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const ok = await deleteMap(id);
    if (!ok) {
      return NextResponse.json({ error: "脑图不存在" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/maps/[id]", error);
    return NextResponse.json({ error: "无法删除脑图" }, { status: 500 });
  }
}
