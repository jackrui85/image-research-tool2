import { useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  ArrowUpRight,
  Check,
  Clipboard,
  FileImage,
  Image as ImageIcon,
  Link2,
  Loader2,
  Search,
  Sparkles,
  UploadCloud,
  X,
} from "lucide-react";
import { toast } from "sonner";

type ResearchResult = {
  analysis: {
    subject: string;
    summary: string;
    keywords: string[];
    visualFacts: string[];
    confidence: "high" | "medium" | "low";
  };
  links: Array<{
    title: string;
    url: string;
    source: string;
    snippet: string;
    kind: "article" | "image" | "search";
  }>;
  searchedAt: string;
};

const confidenceLabels = { high: "高", medium: "中", low: "低" } as const;

function readAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("圖片讀取失敗"));
    reader.readAsDataURL(file);
  });
}

export default function Home() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>("");
  const [note, setNote] = useState("");
  const [dragging, setDragging] = useState(false);
  const [result, setResult] = useState<ResearchResult | null>(null);
  const analyze = trpc.imageResearch.analyze.useMutation();

  const selectFile = (nextFile?: File) => {
    if (!nextFile) return;
    if (!nextFile.type.startsWith("image/")) {
      toast.error("請選擇 JPG、PNG、WEBP 或其他圖片檔案");
      return;
    }
    if (nextFile.size > 6 * 1024 * 1024) {
      toast.error("圖片大小請控制在 6MB 以內");
      return;
    }
    setFile(nextFile);
    setPreview(URL.createObjectURL(nextFile));
    setResult(null);
  };

  const handleAnalyze = async () => {
    if (!file) {
      toast.error("先放入一張圖片，再開始搜尋");
      return;
    }
    try {
      const imageData = await readAsDataUrl(file);
      analyze.mutate(
        { imageData, note: note.trim() || undefined },
        {
          onSuccess: data => {
            setResult(data as ResearchResult);
            toast.success("分析完成，已整理相關來源");
          },
          onError: error => toast.error(error.message || "搜尋失敗，請稍後再試"),
        },
      );
    } catch {
      toast.error("圖片讀取失敗，請重新選擇");
    }
  };

  const clearFile = () => {
    setFile(null);
    setPreview("");
    setResult(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const copyLink = async (url: string) => {
    await navigator.clipboard.writeText(url);
    toast.success("連結已複製");
  };

  const copyAll = async () => {
    if (!result?.links.length) return;
    await navigator.clipboard.writeText(result.links.map(link => `${link.title}\n${link.url}`).join("\n\n"));
    toast.success(`已複製 ${result.links.length} 筆連結`);
  };

  return (
    <div className="min-h-screen overflow-hidden bg-[#101316] text-[#f4efe6]">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_82%_8%,rgba(226,145,93,0.14),transparent_30%),radial-gradient(circle_at_8%_42%,rgba(112,183,163,0.1),transparent_28%)]" />
      <header className="relative z-10 border-b border-white/10 bg-[#101316]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#e2915d] text-[#101316] shadow-[0_0_30px_rgba(226,145,93,0.22)]">
              <Search size={20} strokeWidth={2.5} />
            </div>
            <div>
              <p className="text-sm font-semibold tracking-[0.18em] text-[#e2915d]">IMAGE RESEARCH</p>
              <h1 className="text-lg font-semibold tracking-tight">圖像線索搜尋工作台</h1>
            </div>
          </div>
          <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-white/55 sm:flex">
            <span className="h-2 w-2 rounded-full bg-[#8bc7ac] shadow-[0_0_10px_#8bc7ac]" />
            公開資料來源 · 即時整理
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-7xl px-5 pb-16 pt-10 lg:px-8 lg:pt-14">
        <section className="mb-10 max-w-3xl">
          <p className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.24em] text-[#8bc7ac]"><Sparkles size={14} /> from pixels to context</p>
          <h2 className="font-serif text-4xl leading-[1.06] tracking-[-0.04em] text-[#fffaf2] sm:text-6xl">把一張圖片，<span className="text-[#e2915d]">變成可追查的線索。</span></h2>
          <p className="mt-5 max-w-2xl text-base leading-7 text-white/55 sm:text-lg">上傳圖片後，工具會辨識可見的主體與特徵，產生搜尋詞，並從百科、圖像資料庫與搜尋引擎整理成可複製的連結清單。</p>
        </section>

        <div className="grid gap-6 lg:grid-cols-[minmax(330px,0.82fr)_minmax(0,1.18fr)]">
          <section className="rounded-[28px] border border-white/10 bg-[#171b1e]/90 p-5 shadow-2xl shadow-black/20 sm:p-6">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/35">01 / upload</p>
                <h3 className="mt-2 text-xl font-semibold">放入圖片</h3>
              </div>
              {file && <button onClick={clearFile} className="rounded-full p-2 text-white/40 transition hover:bg-white/10 hover:text-white" aria-label="清除圖片"><X size={18} /></button>}
            </div>

            <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={event => selectFile(event.target.files?.[0])} />
            <button
              type="button"
              className={`group relative flex min-h-[280px] w-full flex-col items-center justify-center overflow-hidden rounded-2xl border border-dashed text-center transition ${dragging ? "border-[#e2915d] bg-[#e2915d]/10" : "border-white/15 bg-[#111517] hover:border-white/30 hover:bg-[#14191b]"}`}
              onClick={() => inputRef.current?.click()}
              onDragOver={event => { event.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={event => { event.preventDefault(); setDragging(false); selectFile(event.dataTransfer.files?.[0]); }}
            >
              {preview ? (
                <img src={preview} alt="待分析圖片預覽" className="absolute inset-0 h-full w-full object-contain p-3" />
              ) : (
                <>
                  <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#e2915d]/10 text-[#e2915d] transition group-hover:scale-105"><UploadCloud size={28} /></div>
                  <span className="text-sm font-semibold text-white/80">拖放圖片到這裡</span>
                  <span className="mt-2 text-xs text-white/38">或點擊選擇檔案 · JPG / PNG / WEBP · 6MB 內</span>
                </>
              )}
            </button>

            {file && (
              <div className="mt-4 flex items-center gap-3 rounded-xl bg-white/[0.04] px-3 py-3 text-sm">
                <FileImage size={18} className="shrink-0 text-[#8bc7ac]" />
                <span className="min-w-0 flex-1 truncate text-white/75">{file.name}</span>
                <span className="text-xs text-white/35">{(file.size / 1024 / 1024).toFixed(1)} MB</span>
              </div>
            )}

            <label className="mt-6 block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-white/40">補充線索（選填）</span>
              <textarea value={note} onChange={event => setNote(event.target.value)} maxLength={300} placeholder="例如：我想知道這是哪一種植物、建築或商品……" className="min-h-[92px] w-full resize-none rounded-xl border border-white/10 bg-[#111517] px-4 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-white/25 focus:border-[#e2915d]/70 focus:ring-2 focus:ring-[#e2915d]/10" />
            </label>

            <button onClick={handleAnalyze} disabled={!file || analyze.isPending} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[#e2915d] px-4 py-3.5 text-sm font-bold text-[#17100b] transition hover:bg-[#efaa7c] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40">
              {analyze.isPending ? <><Loader2 size={17} className="animate-spin" /> 正在分析與搜尋…</> : <><Search size={17} /> 開始找尋相關內容</>}
            </button>
            <p className="mt-4 text-center text-[11px] leading-5 text-white/30">圖片只用於本次分析，不會建立你的圖片歷史紀錄。</p>
          </section>

          <section className="min-w-0 rounded-[28px] border border-white/10 bg-[#171b1e]/75 p-5 sm:p-6">
            {!result ? (
              <div className="flex min-h-[560px] flex-col items-center justify-center px-6 text-center">
                <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-[26px] border border-white/10 bg-white/[0.035] text-white/20"><ImageIcon size={32} /></div>
                <h3 className="text-xl font-semibold text-white/75">你的研究結果會在這裡出現</h3>
                <p className="mt-3 max-w-sm text-sm leading-6 text-white/35">先上傳一張圖片。完成後，你會看到辨識摘要、搜尋詞，以及按來源整理的相關網頁。</p>
                <div className="mt-8 grid max-w-md grid-cols-3 gap-2 text-[11px] text-white/30"><span className="rounded-lg border border-white/8 px-3 py-2">辨識主體</span><span className="rounded-lg border border-white/8 px-3 py-2">找百科</span><span className="rounded-lg border border-white/8 px-3 py-2">複製連結</span></div>
              </div>
            ) : (
              <div>
                <div className="flex flex-col justify-between gap-4 border-b border-white/10 pb-5 sm:flex-row sm:items-start">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8bc7ac]">02 / research brief</p>
                    <h3 className="mt-2 text-2xl font-semibold tracking-tight">{result.analysis.subject}</h3>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-white/55">{result.analysis.summary}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2 rounded-full border border-[#8bc7ac]/20 bg-[#8bc7ac]/10 px-3 py-1.5 text-xs text-[#a9dbc2]">信心度：{confidenceLabels[result.analysis.confidence]}</div>
                </div>

                <div className="grid gap-5 py-5 sm:grid-cols-[1fr_1fr]">
                  <div>
                    <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-white/35">搜尋詞</p>
                    <div className="flex flex-wrap gap-2">{result.analysis.keywords.map(keyword => <span key={keyword} className="rounded-full bg-[#e2915d]/10 px-3 py-1.5 text-xs text-[#f2b48e]">{keyword}</span>)}</div>
                  </div>
                  <div>
                    <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-white/35">可見特徵</p>
                    <ul className="space-y-2 text-sm text-white/55">{result.analysis.visualFacts.map(fact => <li key={fact} className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#8bc7ac]" />{fact}</li>)}</ul>
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-white/10 pb-3 pt-5">
                  <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/35">03 / source list</p><p className="mt-1 text-sm text-white/45">找到 {result.links.length} 筆可延伸閱讀的來源</p></div>
                  <button onClick={copyAll} className="flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-white/70 transition hover:border-[#e2915d]/50 hover:text-[#f2b48e]"><Clipboard size={14} /> 全部複製</button>
                </div>

                <div className="space-y-2">
                  {result.links.map((link, index) => (
                    <article key={`${link.url}-${index}`} className="group flex gap-3 rounded-2xl border border-white/8 bg-[#111517]/70 p-4 transition hover:border-white/20 hover:bg-[#111517]">
                      <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${link.kind === "article" ? "bg-[#8bc7ac]/10 text-[#8bc7ac]" : link.kind === "image" ? "bg-[#e2915d]/10 text-[#e2915d]" : "bg-white/8 text-white/55"}`}>
                        {link.kind === "article" ? <Link2 size={17} /> : link.kind === "image" ? <ImageIcon size={17} /> : <Search size={17} />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2"><a href={link.url} target="_blank" rel="noreferrer" className="line-clamp-1 text-sm font-semibold text-white/85 underline-offset-4 hover:text-[#f2b48e] hover:underline">{link.title}</a><span className="rounded bg-white/6 px-1.5 py-0.5 text-[10px] text-white/35">{link.source}</span></div>
                        <p className="mt-1 line-clamp-2 text-xs leading-5 text-white/42">{link.snippet}</p>
                        <p className="mt-2 truncate text-[11px] text-[#8bc7ac]/70">{link.url}</p>
                      </div>
                      <button onClick={() => copyLink(link.url)} className="self-start rounded-lg p-2 text-white/30 opacity-60 transition hover:bg-white/10 hover:text-white group-hover:opacity-100" title="複製連結" aria-label="複製連結"><Check size={16} /></button>
                      <a href={link.url} target="_blank" rel="noreferrer" className="self-start rounded-lg p-2 text-white/30 opacity-60 transition hover:bg-white/10 hover:text-white group-hover:opacity-100" title="開啟連結" aria-label="開啟連結"><ArrowUpRight size={16} /></a>
                    </article>
                  ))}
                </div>
              </div>
            )}
          </section>
        </div>

        <footer className="mt-8 flex flex-col justify-between gap-3 border-t border-white/10 pt-5 text-xs text-white/30 sm:flex-row sm:items-center"><span>研究結果來自公開 API 與搜尋引擎連結，請自行判斷內容可信度。</span><span className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-[#8bc7ac]" /> ready for your next image</span></footer>
      </main>
    </div>
  );
}
