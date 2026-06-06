import path from "node:path";
import { fileURLToPath } from "node:url";
import { ApiError } from "../core/errors.mjs";
import { getFlagValue, getNumberFlag, hasFlag, printErrorAndExit, printJson, readJsonFile, requireValue } from "../core/cli.mjs";
import { loadRuntimeContext as loadCoreRuntimeContext, type EnvMap, type RuntimeContext } from "../core/token.mjs";
import {
  createInstance,
  getSnapshot,
  getStatus,
  listImages,
  listInstances,
  powerOff,
  powerOn,
  releaseInstance,
  saveImage,
} from "./api.mjs";

export function loadRuntimeContext(options: { skillDir?: string; env?: EnvMap } = {}): RuntimeContext {
  return loadCoreRuntimeContext({
    skillDir: options.skillDir ?? defaultSkillDir(),
    defaultHost: "https://api.autodl.com",
    hostEnvName: "AUTODL_PRO_HOST",
    tokenEnvName: "AUTODL_PRO_TOKEN",
    env: options.env ?? process.env,
  });
}

function defaultSkillDir(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../skills/autodl-instance-pro");
}

const HELP = `AutoDL instance Pro CLI

Usage:
  node autodl-pro.mjs create --json <config.json>
  node autodl-pro.mjs snapshot <instance_uuid>
  node autodl-pro.mjs status <instance_uuid>
  node autodl-pro.mjs list [--page-index 1] [--page-size 10]
  node autodl-pro.mjs power-on <instance_uuid> [--start-command "..."]
  node autodl-pro.mjs power-off <instance_uuid>
  node autodl-pro.mjs release <instance_uuid>
  node autodl-pro.mjs save-image <instance_uuid> --name <image_name>
  node autodl-pro.mjs list-images [--page-index 1] [--page-size 10]
`;

export async function main(argv = process.argv.slice(2), io = process): Promise<number> {
  try {
    if (argv.length === 0 || hasFlag(argv, "--help") || hasFlag(argv, "-h")) {
      io.stdout.write(HELP);
      return 0;
    }
    const command = argv[0];
    const context = loadRuntimeContext();
    if (!context.token) {
      throw new ApiError("token_missing", ".env 中未找到 AUTODL_PRO_TOKEN 或 AUTODL_TOKEN", {}, 1);
    }
    const apiContext = { host: context.host, token: context.token };

    switch (command) {
      case "create": {
        const configPath = requireValue(getFlagValue(argv, "--json"), "--json");
        printJson(await createInstance(apiContext, await readJsonFile(configPath) as Record<string, unknown>), io);
        return 0;
      }
      case "snapshot":
        printJson(await getSnapshot(apiContext, requireValue(argv[1], "instance_uuid")), io);
        return 0;
      case "status":
        printJson(await getStatus(apiContext, requireValue(argv[1], "instance_uuid")), io);
        return 0;
      case "list":
        printJson(await listInstances(apiContext, getNumberFlag(argv, "--page-index", 1), getNumberFlag(argv, "--page-size", 10)), io);
        return 0;
      case "power-on":
        printJson(await powerOn(apiContext, requireValue(argv[1], "instance_uuid"), getFlagValue(argv, "--start-command")), io);
        return 0;
      case "power-off":
        printJson(await powerOff(apiContext, requireValue(argv[1], "instance_uuid")), io);
        return 0;
      case "release":
        printJson(await releaseInstance(apiContext, requireValue(argv[1], "instance_uuid")), io);
        return 0;
      case "save-image":
        printJson(await saveImage(apiContext, requireValue(argv[1], "instance_uuid"), requireValue(getFlagValue(argv, "--name"), "--name")), io);
        return 0;
      case "list-images":
        printJson(await listImages(apiContext, getNumberFlag(argv, "--page-index", 1), getNumberFlag(argv, "--page-size", 10)), io);
        return 0;
      default:
        throw new ApiError("config_error", `Unknown command: ${String(command)}`, {}, 1);
    }
  } catch (error) {
    return printErrorAndExit(error, io);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  process.exitCode = await main();
}
