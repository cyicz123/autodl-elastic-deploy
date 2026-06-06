type JsonRecord = Record<string, any>;

const REQUIRED_CREATE_FIELDS = [
  "req_gpu_amount",
  "expand_system_disk_by_gb",
  "gpu_spec_uuid",
  "image_uuid",
  "cuda_v_from",
];

export function validateCreateConfig(config: JsonRecord): string[] {
  const errors: string[] = [];
  if (!config || typeof config !== "object") {
    return ["配置必须是 JSON 对象"];
  }
  const missing = REQUIRED_CREATE_FIELDS.filter((field) => !(field in config));
  if (missing.length > 0) {
    errors.push(`缺少: ${missing.join(", ")}`);
    return errors;
  }
  const gpuAmount = Number(config.req_gpu_amount);
  if (!Number.isInteger(gpuAmount) || gpuAmount < 1 || gpuAmount > 4) {
    errors.push(`req_gpu_amount(${String(config.req_gpu_amount)}) 必须是 1 到 4`);
  }
  const disk = Number(config.expand_system_disk_by_gb);
  if (!Number.isInteger(disk) || disk < 0 || disk > 500) {
    errors.push(`expand_system_disk_by_gb(${String(config.expand_system_disk_by_gb)}) 必须是 0 到 500`);
  }
  return errors;
}
