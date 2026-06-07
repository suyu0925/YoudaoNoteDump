/**
 * 测试 - 格式转换模块
 */

import { describe, test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { YoudaoNoteConvert } from "../src/core/convert";
import { generateFrontmatter, timestampToIso8601 } from "../src/core/utils";
import type { NoteMeta } from "../src/types";

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

describe("Frontmatter 生成", () => {
  test("时间戳转换为 ISO 8601", () => {
    // 2024-06-07T20:00:00 UTC+8 对应的 UTC 时间是 12:00:00
    // 这里用一个确定的时间戳来测试格式
    const timestamp = 1717776000; // 2024-06-07T12:00:00Z
    const result = timestampToIso8601(timestamp);
    // 验证格式正确：YYYY-MM-DDTHH:MM:SS+HH:MM
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/);
    // 验证日期部分
    expect(result).toContain("2024-06-07");
  });

  test("生成完整 Frontmatter", () => {
    const meta: NoteMeta = {
      title: "测试笔记",
      created: 1500000000,
      modified: 1717776000,
      source_format: "xml",
    };
    const frontmatter = generateFrontmatter(meta);
    expect(frontmatter).toContain("---");
    expect(frontmatter).toContain('title: "测试笔记"');
    expect(frontmatter).toContain("created: 2017-07-14");
    expect(frontmatter).toContain("modified: 2024-06-07");
    expect(frontmatter).toContain("source_format: xml");
  });

  test("Frontmatter 以 --- 开头和结尾", () => {
    const meta: NoteMeta = {
      title: "test",
      created: 1000000000,
      modified: 1000000000,
      source_format: "html",
    };
    const frontmatter = generateFrontmatter(meta);
    const lines = frontmatter.split("\n");
    expect(lines[0]).toBe("---");
    expect(lines[lines.length - 2]).toBe("---");
    // 最后一行是空行（便于与正文拼接）
    expect(lines[lines.length - 1]).toBe("");
  });

  test("Frontmatter 标题含双引号时正确转义", () => {
    const meta: NoteMeta = {
      title: '测试"引号"笔记',
      created: 1000000000,
      modified: 1000000000,
      source_format: "json",
    };
    const frontmatter = generateFrontmatter(meta);
    expect(frontmatter).toContain('title: "测试\\"引号\\"笔记"');
  });
});
