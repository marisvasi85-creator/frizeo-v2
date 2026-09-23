import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

process.env.NEXT_PUBLIC_SUPABASE_URL ??= "https://example.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";

const {
  PLATFORM_ASSISTANT_PROVIDER_BUSY_MESSAGE,
  isGeminiRetryableHttpStatus,
  redactPlatformAssistantSecrets,
  resolvePlatformAssistantFallbackModel,
  runPlatformAssistantChat,
  toPlatformAssistantClientErrorMessage,
} = await import("../lib/platform-assistant/runChat.ts");
const { PLATFORM_ASSISTANT_TOOLS } = await import(
  "../lib/platform-assistant/tools/index.ts"
);

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const API_KEY = "gemini-live-key-0123456789abcdef";
const OPENAI_KEY = "sk-test-openai-key-0123456789";
const PRIMARY = "gemini-3.1-flash-lite";
const DEFAULT_FALLBACK = "gemini-2.5-flash";
const messages = [{ role: "user", content: "Ce am de făcut azi?" }];
const ctx = {
  userId: "user-secret-id",
  email: "creator-secret@example.com",
};

const ENV_KEYS = [
  "OPENAI_API_KEY",
  "GEMINI_API_KEY",
  "GOOGLE_API_KEY",
  "PLATFORM_ASSISTANT_MODEL",
  "FRIZEO_ASSISTANT_MODEL",
  "MARKETING_AI_MODEL",
  "PLATFORM_ASSISTANT_FALLBACK_MODEL",
  "OPENAI_MODEL",
];

function applyEnv(values) {
  const previous = new Map(ENV_KEYS.map((key) => [key, process.env[key]]));
  for (const key of ENV_KEYS) {
    if (values[key] === undefined) delete process.env[key];
    else process.env[key] = values[key];
  }
  return () => {
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  };
}

function geminiEnv(extra = {}) {
  return applyEnv({
    OPENAI_API_KEY: undefined,
    GEMINI_API_KEY: API_KEY,
    GOOGLE_API_KEY: undefined,
    PLATFORM_ASSISTANT_MODEL: undefined,
    FRIZEO_ASSISTANT_MODEL: undefined,
    MARKETING_AI_MODEL: undefined,
    PLATFORM_ASSISTANT_FALLBACK_MODEL: undefined,
    OPENAI_MODEL: undefined,
    ...extra,
  });
}

function captureConsole() {
  const lines = [];
  const originalWarn = console.warn;
  const originalError = console.error;
  const push = (args) => {
    lines.push(args.map((part) => String(part)).join(" "));
  };
  console.warn = (...args) => push(args);
  console.error = (...args) => push(args);
  return {
    lines,
    restore() {
      console.warn = originalWarn;
      console.error = originalError;
    },
  };
}

function installFetch(handler) {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (input, init) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    calls.push({ url, init });
    return handler(url, init, calls.length);
  };
  return {
    calls,
    restore() {
      globalThis.fetch = original;
    },
  };
}

function modelFromUrl(url) {
  const match = String(url).match(/\/models\/([^:?]+):generateContent/);
  return match ? decodeURIComponent(match[1]) : null;
}

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function geminiText(payload) {
  return jsonResponse(200, {
    candidates: [
      { content: { parts: [{ text: JSON.stringify(payload) }] } },
    ],
  });
}

function geminiAnswer(content) {
  return geminiText({ type: "answer", content });
}

function geminiTools(calls) {
  return geminiText({ type: "tools", calls });
}

function geminiHttpError(status, message) {
  return jsonResponse(status, { error: { message } });
}

function queue(items) {
  const pending = [...items];
  return () => {
    const next = pending.shift();
    if (next === undefined) {
      throw new Error("unexpected extra provider call");
    }
    if (typeof next === "function") return next();
    return next;
  };
}

function stubTool(name, execute) {
  const tool = PLATFORM_ASSISTANT_TOOLS.find((item) => item.name === name);
  assert.ok(tool, name);
  const original = tool.execute;
  tool.execute = execute;
  return () => {
    tool.execute = original;
  };
}

