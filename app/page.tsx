'use client';
import { useState, useEffect, useRef } from 'react';

type Message = { role: 'user' | 'assistant'; content: string };
type Conversation = { id: string; titolo: string; updated_at: string };
type Source = { name: string; chunks: number };
type Stile = { dettaglio: 'breve' | 'normale' | 'approfondito'; tono: 'formale' | 'neutro' | 'informale'; focus: 'riassunto' | 'analisi' | 'ricerca' };

const STILE_DEFAULT: Stile = { dettaglio: 'normale', tono: 'neutro', focus: 'riassunto' };

function PillButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={`px-3 py-1 rounded-full text-xs font-medium transition border ${active ? 'bg-blue-600 border-blue-500 text-white' : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-200'}`}>
      {children}
    </button>
  );
}

export default function Home() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [question, setQuestion] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState('');
  const [sources, setSources] = useState<Source[]>([]);
  const [activeTab, setActiveTab] = useState<'chat' | 'sources'>('chat');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [stile, setStile] = useState<Stile>(STILE_DEFAULT);
  const [showStile, setShowStile] = useState(false);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
  useEffect(() => { fetchConversations(); }, []);
  useEffect(() => { if (activeTab === 'sources') fetchSources(); }, [activeTab]);

  const fetchConversations = async () => {
    const res = await fetch('/api/conversations');
    const data = await res.json();
    setConversations(data.conversations || []);
  };

  const newConversation = async () => {
    const res = await fetch('/api/conversations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
    const data = await res.json();
    if (data.conversation) {
      setConversations(prev => [data.conversation, ...prev]);
      setActiveConvId(data.conversation.id);
      setMessages([]);
      setStile(STILE_DEFAULT);
      setSidebarOpen(false);
    }
  };

  const loadConversation = async (id: string) => {
    setActiveConvId(id);
    setSidebarOpen(false);
    const res = await fetch(`/api/conversations?id=${id}`);
    const data = await res.json();
    setMessages(data.messages || []);
  };

  const deleteConversation = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Eliminare questa conversazione?')) return;
    await fetch('/api/conversations', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    setConversations(prev => prev.filter(c => c.id !== id));
    if (activeConvId === id) { setActiveConvId(null); setMessages([]); }
  };

  const startRename = (conv: Conversation, e: React.MouseEvent) => {
    e.stopPropagation();
    setRenamingId(conv.id);
    setRenameValue(conv.titolo);
  };

  const saveRename = async (id: string) => {
    if (!renameValue.trim()) return;
    await fetch('/api/conversations', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, titolo: renameValue }) });
    setConversations(prev => prev.map(c => c.id === id ? { ...c, titolo: renameValue } : c));
    setRenamingId(null);
  };

  const handleChat = async () => {
    if (!question.trim() || chatLoading) return;
    let convId = activeConvId;
    if (!convId) {
      const res = await fetch('/api/conversations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
      const data = await res.json();
      convId = data.conversation.id;
      setActiveConvId(convId);
      setConversations(prev => [data.conversation, ...prev]);
    }
    const userMsg = question.trim();
    setQuestion('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setChatLoading(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: userMsg, conversazione_id: convId, stile }),
      });
      const data = await res.json();
      setMessages(prev => [...prev, { role: 'assistant', content: data.answer || `Errore: ${data.error}` }]);
      fetchConversations();
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: '❌ Errore di connessione.' }]);
    } finally { setChatLoading(false); }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true); setUploadMsg('');
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await res.json();
      setUploadMsg(data.success ? `✅ "${file.name}" caricato!` : `❌ ${data.error}`);
      if (data.success && activeTab === 'sources') fetchSources();
    } catch { setUploadMsg('❌ Errore durante l\'invio'); }
    finally { setUploading(false); e.target.value = ''; }
  };

  const fetchSources = async () => {
    const res = await fetch('/api/sources');
    const data = await res.json();
    setSources(data.sources || []);
  };

  const handleDeleteSource = async (sourceName: string) => {
    if (!confirm(`Eliminare "${sourceName}"?`)) return;
    const res = await fetch('/api/sources', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sourceName }) });
    const data = await res.json();
    if (data.success) fetchSources();
  };

  const downloadFile = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  const renderMessage = (text: string) => {
    const fileMatch = text.match(/\[GENERA_FILE:\s*(.+?)\]/);
    const cleanText = text.replace(/\[GENERA_FILE:\s*.+?\]/, '').trim();
    const formatted = cleanText
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/`(.+?)`/g, '<code style="background:#374151;padding:2px 5px;border-radius:4px;font-size:0.75rem">$1</code>')
      .replace(/\n/g, '<br/>');
    return (
      <div>
        <div dangerouslySetInnerHTML={{ __html: formatted }} />
        {fileMatch && (
          <button onClick={() => downloadFile(cleanText, fileMatch[1])}
            className="mt-2 text-xs bg-blue-700 hover:bg-blue-600 px-3 py-1.5 rounded-lg transition inline-flex items-center gap-1.5">
            ⬇️ Scarica {fileMatch[1]}
          </button>
        )}
      </div>
    );
  };

  const formatDate = (iso: string) => new Date(iso).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' });

  const stileLabel = () => {
    const labels = [];
    if (stile.dettaglio !== 'normale') labels.push(stile.dettaglio);
    if (stile.tono !== 'neutro') labels.push(stile.tono);
    if (stile.focus !== 'riassunto') labels.push(stile.focus);
    return labels.length > 0 ? labels.join(' · ') : 'Stile normale';
  };

  return (
    <div className="flex h-screen bg-gray-950 text-white overflow-hidden">

      {/* SIDEBAR */}
      <aside className={`fixed inset-y-0 left-0 z-30 w-64 bg-gray-900 border-r border-gray-800 flex flex-col transition-transform duration-200 md:relative md:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="px-4 py-4 border-b border-gray-800 flex items-center gap-2">
          <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center text-xs font-bold">W</div>
          <span className="font-semibold text-sm">Wiki AI</span>
        </div>

        <div className="px-3 py-3">
          <button onClick={newConversation} className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm px-3 py-2 rounded-lg transition flex items-center gap-2 justify-center">
            <span className="text-base">+</span> Nuova chat
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-2 space-y-0.5 pb-2">
          {conversations.length === 0 && <p className="text-xs text-gray-500 text-center mt-6">Nessuna conversazione</p>}
          {conversations.map(conv => (
            <div key={conv.id} onClick={() => loadConversation(conv.id)}
              className={`group flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition ${activeConvId === conv.id ? 'bg-gray-700' : 'hover:bg-gray-800'}`}>
              {renamingId === conv.id ? (
                <input autoFocus value={renameValue} onChange={e => setRenameValue(e.target.value)}
                  onBlur={() => saveRename(conv.id)} onKeyDown={e => e.key === 'Enter' && saveRename(conv.id)}
                  onClick={e => e.stopPropagation()}
                  className="flex-1 bg-gray-600 text-white text-xs px-2 py-0.5 rounded outline-none" />
              ) : (
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-200 truncate">{conv.titolo}</p>
                  <p className="text-xs text-gray-500">{formatDate(conv.updated_at)}</p>
                </div>
              )}
              <div className="hidden group-hover:flex items-center gap-0.5 ml-1">
                <button onClick={e => startRename(conv, e)} className="text-gray-400 hover:text-white p-1 text-xs">✏️</button>
                <button onClick={e => deleteConversation(conv.id, e)} className="text-gray-400 hover:text-red-400 p-1 text-xs">🗑</button>
              </div>
            </div>
          ))}
        </div>

        <div className="px-3 py-3 border-t border-gray-800">
          <label className={`w-full cursor-pointer flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm transition ${uploading ? 'bg-gray-700 text-gray-400 cursor-not-allowed' : 'bg-gray-800 hover:bg-gray-700 text-gray-200'}`}>
            {uploading ? '⏳ Caricamento...' : '📎 Carica PDF'}
            <input type="file" accept=".pdf" onChange={handleUpload} disabled={uploading} className="hidden" />
          </label>
          {uploadMsg && <p className={`text-xs mt-1.5 text-center ${uploadMsg.startsWith('✅') ? 'text-green-400' : 'text-red-400'}`}>{uploadMsg}</p>}
        </div>
      </aside>

      {sidebarOpen && <div className="fixed inset-0 z-20 bg-black/50 md:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* MAIN */}
      <div className="flex flex-col flex-1 min-w-0">

        {/* Header */}
        <header className="bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center gap-3">
          <button onClick={() => setSidebarOpen(true)} className="md:hidden text-gray-400 hover:text-white text-lg">☰</button>
          <div className="flex border border-gray-700 rounded-lg overflow-hidden">
            {(['chat', 'sources'] as const).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`px-4 py-1.5 text-sm transition ${activeTab === tab ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'}`}>
                {tab === 'chat' ? '💬 Chat' : '📚 Fonti'}
              </button>
            ))}
          </div>
          <p className="ml-auto text-xs text-gray-500 truncate hidden sm:block">
            {activeConvId ? (conversations.find(c => c.id === activeConvId)?.titolo || 'Chat attiva') : 'Nessuna chat selezionata'}
          </p>
        </header>

        {/* CHAT */}
        {activeTab === 'chat' && (
          <div className="flex flex-col flex-1 overflow-hidden">

            {/* Pannello stile */}
            <div className="border-b border-gray-800 bg-gray-900/50">
              <button onClick={() => setShowStile(s => !s)}
                className="w-full flex items-center justify-between px-4 py-2 text-xs text-gray-400 hover:text-gray-200 transition">
                <span>⚙️ Stile risposta: <span className="text-blue-400 font-medium">{stileLabel()}</span></span>
                <span>{showStile ? '▲' : '▼'}</span>
              </button>

              {showStile && (
                <div className="px-4 pb-3 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-gray-500 w-16">Dettaglio</span>
                    {(['breve', 'normale', 'approfondito'] as const).map(v => (
                      <PillButton key={v} active={stile.dettaglio === v} onClick={() => setStile(s => ({ ...s, dettaglio: v }))}>
                        {v === 'breve' ? '⚡ Breve' : v === 'normale' ? '📝 Normale' : '🔍 Approfondito'}
                      </PillButton>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-gray-500 w-16">Tono</span>
                    {(['formale', 'neutro', 'informale'] as const).map(v => (
                      <PillButton key={v} active={stile.tono === v} onClick={() => setStile(s => ({ ...s, tono: v }))}>
                        {v === 'formale' ? '👔 Formale' : v === 'neutro' ? '⚖️ Neutro' : '😊 Informale'}
                      </PillButton>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-gray-500 w-16">Focus</span>
                    {(['riassunto', 'analisi', 'ricerca'] as const).map(v => (
                      <PillButton key={v} active={stile.focus === v} onClick={() => setStile(s => ({ ...s, focus: v }))}>
                        {v === 'riassunto' ? '📋 Riassunto' : v === 'analisi' ? '🧠 Analisi' : '🔎 Ricerca'}
                      </PillButton>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Messaggi */}
            <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
              {messages.length === 0 && (
                <div className="text-center text-gray-500 mt-16">
                  <p className="text-5xl mb-4">🤖</p>
                  <p className="text-lg font-medium text-gray-300">Benvenuto nella tua Wiki AI</p>
                  <p className="text-sm mt-2">Scrivi una domanda sui tuoi documenti.</p>
                  <p className="text-sm mt-1 text-gray-600">Puoi regolare lo stile di risposta qui sopra ⚙️</p>
                </div>
              )}
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.role === 'assistant' && (
                    <div className="w-7 h-7 bg-blue-600 rounded-full flex items-center justify-center text-xs mr-2 mt-1 flex-shrink-0">AI</div>
                  )}
                  <div className={`max-w-[78%] px-4 py-3 rounded-2xl text-sm leading-relaxed
                    ${msg.role === 'user' ? 'bg-blue-600 text-white rounded-br-sm' : 'bg-gray-800 text-gray-100 rounded-bl-sm'}`}>
                    {msg.role === 'assistant' ? renderMessage(msg.content) : msg.content}
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div className="flex justify-start">
                  <div className="w-7 h-7 bg-blue-600 rounded-full flex items-center justify-center text-xs mr-2 mt-1 flex-shrink-0">AI</div>
                  <div className="bg-gray-800 px-4 py-3 rounded-2xl rounded-bl-sm text-sm text-gray-400 animate-pulse">
                    Sto analizzando i tuoi documenti...
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input */}
            <div className="border-t border-gray-800 px-4 py-3 bg-gray-950">
              <div className="flex gap-2 max-w-3xl mx-auto">
                <input type="text" value={question} onChange={e => setQuestion(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleChat()}
                  placeholder="Scrivi una domanda... (Invio per inviare)"
                  className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500 transition" />
                <button onClick={handleChat} disabled={chatLoading || !question.trim()}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 px-5 py-3 rounded-xl text-sm font-medium transition">
                  Invia
                </button>
              </div>
            </div>
          </div>
        )}

        {/* FONTI */}
        {activeTab === 'sources' && (
          <div className="flex-1 overflow-y-auto px-4 py-6">
            <div className="max-w-2xl mx-auto">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-gray-200">Documenti in memoria</h2>
                <button onClick={fetchSources} className="text-xs text-gray-400 hover:text-gray-200 transition">🔄 Aggiorna</button>
              </div>
              {sources.length === 0 ? (
                <div className="text-center text-gray-500 mt-20">
                  <p className="text-3xl mb-3">📭</p>
                  <p>Nessun documento caricato.</p>
                  <p className="text-sm mt-1">Usa "Carica PDF" nella sidebar.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {sources.map((src, i) => (
                    <div key={i} className="flex items-center justify-between bg-gray-800 border border-gray-700 rounded-xl px-4 py-3">
                      <div>
                        <p className="text-sm font-medium">📄 {src.name}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{src.chunks} chunk in memoria</p>
                      </div>
                      <button onClick={() => handleDeleteSource(src.name)}
                        className="text-xs text-red-400 hover:text-red-300 hover:bg-red-950 px-3 py-1.5 rounded-lg transition">
                        🗑 Elimina
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}