import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  try {
    if (id) {
      const { data, error } = await supabase
        .from("messaggi")
        .select("*")
        .eq("conversazione_id", id)
        .order("created_at", { ascending: true });
      if (error) throw new Error(error.message);
      return NextResponse.json({ messages: data });
    } else {
      const { data, error } = await supabase
        .from("conversazioni")
        .select("*")
        .order("updated_at", { ascending: false });
      if (error) throw new Error(error.message);
      return NextResponse.json({ conversations: data });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { titolo } = await req.json().catch(() => ({}));
    const { data, error } = await supabase
      .from("conversazioni")
      .insert({ titolo: titolo || "Nuova conversazione" })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return NextResponse.json({ conversation: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { id, titolo } = await req.json();
    const { error } = await supabase
      .from("conversazioni")
      .update({ titolo, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw new Error(error.message);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json();
    const { error } = await supabase
      .from("conversazioni")
      .delete()
      .eq("id", id);
    if (error) throw new Error(error.message);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}