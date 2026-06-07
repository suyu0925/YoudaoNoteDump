/**
 * 通用工具函数
 */

import { resolve } from "node:path";
import type { NoteMeta } from "../types";

/** Markdown 文件后缀 */
export const MARKDOWN_SUFFIX = ".md";

/**
 * 获取脚本所在目录（即项目根目录）
 * 对应 Python 版的 get_script_directory()
 */
export function getScriptDirectory(): string {
  return resolve(".");
}

/**
 * 优化文件名：移除特殊字符、换行符等
 * 对应 Python 版的 _optimize_file_name()
 */
export function optimizeFileName(name: string): string {
  // 去除换行符
  name = name.replace(/\n/g, "");
  // 首尾空格
  name = name.trim();
  // 将 < 替换为下划线
  name = name.replace(/[<]/g, "_");
  // 删除特殊字符: \ / " : | * ? # >
  name = name.replace(/[\\/":|*?#>]/g, "");
  return name;
}

/**
 * 将路径统一为 posix 风格（/ 分隔）
 */
export function toPosixPath(filePath: string): string {
  return filePath.replace(/\\/g, "/");
}

/**
 * 对路径中的特殊字符进行 URL 编码（目前只处理空格）
 */
export function urlEncodePath(filePath: string): string {
  return filePath.replace(/ /g, "%20");
}

/**
 * 将秒级时间戳转换为 ISO 8601 格式字符串（含时区）
 * 例如: 1717776000 → "2024-06-07T20:00:00+08:00"
 */
export function timestampToIso8601(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  const tzOffset = -date.getTimezoneOffset();
  const sign = tzOffset >= 0 ? "+" : "-";
  const hours = String(Math.floor(Math.abs(tzOffset) / 60)).padStart(2, "0");
  const minutes = String(Math.abs(tzOffset) % 60).padStart(2, "0");

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  const second = String(date.getSeconds()).padStart(2, "0");

  return `${year}-${month}-${day}T${hour}:${minute}:${second}${sign}${hours}:${minutes}`;
}

/**
 * 生成 YAML Frontmatter 字符串
 * 输出格式:
 * ---
 * title: xxx
 * created: 2024-06-07T20:00:00+08:00
 * modified: 2024-06-07T20:00:00+08:00
 * source_format: xml
 * ---
 */
export function generateFrontmatter(meta: NoteMeta): string {
  const lines = [
    "---",
    `title: "${meta.title.replace(/"/g, '\\"')}"`,
    `created: ${timestampToIso8601(meta.created)}`,
    `modified: ${timestampToIso8601(meta.modified)}`,
    `source_format: ${meta.source_format}`,
    "---",
    "",
  ];
  return lines.join("\n");
}
