import { ApiError } from "../core/errors.mjs";
import { createDeployment, fetchAllImages, fetchGpuStock, type ElasticApiContext, type GpuStockRecord } from "./api.mjs";
import { validateElasticConfig } from "./schema.mjs";

export interface QueueSubmitOptions extends ElasticApiContext {
  intervalSeconds?: number;
  timeoutSeconds?: number;
  sleep?: (milliseconds: number) => Promise<void>;
  now?: () => number;
}

export interface QueueSubmitSuccess {
  status: "success";
  deployment_uuid: string;
  waited_seconds: number;
}

const MAX_SUBMIT_RETRIES = 3;

export async function queueSubmit(config: any, options: QueueSubmitOptions): Promise<QueueSubmitSuccess> {
  const validationErrors = validateElasticConfig(config);
  if (validationErrors.length > 0) {
    throw new ApiError("validation_error", "配置参数有误", { errors: validationErrors }, 1);
  }

  const template = config.container_template;
  const gpuNames: string[] = template.gpu_name_set;
  const gpuNum = Number(template.gpu_num);
  const intervalSeconds = options.intervalSeconds ?? 30;
  const timeoutSeconds = options.timeoutSeconds ?? 0;
  const sleep = options.sleep ?? ((milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds)));
  const now = options.now ?? (() => Date.now() / 1000);
  const startedAt = now();

  const images = await fetchAllImages(options);
  if (!images.some((image) => image.uuid === template.image_uuid)) {
    throw new ApiError("image_not_found", `镜像 '${String(template.image_uuid)}' 不存在`, {
      requested: template.image_uuid,
      available_images: images,
    }, 1);
  }

  let stock = await fetchGpuStock(options, { dcList: template.dc_list });
  const availableTypes = Object.keys(stock).sort();
  const existing = gpuNames.filter((name) => name in stock);
  if (existing.length === 0) {
    throw new ApiError("gpu_type_not_found", `请求的 GPU 型号均不存在: ${JSON.stringify(gpuNames)}`, {
      requested: gpuNames,
      available_gpus: availableTypes,
    }, 1);
  }

  let submitFailures = 0;
  while (true) {
    if (hasIdleGpu(stock, gpuNames, gpuNum)) {
      try {
        const deployment = await createDeployment(options, config) as any;
        if (deployment?.deployment_uuid) {
          return {
            status: "success",
            deployment_uuid: deployment.deployment_uuid,
            waited_seconds: Math.max(0, Math.floor(now() - startedAt)),
          };
        }
        submitFailures += 1;
        if (submitFailures >= MAX_SUBMIT_RETRIES) {
          throw submissionError(deployment);
        }
      } catch (error) {
        if (!(error instanceof ApiError) || error.errorType !== "api_error" || !("code" in error.details)) {
          throw error;
        }
        submitFailures += 1;
        if (submitFailures >= MAX_SUBMIT_RETRIES) {
          throw submissionError(error.details);
        }
      }
    }

    const elapsedSeconds = now() - startedAt;
    if (timeoutSeconds > 0 && elapsedSeconds >= timeoutSeconds) {
      throw new ApiError("timeout", `等待 GPU 资源超时 (${Math.floor(elapsedSeconds)}s)`, {
        elapsed_seconds: Math.floor(elapsedSeconds),
        timeout_seconds: timeoutSeconds,
        last_stock: Object.fromEntries(gpuNames.filter((name) => name in stock).map((name) => [name, stock[name]])),
      }, 2);
    }

    await sleep(intervalSeconds * 1000);
    stock = await fetchGpuStock(options, { dcList: template.dc_list });
  }
}

function hasIdleGpu(stock: Record<string, GpuStockRecord>, gpuNames: string[], gpuNum: number): boolean {
  return gpuNames.some((name) => (stock[name]?.idle ?? 0) >= gpuNum);
}

function submissionError(apiResponse: unknown): ApiError {
  return new ApiError("submission_error", `部署提交连续失败 ${MAX_SUBMIT_RETRIES} 次`, {
    api_response: apiResponse,
    suggestion: "GPU 有空闲但提交失败，可能原因: 价格范围无匹配机器、CPU/内存超出机器规格、CUDA 版本与 GPU 型号不兼容等",
  }, 3);
}
