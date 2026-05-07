import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs"; // forza Node.js, mai Edge

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: NextRequest) {
  console.log("1. [START] Richiesta ricevuta");

  try {
    // 2. Leggi il file
    const formData = await req.formData();
    const file = formData.get("file") as File;
    if (!file) return NextResponse.json({ error: "Nessun file" }, { status: 400 });

    console.log("3. [FILE] Ricevuto:", file.name);

    // 3. Converti in Buffer
    const buffer = Buffer.from(await file.arrayBuffer());

    // 4. Estrai testo dal PDF — import dinamico per evitare conflitti Turbopack
    console.log("4. [PDF] Estrazione testo...");
    const pdfParse = (await import("pdf-parse/lib/pdf-parse.js")).default;
    const pdfData = await pdfParse(buffer);
    const fullText = pdfData.text;

    if (!fullText || fullText.trim().length === 0) {
      return NextResponse.json({ error: "PDF vuoto o non leggibile" }, { status: 400 });
    }
    console.log(`5. [PDF] Testo estratto: ${fullText.length} caratteri`);

    // 5. Chunking
    const chunkSize = 800;
    const chunks: string[] = [];
    for (let i = 0; i < fullText.length; i += chunkSize) {
      const chunk = fullText.slice(i, i + chunkSize).trim();
      if (chunk.length > 50) chunks.push(chunk);
    }
    console.log(`6. [CHUNK] Creati ${chunks.length} chunk`);

    // 6. Embedding — import dinamico
    console.log("7. [EMBED] Caricamento modello...");
    const { pipeline } = await import("@xenova/transformers");
const embedder = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");

    // 7. Embedding + salvataggio chunk per chunk
    console.log("8. [EMBED] Inizio embedding e salvataggio...");
    for (let i = 0; i < chunks.length; i++) {
      const output = await embedder(chunks[i], { pooling: "mean", normalize: true });
const vector = Array.from(output.data) as number[];
      const { error } = await supabase.from("documenti_wiki").insert({
        content: chunks[i],
        embedding: vector,
        metadata: { source: file.name, chunk: i },
      });
      if (error) throw new Error(`Supabase insert fallito: ${error.message}`);
    }

    console.log("9. [DONE] Upload completato!");
    return NextResponse.json({
      success: true,
      message: `${chunks.length} chunk salvati con successo`,
    });

  } catch (err: any) {
    console.error("!!! ERRORE:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}