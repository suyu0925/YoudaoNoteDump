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
});
