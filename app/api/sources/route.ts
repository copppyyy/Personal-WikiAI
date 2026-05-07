import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("documenti_wiki")
      .select("id, metadata, content");

    if (error) throw new Error(error.message);

    const sourcesMap = new Map<string, { name: string; chunks: number }>();
    for (const row of data || []) {
      const name = row.metadata?.source || "Sconosciuto";
      if (!sourcesMap.has(name)) sourcesMap.set(name, { name, chunks: 0 });
      sourcesMap.get(name)!.chunks += 1;
    }

    return NextResponse.json({ sources: Array.from(sourcesMap.values()) });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { sourceName } = await req.json();
    if (!sourceName) return NextResponse.json({ error: "Nome fonte mancante" }, { status: 400 });

    const { error } = await supabase
      .from("documenti_wiki")
      .delete()
      .eq("metadata->>source", sourceName);

    if (error) throw new Error(error.message);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}