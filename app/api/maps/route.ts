import { NextResponse } from "next/server";
import { createMap, listMaps } from "@/lib/maps";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const maps = await listMaps();
    return NextResponse.json(maps);
  } catch (error) {
    console.error("GET /api/maps", error);
    return NextResponse.json(
      { error: "Could not load maps" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      title?: string;
    };
    const map = await createMap(body.title);
    return NextResponse.json(map, { status: 201 });
  } catch (error) {
    console.error("POST /api/maps", error);
    return NextResponse.json({ error: "Could not create map" }, { status: 500 });
  }
}
