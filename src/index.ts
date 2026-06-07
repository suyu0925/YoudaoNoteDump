/**
 * 有道云笔记导出工具 - 主入口
 * 使用方式: bun run src/index.ts
 */

import { initLogging, logger } from "./core/logger";
import { YoudaoNotePull } from "./pull";

async function main(): Promise<void> {
  initLogging();

  const startTime = Date.now();

  try {
    const youdaoNotePull = new YoudaoNotePull();
    const { dirId, errorMsg } = await youdaoNotePull.init();

    if (errorMsg) {
      logger.error(errorMsg);
      process.exit(1);
    }

    logger.info("正在 pull，请稍后 ...");
    await youdaoNotePull.pullDirByIdRecursively(dirId, youdaoNotePull.rootLocalDir);
  } catch (error) {
    if (error instanceof TypeError && String(error).includes("fetch")) {
      logger.error(
        "请检查网络代理设置；也有可能是调用有道云笔记接口次数达到限制，请等待一段时间后重新运行脚本，若一直失败，可删除「cookies.json」后重试",
      );
    } else if (error instanceof Error && error.message.includes("ECONNREFUSED")) {
      logger.error("网络错误，请检查网络是否正常连接。若突然执行中断，可忽略此错误，重新运行脚本");
    } else {
      logger.error(`Cookies 可能已过期！其他错误：${error}`);
    }
    console.error(error);
    logger.info("已终止执行");
    process.exit(1);
  }

  const endTime = Date.now();
  const elapsed = Math.round((endTime - startTime) / 1000);
  logger.info(`运行完成！耗时 ${elapsed} 秒`);
}

main();
