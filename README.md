# youdaonote-pull (TypeScript/Bun 版)

有道云笔记导出工具 - 将所有笔记下载到本地并转换为 Markdown 格式。

基于 [youdaonote-pull](https://github.com/DeppWang/youdaonote-pull) Python 版本改写，使用 TypeScript + Bun 运行时。

## 功能

- 将所有笔记（文件）按原格式下载到本地
- 将有道云笔记的 XML / JSON / HTML 格式笔记自动转换为 Markdown
- 下载有道云图床图片到本地，或上传到 [SM.MS](https://sm.ms) 图床
- 下载有道云笔记附件到本地
- 增量更新：只导出新增、修改或未导出的笔记

## 环境要求

- [Bun](https://bun.sh/) >= 1.0

## 使用步骤

### 1. 安装 Bun

```bash
# macOS / Linux
curl -fsSL https://bun.sh/install | bash

# Windows
powershell -c "irm bun.sh/install.ps1 | iex"
```

### 2. 克隆项目并安装依赖

```bash
git clone <repo-url>
cd youdaonote-pull-bun
bun install
```

### 3. 设置 Cookies

编辑 `cookies.json`，填入有道云笔记的 Cookies：

```json
{
  "cookies": [
    ["YNOTE_CSTK", "你的CSTK值", ".note.youdao.com", "/"],
    ["YNOTE_LOGIN", "你的LOGIN值", ".note.youdao.com", "/"],
    ["YNOTE_SESS", "你的SESS值", ".note.youdao.com", "/"]
  ]
}
```

**获取方式：**

1. 在浏览器（如 Chrome）中登录 [有道云笔记](https://note.youdao.com/)
2. 打开 DevTools（F12），切换到 Network 标签
3. 找到主请求，复制 Cookie 中对应字段的值

### 4. 设置配置文件

编辑 `config.json`：

```json
{
  "local_dir": "",
  "ydnote_dir": "",
  "smms_secret_token": "",
  "is_relative_path": true
}
```

| 参数 | 说明 |
|------|------|
| `local_dir` | 本地存放导出文件的文件夹（绝对路径），不填则默认为当前目录下的 `youdaonote` 文件夹 |
| `ydnote_dir` | 有道云笔记指定导出的顶层文件夹名，不填则导出所有文件 |
| `smms_secret_token` | [SM.MS](https://sm.ms) 的 Secret Token，用于上传图片到 SM.MS 图床，不填则下载到本地 |
| `is_relative_path` | 图片/附件是否使用相对路径，`true` 为相对路径（适配 Obsidian），`false` 为绝对路径 |

### 5. 运行

```bash
bun run src/index.ts
```

或使用 npm scripts：

```bash
bun start
```

## 多次导出

再次运行相同命令即可。脚本会根据有道云笔记文件的最后修改时间判断是否需要更新，只会导出新增或修改的笔记。

## 开发

```bash
# 运行测试
bun test

# TypeScript 类型检查
bun run node_modules/.bin/tsc --noEmit

# 监听模式开发
bun dev

# 编译为单文件可执行程序
bun run compile
```

## 项目结构

```
src/
├── index.ts            # 主入口
├── pull.ts             # 主流程控制（递归遍历、增量更新）
├── core/
│   ├── api.ts          # 有道云笔记 API 封装
│   ├── convert.ts      # 格式转换（XML/JSON/HTML → Markdown）
│   ├── image.ts        # 图片/附件下载与上传
│   ├── logger.ts       # 日志模块
│   └── utils.ts        # 通用工具函数
└── types/
    └── index.ts        # TypeScript 类型定义
```

## 技术栈

- **运行时**: [Bun](https://bun.sh/)
- **语言**: TypeScript
- **XML 解析**: [fast-xml-parser](https://github.com/NaturalIntelligence/fast-xml-parser)
- **HTML → Markdown**: [Turndown](https://github.com/mixmark-io/turndown)
- **HTTP**: Bun 内置 fetch
- **测试**: bun:test

## 注意事项

1. 脚本完全本地运行，不用担心数据安全
2. 不要将 `cookies.json` 提交到 Git 仓库
3. 有道云笔记接口有频率限制，如遇到错误请等待后重试
4. 有道云笔记和本地不要同时修改同一个文件，可能导致本地修改丢失

## 致谢

- 原始项目：[DeppWang/youdaonote-pull](https://github.com/DeppWang/youdaonote-pull)

## License

MIT
