# YoudaoNoteDump 开发文档

## 项目概述

有道云笔记导出/备份工具（TypeScript/Bun 版），支持将有道云笔记中的所有笔记文件拉取到本地，并自动转换为 Markdown 格式。

## 技术栈

| 技术 | 用途 |
|------|------|
| Bun 1.x | 运行时 & 包管理器 & 测试框架 |
| TypeScript | 开发语言 |
| fast-xml-parser | XML 格式笔记解析 |
| turndown | HTML → Markdown 转换 |
| bun:test | 单元测试 |

## 项目结构

```
src/
├── index.ts              # 主入口，程序启动点
├── pull.ts               # Pull 主流程，递归遍历、下载、转换
├── core/
│   ├── api.ts            # 有道云笔记 API 封装
│   ├── convert.ts        # 格式转换（XML/JSON/HTML → Markdown）
│   ├── image.ts          # 图片/附件下载、SM.MS 图床上传
│   ├── logger.ts         # 日志模块（控制台 + 文件）
│   └── utils.ts          # 通用工具函数
└── types/
    └── index.ts          # 所有类型定义（枚举、接口）
```

## 运行命令

```bash
bun run start      # 运行主程序（拉取笔记）
bun run dev        # 开发模式（watch）
bun test           # 运行测试
bun run build      # 打包为单文件
bun run compile    # 编译为可执行文件
```

## 配置文件

### config.json

```jsonc
{
  "local_dir": "",              // 本地导出路径（绝对路径），空则用默认 ./youdaonote
  "ydnote_dir": "",             // 指定导出的有道云目录名，空则导出全部
  "smms_secret_token": "",      // SM.MS 图床 Token，空则下载图片到本地
  "is_relative_path": true      // 图片/附件是否使用相对路径
}
```

### cookies.json

```jsonc
{
  "cookies": [
    // 格式: [name, value, domain, path]
    ["YNOTE_CSTK", "xxx", ".note.youdao.com", "/"],
    ["YNOTE_LOGIN", "xxx", ".note.youdao.com", "/"],
    ["YNOTE_SESS", "xxx", ".note.youdao.com", "/"]
  ]
}
```

> `YNOTE_CSTK` 是必需字段，用作 API 请求的 CSRF Token。

---

## 核心流程

```
main() → init() → pullDirByIdRecursively()
                        │
                        ├── getDirInfoById()    获取目录列表
                        ├── judgeType()         判断文件格式
                        ├── getFileAction()     决定新增/更新/跳过
                        └── pullFile()          下载 + 转换 + 图片迁移
```

### 文件类型识别逻辑

| 后缀 | 内容开头 | 识别为 |
|------|---------|--------|
| `.md` | - | FileType.MARKDOWN |
| `.note` | `<?xml` | FileType.XML |
| `.note` | `{"` | FileType.JSON |
| `.note` | 其他 | FileType.HTML |
| `.clip` / 空 | `<?xml` | FileType.XML |
| `.clip` / 空 | `{"` | FileType.JSON |
| 其他 | - | FileType.OTHER |

### 转换策略

| 源格式 | 转换方式 | 实现方法 |
|--------|---------|---------|
| XML (.note 新版) | fast-xml-parser 解析 → 逐元素转 MD | `convertXmlToMarkdown()` |
| JSON (.note 新版) | JSON 解析 → 逐节点转 MD | `convertJsonToMarkdown()` |
| HTML (.note 旧版) | Turndown 库直接转换 | `convertHtmlToMarkdown()` |

---

## 有道云笔记 API 接口

### 认证方式

所有请求通过 Cookie 认证，关键字段：
- `YNOTE_CSTK`：CSRF Token，需在 URL query 和 POST body 中携带
- `YNOTE_SESS`：会话标识
- `YNOTE_LOGIN`：登录状态

### API 1: 获取根目录信息

**请求**

