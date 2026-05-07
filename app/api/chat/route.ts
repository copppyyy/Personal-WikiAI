import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Groq from "groq-sdk";

export const runtime = "nodejs";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

type Stile = { dettaglio: string; tono: string; focus: string };

function buildSystemPrompt(context: string, stile: Stile): string {
  const dettaglioMap: Record<string, string> = {
    breve: "Rispondi in modo MOLTO CONCISO: massimo 3-4 frasi, vai dritto al punto.",
    normale: "Rispondi in modo chiaro e bilanciato, né troppo lungo né troppo corto.",
    approfondito: "Rispondi in modo MOLTO DETTAGLIATO: approfondisci ogni aspetto, usa esempi, struttura la risposta con punti elenco se utile.",
  };

  const tonoMap: Record<string, string> = {
    formale: "Usa un tono professionale e formale.",
    neutro: "Usa un tono neutro e obiettivo.",
    informale: "Usa un tono amichevole e conversazionale, come se parlassi con un collega.",
  };

  const focusMap: Record<string, string> = {
    riassunto: "Concentrati nel RIASSUMERE i punti chiave dei documenti.",
    analisi: "Fai un'ANALISI critica e approfondita del contenuto.",
    ricerca: "CERCA in tutti i documenti disponibili e cita le fonti specifiche da cui prendi le informazioni.",
  };

  return `Sei un assistente intelligente che aiuta l'utente ad analizzare i propri documenti.
Rispondi sempre in italiano.

STILE DI RISPOSTA:
- ${dettaglioMap[stile.dettaglio] || dettaglioMap.normale}
- ${tonoMap[stile.tono] || tonoMap.neutro}
- ${focusMap[stile.focus] || focusMap.riassunto}

Se la risposta non è nei documenti, dillo esplicitamente.
Se l'utente chiede di creare un file o documento, genera il contenuto in markdown ben strutturato e aggiungi alla fine: [GENERA_FILE: nome_file.md]

DOCUMENTI DISPONIBILI:
${context}`;
}

export async function POST(req: NextRequest) {
  try {
    const { question, conversazione_id, stile } = await req.json();
    if (!question) return NextResponse.json({ error: "Domanda mancante" }, { status: 400 });
    if (!conversazione_id) return NextResponse.json({ error: "ID conversazione mancante" }, { status: 400 });

    const stileAttivo: Stile = {
      dettaglio: stile?.dettaglio || "normale",
      tono: stile?.tono || "neutro",
      focus: stile?.focus || "riassunto",
    };

    // 1. Storia conversazione
    const { data: storiaMsgDb } = await supabase
      .from("messaggi")
      .select("role, content")
      .eq("conversazione_id", conversazione_id)
      .order("created_at", { ascending: true })
      .limit(20);

    const storiaMsg = storiaMsgDb || [];

    // 2. Embedding domanda
    const { pipeline } = await import("@xenova/transformers");
    const embedder = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
    const output = await embedder(question, { pooling: "mean", normalize: true });
    const vector = Array.from(output.data) as number[];

    // 3. Ricerca documenti
    const { data: chunks, error: searchError } = await supabase.rpc("match_documents", {
      query_embedding: vector,
      match_threshold: 0.1,
      match_count: 6,
    });
    if (searchError) throw new Error("Errore ricerca: " + searchError.message);

    const context = chunks && chunks.length > 0
      ? chunks.map((c: any) => `[Fonte: ${c.metadata?.source || "documento"}]\n${c.content}`).join("\n\n---\n\n")
      : "Nessun documento rilevante trovato.";

    // 4. Costruisci messaggi con stile dinamico
    const groqMessages = [
      { role: "system" as const, content: buildSystemPrompt(context, stileAttivo) },
      ...storiaMsg.map((m: any) => ({ role: m.role as "user" | "assistant", content: m.content })),
      { role: "user" as const, content: question },
    ];

    // 5. Temperatura basata sul dettaglio
    const tempMap: Record<string, number> = { breve: 0.1, normale: 0.3, approfondito: 0.5 };
    const maxTokensMap: Record<string, number> = { breve: 512, normale: 1024, approfondito: 2048 };

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: groqMessages,
      temperature: tempMap[stileAttivo.dettaglio] || 0.3,
      max_tokens: maxTokensMap[stileAttivo.dettaglio] || 1024,
    });

    const answer = completion.choices[0]?.message?.content || "Nessuna risposta generata.";

    // 6. Salva messaggi
    await supabase.from("messaggi").insert([
      { conversazione_id, role: "user", content: question },
      { conversazione_id, role: "assistant", content: answer },
    ]);

    // 7. Auto-titolo al primo messaggio
    if (storiaMsg.length === 0) {
      const titolo = question.length > 50 ? question.substring(0, 50) + "..." : question;
      await supabase.from("conversazioni").update({ titolo, updated_at: new Date().toISOString() }).eq("id", conversazione_id);
    } else {
      await supabase.from("conversazioni").update({ updated_at: new Date().toISOString() }).eq("id", conversazione_id);
    }

    return NextResponse.json({ answer, sources: chunks?.length || 0 });

  } catch (err: any) {
    console.error("Errore chat:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}