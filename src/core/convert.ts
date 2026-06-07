/**
 * 有道云笔记格式转换模块
 * 支持 XML → Markdown, JSON → Markdown, HTML → Markdown
 */

import { readFileSync, writeFileSync, renameSync, existsSync, statSync, unlinkSync } from "node:fs";
import { basename, extname, join } from "node:path";
import { XMLParser } from "fast-xml-parser";
import TurndownService from "turndown";
import { MARKDOWN_SUFFIX } from "./utils";

// ==================== XML 转换 ====================

/** XML 命名空间前缀 */
const XML_NS = "http://note.youdao.com";

/**
 * XML 元素转 Markdown 的转换器
 */
class XmlElementConvert {
  /** 普通文本 */
  static convertPara(text: string): string {
    return text;
  }

  /** 标题 */
  static convertHeading(text: string, element: any): string {
    let level = element["@_level"] ?? 0;
    if (level === "a" || level === "b") level = 1;
    return text ? `${"#".repeat(Number(level))} ${text}` : text;
  }

  /** 图片 */
  static convertImage(text: string, element: any): string {
    const source = XmlElementConvert.getChildText(element, "source");
    return `![${text}](${source})`;
  }

  /** 附件 */
  static convertAttach(_text: string, element: any): string {
    const filename = XmlElementConvert.getChildText(element, "filename");
    const resource = XmlElementConvert.getChildText(element, "resource");
    return `[${filename}](${resource})`;
  }

  /** 代码块 */
  static convertCode(text: string, element: any): string {
    const language = XmlElementConvert.getChildText(element, "language");
    return `\`\`\`${language}\r\n${text}\`\`\``;
  }

  /** to-do */
  static convertTodo(text: string): string {
    return `- [ ] ${text}`;
  }

  /** 引用 */
  static convertQuote(text: string): string {
    return `> ${text}`;
  }

  /** 分割线 */
  static convertHorizontalLine(): string {
    return "---";
  }

  /** 列表 */
  static convertListItem(text: string, element: any, listItem: Record<string, string>): string {
    const listId = element["@_list-id"];
    const isOrdered = listItem[listId];
    if (isOrdered === "unordered") {
      return `- ${text}`;
    } else if (isOrdered === "ordered") {
      return `1. ${text}`;
    }
    return text;
  }

  /** 标题（preserveOrder 模式） */
  static convertHeadingOrdered(text: string, attrs: any): string {
    let level = attrs["@_level"] ?? 0;
    if (level === "a" || level === "b") level = 1;
    return text ? `${"#".repeat(Number(level))} ${text}` : text;
  }

  /** 图片（preserveOrder 模式） */
  static convertImageOrdered(text: string, childContent: any[]): string {
    const source = getOrderedChildText(childContent, "source");
    return `![${text}](${source})`;
  }

  /** 附件（preserveOrder 模式） */
  static convertAttachOrdered(childContent: any[]): string {
    const filename = getOrderedChildText(childContent, "filename");
    const resource = getOrderedChildText(childContent, "resource");
    return `[${filename}](${resource})`;
  }

  /** 代码块（preserveOrder 模式） */
  static convertCodeOrdered(text: string, childContent: any[]): string {
    const language = getOrderedChildText(childContent, "language");
    return `\`\`\`${language}\r\n${text}\`\`\``;
  }

  /** 列表（preserveOrder 模式） */
  static convertListItemOrdered(text: string, attrs: any, listItem: Record<string, string>): string {
    const listId = attrs["@_list-id"];
    const isOrdered = listItem[listId];
    if (isOrdered === "unordered") {
      return `- ${text}`;
    } else if (isOrdered === "ordered") {
      return `1. ${text}`;
    }
    return text;
  }

  /** 表格（preserveOrder 模式） */
  static convertTableOrdered(childContent: any[]): string {
    const content = getOrderedChildText(childContent, "content");
    if (!content) return "";

    const nl = "\r\n";
    const tableData = JSON.parse(content);
    const colCount = tableData.widths.length;
    const tableDataArr: string[][] = [];
    let currentLine: string[] = [];

    for (const cell of tableData.cells) {
      const value = cell.value ?? "";
      const cellValue = encodeStringToMd(value);
      currentLine.push(cellValue);
      if (currentLine.length === colCount) {
        tableDataArr.push(currentLine);
        currentLine = [];
      }
    }

    // 如果只有一行，添加空白 title 行
    if (tableDataArr.length === 1) {
      tableDataArr.unshift(Array(colCount).fill(" "));
      tableDataArr.splice(1, 0, Array(colCount).fill("-"));
    } else if (tableDataArr.length > 1) {
      tableDataArr.splice(1, 0, Array(colCount).fill("-"));
    }

    let result = "";
    for (const line of tableDataArr) {
      result += "|";
      for (const cell of line) {
        result += ` ${cell} |`;
      }
      result += nl;
    }
    return result;
  }

