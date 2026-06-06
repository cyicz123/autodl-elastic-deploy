import path from "node:path";
import { fileURLToPath } from "node:url";
import { ApiError } from "../core/errors.mjs";
import { getFlagValue, getNumberFlag, hasFlag, printErrorAndExit, printJson, readJsonFile, requireValue } from "../core/cli.mjs";
import { loadRuntimeContext as loadCoreRuntimeContext, type EnvMap, type RuntimeContext } from "../core/token.mjs";
import {
  addBlacklist,
  deleteDeployment,
  fetchAllImages,
  fetchGpuStock,
  listContainers,
  listDeployments,
  listEvents,
  listBlacklists,
  setReplicas,
  stopContainer,
  stopDeployment,
} from "./api.mjs";
import { queueSubmit } from "./queue.mjs";

export function loadRuntimeContext(options: { skillDir?: string; env?: EnvMap } = {}): RuntimeContext {
  return loadCoreRuntimeContext({
    skillDir: options.skillDir ?? defaultSkillDir(),
    defaultHost: "https://private.autodl.com",
    hostEnvName: "AUTODL_ELASTIC_HOST",
    tokenEnvName: "AUTODL_ELASTIC_TOKEN",
    env: options.env ?? process.env,
  });
}

function defaultSkillDir(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../skills/autodl-elastic-deploy");
}

const HELP = `AutoDL elastic deployment CLI

Usage:
  node autodl-elastic.mjs queue-submit <config.json> [--interval 30] [--timeout 0]
  node autodl-elastic.mjs images [--page-index 1] [--page-size 100]
  node autodl-elastic.mjs deployments [--page-index 1] [--page-size 10]
  node autodl-elastic.mjs containers --deployment-uuid <uuid> [--page-index 1] [--page-size 10]
  node autodl-elastic.mjs events --deployment-uuid <uuid> [--offset N]
  node autodl-elastic.mjs stop-container <container_uuid> [--decrease-one-replica-num] [--no-cache]
  node autodl-elastic.mjs set-replicas <deployment_uuid> <replica_num>
  node autodl-elastic.mjs stop-deployment <deployment_uuid>
  node autodl-elastic.mjs delete-deployment <deployment_uuid>
  node autodl-elastic.mjs blacklist <container_uuid> [--comment "..."]
  node autodl-elastic.mjs list-blacklist
  node autodl-elastic.mjs gpu-stock --region <region_sign> [--json <filters.json>]
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
      throw new ApiError("token_missing", ".env 中未找到 AUTODL_ELASTIC_TOKEN 或 AUTODL_TOKEN", {}, 1);
    }
    const apiContext = { host: context.host, token: context.token };

    switch (command) {
      case "queue-submit": {
        const configPath = requireValue(argv[1], "config.json");
        const config = await readJsonFile(configPath);
        printJson(await queueSubmit(config, {
          ...apiContext,
          intervalSeconds: getNumberFlag(argv, "--interval", 30),
          timeoutSeconds: getNumberFlag(argv, "--timeout", 0),
        }), io);
        return 0;
      }
      case "images":
        printJson(await fetchAllImages(apiContext, getNumberFlag(argv, "--page-size", 100)), io);
        return 0;
      case "deployments":
        printJson(await listDeployments(apiContext, getNumberFlag(argv, "--page-index", 1), getNumberFlag(argv, "--page-size", 10)), io);
        return 0;
      case "containers":
        printJson(await listContainers(apiContext, {
          deployment_uuid: requireValue(getFlagValue(argv, "--deployment-uuid"), "--deployment-uuid"),
          page_index: getNumberFlag(argv, "--page-index", 1),
          page_size: getNumberFlag(argv, "--page-size", 10),
        }), io);
        return 0;
      case "events":
        printJson(await listEvents(apiContext, {
          deployment_uuid: requireValue(getFlagValue(argv, "--deployment-uuid"), "--deployment-uuid"),
          page_index: 1,
          page_size: 100,
          ...(getFlagValue(argv, "--offset") ? { offset: getNumberFlag(argv, "--offset", 0) } : {}),
        }), io);
        return 0;
      case "stop-container":
        printJson(await stopContainer(apiContext, {
          deployment_container_uuid: requireValue(argv[1], "container_uuid"),
          decrease_one_replica_num: hasFlag(argv, "--decrease-one-replica-num"),
          cache_container: !hasFlag(argv, "--no-cache"),
        }), io);
        return 0;
      case "set-replicas":
        printJson(await setReplicas(apiContext, requireValue(argv[1], "deployment_uuid"), Number(requireValue(argv[2], "replica_num"))), io);
        return 0;
      case "stop-deployment":
        printJson(await stopDeployment(apiContext, requireValue(argv[1], "deployment_uuid")), io);
        return 0;
      case "delete-deployment":
        printJson(await deleteDeployment(apiContext, requireValue(argv[1], "deployment_uuid")), io);
        return 0;
      case "blacklist":
        printJson(await addBlacklist(apiContext, requireValue(argv[1], "container_uuid"), getFlagValue(argv, "--comment")), io);
        return 0;
      case "list-blacklist":
        printJson(await listBlacklists(apiContext), io);
        return 0;
      case "gpu-stock": {
        const filtersPath = getFlagValue(argv, "--json");
        const filters = filtersPath ? await readJsonFile(filtersPath) as Record<string, unknown> : undefined;
        const stockOptions: { region?: string; filters?: Record<string, unknown> } = {};
        const region = getFlagValue(argv, "--region");
        if (region) {
          stockOptions.region = region;
        }
        if (filters) {
          stockOptions.filters = filters;
        }
        printJson(await fetchGpuStock(apiContext, stockOptions), io);
        return 0;
      }
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
