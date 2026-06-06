import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export type EnvMap = Record<string, string | undefined>;

export interface RuntimeContextOptions {
  skillDir: string;
  defaultHost: string;
  hostEnvName: string;
  tokenEnvName: string;
  fallbackTokenEnvName?: string;
  env?: EnvMap;
}

export interface RuntimeContext {
  host: string;
  token?: string;
}

export function parseDotEnv(text: string): Record<string, string> {
  const parsed: Record<string, string> = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }
    const equalsIndex = line.indexOf("=");
    if (equalsIndex < 0) {
      continue;
    }
    const key = line.slice(0, equalsIndex).trim();
    const value = line.slice(equalsIndex + 1).trim();
    if (key) {
      parsed[key] = value;
    }
  }
  return parsed;
}

function loadSkillEnv(skillDir: string): Record<string, string> {
  const envPath = path.join(skillDir, ".env");
  if (!existsSync(envPath)) {
    return {};
  }
  return parseDotEnv(readFileSync(envPath, "utf8"));
}

function cleanHost(host: string): string {
  return host.replace(/\/+$/, "");
}

export function loadRuntimeContext(options: RuntimeContextOptions): RuntimeContext {
  const env = options.env ?? process.env;
  const skillEnv = loadSkillEnv(options.skillDir);
  const fallbackTokenEnvName = options.fallbackTokenEnvName ?? "AUTODL_TOKEN";

  const host =
    env[options.hostEnvName] ??
    skillEnv[options.hostEnvName] ??
    options.defaultHost;

  const token =
    env[options.tokenEnvName] ??
    env[fallbackTokenEnvName] ??
    skillEnv[options.tokenEnvName] ??
    skillEnv[fallbackTokenEnvName];

  return {
    host: cleanHost(host),
    ...(token ? { token } : {}),
  };
}