```
POST https://note.youdao.com/yws/api/personal/file?method=getByPath&keyfrom=web&cstk={cstk}
Content-Type: application/x-www-form-urlencoded

path=/&entire=true&purge=false&cstk={cstk}
```

**响应 `RootDirInfo`**

```typescript
interface RootDirInfo {
  fileEntry: FileEntry;
}

interface FileEntry {
  id: string;                  // 文件/目录唯一 ID
  name: string;                // 名称
  dir: boolean;                // true=目录, false=文件
  modifyTimeForSort: number;   // 修改时间（秒级时间戳）
  createTimeForSort: number;   // 创建时间（秒级时间戳）
}
```

**响应示例**

```json
{
  "fileEntry": {
    "id": "WEBa1b2c3d4e5f6",
    "name": "",
    "dir": true,
    "modifyTimeForSort": 1717776000,
    "createTimeForSort": 1500000000
  }
}
```

### API 2: 获取目录内容列表

**请求**

```
GET https://note.youdao.com/yws/api/personal/file/{dir_id}?all=true&f=true&len=1000&sort=1&isReverse=false&method=listPageByParentId&keyfrom=web&cstk={cstk}
```

| 参数 | 说明 |
|------|------|
| `dir_id` | 目录 ID（路径参数） |
| `len` | 每页数量，固定 1000 |
| `sort` | 排序方式 |
| `isReverse` | 是否反转 |

**响应 `DirInfo`**

```typescript
interface DirInfo {
  count: number;           // 条目总数
  entries: DirEntry[];     // 条目列表
}

interface DirEntry {
  fileEntry: FileEntry;    // 文件/目录信息
}

interface FileEntry {
  id: string;              // 唯一 ID
  name: string;            // 文件名（含后缀）或目录名
  dir: boolean;            // 是否为目录
  modifyTimeForSort: number;
  createTimeForSort: number;
}
```

**响应示例**

```json
{
  "count": 3,
  "entries": [
    {
      "fileEntry": {
        "id": "WEB1234567890",
        "name": "我的笔记.note",
        "dir": false,
        "modifyTimeForSort": 1717776000,
        "createTimeForSort": 1600000000
      }
    },
    {
      "fileEntry": {
        "id": "WEB0987654321",
        "name": "子目录",
        "dir": true,
        "modifyTimeForSort": 1717700000,
        "createTimeForSort": 1500000000
      }
    }
  ]
}
```

### API 3: 下载文件内容

**请求**

```
POST https://note.youdao.com/yws/api/personal/sync?method=download&keyfrom=web&cstk={cstk}&...
Content-Type: application/x-www-form-urlencoded

fileId={file_id}&version=-1&convert=true&editorType=1&cstk={cstk}
```

| 参数 | 说明 |
|------|------|
| `fileId` | 文件 ID |
| `version` | 版本号，-1 表示最新 |
| `convert` | 是否转换 |
| `editorType` | 编辑器类型 |

**响应**

返回二进制内容（`Response`），即笔记的原始字节流。根据内容前几个字节判断格式：

| 特征 | 格式 |
|------|------|
| 前 5 字节 = `<?xml` | XML 格式笔记 |
| 前 2 字节 = `{"` | JSON 格式笔记 |
| 其他（含 `<div>` 等标签） | HTML 格式笔记 |

---

## 笔记内容格式

### XML 格式（新版 .note）

```xml
<?xml version="1.0" encoding="UTF-8"?>
<note xmlns="http://note.youdao.com" schema-version="1.0.3">
  <head>
    <list id="xxx" type="unordered|ordered"/>
  </head>
  <body>
    <heading level="1|2|3"><text>标题</text></heading>
    <para><text>段落文字</text></para>
    <list-item level="1" list-id="xxx"><text>列表项</text></list-item>
    <image><source>url</source><text>描述</text></image>
    <code><text>代码内容</text><language>java</language></code>
    <quote><text>引用内容</text></quote>
    <horizontal-line/>
    <table><content>JSON表格数据</content></table>
    <attach><filename>文件名</filename><resource>url</resource></attach>
    <todo><text>待办事项</text></todo>
  </body>
</note>
```

