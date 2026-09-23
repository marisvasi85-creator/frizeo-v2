import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function fileExists(url) {
  try {
    return fs.existsSync(fileURLToPath(url));
  } catch {
    return false;
  }
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    const base = pathToFileURL(path.join(ROOT, specifier.slice(2))).href;
    const withTs = base.endsWith(".ts") ? base : `${base}.ts`;
    if (fileExists(withTs)) {
      return { url: withTs, shortCircuit: true };
    }
  }

  const parent = context.parentURL || "";
  if (
    parent.endsWith(".ts") &&
    specifier.startsWith(".") &&
    !path.extname(specifier.split("?")[0])
  ) {
    const withTs = new URL(`${specifier}.ts`, parent).href;
    if (fileExists(withTs)) {
      return { url: withTs, shortCircuit: true };
    }
    const indexTs = new URL(`${specifier}/index.ts`, parent).href;
    if (fileExists(indexTs)) {
      return { url: indexTs, shortCircuit: true };
    }
  }

  try {
    return await nextResolve(specifier, context);
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ERR_MODULE_NOT_FOUND" &&
      !specifier.startsWith(".") &&
      !specifier.startsWith("/") &&
      !specifier.startsWith("node:") &&
      !specifier.endsWith(".js")
    ) {
      return nextResolve(`${specifier}.js`, context);
    }
    throw error;
  }
}
