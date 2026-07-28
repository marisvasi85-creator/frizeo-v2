const NOTION_API = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

export function getNotionToken(): string | null {
  return process.env.NOTION_TOKEN?.trim() || null;
}

export function getSmsUsageDatabaseId(): string | null {
  return process.env.NOTION_SMS_USAGE_DATABASE_ID?.trim() || null;
}

export function getSaloaneDatabaseId(): string | null {
  return process.env.NOTION_SALOANE_DATABASE_ID?.trim() || null;
}

type NotionRequestInit = {
  method?: string;
  body?: unknown;
};

export async function notionRequest<T = unknown>(
  path: string,
  init: NotionRequestInit = {},
): Promise<T> {
  const token = getNotionToken();
  if (!token) {
    throw new Error("NOTION_TOKEN is not configured");
  }

  const res = await fetch(`${NOTION_API}${path}`, {
    method: init.method || "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });

  const json = (await res.json()) as T & {
    message?: string;
    code?: string;
  };

  if (!res.ok) {
    throw new Error(
      `Notion API ${res.status}: ${json.message || res.statusText}`,
    );
  }

  return json;
}

export function richText(content: string) {
  return [{ type: "text" as const, text: { content: content.slice(0, 2000) } }];
}

export function titleProp(content: string) {
  return { title: richText(content) };
}

export function richTextProp(content: string | null | undefined) {
  if (!content) return { rich_text: [] };
  return { rich_text: richText(content) };
}

export function numberProp(value: number | null | undefined) {
  return { number: value ?? null };
}

export function selectProp(name: string | null | undefined) {
  if (!name) return { select: null };
  return { select: { name } };
}

export function dateProp(start: string | null | undefined) {
  if (!start) return { date: null };
  return { date: { start: start.slice(0, 10) } };
}

export function emailProp(email: string | null | undefined) {
  return { email: email || null };
}

export function phoneProp(phone: string | null | undefined) {
  return { phone_number: phone || null };
}

type NotionPage = {
  id: string;
  properties?: Record<string, unknown>;
};

type NotionQueryResponse = {
  results: NotionPage[];
  has_more: boolean;
  next_cursor: string | null;
};

export async function findPageByRichTextEquals(params: {
  databaseId: string;
  property: string;
  value: string;
}): Promise<NotionPage | null> {
  const data = await notionRequest<NotionQueryResponse>(
    `/databases/${params.databaseId}/query`,
    {
      method: "POST",
      body: {
        page_size: 1,
        filter: {
          property: params.property,
          rich_text: { equals: params.value },
        },
      },
    },
  );

  return data.results[0] ?? null;
}

export async function findPageByTitleEquals(params: {
  databaseId: string;
  property?: string;
  value: string;
}): Promise<NotionPage | null> {
  const data = await notionRequest<NotionQueryResponse>(
    `/databases/${params.databaseId}/query`,
    {
      method: "POST",
      body: {
        page_size: 1,
        filter: {
          property: params.property || "Name",
          title: { equals: params.value },
        },
      },
    },
  );

  return data.results[0] ?? null;
}

export async function createPage(params: {
  databaseId: string;
  properties: Record<string, unknown>;
}): Promise<NotionPage> {
  return notionRequest<NotionPage>("/pages", {
    method: "POST",
    body: {
      parent: { database_id: params.databaseId },
      properties: params.properties,
    },
  });
}

export async function updatePage(params: {
  pageId: string;
  properties: Record<string, unknown>;
}): Promise<NotionPage> {
  return notionRequest<NotionPage>(`/pages/${params.pageId}`, {
    method: "PATCH",
    body: { properties: params.properties },
  });
}
