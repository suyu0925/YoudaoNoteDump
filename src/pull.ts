/**
 * 有道云笔记 Pull 主流程
 */

import { readFileSync, existsSync, mkdirSync, statSync, unlinkSync, utimesSync, writeFileSync } from "node:fs";
import { join, extname } from "node:path";
import { platform } from "node:os";
import type { Config, DirInfo } from "./types";
import { FileType, FileAction } from "./types";
import { YoudaoNoteApi } from "./core/api";
import { YoudaoNoteConvert } from "./core/convert";
import { ImagePull } from "./core/image";
import { logger } from "./core/logger";
import { getScriptDirectory, optimizeFileName, toPosixPath, MARKDOWN_SUFFIX } from "./core/utils";

export class YoudaoNotePull {
  /** 本地文件根目录 */
  rootLocalDir: string = "";
  private youdaoNoteApi!: YoudaoNoteApi;
  private smmsSecretToken: string = "";
  private isRelativePath: boolean = false;

  /**
   * 加载并验证配置文件
   */
  private loadConfig(configPath?: string): { config: Config | null; errorMsg: string } {
    const path = configPath ?? join(getScriptDirectory(), "config.json");
    let configStr: string;
    try {
      configStr = readFileSync(path, "utf-8");
    } catch {
      return { config: null, errorMsg: `无法读取配置文件「${path}」` };
    }

    let config: Config;
    try {
      config = JSON.parse(configStr);
    } catch {
      return {
        config: null,
        errorMsg: "请检查「config.json」格式是否为 utf-8 格式的 json！建议使用 Sublime 编辑「config.json」",
      };
    }

    const requiredKeys = ["local_dir", "ydnote_dir", "smms_secret_token", "is_relative_path"];
    const actualKeys = Object.keys(config);
    if (requiredKeys.some((k) => !actualKeys.includes(k))) {
      return {
        config: null,
        errorMsg:
          "请检查「config.json」的 key 是否分别为 local_dir, ydnote_dir, smms_secret_token, is_relative_path",
      };
    }

    return { config, errorMsg: "" };
  }

  /**
   * 检查本地输出目录
   */
  private checkLocalDir(localDir: string): { dir: string; errorMsg: string } {
    if (!localDir) {
      localDir = toPosixPath(join(getScriptDirectory(), "youdaonote"));
    }

    if (!existsSync(localDir)) {
      try {
        mkdirSync(localDir, { recursive: true });
      } catch {
        return { dir: "", errorMsg: `请检查「${localDir}」上层文件夹是否存在，并使用绝对路径！` };
      }
    }

    return { dir: localDir, errorMsg: "" };
  }

  /**
   * 获取有道云笔记指定目录 ID
   */
  private async getYdnoteDirId(ydnoteDir: string): Promise<{ dirId: string; errorMsg: string }> {
    const rootDirInfo = await this.youdaoNoteApi.getRootDirInfoId();
    const rootDirId = rootDirInfo.fileEntry.id;

    // 如果不指定文件夹，取根目录 ID
    if (!ydnoteDir) {
      return { dirId: rootDirId, errorMsg: "" };
    }

    const dirInfo = await this.youdaoNoteApi.getDirInfoById(rootDirId);
    for (const entry of dirInfo.entries) {
      if (entry.fileEntry.name === ydnoteDir) {
        return { dirId: entry.fileEntry.id, errorMsg: "" };
      }
    }

    return { dirId: "", errorMsg: "有道云笔记指定顶层目录不存在" };
  }

  /**
   * 初始化并获取目录 ID（主入口前的初始化）
   */
  async init(): Promise<{ dirId: string; errorMsg: string }> {
    const { config, errorMsg: configErr } = this.loadConfig();
    if (configErr || !config) {
      return { dirId: "", errorMsg: configErr };
    }

    const { dir, errorMsg: dirErr } = this.checkLocalDir(config.local_dir);
    if (dirErr) {
      return { dirId: "", errorMsg: dirErr };
    }

    this.rootLocalDir = dir;
    this.youdaoNoteApi = new YoudaoNoteApi();

    const loginErr = this.youdaoNoteApi.loginByCookies();
    logger.info("本次使用 Cookies 登录");
    if (loginErr) {
      return { dirId: "", errorMsg: loginErr };
    }

    this.smmsSecretToken = config.smms_secret_token;
    this.isRelativePath = config.is_relative_path;

    return this.getYdnoteDirId(config.ydnote_dir);
  }

  /**
   * 判断笔记类型
   */
  private async judgeType(fileId: string, youdaoFileSuffix: string): Promise<FileType> {
    if (youdaoFileSuffix === MARKDOWN_SUFFIX) {
      return FileType.MARKDOWN;
    }

    if (youdaoFileSuffix === ".note" || youdaoFileSuffix === ".clip" || youdaoFileSuffix === "") {
      const response = await this.youdaoNoteApi.getFileById(fileId);
      const buffer = Buffer.from(await response.arrayBuffer());
      // 判断前几个字节
      if (buffer.subarray(0, 5).toString("utf-8") === "<?xml") {
        return FileType.XML;
      }
      if (buffer.subarray(0, 2).toString("utf-8") === '{"') {
        return FileType.JSON;
      }
    }

    return FileType.OTHER;
  }

