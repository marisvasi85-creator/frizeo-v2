import { ASSISTANT_KNOWLEDGE_ARTICLES } from "../knowledge/articles";
import type { AssistantToolContext, AssistantToolResult } from "../types";
import { asString } from "./helpers";

function fold(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

const SYNONYMS: Record<string, string[]> = {
  sms: ["sms", "reminder", "notificari", "notificare"],
  google: ["google", "calendar", "gmail", "sync"],
  programari: ["programari", "booking", "calendar", "client"],
  servicii: ["servicii", "pret", "durata", "tuns"],
  program: ["program", "orar", "luni", "sambata", "pauza", "selectiv"],
  frizeri: ["frizeri", "invitatie", "echipa", "locuri"],
  link: ["link", "pagina", "public", "instagram", "bio"],
  acces: ["acces", "aprobare", "blocare"],
  rapoarte: ["rapoarte", "statistici", "ocupare"],
  marketing: ["marketing", "postari", "instagram", "reel"],
  abonament: ["abonament", "billing", "trial", "plan", "pro", "pret"],
  assistant: ["assistant", "chat", "ajutor"],
  salon: ["salon", "logo", "adresa", "galerie"],
  profil: ["profil", "avatar", "tema"],
};

function tokens(query: string): string[] {
  return fold(query)
    .split(/[^a-z0-9+]+/)
    .filter((t) => t.length > 1);
}

function scoreArticle(
  article: (typeof ASSISTANT_KNOWLEDGE_ARTICLES)[number],
  queryTokens: string[],
): number {
  const hayTitle = fold(article.title);
  const hayTags = fold(article.tags.join(" "));
  const hayBody = fold(article.body);
  const hayPath = fold(article.admin_path);
  let score = 0;

  for (const token of queryTokens) {
    if (hayTitle.includes(token)) score += 6;
    if (hayTags.includes(token)) score += 4;
    if (hayPath.includes(token)) score += 3;
    if (hayBody.includes(token)) score += 1;
    for (const group of Object.values(SYNONYMS)) {
      if (group.includes(token) && group.some((g) => hayTags.includes(g))) {
        score += 2;
      }
    }
  }

  return score;
}

export async function productHelpTool(
  args: Record<string, unknown>,
  _ctx: AssistantToolContext,
): Promise<AssistantToolResult> {
  const query =
    asString(args.query) ||
    asString(args.question) ||
    asString(args.topic) ||
    "";

  const catalog = ASSISTANT_KNOWLEDGE_ARTICLES.map((a) => ({
    id: a.id,
    title: a.title,
    admin_path: a.admin_path,
  }));

  if (!query) {
    return {
      ok: true,
      summary:
        "Knowledge base: alege un subiect (SMS, Google Calendar, programări, servicii, program, frizeri, link, acces clienți, rapoarte, Marketing AI, abonament, Assistant, salon, profil).",
      data: { catalog },
    };
  }

  const queryTokens = tokens(query);
  const ranked = ASSISTANT_KNOWLEDGE_ARTICLES.map((article) => ({
    article,
    score: scoreArticle(article, queryTokens),
  }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);

  if (ranked.length === 0) {
    return {
      ok: true,
      summary:
        "Nu am găsit un articol exact. Folosește catalogul și reia product_help cu un topic mai precis. Pentru statusul planului salonului, folosește subscription_status.",
      data: { catalog, query },
    };
  }

  const articles = ranked.map(({ article, score }) => ({
    id: article.id,
    title: article.title,
    admin_path: article.admin_path,
    body: article.body,
    score,
  }));

  return {
    ok: true,
    summary: `Am găsit: ${articles.map((a) => a.title).join("; ")}. Răspunde din aceste articole; trimite utilizatorul la admin_path. Nu inventa funcții care nu sunt aici.`,
    data: { query, articles },
  };
}
