export const VALID_DEPLOYMENT_TYPES = ["ReplicaSet", "Job", "Container"] as const;

type JsonRecord = Record<string, any>;

const REQUIRED_TEMPLATE_FIELDS = [
  "dc_list",
  "gpu_name_set",
  "gpu_num",
  "cuda_v_from",
  "cuda_v_to",
  "cpu_num_from",
  "cpu_num_to",
  "memory_size_from",
  "memory_size_to",
  "cmd",
  "price_from",
  "price_to",
  "image_uuid",
];

export function validateElasticConfig(config: JsonRecord): string[] {
  const errors: string[] = [];

  if (!config || typeof config !== "object") {
    return ["配置必须是 JSON 对象"];
  }
  if (!("name" in config)) {
    errors.push("缺少 name");
  }

  const deploymentType = config.deployment_type;
  if (!VALID_DEPLOYMENT_TYPES.includes(deploymentType)) {
    errors.push(`无效 deployment_type '${String(deploymentType)}'，可选: ${VALID_DEPLOYMENT_TYPES.join(", ")}`);
  }
  if ((deploymentType === "ReplicaSet" || deploymentType === "Job") && !("replica_num" in config)) {
    errors.push(`${deploymentType} 需要 replica_num`);
  }
  if (deploymentType === "Job" && !("parallelism_num" in config)) {
    errors.push("Job 需要 parallelism_num");
  }

  const template = config.container_template;
  if (!template || typeof template !== "object") {
    errors.push("缺少 container_template");
    return errors;
  }

  if ("cuda_v" in template && (!("cuda_v_from" in template) || !("cuda_v_to" in template))) {
    errors.push("请使用 cuda_v_from 和 cuda_v_to 替代旧字段 cuda_v");
    return errors;
  }

  const missing = REQUIRED_TEMPLATE_FIELDS.filter((field) => !(field in template));
  if (missing.length > 0) {
    errors.push(`container_template 缺少: ${missing.join(", ")}`);
    return errors;
  }

  pushRangeError(errors, template, "cpu_num_from", "cpu_num_to");
  pushRangeError(errors, template, "memory_size_from", "memory_size_to");
  pushRangeError(errors, template, "price_from", "price_to");
  pushRangeError(errors, template, "cuda_v_from", "cuda_v_to");

  if (Number(template.gpu_num) < 1) {
    errors.push(`gpu_num(${String(template.gpu_num)}) 必须 >= 1`);
  }
  if (!Array.isArray(template.gpu_name_set) || template.gpu_name_set.length === 0) {
    errors.push("gpu_name_set 不能为空");
  }
  if (!Array.isArray(template.dc_list) || template.dc_list.length === 0) {
    errors.push("dc_list 不能为空");
  }

  return errors;
}

function pushRangeError(errors: string[], template: JsonRecord, fromKey: string, toKey: string): void {
  if (Number(template[fromKey]) > Number(template[toKey])) {
    errors.push(`${fromKey}(${String(template[fromKey])}) > ${toKey}(${String(template[toKey])})`);
  }
}
