# dsh-session-input-history

[![npm](https://img.shields.io/npm/v/dsh-session-input-history)](https://www.npmjs.com/package/dsh-session-input-history)
[![license](https://img.shields.io/npm/l/dsh-session-input-history)](./LICENSE)
[![node](https://img.shields.io/node/v/dsh-session-input-history)](https://nodejs.org)
[![GitHub stars](https://img.shields.io/github/stars/czhzz/dsh-session-input-history)](https://github.com/czhzz/dsh-session-input-history)

DSH **会话隔离**的输入历史导航插件（纯 client）：对话输入框中按 **↑/↓ 方向键**遍历**当前会话**发送过的消息（shell history 式交互）。

> 与全局历史插件的区别：历史严格限定在**当前会话**内。切换到别的会话，↑ 拿到的就是那个会话自己的历史；新会话从空白开始，不会被其他会话或工作区的输入污染。历史也不落盘。

## 安装

**方式一：从 npm 安装（推荐）**

```sh
dsh plugin --profile web add dsh-session-input-history
```

> 发布到 npm 的 tarball 已包含构建产物（`lib/`），安装即用，**不需要**授权构建脚本。

**方式二：从 GitHub 安装**

```sh
dsh plugin --profile web add github:czhzz/dsh-session-input-history
```

> 适合跟进未发布的提交。建议锁定 commit（`github:czhzz/dsh-session-input-history#<sha>`）。

## 交互

| 按键 | 行为 |
|---|---|
| **↑** | 草稿为空时 → 载入最新一条历史消息；再次按 ↑ 继续向前（更旧） |
| **↓** | 浏览中向后（更新）；到最新一条后再按 ↓ → 清空输入框（退出浏览） |
| 浏览中编辑 | 正常编辑，不受影响 |
| 浏览中发送 | 发送当前载入的消息 |

- 历史范围：**当前会话**发送过的用户文本消息（去空白、相邻重复去重）
- 焦点不在输入框时不接管方向键；带 Ctrl/Alt/Cmd/Shift 的组合键一律不接管，保持原生行为（选词、移动光标等）
- 无任何 UI 常驻（纯键盘）

## 验证

```sh
# 1) 配置树里出现插件行
dsh --profile web --dump-config | grep dsh-session-input-history

# 2) 浏览器里：发两条消息 → 清空输入框 → 按 ↑ 应回显最新一条，再按 ↑ 回显更旧一条
```

## 开发

```sh
npm install
npm run build        # host: tsc → lib/index.js；client: esbuild → lib/client.js
npm test             # 纯函数单测（历史提取 + 导航状态机）
```

结构：

```
src/
├── index.ts         # host 半侧（空 apply，无 host 行为）
└── client/
    ├── history.ts   # 纯逻辑：chat 快照 → 历史数组、方向键状态机（无框架依赖，可直接单测）
    └── index.ts     # client 接线：slot 注册 + 标准 props 订阅 + document 捕获方向键
scripts/build.mjs    # esbuild 打包 client（lazy-CJS factory）
```

### 实现注记（对齐 dsh 0.1.6-alpha 一代）

- 挂载点：`conversation.input.left`（session scope 的 list slot），框架按 scope 通过 standard provide channel 注入 `useInput` / `useConversation` / `inputActions`。
- 历史来源：`useConversation` 选出的 chat 视图快照（`ConversationViewSnapshotMap` 的 `'chat'` 槽），取用户消息节点。视图快照本身按会话隔离。
- 草稿读写：`useInput` 读 `draft`，`inputActions.setDraft` 写回——不再操作 DOM 受控组件。
- 键盘：新版 `ComposerKeyboard` 是包内私有面（契约明确不跨插件边界），插件没有官方键盘仲裁，因此在 `document` 捕获阶段接管方向键，用 `data-lexical-editor` 标记确认焦点在 composer（新版 composer 是 Lexical 编辑器，不再是 `textarea`）。

## 卸载

```sh
dsh plugin --profile web remove dsh-session-input-history
```
