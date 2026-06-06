import { requestJson } from "../core/http.mjs";

export interface ElasticApiContext {
  host: string;
  token: string;
  fetchImpl?: typeof fetch;
}

export interface ImageRecord {
  uuid: string;
  name: string;
}

export interface GpuStockRecord {
  idle: number;
  total: number;
}

function request(context: ElasticApiContext, method: "GET" | "POST" | "PUT" | "DELETE", path: string, body?: unknown) {
  return requestJson({
    host: context.host,
    method,
    path,
    token: context.token,
    ...(body !== undefined ? { body } : {}),
    ...(context.fetchImpl ? { fetchImpl: context.fetchImpl } : {}),
  });
}

export async function fetchAllImages(
  context: ElasticApiContext,
  pageSize = 100,
): Promise<ImageRecord[]> {
  const images: ImageRecord[] = [];
  let pageIndex = 1;
  while (true) {
    const response = await request(context, "POST", "/api/v1/dev/image/private/list", {
      page_index: pageIndex,
      page_size: pageSize,
    });
    const data = (response.data ?? {}) as any;
    const list = Array.isArray(data.list) ? data.list : [];
    for (const image of list) {
      images.push({
        uuid: image.image_uuid ?? "",
        name: image.image_name ?? image.name ?? "",
      });
    }
    const maxPage = Number(data.max_page ?? pageIndex);
    if (list.length === 0 || pageIndex >= maxPage) {
      break;
    }
    pageIndex += 1;
  }
  return images;
}

export async function fetchGpuStock(
  context: ElasticApiContext,
  options: { dcList?: string[]; region?: string; filters?: Record<string, unknown> } = {},
): Promise<Record<string, GpuStockRecord>> {
  const hasRegionFilters = Boolean(options.region || options.dcList?.length || options.filters);
  const body = options.filters ? { ...options.filters } : {};
  if (options.region) {
    Object.assign(body, { region_sign: options.region });
  }
  if (options.dcList?.length) {
    Object.assign(body, { dc_list: options.dcList });
  }
  const response = hasRegionFilters
    ? await request(context, "POST", "/api/v1/dev/machine/region/gpu_stock", body)
    : await request(context, "GET", "/api/v1/dev/machine/gpu_stock");
  return normalizeGpuStock(response.data);
}

export function normalizeGpuStock(raw: unknown): Record<string, GpuStockRecord> {
  const stock: Record<string, GpuStockRecord> = {};
  const entries = Array.isArray(raw) ? raw : [raw];
  for (const item of entries) {
    if (!item || typeof item !== "object") {
      continue;
    }
    for (const [name, info] of Object.entries(item as Record<string, any>)) {
      if (!info || typeof info !== "object") {
        continue;
      }
      stock[name] = {
        idle: Number(info.idle_gpu_num ?? info.idle ?? 0),
        total: Number(info.total_gpu_num ?? info.total ?? 0),
      };
    }
  }
  return stock;
}

export async function createDeployment(context: ElasticApiContext, config: unknown) {
  const response = await request(context, "POST", "/api/v1/dev/deployment", config);
  return response.data;
}

export async function listDeployments(context: ElasticApiContext, pageIndex = 1, pageSize = 10) {
  const response = await request(context, "POST", "/api/v1/dev/deployment/list", {
    page_index: pageIndex,
    page_size: pageSize,
  });
  return response.data;
}

export async function listContainers(context: ElasticApiContext, body: Record<string, unknown>) {
  const response = await request(context, "POST", "/api/v1/dev/deployment/container/list", body);
  return response.data;
}

export async function listEvents(context: ElasticApiContext, body: Record<string, unknown>) {
  const response = await request(context, "POST", "/api/v1/dev/deployment/container/event/list", body);
  return response.data;
}

export async function stopContainer(context: ElasticApiContext, body: Record<string, unknown>) {
  const response = await request(context, "PUT", "/api/v1/dev/deployment/container/stop", body);
  return response.data ?? null;
}

export async function setReplicas(context: ElasticApiContext, deploymentUuid: string, replicaNum: number) {
  const response = await request(context, "PUT", "/api/v1/dev/deployment/replica_num", {
    deployment_uuid: deploymentUuid,
    replica_num: replicaNum,
  });
  return response.data ?? null;
}

export async function stopDeployment(context: ElasticApiContext, deploymentUuid: string) {
  const response = await request(context, "PUT", "/api/v1/dev/deployment/operate", {
    deployment_uuid: deploymentUuid,
    operate: "stop",
  });
  return response.data ?? null;
}

export async function deleteDeployment(context: ElasticApiContext, deploymentUuid: string) {
  const response = await request(context, "DELETE", "/api/v1/dev/deployment", {
    deployment_uuid: deploymentUuid,
  });
  return response.data ?? null;
}

export async function addBlacklist(context: ElasticApiContext, deploymentContainerUuid: string, comment?: string) {
  const response = await request(context, "POST", "/api/v1/dev/deployment/blacklist", {
    deployment_container_uuid: deploymentContainerUuid,
    ...(comment ? { comment } : {}),
  });
  return response.data ?? null;
}

export async function listBlacklists(context: ElasticApiContext) {
  const response = await request(context, "POST", "/api/v1/dev/deployment/blacklist/list", {});
  return response.data;
}
