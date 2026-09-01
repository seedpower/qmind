import { NextResponse } from "next/server";
import {
  getMcpKeyStatus,
  revokeMcpApiKey,
  rotateMcpApiKey,
} from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await getMcpKeyStatus());
  } catch (error) {
    console.error("GET /api/settings/mcp-key", error);
    return NextResponse.json(
      { error: "Could not load settings" },
      { status: 500 },
    );
  }
}

export async function POST() {
  try {
    const created = await rotateMcpApiKey();
    return NextResponse.json(created);
  } catch (error) {
    console.error("POST /api/settings/mcp-key", error);
    return NextResponse.json(
      { error: "Could not generate API key" },
      { status: 500 },
    );
  }
}

export async function DELETE() {
  try {
    await revokeMcpApiKey();
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/settings/mcp-key", error);
    return NextResponse.json(
      { error: "Could not revoke API key" },
      { status: 500 },
    );
  }
}
