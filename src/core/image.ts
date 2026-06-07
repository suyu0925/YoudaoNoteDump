/**
 * 图片/附件处理模块
 * 负责下载有道云笔记图片到本地，或上传到 SM.MS 图床
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, basename } from "node:path";
import type { SmmsResponse } from "../types";
import type { YoudaoNoteApi } from "./api";
import { logger } from "./logger";
import { toPosixPath, urlEncodePath } from "./utils";

/** 有道云图片链接正则 */
const REGEX_IMAGE_URL = /!\[.*?\]\((.*?note\.youdao\.com.*?)\)/g;

/** 有道云附件链接正则 */
const REGEX_ATTACH = /\[(.*?)\]\(((http|https):\/\/note\.youdao\.com.*?)\)/g;

/** 图片目录名 */
const IMAGES = "images";

/** 附件目录名 */
const ATTACH = "attachments";

export class ImagePull {
  private youdaoNoteApi: YoudaoNoteApi;
  private smmsSecretToken: string;
  private isRelativePath: boolean;

  constructor(
    youdaoNoteApi: YoudaoNoteApi,
    smmsSecretToken: string,
    isRelativePath: boolean,
  ) {
    this.youdaoNoteApi = youdaoNoteApi;
    this.smmsSecretToken = smmsSecretToken;
    this.isRelativePath = isRelativePath;
  }

  /**
   * 迁移有道云笔记文件中的 URL（图片和附件）
   */
  async migrationYdnoteUrl(filePath: string): Promise<void> {
    let content = readFileSync(filePath, "utf-8");

    // 处理图片
    const imageUrls = [...content.matchAll(REGEX_IMAGE_URL)].map((m) => m[1]);
    if (imageUrls.length > 0) {
      logger.info(`正在转换有道云笔记「${filePath}」中的有道云图片链接...`);
    }

    for (const imageUrl of imageUrls) {
      let imagePath: string;
      try {
        imagePath = await this.getNewImagePath(filePath, imageUrl);
      } catch (error) {
        logger.info(`下载图片「${imageUrl}」可能失败！请检查图片！错误提示：${error}`);
        continue;
      }
      if (imageUrl === imagePath) continue;

      // 将绝对路径替换为相对路径
      if (this.isRelativePath && !this.smmsSecretToken) {
        const imagesIndex = imagePath.indexOf(IMAGES);
        if (imagesIndex !== -1) {
          imagePath = imagePath.slice(imagesIndex);
        }
      }

      imagePath = urlEncodePath(imagePath);
      content = content.replace(imageUrl, imagePath);
    }

    // 处理附件
    const attachMatches = [...content.matchAll(REGEX_ATTACH)];
    if (attachMatches.length > 0) {
      logger.info(`正在转换有道云笔记「${filePath}」中的有道云附件链接...`);
    }

    for (const match of attachMatches) {
      const attachName = match[1];
      const attachUrl = match[2];
      let attachPath = await this.downloadYdnoteUrl(filePath, attachUrl, attachName);
      if (!attachPath) continue;

      // 相对路径处理
      if (this.isRelativePath) {
        const attachIndex = attachPath.indexOf(ATTACH);
        if (attachIndex !== -1) {
          attachPath = attachPath.slice(attachIndex);
        }
      }
      content = content.replace(attachUrl, attachPath);
    }

    writeFileSync(filePath, content, "utf-8");
  }

  /**
   * 将图片链接转换为新的链接
   */
  private async getNewImagePath(filePath: string, imageUrl: string): Promise<string> {
    // 当 smmsSecretToken 为空（不上传到 SM.MS），下载图片到本地
    if (!this.smmsSecretToken) {
      const imagePath = await this.downloadYdnoteUrl(filePath, imageUrl);
      return imagePath || imageUrl;
    }

    // smmsSecretToken 不为空，上传到 SM.MS
    const { url: newFileUrl, errorMsg } = await ImageUpload.uploadToSmms(
      this.youdaoNoteApi,
      imageUrl,
      this.smmsSecretToken,
    );

    // 如果上传成功
    if (!errorMsg) {
      return newFileUrl;
    }

    // 上传失败，仍下载到本地
    logger.info(errorMsg);
    const imagePath = await this.downloadYdnoteUrl(filePath, imageUrl);
    return imagePath || imageUrl;
  }

