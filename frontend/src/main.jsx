import React, { useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { ArrowDownToLine, ArrowRight, Check, CheckCircle2, FileText, FileUp, Globe2, Languages, LoaderCircle, LockKeyhole, RefreshCw, ShieldCheck, Sparkles, UploadCloud, X } from 'lucide-react'
import './index.css'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'
function App() {
  const [file, setFile] = useState(null)
  const [dragging, setDragging] = useState(false)
  const [ocr, setOcr] = useState(false)
  const [status, setStatus] = useState('idle')
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const inputRef = useRef(null)
  const validFile = f => {
    if (!f) return
    setError(''); setResult(null)
    if (!f.name.toLowerCase().endsWith('.pdf') || f.type && f.type !== 'application/pdf') { setFile(null); setError('Please choose a PDF file.'); return }
    if (f.size > 25 * 1024 * 1024) { setFile(null); setError('The file is larger than 25 MB. Choose a smaller PDF.'); return }
    setFile(f); setStatus('idle'); setProgress(0)
  }
  const formatSize = n => n < 1024 * 1024 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`
  async function translate() {
    if (!file || status === 'working') return
    setStatus('working'); setError(''); setResult(null); setProgress(8)
    const form = new FormData(); form.append('file', file); form.append('ocr', String(ocr))
    const tick = setInterval(() => setProgress(p => p < 88 ? p + Math.max(1, (88-p)*0.08) : p), 700)
    try {
      const response = await fetch(`${API_URL}/api/translate?ocr=${ocr}`, { method: 'POST', body: form })
      if (!response.ok) {
        let message = `Translation failed (${response.status}).`
        try { const data = await response.json(); message = data.detail || message } catch {}
        throw new Error(message)
      }
      const blob = await response.blob()
      if (!blob.size) throw new Error('The server returned an empty PDF. Please try again.')
      const url = URL.createObjectURL(blob)
      const pages = Number(response.headers.get('X-Translated-Pages') || 0)
      setResult({ url, name: `${file.name.replace(/\.pdf$/i, '')}_bangla.pdf`, size: blob.size, pages })
      setProgress(100); setStatus('done')
    } catch (e) {
      setError(e.message || 'Could not connect to the translation server. Make sure the backend is running.')
      setStatus('error')
    } finally { clearInterval(tick) }
  }
  function reset() { if (result?.url) URL.revokeObjectURL(result.url); setFile(null); setResult(null); setError(''); setStatus('idle'); setProgress(0); if (inputRef.current) inputRef.current.value = '' }
  return <div className="min-h-screen bg-[#f7f9fc] text-slate-800">
    <header className="border-b border-slate-200/80 bg-white/90"><div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-8">
      <a href="#top" className="flex items-center gap-3" aria-label="BanglaPDF home"><span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-lg shadow-emerald-600/20"><Languages size={21}/></span><span><span className="block text-lg font-bold tracking-tight">BanglaPDF</span><span className="block text-[11px] font-medium text-slate-500">DOCUMENT TRANSLATOR</span></span></a>
      <div className="hidden items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600 sm:flex"><Globe2 size={14} className="text-emerald-600"/> English <ArrowRight size={13}/> বাংলা</div>
      <a href="#how-it-works" className="text-sm font-semibold text-slate-600 transition hover:text-emerald-700">How it works</a>
    </div></header>
    <main id="top" className="mx-auto max-w-6xl px-5 pb-16 pt-10 sm:px-8 sm:pt-16">
      <section className="mx-auto max-w-3xl text-center"><div className="mb-5 inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-3.5 py-1.5 text-xs font-bold text-emerald-800"><Sparkles size={14}/> ENGLISH TO BENGALI, MADE SIMPLE</div><h1 className="text-4xl font-bold leading-tight tracking-tight text-slate-900 sm:text-6xl">Every page, in your <span className="text-emerald-600">own language.</span></h1><p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-slate-500 sm:text-lg">Translate English PDF documents into Bengali in a few clicks. Upload your document, translate the text, and download a new Bengali PDF.</p></section>
      <section className="mx-auto mt-10 max-w-2xl"><div className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-soft sm:p-7">
        <div className="mb-5 flex items-center justify-between"><div><h2 className="text-lg font-bold text-slate-900">Translate your document</h2><p className="mt-1 text-sm text-slate-500">PDF only · Up to 25 MB</p></div><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700"><FileText size={22}/></div></div>
        {!file ? <button type="button" onClick={() => inputRef.current?.click()} onDragOver={e => {e.preventDefault(); setDragging(true)}} onDragLeave={() => setDragging(false)} onDrop={e => {e.preventDefault(); setDragging(false); validFile(e.dataTransfer.files?.[0])}} className={`group flex min-h-56 w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed px-5 py-8 transition ${dragging ? 'border-emerald-500 bg-emerald-50' : 'border-slate-300 bg-slate-50/70 hover:border-emerald-400 hover:bg-emerald-50/50'}`}><span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-emerald-600 shadow-sm ring-1 ring-slate-200 transition group-hover:scale-105"><UploadCloud size={27}/></span><span className="text-base font-bold text-slate-800">Drop your PDF here</span><span className="mt-1.5 text-sm text-slate-500">or <span className="font-semibold text-emerald-700 underline underline-offset-2">browse files</span> from your device</span><span className="mt-4 rounded-full bg-slate-200/70 px-3 py-1 text-[11px] font-semibold text-slate-500">PDF · MAX 25 MB</span></button> : <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4"><div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white text-emerald-700 shadow-sm"><FileText size={23}/></div><div className="min-w-0 flex-1 text-left"><p className="truncate text-sm font-bold text-slate-800">{file.name}</p><p className="mt-1 text-xs text-slate-500">{formatSize(file.size)} · Ready to translate</p></div><button onClick={reset} disabled={status === 'working'} aria-label="Remove PDF" className="rounded-lg p-2 text-slate-500 hover:bg-white hover:text-rose-600 disabled:opacity-40"><X size={18}/></button></div>}
        <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={e => validFile(e.target.files?.[0])}/>
        <div className="my-5 flex items-center gap-3 rounded-xl bg-slate-50 px-4 py-3"><div className="flex min-w-0 flex-1 items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-slate-500 ring-1 ring-slate-200"><Languages size={18}/></div><div><p className="text-sm font-semibold">Translation language</p><p className="mt-0.5 text-xs text-slate-500">English <ArrowRight className="mx-1 inline" size={12}/> Bengali (বাংলা)</p></div></div><span className="rounded-lg border border-emerald-200 bg-white px-2.5 py-1.5 text-sm font-bold text-emerald-700">বাংলা</span></div>
        <label className="mb-5 flex cursor-pointer items-start gap-3 rounded-xl px-1 py-1"><input type="checkbox" checked={ocr} onChange={e => setOcr(e.target.checked)} className="mt-1 h-4 w-4 rounded border-slate-300 accent-emerald-600"/><span><span className="block text-sm font-semibold text-slate-700">Enable OCR for scanned PDFs</span><span className="mt-1 block text-xs leading-5 text-slate-500">Use this if your PDF contains scanned pages or images of text. It requires the OCR tools in the backend.</span></span></label>
        {status === 'working' && <div className="mb-5 rounded-xl border border-emerald-100 bg-emerald-50/60 p-4"><div className="mb-2 flex items-center justify-between text-sm"><span className="flex items-center gap-2 font-semibold text-emerald-800"><LoaderCircle size={16} className="animate-spin"/> Translating your PDF…</span><span className="font-bold tabular-nums text-emerald-800">{Math.round(progress)}%</span></div><div className="h-2 overflow-hidden rounded-full bg-emerald-100"><div className="h-full rounded-full bg-emerald-600 transition-all duration-500" style={{width:`${progress}%`}}/></div><p className="mt-2 text-xs text-emerald-800/75">Long documents may take a few minutes. Please keep this tab open.</p></div>}
        {error && <div role="alert" className="mb-4 flex gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm leading-5 text-rose-700"><X size={17} className="mt-0.5 shrink-0"/><span>{error}</span></div>}
        {status === 'done' && result && <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-left"><div className="flex items-start gap-3"><CheckCircle2 className="mt-0.5 shrink-0 text-emerald-700" size={21}/><div className="min-w-0 flex-1"><p className="font-bold text-emerald-900">Your Bengali PDF is ready!</p><p className="mt-1 break-all text-sm text-emerald-800">{result.name} · {formatSize(result.size)}{result.pages ? ` · ${result.pages} pages` : ''}</p><a href={result.url} download={result.name} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-800"><ArrowDownToLine size={17}/> Download translated PDF</a></div></div></div>}
        {status === 'done' ? <button onClick={reset} className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50"><RefreshCw size={16}/> Translate another PDF</button> : <button onClick={translate} disabled={!file || status === 'working'} className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3.5 text-sm font-bold text-white shadow-lg shadow-emerald-600/15 transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none">{status === 'working' ? <><LoaderCircle size={17} className="animate-spin"/> Translating…</> : <><Languages size={18}/> Translate to Bengali <ArrowRight size={17}/></>}</button>}
        <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-[11px] leading-5 text-slate-400"><LockKeyhole size={12}/> Files are processed by your backend and are not saved by this app.</p>
      </div></section>
      <section id="how-it-works" className="mx-auto mt-16 max-w-4xl"><div className="mb-7 text-center"><p className="text-xs font-bold uppercase tracking-[.18em] text-emerald-700">Simple by design</p><h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">From English PDF to বাংলা PDF</h2></div><div className="grid gap-4 sm:grid-cols-3">{[{n:'01',icon:FileUp,title:'Upload your PDF',desc:'Choose a text-based PDF or enable OCR for scanned documents.'},{n:'02',icon:Languages,title:'Translate the text',desc:'The backend extracts each page and translates the content into Bengali.'},{n:'03',icon:ArrowDownToLine,title:'Download in Bengali',desc:'Get a new PDF with Bengali text, ready to read or share.'}].map(item => <div key={item.n} className="rounded-2xl border border-slate-200 bg-white p-5"><div className="mb-4 flex items-center justify-between"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><item.icon size={20}/></span><span className="text-xs font-bold tracking-widest text-slate-300">{item.n}</span></div><h3 className="font-bold text-slate-800">{item.title}</h3><p className="mt-2 text-sm leading-6 text-slate-500">{item.desc}</p></div>)}</div></section>
      <div className="mx-auto mt-10 flex max-w-3xl items-start gap-3 rounded-2xl border border-amber-200/80 bg-amber-50/70 p-4"><ShieldCheck className="mt-0.5 shrink-0 text-amber-700" size={19}/><p className="text-xs leading-5 text-amber-900/80"><strong>Good to know:</strong> This creates a newly formatted Bengali PDF; it does not preserve the original page design, images, tables, or exact layout. Translation uses an online service, so the backend needs internet access. Avoid uploading confidential documents unless your deployment and translation provider meet your privacy requirements.</p></div>
    </main><footer className="border-t border-slate-200 bg-white"><div className="mx-auto flex max-w-6xl flex-col gap-2 px-5 py-6 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between sm:px-8"><span className="font-semibold text-slate-500">BanglaPDF <span className="font-normal">· English to Bengali PDF translation</span></span><span>Built for easier reading in বাংলা.</span></div></footer>
  </div>
}

createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>)
