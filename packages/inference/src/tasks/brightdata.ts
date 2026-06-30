import type { CodeTask } from "@shiptopod/core";
import { CodeTaskSchema } from "@shiptopod/core";

export interface BrightDataConfig {
  apiKey: string;
  maxTasks?: number;
  languages?: Array<"python" | "sql">;
}

export async function fetchBrightDataTasks(
  config?: Partial<BrightDataConfig>,
): Promise<CodeTask[]> {
  const apiKey = config?.apiKey ?? process.env.BRIGHTDATA_API_KEY;
  if (!apiKey) return [];

  try {
    const raw = await scrapeCodingTasks(apiKey, config);
    return parseCodeTasks(raw);
  } catch {
    return [];
  }
}

async function scrapeCodingTasks(
  apiKey: string,
  config?: Partial<BrightDataConfig>,
): Promise<unknown[]> {
  const maxTasks = config?.maxTasks ?? 20;
  const languages = config?.languages ?? ["python", "sql"];

  const urls = languages.flatMap((lang) => [
    "https://leetcode.com/problemset/all/?search=" + lang,
    "https://stackoverflow.com/questions/tagged/" + lang + "?sort=votes",
  ]);

  const tasks: unknown[] = [];
  for (const url of urls.slice(0, 3)) {
    if (tasks.length >= maxTasks) break;
    try {
      const html = await fetchPage(apiKey, url);
      tasks.push(...extractTasks(html, languages));
    } catch {
      /* skip failed URL */
    }
  }
  return tasks.slice(0, maxTasks);
}

async function fetchPage(apiKey: string, url: string): Promise<string> {
  const zone = process.env.BRIGHTDATA_ZONE || "unlocker";
  const res = await fetch("https://api.brightdata.com/request", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + apiKey,
    },
    body: JSON.stringify({ zone: zone, url: url, format: "raw" }),
    signal: AbortSignal.timeout(45_000),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      "Bright Data returned " + res.status + ": " + text.slice(0, 200),
    );
  }
  return res.text();
}

function extractTasks(
  html: string,
  languages: string[],
): Array<{ prompt: string; language: string; hidden_tests: string }> {
  const tasks: Array<{
    prompt: string;
    language: string;
    hidden_tests: string;
  }> = [];

  const descMatches = html.match(
    /data-track-load="description_content"[^>]*>([\s\S]*?)<\/div>/gi,
  );
  for (const match of descMatches ?? []) {
    const text = match
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (text.length < 50) continue;

    const isSql =
      /sql|select |table|query/i.test(text) &&
      !/python|def |class /i.test(text);
    const lang = isSql ? "sql" : "python";
    if (!languages.includes(lang)) continue;

    tasks.push({
      prompt: text.slice(0, 500),
      language: lang,
      hidden_tests: "# Verify with test runner",
    });
  }

  const qaMatches = html.match(
    /<a[^>]*class="[^"]*question-hyperlink[^"]*"[^>]*>([^<]+)<\/a>/gi,
  );
  for (const qaMatch of qaMatches ?? []) {
    const title = qaMatch.replace(/<[^>]*>/g, "").trim();
    if (title.length < 10) continue;

    const lang = /sql/i.test(title) ? "sql" : "python";
    if (!languages.includes(lang)) continue;

    tasks.push({
      prompt: "Fix: " + title,
      language: lang,
      hidden_tests: "# Tests from accepted answer",
    });
  }

  return tasks;
}

function parseCodeTasks(raw: unknown[]): CodeTask[] {
  const tasks: CodeTask[] = [];
  for (let i = 0; i < raw.length; i++) {
    const item = raw[i] as Record<string, unknown> | null;
    if (
      !item ||
      typeof item.prompt !== "string" ||
      typeof item.language !== "string"
    )
      continue;

    const candidate = {
      id: "brightdata-" + i,
      prompt: item.prompt,
      language: item.language,
      hidden_tests:
        typeof item.hidden_tests === "string" ? item.hidden_tests : "",
      source: "brightdata",
    };
    const parsed = CodeTaskSchema.safeParse(candidate);
    if (parsed.success) tasks.push(parsed.data);
  }
  return tasks;
}
