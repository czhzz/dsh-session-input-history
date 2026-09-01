# dsh-input-history

DSH 输入历史导航插件（纯 client）：对话输入框中按 **↑/↓ 方向键**遍历当前会话发送过的消息（shell history 式交互）。

## 安装

**方式一：从 GitHub 安装（推荐）**

```sh
dsh plugin --profile web add github:czhzz/dsh-input-history
```

> git 安装拉取的是源码，首次 `add` 需要为该包授权构建脚本（pnpm ≥10 默认拒绝运行 git 依赖的 `prepare`）。首次失败时，把 pnpm 提示的包键复制进 profile 的 `pnpm-workspace.yaml`：
>
> ```yaml
> allowBuilds:
>   dsh-input-history: true
> ```
>
> 然后重新执行 `add`。建议锁定 commit（`github:czhzz/dsh-input-history#<sha>`）。

**方式二：从 npm 安装（发布后）**

```sh
dsh plugin --profile web add dsh-input-history
```

## 交互

| 按键 | 行为 |
|---|---|
| **↑** | 光标在首行且草稿为空 → 载入最新一条历史消息；再次按 ↑ 继续向前（更旧） |
| **↓** | 浏览中向后（更新）；到最新一条后再按 ↓ → 清空输入框（退出浏览） |
| 浏览中编辑 | 正常编辑，不受影响 |
| 浏览中发送 | 发送当前载入的消息 |

- 历史范围：**当前会话**发送过的用户文本消息（去空白、相邻重复去重）
- 焦点不在输入框时不接管方向键
- 无任何 UI 常驻（纯键盘）

## 验证

```sh
# 1) 配置树里出现插件行
dsh --profile web --dump-config | grep dsh-input-history

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
└── client/index.ts  # client 半侧：useSession 订阅快照 + document 捕获 keydown
scripts/build.mjs    # esbuild 打包 client（lazy-CJS factory）
```

## 卸载

```sh
dsh plugin --profile web remove dsh-input-history
```
