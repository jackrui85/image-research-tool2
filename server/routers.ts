import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { invokeLLM } from "./_core/llm";
import { publicProcedure, router } from "./_core/trpc";

type VisionAnalysis = {
  subject: string;
  summary: string;
  keywords: string[];
  visualFacts: string[];
  confidence: "high" | "medium" | "low";
};

type ResearchLink = {
  title: string;
  url: string;
  source: string;
  snippet: string;
  kind: "article" | "image" | "search";
};

const imageDataSchema = z
  .string()
  .min(100, "請先選擇一張圖片")
  .max(8_000_000, "圖片檔案過大，請選擇 6MB 以下的圖片");

function textFromContent(content: unknown) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map(part => (typeof part === "string" ? part : (part as { text?: string })?.text ?? ""))
      .join("\n");
  }
  return "";
}

function cleanSnippet(value: string | undefined) {
  return (value ?? "").replace(/<[^>]+>/g, "").replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
}

async function fetchJson(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7_000);
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "ImageResearchTool/1.0" },
      signal: controller.signal,
    });
    if (!response.ok) return null;
    return (await response.json()) as Record<string, any>;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function searchWikipedia(query: string, language: "zh" | "en"): Promise<ResearchLink[]> {
  const host = language === "zh" ? "zh.wikipedia.org" : "en.wikipedia.org";
  const params = new URLSearchParams({
    action: "query",
    generator: "search",
    gsrsearch: query,
    gsrnamespace: "0",
    gsrlimit: "3",
    prop: "extracts|info",
    exintro: "1",
    explaintext: "1",
    inprop: "url",
    format: "json",
    origin: "*",
  });
  const data = await fetchJson(`https://${host}/w/api.php?${params.toString()}`);
  const pages = Object.values((data?.query?.pages ?? {}) as Record<string, any>);
  return pages.map(page => ({
    title: page.title ?? query,
    url: page.fullurl ?? `https://${host}/wiki/${encodeURIComponent(String(page.title ?? query).replace(/ /g, "_"))}`,
    source: language === "zh" ? "維基百科・中文" : "Wikipedia・English",
    snippet: cleanSnippet(page.extract) || `與「${query}」相關的百科條目`,
    kind: "article" as const,
  }));
}

async function searchCommons(query: string): Promise<ResearchLink[]> {
  const params = new URLSearchParams({
    action: "query",
    generator: "search",
    gsrsearch: query,
    gsrnamespace: "6",
    gsrlimit: "3",
    prop: "info",
    inprop: "url",
    format: "json",
    origin: "*",
  });
  const data = await fetchJson(`https://commons.wikimedia.org/w/api.php?${params.toString()}`);
  const pages = Object.values((data?.query?.pages ?? {}) as Record<string, any>);
  return pages.map(page => ({
    title: page.title?.replace(/^File:/, "") ?? query,
    url: page.fullurl ?? `https://commons.wikimedia.org/wiki/${encodeURIComponent(String(page.title ?? query).replace(/ /g, "_"))}`,
    source: "Wikimedia Commons",
    snippet: `可用於進一步比對的相關圖片與媒體素材：${page.title?.replace(/^File:/, "") ?? query}`,
    kind: "image" as const,
  }));
}

function searchEngineLinks(query: string): ResearchLink[] {
  const encoded = encodeURIComponent(query);
  return [
    {
      title: `在 Google 搜尋「${query}」`,
      url: `https://www.google.com/search?q=${encoded}`,
      source: "Google Search",
      snippet: "開啟完整網頁搜尋結果，查看新聞、圖片、商業網站與其他來源。",
      kind: "search",
    },
    {
      title: `在 Bing 搜尋「${query}」`,
      url: `https://www.bing.com/search?q=${encoded}`,
      source: "Bing Search",
      snippet: "開啟另一組完整網頁搜尋結果，方便交叉比對。",
      kind: "search",
    },
  ];
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  imageResearch: router({
    analyze: publicProcedure
      .input(
        z.object({
          imageData: imageDataSchema,
          note: z.string().max(300).optional(),
        }),
      )
      .mutation(async ({ input }) => {
        const response = await invokeLLM({
          model: "gemini-3-flash-preview",
          messages: [
            {
              role: "system",
              content:
                "你是一個嚴謹的視覺研究助理。請只根據圖片中可見的內容，產生便於網路搜尋的描述與關鍵詞；不要猜測個人身分、敏感屬性或圖片中不可辨識的細節。請使用繁體中文輸出。",
            },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: `分析這張圖片，回傳可供網路查找的視覺線索。${input.note ? `使用者補充線索：${input.note}` : ""}`,
                },
                { type: "image_url", image_url: { url: input.imageData, detail: "auto" } },
              ],
            },
          ],
          maxTokens: 1000,
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "image_research_analysis",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  subject: { type: "string" },
                  summary: { type: "string" },
                  keywords: { type: "array", items: { type: "string" }, minItems: 3, maxItems: 8 },
                  visualFacts: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 6 },
                  confidence: { type: "string", enum: ["high", "medium", "low"] },
                },
                required: ["subject", "summary", "keywords", "visualFacts", "confidence"],
                additionalProperties: false,
              },
            },
          },
        });

        const raw = textFromContent(response.choices?.[0]?.message?.content);
        let analysis: VisionAnalysis;
        try {
          analysis = JSON.parse(raw) as VisionAnalysis;
        } catch {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "影像分析結果格式錯誤，請再試一次。" });
        }

        const keywords = Array.from(new Set([analysis.subject, ...analysis.keywords].map(value => value.trim()).filter(Boolean))).slice(0, 5);
        const batches = await Promise.all(
          keywords.map(async keyword => {
            const [zh, en, commons] = await Promise.all([
              searchWikipedia(keyword, "zh"),
              searchWikipedia(keyword, "en"),
              searchCommons(keyword),
            ]);
            return [...zh, ...en, ...commons];
          }),
        );

        const links = batches.flat();
        const seen = new Set<string>();
        const uniqueLinks = links.filter(link => {
          if (seen.has(link.url)) return false;
          seen.add(link.url);
          return true;
        });
        const queryLinks = keywords.slice(0, 3).flatMap(searchEngineLinks);

        return {
          analysis: { ...analysis, keywords },
          links: [...queryLinks, ...uniqueLinks].slice(0, 30),
          searchedAt: new Date().toISOString(),
        };
      }),
  }),
});

export type AppRouter = typeof appRouter;