  /**
   * 从子元素中获取文本内容
   */
  static getChildText(element: any, key: string = "text"): string {
    if (!element) return "";

    // fast-xml-parser 将子元素解析为属性
    // 需要遍历查找包含 key 的属性
    for (const [k, v] of Object.entries(element)) {
      if (k.includes(key)) {
        if (typeof v === "string") return v;
        if (typeof v === "object" && v !== null) {
          // 可能是 { "#text": "content" } 形式
          return (v as any)["#text"] ?? "";
        }
      }
    }
    return "";
  }
}

/**
 * 从 preserveOrder 模式的子元素数组中获取指定标签的文本内容
 */
function getOrderedChildText(children: any[], key: string): string {
  if (!children || !Array.isArray(children)) return "";
  for (const child of children) {
    if (child[key] !== undefined) {
      const inner = child[key];
      // inner 可能是数组，包含 { "#text": "..." }
      if (Array.isArray(inner)) {
        for (const item of inner) {
          if (item["#text"] !== undefined) return String(item["#text"]);
        }
        return "";
      }
      if (typeof inner === "string") return inner;
      return "";
    }
  }
  return "";
}

/**
 * 将字符串转义防止 Markdown 识别错误
 */
function encodeStringToMd(original: string): string {
  if (!original || original === " ") return original;

  original = original.replace(/\\/g, "\\\\");
  original = original.replace(/\*/g, "\\*");
  original = original.replace(/_/g, "\\_");
  original = original.replace(/#/g, "\\#");
  original = original.replace(/&/g, "&amp;");
  original = original.replace(/</g, "&lt;");
  original = original.replace(/>/g, "&gt;");
  original = original.replace(/\u201c/g, "&quot;"); // "
  original = original.replace(/'/g, "&apos;");
  original = original.replace(/\t/g, "&emsp;");
  original = original.replace(/\r\n/g, "<br>");
  original = original.replace(/\n\r/g, "<br>");
  original = original.replace(/\r/g, "<br>");
  original = original.replace(/\n/g, "<br>");

  return original;
}

// ==================== JSON 转换 ====================

/**
 * JSON 笔记转 Markdown 的转换器
 */
class JsonConvert {
  /** 获取通常文本 */
  private getCommonText(content: any): string {
    let allText = "";
    const fiveContents = content?.["5"];
    if (fiveContents && Array.isArray(fiveContents)) {
      const sevenContents = fiveContents[0]?.["7"];
      if (!sevenContents) return allText;
      for (const sevenContent of sevenContents) {
        let text = sevenContent["8"] ?? "";
        const textAttrs = sevenContent["9"];
        if (text && textAttrs) {
          text = this.convertTextAttribute(text, textAttrs);
        }
        allText += text;
      }
    }
    return allText;
  }

  /** 文本属性（粗体、斜体） */
  private convertTextAttribute(text: string, textAttrs: any[]): string {
    if (Array.isArray(textAttrs) && textAttrs.length > 0 && text) {
      for (const attr of textAttrs) {
        if (attr["2"] === "b") {
          text = `**${text}**`;
        } else if (attr["2"] === "i") {
          text = `*${text}*`;
        }
      }
    }
    return text;
  }

  /** 正常文本、粗体、斜体、删除线、链接 */
  convertText(content: any): string {
    let allText = "";
    const oneFiveContents = content?.["5"];
    if (!oneFiveContents) return allText;

    for (const oneFiveContent of oneFiveContents) {
      const twoFiveContents = oneFiveContent?.["5"];
      const textType = oneFiveContent?.["6"];
      const sevenContents = oneFiveContent?.["7"];

      let text = "";

      if (sevenContents && !twoFiveContents) {
        for (const sevenContent of sevenContents) {
          let raw = sevenContent["8"] ?? "";
          const textAttrs = sevenContent["9"];
          if (raw && textAttrs) {
            raw = this.convertTextAttribute(raw, textAttrs);
          }
          text += raw;
        }
      } else if (textType === "li" && twoFiveContents) {
        const sourceText = this.getCommonText(oneFiveContent);
        const fourContents = oneFiveContent?.["4"];
        if (fourContents) {
          const hf = fourContents.hf;
          text = `[${sourceText}](${hf})`;
        }
      }

      if (text) allText += text;
    }
    return allText;
  }

  /** 标题 */
  convertH(content: any): string {
    const typeName = content?.["4"]?.["l"];
    let text = this.getCommonText(content);
    if (text && typeName) {
      const levelStr = typeName.replace("h", "");
      const level = parseInt(levelStr);
      text = `${"#".repeat(level)} ${text}`;
    }
    return text;
  }

  /** 图片 */
  convertIm(content: any): string {
    const imageUrl = content["4"]["u"];
    return `![](${imageUrl})`;
  }

  /** 附件 */
  convertA(content: any): string {
    const fn = content["4"]["fn"];
    const fl = content["4"]["re"];
    return `[${fn}](${fl})`;
  }

  /** 代码块 */
  convertCd(content: any): string {
    const language = content?.["4"]?.["la"] ?? "";
    const codes: any[] = content?.["5"] ?? [];
    let codeBlock = "";
    for (const code of codes) {
      const text = this.getCommonText(code);
      codeBlock += text + "\n";
    }
    return `\`\`\`${language}\r\n${codeBlock}\`\`\``;
  }

  /** 高亮块 */
  convertLa(content: any): string {
    const lines: any[] = content?.["5"] ?? [];
    let highlightBlock = "";
    for (const line of lines) {
      const text = this.getCommonText(line);
      highlightBlock += text + "\n";
    }
    return `\`\`\`\r\n${highlightBlock}\`\`\``;
  }

  /** 引用 */
  convertQ(content: any): string {
    const qTextList = content["5"];
    let text = "";
    for (const qTextDict of qTextList) {
      let qText = this.getCommonText(qTextDict);
      qText = qText.replace(/\n/g, "");
      text += `> ${qText}\n`;
    }
    return text;
  }

  /** 列表 */
  convertL(content: any): string {
    const text = this.getCommonText(content);
    const isOrdered = content?.["4"]?.["lt"];
    if (isOrdered === "unordered") {
      const level = content?.["4"]?.["ll"] ?? 1;
      return "\t".repeat(level - 1) + `- ${text}`;
    } else if (isOrdered === "ordered") {
      return `1. ${text}`;
    }
    return text;
  }

  /** 表格 */
  convertT(content: any): string {
    const nl = "\r\n";
    const trList = content["5"];
    let tableLines = "";

    for (let index = 0; index < trList.length; index++) {
      const tc = trList[index];
      const tableContentList = tc["5"];
      const tableContentLen = tableContentList.length;
      let tableLine: string;

      if (index === 1) {
        tableLine = "| -- ".repeat(tableContentLen) + "|\n| ";
      } else {
        tableLine = "| ";
      }

      for (const tableContent of tableContentList) {
        const tableTextList = tableContent?.["5"]?.[0]?.["5"]?.[0]?.["7"];
        const tableText = tableTextList ? tableTextList[0]["8"] : " ";
        tableLine = tableLine + tableText + " | ";
      }
      tableLines = tableLines + tableLine + nl;
    }
    return tableLines;
  }
}

// ==================== 主转换类 ====================

/**
 * 有道云笔记内容转换为 Markdown
 */
export class YoudaoNoteConvert {
  /**
   * 转换 HTML 为 Markdown
   */
  static convertHtmlToMarkdown(filePath: string): void {
    const content = readFileSync(filePath, "utf-8");
    const turndownService = new TurndownService();
    const newContent = turndownService.turndown(content);

    const base = filePath.slice(0, filePath.lastIndexOf("."));
    const newFilePath = base + MARKDOWN_SUFFIX;
    renameSync(filePath, newFilePath);
    writeFileSync(newFilePath, newContent, "utf-8");
  }

  /**
   * 转换 XML 为 Markdown
   * @returns 是否转换成功
   */
  static convertXmlToMarkdown(filePath: string): boolean {
    const base = filePath.slice(0, filePath.lastIndexOf("."));
    const newFilePath = base + MARKDOWN_SUFFIX;

    // 如果文件为空
    if (statSync(filePath).size === 0) {
      renameSync(filePath, newFilePath);
      return false;
    }

    const newContent = YoudaoNoteConvert.convertXmlToMarkdownContent(filePath);
    renameSync(filePath, newFilePath);
    writeFileSync(newFilePath, newContent, "utf-8");
    return true;
  }

  /**
   * 内部方法：将 XML 文件转为 Markdown 内容字符串
   * 使用 preserveOrder 模式保持 XML 元素的文档顺序
   */
  static convertXmlToMarkdownContent(filePath: string): string {
    const xmlContent = readFileSync(filePath, "utf-8");

    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
      preserveOrder: true,
      trimValues: false,
    });
    const parsed = parser.parse(xmlContent);

    // preserveOrder 模式下，parsed 是数组
    // 找到 note 根元素
    const noteNode = parsed.find((n: any) => n.note);
    if (!noteNode) return "";
    const noteChildren = noteNode.note;

    // 找 head 和 body
    const headNode = noteChildren.find((n: any) => n.head);
    const bodyNode = noteChildren.find((n: any) => n.body);
    if (!bodyNode) return "";

    // 解析 list-item 的 id 与 type 对应关系
    const listItem: Record<string, string> = {};
    if (headNode) {
      for (const child of headNode.head) {
        if (child.list !== undefined) {
          const attrs = child[":@"] ?? {};
          const id = attrs["@_id"];
          const type = attrs["@_type"];
          if (id && type) listItem[id] = type;
        }
      }
    }

    // 遍历 body 子元素（保持顺序）
    const bodyChildren = bodyNode.body;
    const newContentList: string[] = [];

    for (const child of bodyChildren) {
      // preserveOrder 模式下每个子节点是 { tagName: [...children], ":@": { attrs } }
      const tagName = Object.keys(child).find((k) => k !== ":@");
      if (!tagName) continue;
      // 跳过文本节点（XML 标签间的空白等）
      if (tagName === "#text") continue;

      const childContent = child[tagName]; // 子元素数组
      const attrs = child[":@"] ?? {};

      // 获取 text 子元素的值
      const text = getOrderedChildText(childContent, "text");
      const cleanName = tagName.replace(/-/g, "_");

      let lineContent: string;
      switch (cleanName) {
        case "para":
          lineContent = XmlElementConvert.convertPara(text);
          break;
        case "heading":
          lineContent = XmlElementConvert.convertHeadingOrdered(text, attrs);
          break;
        case "image":
          lineContent = XmlElementConvert.convertImageOrdered(text, childContent);
          break;
        case "attach":
          lineContent = XmlElementConvert.convertAttachOrdered(childContent);
          break;
        case "code":
          lineContent = XmlElementConvert.convertCodeOrdered(text, childContent);
          break;
        case "todo":
          lineContent = XmlElementConvert.convertTodo(text);
          break;
        case "quote":
          lineContent = XmlElementConvert.convertQuote(text);
          break;
        case "horizontal_line":
          lineContent = XmlElementConvert.convertHorizontalLine();
          break;
        case "list_item":
          lineContent = XmlElementConvert.convertListItemOrdered(text, attrs, listItem);
          break;
        case "table":
          lineContent = XmlElementConvert.convertTableOrdered(childContent);
          break;
        default:
          lineContent = text;
      }
      newContentList.push(lineContent);
    }

    return newContentList.join("\r\n\r\n");
  }

  /**
   * 转换 JSON 为 Markdown
   * @returns 新文件路径，失败返回空字符串
   */
  static convertJsonToMarkdown(filePath: string): string {
    const base = filePath.slice(0, filePath.lastIndexOf("."));
    const newFilePath = base + MARKDOWN_SUFFIX;

    // 如果文件为空
    if (statSync(filePath).size === 0) {
      renameSync(filePath, newFilePath);
      return "";
    }

    const newContent = YoudaoNoteConvert.convertJsonToMarkdownContent(filePath);
    writeFileSync(newFilePath, newContent, "utf-8");

    // 删除旧文件
    if (existsSync(filePath) && filePath !== newFilePath) {
      unlinkSync(filePath);
    }
    return newFilePath;
  }

  /**
   * 内部方法：将 JSON 文件转为 Markdown 内容字符串
   */
  static convertJsonToMarkdownContent(filePath: string): string {
    const jsonStr = readFileSync(filePath, "utf-8");
    let jsonData: any;
    try {
      jsonData = JSON.parse(jsonStr);
    } catch (e) {
      console.error("JSON 解析失败:", e);
      return "";
    }

    const jsonContents = jsonData["5"]; // 5 代表内容
    if (!jsonContents || !Array.isArray(jsonContents)) return "";

    const converter = new JsonConvert();
    const newContentList: string[] = [];

    for (const content of jsonContents) {
      const type = content?.["6"]; // 6 代表类型
      let lineContent: string;

      if (type) {
        switch (type) {
          case "h":
            lineContent = converter.convertH(content);
            break;
          case "im":
            lineContent = converter.convertIm(content);
            break;
          case "a":
            lineContent = converter.convertA(content);
            break;
          case "cd":
            lineContent = converter.convertCd(content);
            break;
          case "la":
            lineContent = converter.convertLa(content);
            break;
          case "q":
            lineContent = converter.convertQ(content);
            break;
          case "l":
            lineContent = converter.convertL(content);
            break;
          case "t":
            lineContent = converter.convertT(content);
            break;
          default:
            lineContent = converter.convertText(content);
        }
      } else {
        lineContent = converter.convertText(content);
      }

      if (lineContent) {
        newContentList.push(lineContent);
      }
    }

    return newContentList.join("\r\n\r\n");
  }
}