  /**
   * 获取文件操作行为
   */
  private getFileAction(localFilePath: string, modifyTime: number): FileAction {
    if (!existsSync(localFilePath)) {
      return FileAction.ADD;
    }

    const stat = statSync(localFilePath);
    if (modifyTime <= stat.mtimeMs / 1000) {
      logger.info(`此文件「${localFilePath}」不更新，跳过`);
      return FileAction.CONTINUE;
    }

    return FileAction.UPDATE;
  }

  /**
   * 根据目录 ID 循环遍历下载目录下所有文件
   */
  async pullDirByIdRecursively(dirId: string, localDir: string): Promise<void> {
    const dirInfo: DirInfo = await this.youdaoNoteApi.getDirInfoById(dirId);

    if (!dirInfo.entries) {
      throw new Error("有道云笔记修改了接口地址，此脚本暂时不能使用！请提 issue");
    }

    for (const entry of dirInfo.entries) {
      const { id, name, dir } = entry.fileEntry;

      if (dir) {
        const subDir = toPosixPath(join(localDir, name));
        if (!existsSync(subDir)) {
          mkdirSync(subDir, { recursive: true });
        }
        await this.pullDirByIdRecursively(id, subDir);
      } else {
        const modifyTime = entry.fileEntry.modifyTimeForSort;
        const createTime = entry.fileEntry.createTimeForSort;
        await this.addOrUpdateFile(id, name, localDir, modifyTime, createTime);
      }
    }
  }

  /**
   * 新增或更新文件
   */
  private async addOrUpdateFile(
    fileId: string,
    fileName: string,
    localDir: string,
    modifyTime: number,
    createTime: number,
  ): Promise<void> {
    fileName = optimizeFileName(fileName);
    const youdaoFileSuffix = extname(fileName);
    const originalFilePath = toPosixPath(join(localDir, fileName));

    // 判断文件类型
    const fileType = await this.judgeType(fileId, youdaoFileSuffix);

    // 「文档」类型本地文件均以 .md 结尾
    const localFilePath =
      fileType !== FileType.OTHER
        ? toPosixPath(join(localDir, fileName.replace(youdaoFileSuffix, MARKDOWN_SUFFIX)))
        : originalFilePath;

    // 如果有有道云笔记是「文档」类型，则提示类型
    const tip = fileType !== FileType.OTHER ? `，云笔记原格式为 ${FileType[fileType]}` : "";

    const fileAction = this.getFileAction(localFilePath, modifyTime);
    if (fileAction === FileAction.CONTINUE) return;

    if (fileAction === FileAction.UPDATE) {
      // 先删除旧文件再写入
      try {
        unlinkSync(localFilePath);
      } catch { /* 文件可能不存在 */ }
    }

    try {
      await this.pullFile(fileId, originalFilePath, localFilePath, fileType, youdaoFileSuffix);
      logger.info(`${fileAction}「${localFilePath}」${tip}`);

      // 设置文件时间戳
      try {
        utimesSync(localFilePath, createTime, modifyTime);
      } catch { /* 时间设置失败不阻断 */ }
    } catch (error) {
      logger.info(`${fileAction}「${originalFilePath}」可能失败！请检查文件！错误提示：${error}`);
    }
  }

  /**
   * 下载文件
   */
  private async pullFile(
    fileId: string,
    filePath: string,
    localFilePath: string,
    fileType: FileType,
    youdaoFileSuffix: string,
  ): Promise<void> {
    // 1、先下载文件
    const response = await this.youdaoNoteApi.getFileById(fileId);
    const buffer = Buffer.from(await response.arrayBuffer());
    writeFileSync(filePath, buffer);

    // 2、如果文件是 note 类型，将其转换为 Markdown 类型
    if (fileType === FileType.XML) {
      try {
        YoudaoNoteConvert.convertXmlToMarkdown(filePath);
      } catch (e) {
        if (e instanceof Error && e.message.includes("Parse")) {
          logger.info("此 note 笔记应该为 17 年以前新建，格式为 html，将转换为 Markdown ...");
          YoudaoNoteConvert.convertHtmlToMarkdown(filePath);
        } else {
          logger.info(`note 笔记转换 Markdown 失败，将跳过: ${e}`);
        }
      }
    } else if (fileType === FileType.JSON) {
      YoudaoNoteConvert.convertJsonToMarkdown(filePath);
    }

    // 3、迁移文本文件里面的有道云笔记图片（链接）
    if (fileType !== FileType.OTHER || youdaoFileSuffix === MARKDOWN_SUFFIX) {
      const imagePull = new ImagePull(
        this.youdaoNoteApi,
        this.smmsSecretToken,
        this.isRelativePath,
      );
      await imagePull.migrationYdnoteUrl(localFilePath);
    }
  }
}
