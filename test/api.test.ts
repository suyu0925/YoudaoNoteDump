/**
 * 测试 - API 模块
 */

import { describe, test, expect, mock, beforeEach } from "bun:test";
import { YoudaoNoteApi } from "../src/core/api";
import { join } from "node:path";
import { writeFileSync, unlinkSync, existsSync } from "node:fs";

const TEST_COOKIES_PATH = join(import.meta.dir, "fixtures", "test_cookies.json");

describe("YoudaoNoteApi", () => {
  beforeEach(() => {
    // 清理测试文件
    if (existsSync(TEST_COOKIES_PATH)) {
      unlinkSync(TEST_COOKIES_PATH);
    }
  });

  test("cookies 文件不存在时，登录失败", () => {
    const api = new YoudaoNoteApi(TEST_COOKIES_PATH);
    const message = api.loginByCookies();
    expect(message).toContain("读取 cookies 文件失败");
  });

  test("cookies 格式错误时，登录失败", () => {
    const badJson = `{"cookies": "not_an_array"}`;
    writeFileSync(TEST_COOKIES_PATH, badJson, "utf-8");

    const api = new YoudaoNoteApi(TEST_COOKIES_PATH);
    const message = api.loginByCookies();
    // 可能会因为格式不对而报错
    expect(message).toBeTruthy();

    unlinkSync(TEST_COOKIES_PATH);
  });

  test("cookies 缺少 YNOTE_CSTK 时，登录失败", () => {
    const json = JSON.stringify({
      cookies: [
        ["YNOTE_LOGIN", "3||1591964671668", ".note.youdao.com", "/"],
        ["YNOTE_SESS", "***", ".note.youdao.com", "/"],
      ],
    });
    writeFileSync(TEST_COOKIES_PATH, json, "utf-8");

    const api = new YoudaoNoteApi(TEST_COOKIES_PATH);
    const message = api.loginByCookies();
    expect(message).toBe("YNOTE_CSTK 字段为空");

    unlinkSync(TEST_COOKIES_PATH);
  });

  test("cookies 格式正确且包含 YNOTE_CSTK 时，登录成功", () => {
    const json = JSON.stringify({
      cookies: [
        ["YNOTE_CSTK", "fPk5IkDg", ".note.youdao.com", "/"],
        ["YNOTE_LOGIN", "3||1591964671668", ".note.youdao.com", "/"],
        ["YNOTE_SESS", "***", ".note.youdao.com", "/"],
      ],
    });
    writeFileSync(TEST_COOKIES_PATH, json, "utf-8");

    const api = new YoudaoNoteApi(TEST_COOKIES_PATH);
    const message = api.loginByCookies();
    expect(message).toBe("");

    unlinkSync(TEST_COOKIES_PATH);
  });
});
