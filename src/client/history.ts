// dsh-session-input-history — 历史提取与导航状态机（纯逻辑，无框架依赖）。
//
// 本模块不 import 任何运行时框架，因此单测可以直接加载它，不必先装 react。
// 快照形状用宽松类型描述：esbuild 只转译不查类型，且 client 类型包由 shell
// 在运行时提供，构建期不可见。

// ---- 快照形状（宽松类型，只描述本插件读取的字段） ----

/** 消息内容块的最小形状。 */
export interface ContentBlockLike {
  type?: string
  text?: string
}

/** 会话消息节点的最小形状。 */
export interface MessageNodeLike {
  kind?: string
  content?: readonly ContentBlockLike[]
}

/** chat 视图快照的最小形状。 */
export interface ChatSnapshotLike {
  /** 兼容投影：已按时间顺序铺平的消息节点。 */
  legacy?: { nodes?: readonly MessageNodeLike[] }
  /** 正式路径：渲染顺序键 + 键控节点读取器。 */
  order?: readonly string[]
  nodes?: { get: (key: string) => MessageNodeLike | undefined }
}

// ---- 历史提取 ----

/** 取出 chat 视图的消息节点序列；优先兼容投影，缺失时退到 order + nodes.get。 */
function messageNodes(chat: ChatSnapshotLike | undefined): readonly MessageNodeLike[] {
  const legacy = chat?.legacy?.nodes
  if (legacy !== undefined) return legacy
  const order = chat?.order
  const store = chat?.nodes
  if (order === undefined || store === undefined) return []
  const out: MessageNodeLike[] = []
  for (const key of order) {
    const node = store.get(key)
    if (node !== undefined) out.push(node)
  }
  return out
}

/** 从 chat 视图快照提取用户发送过的文本消息（去空白、相邻重复去重、按时间顺序）。 */
export function extractUserMessages(chat: ChatSnapshotLike | undefined): string[] {
  const out: string[] = []
  for (const node of messageNodes(chat)) {
    if (node?.kind !== 'user') continue
    const parts: string[] = []
    for (const block of node.content ?? []) {
      if (block?.type === 'text' && typeof block.text === 'string' && block.text.trim() !== '') {
        parts.push(block.text)
      }
    }
    const text = parts.join('\n').trim()
    if (text !== '' && out[out.length - 1] !== text) out.push(text)
  }
  return out
}

// ---- 历史导航状态机 ----

/**
 * 计算方向键导航后的新状态。
 * @param history - 用户历史消息（时间正序，最新在最后）。
 * @param currentIndex - 当前浏览位置；-1 表示未在浏览（空草稿基线）。
 * @param direction - 'up' 向前（更旧）/ 'down' 向后（更新）。
 * @returns 新位置（-1 = 退出浏览，回空草稿）与对应草稿文本。
 */
export function navigateHistory(
  history: string[],
  currentIndex: number,
  direction: 'up' | 'down',
): { index: number; text: string } {
  if (history.length === 0) return { index: -1, text: '' }
  if (direction === 'up') {
    // 从 -1 或当前位置向前（更旧）。-1 的上一位置 = 最后一条（最新）。
    const next = currentIndex === -1 ? history.length - 1 : Math.max(0, currentIndex - 1)
    return { index: next, text: history[next] }
  }
  // down：向后（更新）。从最后一条再往下 = 退出浏览回空。
  if (currentIndex === -1 || currentIndex >= history.length - 1) return { index: -1, text: '' }
  const next = currentIndex + 1
  return { index: next, text: history[next] }
}