async function exercise(handler, env = {}) {
  const restoreEnv = geminiEnv(env);
  const logs = captureConsole();
  const fetchMock = installFetch(handler);
  const delays = [];
  const originalTimeout = globalThis.setTimeout;
  globalThis.setTimeout = (handlerFn, timeout, ...args) => {
    if (timeout === 400 || timeout === 900) {
      delays.push(timeout);
      return originalTimeout(handlerFn, 0, ...args);
    }
    return originalTimeout(handlerFn, timeout, ...args);
  };

  try {
    try {
      const result = await runPlatformAssistantChat(messages, ctx);
      return {
        result,
        delays: [...delays],
        logs: [...logs.lines],
        calls: [...fetchMock.calls],
      };
    } catch (error) {
      return {
        error,
        delays: [...delays],
        logs: [...logs.lines],
        calls: [...fetchMock.calls],
      };
    }
  } finally {
    globalThis.setTimeout = originalTimeout;
    fetchMock.restore();
    logs.restore();
    restoreEnv();
  }
}

function modelsOf(run) {
  return run.calls.map((call) => modelFromUrl(call.url));
}

function assertNoSecrets(run) {
  const blob = [
    ...run.logs,
    run.error instanceof Error ? run.error.message : "",
    run.result?.reply ?? "",
  ].join("\n");
  assert.equal(blob.includes(API_KEY), false);
  assert.equal(blob.includes(OPENAI_KEY), false);
  assert.equal(blob.includes("creator-secret@example.com"), false);
  assert.equal(blob.includes("user-secret-id"), false);
  assert.equal(blob.includes("Ești Frizeo Platform Assistant"), false);
  assert.equal(
    blob.includes("This model is currently experiencing high demand"),
    false,
  );
}

