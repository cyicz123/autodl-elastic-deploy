import { ApiError } from "../core/errors.mjs";
import { requestJson } from "../core/http.mjs";
import { validateCreateConfig } from "./schema.mjs";

export interface ProApiContext {
  host: string;
  token: string;
  fetchImpl?: typeof fetch;
}

function request(context: ProApiContext, method: "GET" | "POST", path: string, body?: unknown) {
  return requestJson({
    host: context.host,
    method,
    path,
    token: context.token,
    ...(body !== undefined ? { body } : {}),
    ...(context.fetchImpl ? { fetchImpl: context.fetchImpl } : {}),
  });
}

export async function createInstance(context: ProApiContext, config: Record<string, unknown>) {
  const errors = validateCreateConfig(config);
  if (errors.length > 0) {
    throw new ApiError("validation_error", "Pro 创建参数有误", { errors }, 1);
  }
  const response = await request(context, "POST", "/api/v1/dev/instance/pro/create", config);
  return response.data;
}

export async function getSnapshot(context: ProApiContext, instanceUuid: string) {
  const response = await request(context, "GET", "/api/v1/dev/instance/pro/snapshot", {
    instance_uuid: instanceUuid,
  });
  return response.data;
}

export async function getStatus(context: ProApiContext, instanceUuid: string) {
  const response = await request(context, "GET", "/api/v1/dev/instance/pro/status", {
    instance_uuid: instanceUuid,
  });
  return response.data;
}

export async function listInstances(context: ProApiContext, pageIndex = 1, pageSize = 10) {
  const response = await request(context, "POST", "/api/v1/dev/instance/pro/list", {
    page_index: pageIndex,
    page_size: pageSize,
  });
  return response.data;
}

export async function powerOn(context: ProApiContext, instanceUuid: string, startCommand?: string) {
  const response = await request(context, "POST", "/api/v1/dev/instance/pro/power_on", {
    instance_uuid: instanceUuid,
    payload: "gpu",
    ...(startCommand ? { start_command: startCommand } : {}),
  });
  return response.data ?? null;
}

export async function powerOff(context: ProApiContext, instanceUuid: string) {
  const response = await request(context, "POST", "/api/v1/dev/instance/pro/power_off", {
    instance_uuid: instanceUuid,
  });
  return response.data ?? null;
}

export async function releaseInstance(context: ProApiContext, instanceUuid: string) {
  const response = await request(context, "POST", "/api/v1/dev/instance/pro/release", {
    instance_uuid: instanceUuid,
  });
  return response.data ?? null;
}

export async function saveImage(context: ProApiContext, instanceUuid: string, imageName: string) {
  const response = await request(context, "POST", "/api/v1/dev/instance/pro/image/save", {
    instance_uuid: instanceUuid,
    image_name: imageName,
  });
  return response.data;
}

export async function listImages(context: ProApiContext, pageIndex = 1, pageSize = 10) {
  const response = await request(context, "POST", "/api/v1/dev/instance/pro/image/private/list", {
    page_index: pageIndex,
    page_size: pageSize,
  });
  return response.data;
}
