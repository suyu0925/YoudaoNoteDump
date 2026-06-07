/**
 * 日志模块
 * 同时输出到控制台和日志文件
 */

import { mkdirSync, existsSync, appendFileSync } from "node:fs";
import { join } from "node:path";
import { getScriptDirectory } from "./utils";

const LOG_DIR = join(getScriptDirectory(), "logs");

let logFilePath: string | null = null;

/** 初始化日志系统 */
export function initLogging(): void {
  if (!existsSync(LOG_DIR)) {
    mkdirSync(LOG_DIR, { recursive: true });
  }

  const now = new Date();
  const timestamp = now.toISOString().replace(/[-:T]/g, "").slice(0, 15);
  logFilePath = join(LOG_DIR, `pull-${timestamp}.log`);
}

/** 格式化当前时间 */
function formatTime(): string {
  return new Date().toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

/** 写入日志（控制台 + 文件） */
function writeLog(level: string, message: string): void {
  const line = `${formatTime()} [${level}] ${message}`;

  // 输出到控制台
  if (level === "ERROR") {
    console.error(line);
  } else {
    console.log(line);
  }

  // 写入日志文件
  if (logFilePath) {
    appendFileSync(logFilePath, line + "\n", "utf-8");
  }
}

export const logger = {
  info(message: string): void {
    writeLog("INFO", message);
  },

  error(message: string): void {
    writeLog("ERROR", message);
  },

  debug(message: string): void {
    writeLog("DEBUG", message);
  },

  warn(message: string): void {
    writeLog("WARN", message);
  },
};
