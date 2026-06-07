/**
 * 有道云笔记导出工具 - 类型定义
 */

// ==================== 枚举 ====================

/** 文件类型 */
export enum FileType {
  /** 其他类型（不做转换） */
  OTHER = 0,
  /** Markdown 文件 */
  MARKDOWN = 1,
  /** XML 格式笔记 */
  XML = 2,
  /** JSON 格式笔记 */
  JSON = 3,
  /** HTML 格式笔记（早期有道云笔记） */
  HTML = 4,
}

/** 文件操作行为 */
export enum FileAction {
  /** 跳过（本地文件已是最新） */
  CONTINUE = "跳过",
  /** 新增（本地不存在） */
  ADD = "新增",
  /** 更新（云端更新时间晚于本地） */
  UPDATE = "更新",
}

// ==================== 配置相关 ====================

/** 用户配置 (config.json) */
export interface Config {
  /** 本地存放导出文件的文件夹（绝对路径），不填则默认为当前文件夹 */
  local_dir: string;
  /** 有道云笔记指定导出文件夹名，不填则导出所有文件 */
  ydnote_dir: string;
  /** SM.MS 的 Secret Token，用于上传图片到 SM.MS 图床 */
  smms_secret_token: string;
  /** 是否使用相对路径展示图片/附件 */
  is_relative_path: boolean;
}

/** Cookie 元组 [name, value, domain, path] */
export type CookieTuple = [string, string, string, string];

/** Cookies 配置文件 (cookies.json) */
export interface CookiesConfig {
  cookies: CookieTuple[];
}

// ==================== API 返回类型 ====================

/** 文件/目录条目 */
export interface FileEntry {
  /** 文件/目录 ID */
  id: string;
  /** 文件/目录名称 */
  name: string;
  /** 是否为目录 */
  dir: boolean;
  /** 修改时间（用于排序，秒级时间戳） */
  modifyTimeForSort: number;
  /** 创建时间（用于排序，秒级时间戳） */
  createTimeForSort: number;
}

/** 目录条目包装 */
export interface DirEntry {
  fileEntry: FileEntry;
}

/** 目录信息（获取目录内容的响应） */
export interface DirInfo {
  count: number;
  entries: DirEntry[];
}

/** 根目录信息（获取根目录的响应） */
export interface RootDirInfo {
  fileEntry: FileEntry;
}

// ==================== SM.MS API ====================

/** SM.MS 上传成功响应 */
export interface SmmsUploadSuccess {
  success: true;
  data: {
    url: string;
  };
}

/** SM.MS 图片重复响应 */
export interface SmmsImageRepeated {
  success: false;
  code: "image_repeated";
  images: string;
}

/** SM.MS 频率限制响应 */
export interface SmmsFlood {
  success: false;
  code: "flood";
}

/** SM.MS 上传响应（联合类型） */
export type SmmsResponse = SmmsUploadSuccess | SmmsImageRepeated | SmmsFlood | {
  success: false;
  code?: string;
};
