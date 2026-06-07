/**
 * 通用工具函数
 */

import { resolve } from "node:path";

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