test("platform assistant gemini resilience", { concurrency: 1 }, async (t) => {
  await t.test("confirmed fallback defaults and retryable statuses", () => {
    const restore = geminiEnv();
    try {
      assert.equal(resolvePlatformAssistantFallbackModel(PRIMARY), DEFAULT_FALLBACK);
      assert.equal(
        resolvePlatformAssistantFallbackModel(DEFAULT_FALLBACK),
        PRIMARY,
      );
      assert.equal(
        resolvePlatformAssistantFallbackModel("gemini-3.5-flash"),
        PRIMARY,
      );
      process.env.PLATFORM_ASSISTANT_FALLBACK_MODEL = "gemini-3.5-flash";
      assert.equal(
        resolvePlatformAssistantFallbackModel(PRIMARY),
        "gemini-3.5-flash",
      );
      process.env.PLATFORM_ASSISTANT_FALLBACK_MODEL = PRIMARY;
      assert.equal(resolvePlatformAssistantFallbackModel(PRIMARY), null);
      for (const status of [429, 500, 502, 503, 504]) {
        assert.equal(isGeminiRetryableHttpStatus(status), true);
      }
      for (const status of [400, 401, 403, 404]) {
        assert.equal(isGeminiRetryableHttpStatus(status), false);
      }
    } finally {
      restore();
    }
  });

  await t.test("Gemini success on the first attempt", async () => {
    const run = await exercise(queue([geminiAnswer("Totul e în regulă.")]));
    assert.equal(run.result.reply, "Totul e în regulă.");
    assert.deepEqual(run.result.toolsUsed, []);
    assert.equal(run.calls.length, 1);
    assert.deepEqual(modelsOf(run), [PRIMARY]);
    assert.deepEqual(run.delays, []);
    assert.equal(
      run.logs.some((line) => line.includes("Gemini retry")),
      false,
    );
    const body = JSON.parse(run.calls[0].init.body);
    assert.equal(body.generationConfig.temperature, 0.2);
    assert.equal(body.generationConfig.responseMimeType, "application/json");
    assert.match(body.contents[0].parts[0].text, /set_tenant_plan/);
    assert.match(body.contents[0].parts[0].text, /delete_tenant/);
    assertNoSecrets(run);
  });

  await t.test("503 retries once and then succeeds", async () => {
    const run = await exercise(
      queue([
        geminiHttpError(
          503,
          "This model is currently experiencing high demand. Spikes in demand are usually temporary.",
        ),
        geminiAnswer("Răspuns după retry."),
      ]),
    );
    assert.equal(run.result.reply, "Răspuns după retry.");
    assert.equal(run.calls.length, 2);
    assert.deepEqual(modelsOf(run), [PRIMARY, PRIMARY]);
    assert.deepEqual(run.delays, [400]);
    assert.equal(
      run.logs.some((line) =>
        line.includes(
          `platform-assistant Gemini retry: model=${PRIMARY} status=503 attempt=2`,
        ),
      ),
      true,
    );
    assertNoSecrets(run);
  });

  await t.test("429 retries once and then succeeds", async () => {
    const run = await exercise(
      queue([
        geminiHttpError(429, "Resource exhausted"),
        geminiAnswer("Răspuns după 429."),
      ]),
    );
    assert.equal(run.result.reply, "Răspuns după 429.");
    assert.equal(run.calls.length, 2);
    assert.deepEqual(run.delays, [400]);
    assert.equal(
      run.logs.some((line) =>
        line.includes(
          `platform-assistant Gemini retry: model=${PRIMARY} status=429 attempt=2`,
        ),
      ),
      true,
    );
    assertNoSecrets(run);
  });

  await t.test("repeated 503 falls back to the confirmed Gemini model", async () => {
    const run = await exercise(
      queue([
        geminiHttpError(503, "high demand"),
        geminiHttpError(503, "high demand"),
        geminiHttpError(503, "high demand"),
        geminiAnswer("Răspuns de pe fallback."),
      ]),
    );
    assert.equal(run.result.reply, "Răspuns de pe fallback.");
    assert.deepEqual(modelsOf(run), [
      PRIMARY,
      PRIMARY,
      PRIMARY,
      DEFAULT_FALLBACK,
    ]);
    assert.deepEqual(run.delays, [400, 900]);
    assert.equal(
      run.logs.some((line) =>
        line.includes(
          `platform-assistant Gemini fallback: primary=${PRIMARY} fallback=${DEFAULT_FALLBACK}`,
        ),
      ),
      true,
    );
    assertNoSecrets(run);
  });

  await t.test("500, 502 and 504 are retryable", async () => {
    for (const status of [500, 502, 504]) {
      const run = await exercise(
        queue([
          geminiHttpError(status, `temporary ${status}`),
          geminiAnswer(`ok ${status}`),
        ]),
      );
      assert.equal(run.result.reply, `ok ${status}`);
      assert.equal(run.calls.length, 2);
      assert.deepEqual(run.delays, [400]);
      assert.equal(
        run.logs.some((line) =>
          line.includes(
            `platform-assistant Gemini retry: model=${PRIMARY} status=${status} attempt=2`,
          ),
        ),
        true,
      );
      assertNoSecrets(run);
    }
  });

  await t.test("400 does not retry or fall back", async () => {
    const run = await exercise(
      queue([
        geminiHttpError(400, `bad request ${API_KEY}`),
        geminiAnswer("nu trebuie să ajungă aici"),
      ]),
      { PLATFORM_ASSISTANT_FALLBACK_MODEL: "gemini-3.5-flash" },
    );
    assert.ok(run.error instanceof Error);
    assert.notEqual(run.error.message, PLATFORM_ASSISTANT_PROVIDER_BUSY_MESSAGE);
    assert.equal(run.error.message.includes(API_KEY), false);
    assert.equal(run.calls.length, 1);
    assert.deepEqual(run.delays, []);
    assert.equal(run.logs.some((line) => line.includes("Gemini retry")), false);
    assert.equal(run.logs.some((line) => line.includes("Gemini fallback")), false);
    assertNoSecrets(run);
  });

  await t.test("401 and 403 do not retry or fall back", async () => {
    for (const status of [401, 403]) {
      const run = await exercise(
        queue([
          geminiHttpError(status, `denied ${API_KEY}`),
          geminiAnswer("nu trebuie să ajungă aici"),
        ]),
      );
      assert.ok(run.error instanceof Error);
      assert.notEqual(run.error.message, PLATFORM_ASSISTANT_PROVIDER_BUSY_MESSAGE);
      assert.equal(run.error.message.includes(API_KEY), false);
      assert.equal(run.calls.length, 1);
      assert.deepEqual(run.delays, []);
      assert.equal(run.logs.some((line) => line.includes("Gemini fallback")), false);
      assertNoSecrets(run);
    }
  });

  await t.test("primary and fallback unavailable return a controlled Romanian error", async () => {
    const demand = `This model is currently experiencing high demand. ${API_KEY}`;
    const run = await exercise(
      queue([
        geminiHttpError(503, demand),
        geminiHttpError(503, demand),
        geminiHttpError(503, demand),
        geminiHttpError(503, demand),
      ]),
    );
    assert.ok(run.error instanceof Error);
    assert.equal(run.error.message, PLATFORM_ASSISTANT_PROVIDER_BUSY_MESSAGE);
    assert.equal(run.calls.length, 4);
    assert.deepEqual(modelsOf(run), [
      PRIMARY,
      PRIMARY,
      PRIMARY,
      DEFAULT_FALLBACK,
    ]);
    assert.equal(
      run.logs.some((line) =>
        line.includes(
          `platform-assistant Gemini unavailable: model=${DEFAULT_FALLBACK} status=503 attempt=1`,
        ),
      ),
      true,
    );
    assert.equal(
      toPlatformAssistantClientErrorMessage(run.error),
      PLATFORM_ASSISTANT_PROVIDER_BUSY_MESSAGE,
    );
    assertNoSecrets(run);
  });

  await t.test("API key never appears in logs or the client error", async () => {
    const denied = await exercise(
      queue([geminiHttpError(401, `API key invalid: ${API_KEY}`)]),
    );
    assert.equal(denied.error.message.includes(API_KEY), false);
    assertNoSecrets(denied);

    let attempts = 0;
    const network = await exercise(() => {
      attempts += 1;
      if (attempts === 1) {
        throw new TypeError(
          `fetch failed https://generativelanguage.googleapis.com/v1beta/models/${PRIMARY}:generateContent?key=${API_KEY}`,
        );
      }
      return geminiAnswer("după eroare de rețea");
    });
    assert.equal(network.result.reply, "după eroare de rețea");
    assert.equal(
      network.logs.some((line) =>
        line.includes(
          `platform-assistant Gemini retry: model=${PRIMARY} status=network attempt=2`,
        ),
      ),
      true,
    );
    assertNoSecrets(network);

    const redacted = redactPlatformAssistantSecrets(
      `cheie ${API_KEY} în mesaj`,
      API_KEY,
    );
    assert.equal(redacted.includes(API_KEY), false);
    const restore = geminiEnv();
    try {
      assert.equal(
        toPlatformAssistantClientErrorMessage(new Error(`leak ${API_KEY}`)).includes(
          API_KEY,
        ),
        false,
      );
    } finally {
      restore();
    }
  });

  await t.test("tool execution still runs after a retry", async () => {
    let calls = 0;
    const restoreTool = stubTool("platform_overview", async () => {
      calls += 1;
      return {
        ok: true,
        summary: "SUMAR-UNIC-9f3a",
        data: { tenants: 4 },
      };
    });
    try {
      const run = await exercise(
        queue([
          geminiHttpError(503, "high demand"),
          geminiTools([{ name: "platform_overview", arguments: {} }]),
          geminiAnswer("Sunt 4 saloane."),
        ]),
      );
      assert.equal(run.result.reply, "Sunt 4 saloane.");
      assert.deepEqual(run.result.toolsUsed, ["platform_overview"]);
      assert.equal(calls, 1);
      assert.equal(run.calls.length, 3);
      assert.equal(
        run.logs.some((line) => line.includes("SUMAR-UNIC-9f3a")),
        false,
      );
      assertNoSecrets(run);
    } finally {
      restoreTool();
    }
  });

  await t.test("tool execution still runs after fallback", async () => {
    let calls = 0;
    const restoreTool = stubTool("daily_briefing", async (args) => {
      calls += 1;
      assert.equal(args.trial_days, 7);
      return {
        ok: true,
        summary: "BRIEFING-UNIC-9f3a",
        data: { actions: 2 },
      };
    });
    try {
      const run = await exercise(
        queue([
          geminiHttpError(503, "high demand"),
          geminiHttpError(503, "high demand"),
          geminiHttpError(503, "high demand"),
          geminiTools([
            { name: "daily_briefing", arguments: { trial_days: 7 } },
          ]),
          geminiAnswer("Briefing gata."),
        ]),
      );
      assert.equal(run.result.reply, "Briefing gata.");
      assert.deepEqual(run.result.toolsUsed, ["daily_briefing"]);
      assert.equal(calls, 1);
      assert.equal(modelsOf(run)[3], DEFAULT_FALLBACK);
      assert.equal(
        run.logs.some((line) => line.includes("BRIEFING-UNIC-9f3a")),
        false,
      );
      assertNoSecrets(run);
    } finally {
      restoreTool();
    }
  });

  await t.test("confirmed writes still short-circuit after a retry", async () => {
    for (const name of [
      "set_tenant_plan",
      "extend_trial",
      "add_tenant_note",
      "send_trial_followup",
      "delete_tenant",
    ]) {
      let calls = 0;
      const restoreTool = stubTool(name, async () => {
        calls += 1;
        return {
          ok: true,
          summary: `Scris ${name}`,
          data: { confirmed: true },
        };
      });
      try {
        const run = await exercise(
          queue([
            geminiHttpError(503, "high demand"),
            geminiTools([{ name, arguments: { confirmed: true } }]),
            geminiAnswer("nu trebuie apelat"),
          ]),
        );
        assert.equal(run.result.reply, `Scris ${name}`);
        assert.deepEqual(run.result.toolsUsed, [name]);
        assert.equal(calls, 1);
        assert.equal(run.calls.length, 2);
        assertNoSecrets(run);
      } finally {
        restoreTool();
      }
    }
  });

  await t.test("needs_confirmation still asks for confirmation and does not write early", async () => {
    let calls = 0;
    const restoreTool = stubTool("set_tenant_plan", async (args) => {
      calls += 1;
      assert.equal(args.confirmed, false);
      return {
        ok: true,
        summary: "Confirmare necesară: plan Pro.",
        data: {
          needs_confirmation: true,
          proposal: { warning: "Stripe rămâne" },
        },
      };
    });
    try {
      const answered = await exercise(
        queue([
          geminiTools([
            {
              name: "set_tenant_plan",
              arguments: { confirmed: false, plan: "pro" },
            },
          ]),
          geminiAnswer("Iată propunerea."),
        ]),
      );
      assert.equal(answered.result.reply, "Iată propunerea.");
      assert.equal(calls, 1);
      assert.equal(answered.calls.length, 2);

      const executedBeforeExhausted = calls;
      const exhausted = await exercise(
        queue([
          geminiTools([{ name: "set_tenant_plan", arguments: { confirmed: false } }]),
          geminiTools([{ name: "set_tenant_plan", arguments: { confirmed: false } }]),
          geminiTools([{ name: "set_tenant_plan", arguments: { confirmed: false } }]),
          geminiTools([{ name: "set_tenant_plan", arguments: { confirmed: false } }]),
          geminiTools([{ name: "set_tenant_plan", arguments: { confirmed: false } }]),
        ]),
      );
      assert.match(exhausted.result.reply, /Confirmare necesară: plan Pro\./);
      assert.match(exhausted.result.reply, /Stripe rămâne/);
      assert.match(exhausted.result.reply, /Confirmi\?/);
      assert.equal(calls - executedBeforeExhausted, 4);
      assert.equal(exhausted.calls.length, 5);
      assertNoSecrets(exhausted);
    } finally {
      restoreTool();
    }
  });

  await t.test("internal tool errors are not reported as provider busy", async () => {
    const restoreTool = stubTool("set_tenant_plan", async () => {
      throw new Error("TypeError: plan_id intern");
    });
    try {
      const run = await exercise(
        queue([
          geminiTools([{ name: "set_tenant_plan", arguments: { confirmed: true } }]),
        ]),
      );
      assert.ok(run.error instanceof Error);
      assert.equal(run.error.message, "TypeError: plan_id intern");
      assert.notEqual(run.error.message, PLATFORM_ASSISTANT_PROVIDER_BUSY_MESSAGE);
      assert.equal(run.calls.length, 1);
    } finally {
      restoreTool();
    }
  });

  await t.test("configured fallback model is used, and the same model is not", async () => {
    const custom = await exercise(
      queue([
        geminiHttpError(503, "high demand"),
        geminiHttpError(503, "high demand"),
        geminiHttpError(503, "high demand"),
        geminiAnswer("fallback configurat"),
      ]),
      { PLATFORM_ASSISTANT_FALLBACK_MODEL: "gemini-3.5-flash" },
    );
    assert.equal(custom.result.reply, "fallback configurat");
    assert.equal(modelsOf(custom)[3], "gemini-3.5-flash");

    const same = await exercise(
      queue([
        geminiHttpError(503, "high demand"),
        geminiHttpError(503, "high demand"),
        geminiHttpError(503, "high demand"),
        geminiAnswer("nu trebuie"),
      ]),
      { PLATFORM_ASSISTANT_FALLBACK_MODEL: PRIMARY },
    );
    assert.equal(same.error.message, PLATFORM_ASSISTANT_PROVIDER_BUSY_MESSAGE);
    assert.equal(same.calls.length, 3);
    assert.equal(same.logs.some((line) => line.includes("Gemini fallback")), false);
  });

  await t.test("GOOGLE_API_KEY still selects Gemini", async () => {
    const run = await exercise(queue([geminiAnswer("din google key")]), {
      GEMINI_API_KEY: undefined,
      GOOGLE_API_KEY: API_KEY,
    });
    assert.equal(run.result.reply, "din google key");
    assert.equal(run.calls.length, 1);
    assert.equal(String(run.calls[0].url).includes(API_KEY), true);
  });

  await t.test("OpenAI path stays preferred and can still execute tools", async () => {
    let toolCalls = 0;
    const restoreTool = stubTool("platform_overview", async () => {
      toolCalls += 1;
      return { ok: true, summary: "overview", data: { tenants: 1 } };
    });
    const restoreEnv = applyEnv({
      OPENAI_API_KEY: OPENAI_KEY,
      GEMINI_API_KEY: API_KEY,
      GOOGLE_API_KEY: undefined,
      PLATFORM_ASSISTANT_MODEL: undefined,
      FRIZEO_ASSISTANT_MODEL: undefined,
      MARKETING_AI_MODEL: undefined,
      PLATFORM_ASSISTANT_FALLBACK_MODEL: undefined,
      OPENAI_MODEL: undefined,
    });
    const logs = captureConsole();
    let step = 0;
    const fetchMock = installFetch((url) => {
      assert.equal(url.includes("generativelanguage.googleapis.com"), false);
      assert.equal(url.includes(API_KEY), false);
      step += 1;
      if (step === 1) {
        return jsonResponse(200, {
          id: "chatcmpl-test",
          object: "chat.completion",
          created: 1,
          model: "gpt-4o-mini",
          choices: [
            {
              index: 0,
              finish_reason: "tool_calls",
              message: {
                role: "assistant",
                content: null,
                tool_calls: [
                  {
                    id: "call_test",
                    type: "function",
                    function: {
                      name: "platform_overview",
                      arguments: "{}",
                    },
                  },
                ],
              },
            },
          ],
        });
      }
      return jsonResponse(200, {
        id: "chatcmpl-test-2",
        object: "chat.completion",
        created: 1,
        model: "gpt-4o-mini",
        choices: [
          {
            index: 0,
            finish_reason: "stop",
            message: {
              role: "assistant",
              content: "Răspuns OpenAI neschimbat.",
            },
          },
        ],
      });
    });
    try {
      const result = await runPlatformAssistantChat(messages, ctx);
      assert.equal(result.reply, "Răspuns OpenAI neschimbat.");
      assert.deepEqual(result.toolsUsed, ["platform_overview"]);
      assert.equal(toolCalls, 1);
      assert.equal(step, 2);
      const firstBody = JSON.parse(fetchMock.calls[0].init.body);
      assert.equal(firstBody.model, "gpt-4o-mini");
      assert.equal(firstBody.temperature, 0.2);
      assert.equal(Array.isArray(firstBody.tools), true);
      assert.equal(
        firstBody.tools.some((tool) => tool.function?.name === "set_tenant_plan"),
        true,
      );
      const blob = logs.lines.join("\n");
      assert.equal(blob.includes(OPENAI_KEY), false);
      assert.equal(blob.includes(API_KEY), false);
    } finally {
      fetchMock.restore();
      logs.restore();
      restoreEnv();
      restoreTool();
    }
  });

  await t.test("chat route returns the sanitized message", () => {
    const source = readFileSync(
      join(root, "app/api/platform-assistant/chat/route.ts"),
      "utf8",
    );
    assert.match(source, /toPlatformAssistantClientErrorMessage/);
    assert.match(source, /redactPlatformAssistantSecrets/);
    assert.doesNotMatch(source, /error\.message/);
    assert.equal(
      toPlatformAssistantClientErrorMessage(
        new Error(PLATFORM_ASSISTANT_PROVIDER_BUSY_MESSAGE),
      ),
      PLATFORM_ASSISTANT_PROVIDER_BUSY_MESSAGE,
    );
    assert.equal(
      toPlatformAssistantClientErrorMessage(
        new Error("TypeError: plan_id intern"),
      ),
      "TypeError: plan_id intern",
    );
  });
});