  /**
   * 下载文件到本地，返回本地路径
   */
  private async downloadYdnoteUrl(
    filePath: string,
    url: string,
    attachName?: string,
  ): Promise<string> {
    let response: Response;
    try {
      response = await this.youdaoNoteApi.httpGet(url);
    } catch (err) {
      logger.info(`网络错误，「${url}」下载失败。错误提示：${err}`);
      return "";
    }

    const contentType = response.headers.get("Content-Type");
    const fileType = attachName ? "附件" : "图片";

    if (response.status !== 200 || !contentType) {
      logger.info(
        `下载「${url}」失败！${fileType}可能已失效，可浏览器登录有道云笔记后，查看${fileType}是否能正常加载`,
      );
      return "";
    }

    let fileDirname: string;
    let fileSuffix: string;

    if (attachName) {
      fileDirname = ATTACH;
      fileSuffix = attachName;
    } else {
      fileDirname = IMAGES;
      const contentTypeArr = contentType.split("/");
      fileSuffix =
        contentTypeArr.length === 2
          ? "." + contentTypeArr[1].replace(";", "")
          : ".jpg";
    }

    // 确定本地目录
    let localFileDir: string;
    const lastDotIndex = filePath.lastIndexOf(".");
    if (lastDotIndex === -1) {
      localFileDir = toPosixPath(join(filePath, fileDirname));
    } else {
      const fileDir = filePath.slice(0, filePath.lastIndexOf("/"));
      localFileDir = toPosixPath(join(fileDir, fileDirname));
    }

    if (!existsSync(localFileDir)) {
      mkdirSync(localFileDir, { recursive: true });
    }

    // 确定文件名
    const parsedUrl = new URL(url);
    const fileBasename = basename(parsedUrl.pathname);

    // 检查真实的 URL 中的参数
    const realUrl = new URL(response.url);
    const filenameParam = realUrl.searchParams.get("filename");
    const downloadParam = realUrl.searchParams.get("download");

    let fileName: string;
    if (filenameParam || downloadParam) {
      fileName = fileBasename + (filenameParam || downloadParam || "");
    } else {
      fileName = attachName ? fileSuffix : fileBasename + fileSuffix;
    }

    const localFilePath = toPosixPath(join(localFileDir, fileName));

    try {
      const buffer = Buffer.from(await response.arrayBuffer());
      writeFileSync(localFilePath, buffer);
      logger.info(`已将${fileType}「${url}」转换为「${localFilePath}」`);
    } catch {
      logger.info(`${url} ${fileType}有误！`);
      return "";
    }

    return localFilePath;
  }
}

/**
 * 图片上传到 SM.MS 图床
 */
export class ImageUpload {
  /**
   * 上传图片到 SM.MS
   * @returns { url, errorMsg }
   */
  static async uploadToSmms(
    youdaoNoteApi: YoudaoNoteApi,
    imageUrl: string,
    smmsSecretToken: string,
  ): Promise<{ url: string; errorMsg: string }> {
    // 下载图片
    let smfile: ArrayBuffer;
    try {
      const response = await youdaoNoteApi.httpGet(imageUrl);
      smfile = await response.arrayBuffer();
    } catch {
      return {
        url: "",
        errorMsg: `下载「${imageUrl}」失败！图片可能已失效，可浏览器登录有道云笔记后，查看图片是否能正常加载`,
      };
    }

    const floodErrorMsg =
      `SM.MS 免费版每分钟限额 20 张图片，每小时限额 100 张图片，大小限制 5 M，上传失败！「${imageUrl}」未转换，将下载图片到本地`;

    // 上传到 SM.MS
    const uploadApiUrl = "https://sm.ms/api/v2/upload";
    const formData = new FormData();
    formData.append("smfile", new Blob([smfile]));

    let resJson: SmmsResponse;
    try {
      const res = await fetch(uploadApiUrl, {
        method: "POST",
        headers: { Authorization: smmsSecretToken },
        body: formData,
        signal: AbortSignal.timeout(5000),
      });
      resJson = (await res.json()) as SmmsResponse;
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return { url: "", errorMsg: floodErrorMsg };
      }
      return {
        url: "",
        errorMsg: `网络错误，上传「${imageUrl}」到 SM.MS 失败！将下载图片到本地。错误提示：${err}`,
      };
    }

    if (resJson.success) {
      const url = resJson.data.url;
      logger.info(`已将图片「${imageUrl}」转换为「${url}」`);
      return { url, errorMsg: "" };
    }

    if ("code" in resJson) {
      if (resJson.code === "image_repeated" && "images" in resJson) {
        const url = resJson.images;
        logger.info(`已将图片「${imageUrl}」转换为「${url}」`);
        return { url, errorMsg: "" };
      }
      if (resJson.code === "flood") {
        return { url: "", errorMsg: floodErrorMsg };
      }
    }

    return {
      url: "",
      errorMsg: `上传「${imageUrl}」到 SM.MS 失败，请检查图片 url 或 smms_secret_token（${smmsSecretToken}）是否正确！将下载图片到本地`,
    };
  }
}
