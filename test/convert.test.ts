/**
 * 测试 - 格式转换模块
 */

import { describe, test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { YoudaoNoteConvert } from "../src/core/convert";

const FIXTURES_DIR = join(import.meta.dir, "fixtures");

function normalizeNewlines(str: string): string {
  return str.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

describe("YoudaoNoteConvert", () => {
  test("XML 转换 Markdown 内容", () => {
    const testNotePath = join(FIXTURES_DIR, "test.note");
    const content = YoudaoNoteConvert.convertXmlToMarkdownContent(testNotePath);
    const expectedContent = readFileSync(join(FIXTURES_DIR, "test.md"), "utf-8");
    expect(normalizeNewlines(content)).toBe(normalizeNewlines(expectedContent));
  });

  test("JSON 转换 Markdown 内容", () => {
    const testJsonPath = join(FIXTURES_DIR, "test.json");
    const content = YoudaoNoteConvert.convertJsonToMarkdownContent(testJsonPath);
    const expectedContent = readFileSync(join(FIXTURES_DIR, "test-json.md"), "utf-8");
    expect(normalizeNewlines(content)).toBe(normalizeNewlines(expectedContent));
  });

  test("JSON 转换 Markdown 单行富文本", () => {
    const testConvertJsonPath = join(FIXTURES_DIR, "test-convert.json");
    const content = YoudaoNoteConvert.convertJsonToMarkdownContent(testConvertJsonPath);
    const expectedContent = readFileSync(join(FIXTURES_DIR, "test-convert.md"), "utf-8");
    expect(normalizeNewlines(content)).toBe(normalizeNewlines(expectedContent));
  });

  test("HTML (.note) 转换 Markdown 内容", () => {
    const testHtmlNotePath = join(FIXTURES_DIR, "test-html.note");
    const htmlContent = readFileSync(testHtmlNotePath, "utf-8");
    const content = YoudaoNoteConvert.convertHtmlToMarkdownContent(htmlContent);
    const expectedContent = readFileSync(join(FIXTURES_DIR, "test-html.md"), "utf-8");
    expect(normalizeNewlines(content)).toBe(normalizeNewlines(expectedContent));
  });

  test("HTML (.note) 转换不丢失内容", () => {
    const testHtmlNotePath = join(FIXTURES_DIR, "test-html.note");
    const htmlContent = readFileSync(testHtmlNotePath, "utf-8");
    const content = YoudaoNoteConvert.convertHtmlToMarkdownContent(htmlContent);
    // 确保关键内容不丢失
    expect(content).toContain("80端口被占用");
    expect(content).toContain("sudo lsof -i -P");
    expect(content).toContain("apachectl stop");
    expect(content).toContain("launchctl unload");
  });
});
