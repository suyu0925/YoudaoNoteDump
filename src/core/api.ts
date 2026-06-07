/**
 * 有道云笔记 API 封装
 * 原理：https://depp.wang/2020/06/11/how-to-find-the-api-of-a-website-eg-note-youdao-com/
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { CookiesConfig, CookieTuple, DirInfo, RootDirInfo } from "../types";
import { getScriptDirectory } from "./utils";

/** API URL 模板 */
const ROOT_ID_URL =
  "https://note.youdao.com/yws/api/personal/file?method=getByPath&keyfrom=web&cstk={cstk}";

const DIR_MES_URL =
  "https://note.youdao.com/yws/api/personal/file/{dir_id}?all=true&f=true&len=1000&sort=1&isReverse=false&method=listPageByParentId&keyfrom=web&cstk={cstk}";

const FILE_URL =
  "https://note.youdao.com/yws/api/personal/sync?method=download&_system=macos&_systemVersion=&_screenWidth=1280&_screenHeight=800&_appName=ynote&_appuser=0123456789abcdeffedcba9876543210&_vendor=official-website&_launch=16&_firstTime=&_deviceId=0123456789abcdef&_platform=web&_cityCode=110000&_cityName=&sev=j1&keyfrom=web&cstk={cstk}";

/** 默认请求头 */
const DEFAULT_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.88 Safari/537.36",
  Accept: "*/*",
  "Accept-Encoding": "gzip, deflate",
  "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
  "sec-ch-ua": '" Not A;Brand";v="99", "Chromium";v="100", "Google Chrome";v="100"',
  "sec-ch-ua-mobile": "?0",
  "sec-ch-ua-platform": '"macOS"',
};

export class YoudaoNoteApi {
  private cookiesPath: string;
  private cstk: string = "";
  private cookieHeader: string = "";

  constructor(cookiesPath?: string) {
    this.cookiesPath = cookiesPath ?? join(getScriptDirectory(), "cookies.json");
  }

  /**
   * 使用 Cookies 登录（设置认证信息）
   * @returns 错误信息，为空表示成功
   */
  loginByCookies(): string {
    let cookies: CookieTuple[];
    try {
      cookies = this.loadCookies();
    } catch (err) {
      return String(err);
    }

    // 验证 cookies 是数组
    if (!Array.isArray(cookies)) {
      return `转换「${this.cookiesPath}」为字典时出现错误`;
    }

    // 构建 Cookie header 字符串
    this.cookieHeader = cookies.map(([name, value]) => `${name}=${value}`).join("; ");

    // 提取 YNOTE_CSTK
    const cstkCookie = cookies.find(([name]) => name === "YNOTE_CSTK");
    if (!cstkCookie || !cstkCookie[1]) {
      return "YNOTE_CSTK 字段为空";
    }
    this.cstk = cstkCookie[1];

    return "";
  }

  /**
   * 读取并解析 cookies.json 文件
   */
  private loadCookies(): CookieTuple[] {
    let jsonStr: string;
    try {
      jsonStr = readFileSync(this.cookiesPath, "utf-8");
    } catch (err) {
      throw new Error(`读取 cookies 文件失败: ${err}`);
    }

    let config: CookiesConfig;
    try {
      config = JSON.parse(jsonStr);
    } catch {
      throw new Error(`转换「${this.cookiesPath}」为字典时出现错误`);
    }

    return config.cookies;
  }

  /**
   * 获取请求头（包含 Cookie）
   */
  private getHeaders(extraHeaders?: Record<string, string>): Record<string, string> {
    return {
      ...DEFAULT_HEADERS,
      Cookie: this.cookieHeader,
      ...extraHeaders,
    };
  }

  /**
   * 封装 POST 请求
   */
  async httpPost(
    url: string,
    data?: Record<string, string | number | boolean>,
  ): Promise<Response> {
    const body = data
      ? new URLSearchParams(
          Object.entries(data).map(([k, v]) => [k, String(v)] as [string, string]),
        )
      : undefined;

    return fetch(url, {
      method: "POST",
      headers: this.getHeaders({
        "Content-Type": "application/x-www-form-urlencoded",
      }),
      body,
    });
  }

  /**
   * 封装 GET 请求
   */
  async httpGet(url: string): Promise<Response> {
    return fetch(url, {
      method: "GET",
      headers: this.getHeaders(),
    });
  }

  /**
   * 获取有道云笔记根目录信息
   */
  async getRootDirInfoId(): Promise<RootDirInfo> {
    const url = ROOT_ID_URL.replace("{cstk}", this.cstk);
    const data = {
      path: "/",
      entire: "true",
      purge: "false",
      cstk: this.cstk,
    };
    const response = await this.httpPost(url, data);
    return response.json() as Promise<RootDirInfo>;
  }

  /**
   * 根据目录 ID 获取目录下所有文件信息
   */
  async getDirInfoById(dirId: string): Promise<DirInfo> {
    const url = DIR_MES_URL.replace("{dir_id}", dirId).replace("{cstk}", this.cstk);
    const response = await this.httpGet(url);
    return response.json() as Promise<DirInfo>;
  }

  /**
   * 根据文件 ID 获取文件内容
   * @returns Response（内容为笔记字节码）
   */
  async getFileById(fileId: string): Promise<Response> {
    const url = FILE_URL.replace("{cstk}", this.cstk);
    const data = {
      fileId,
      version: -1,
      convert: "true",
      editorType: 1,
      cstk: this.cstk,
    };
    return this.httpPost(url, data);
  }
}