支持的内联样式（`<inline-styles>` 内）：
- `<bold>` 粗体
- `<italic>` 斜体
- `<strike>` 删除线
- `<href>` 超链接
- `<color>` 字体颜色
- `<font-size>` 字号

### JSON 格式（新版 .note）

```jsonc
{
  "5": [  // 内容数组
    {
      "6": "h",   // 类型标识
      "4": { "l": "h1" },  // 属性
      "5": [...]  // 子内容
    }
  ]
}
```

| 类型标识 `"6"` | 含义 |
|------|------|
| `"h"` | 标题 |
| `"im"` | 图片 |
| `"a"` | 附件 |
| `"cd"` | 代码块 |
| `"la"` | 高亮块 |
| `"q"` | 引用 |
| `"l"` | 列表 |
| `"t"` | 表格 |
| 无/其他 | 普通文本 |

### HTML 格式（旧版 .note，2017 年前创建）

直接使用 HTML 标签，典型结构：

```html
<div>段落文字</div>
<div><br/></div>
<div><span style="...">带样式文字</span></div>
<div><a href="url">链接</a></div>
<div><hr/></div>
```

---

## SM.MS 图床 API

### 上传图片

```
POST https://sm.ms/api/v2/upload
Headers: Authorization: {smms_secret_token}
Body: FormData { smfile: Blob }
```

**响应类型 `SmmsResponse`**

```typescript
// 上传成功
{ success: true, data: { url: "https://i.loli.net/xxx.png" } }

// 图片重复（返回已有链接）
{ success: false, code: "image_repeated", images: "https://i.loli.net/xxx.png" }

// 频率限制
{ success: false, code: "flood" }

// 其他错误
{ success: false, code?: string }
```

---

## 枚举定义

### FileType

```typescript
enum FileType {
  OTHER = 0,      // 其他类型（不转换，如 pdf、图片等）
  MARKDOWN = 1,   // 原始 Markdown 文件
  XML = 2,        // XML 格式笔记
  JSON = 3,       // JSON 格式笔记
  HTML = 4,       // HTML 格式笔记（早期有道云）
}
```

### FileAction

```typescript
enum FileAction {
  CONTINUE = "跳过",   // 本地已最新
  ADD = "新增",        // 本地不存在
  UPDATE = "更新",     // 云端有更新
}
```

---

## 增量更新策略

通过比较云端 `modifyTimeForSort`（秒级时间戳）和本地文件 `mtime` 判断：
- 云端时间 > 本地 mtime → 更新
- 云端时间 ≤ 本地 mtime → 跳过
- 本地文件不存在 → 新增

下载完成后会用 `utimesSync()` 设置本地文件的 atime 和 mtime 为云端的创建/修改时间。

---

## 开发指南

### 添加新的笔记格式支持

1. 在 `src/types/index.ts` 的 `FileType` 枚举中添加新类型
2. 在 `src/pull.ts` 的 `judgeType()` 中添加识别逻辑
3. 在 `src/core/convert.ts` 中实现 `convertXxxToMarkdown()` 和 `convertXxxToMarkdownContent()` 方法
4. 在 `src/pull.ts` 的 `pullFile()` 中添加转换分支
5. 在 `test/convert.test.ts` 中添加测试用例

### 添加新的 API 接口

1. 在 `src/core/api.ts` 中添加 URL 模板常量
2. 在 `YoudaoNoteApi` 类中实现调用方法
3. 在 `src/types/index.ts` 中定义响应类型接口
4. 更新本文档的 API 接口部分

### 测试

```bash
bun test                    # 运行全部测试
bun test test/convert.test  # 运行指定测试文件
```

测试 fixture 存放在 `test/fixtures/` 目录下，包含各种格式的测试文件及对应的期望 Markdown 输出。
