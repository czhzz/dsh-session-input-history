// dsh-input-history — client 半侧（输入历史导航）。
//
// 在对话输入框中按 ↑/↓ 方向键遍历当前会话发送过的消息（shell history 式）。
//
// 实现要点：
//  - 通过 conversation.input.left slot 挂一个不可见组件，用框架注入的
//    useSession hook 订阅会话快照（session.nodes），提取 kind==='user'
//    的 text block 作为历史数组；
//  - 组件挂载时在 document 上挂捕获阶段 keydown 监听，命中 composer
//    textarea 且 ↑/↓ 满足接管条件时阻止默认行为并写回草稿；
//  - 写回草稿直接操作 textarea.value（原生 setter + input 事件），
//    让 React 受控组件同步（官方 setDraft 不跨插件边界）。
//
// 类型：esbuild 只转译不查类型；本文件用宽松类型避免依赖缺失的 client 类型包。

import type { Context } from 'cordis'
import type { JSX } from 'react'
import { useEffect, useRef } from 'react'

export const inject = ['slots']

/** 会话快照的最小形状（宽松类型）。 */
interface UserMsgNode {
  kind: 'user'
  content: readonly { type?: string; text?: string }[]
}

interface SessionSnapshotLike {
  nodes?: readonly UserMsgNode[]
}

// ---- 历史提取（纯函数，可单测） ----

/** 从会话快照提取用户发送过的文本消息（去空白、去重、按时间顺序）。 */
export function extractUserMessages(session: SessionSnapshotLike | undefined): string[] {
  if (!session?.nodes) return []
  const out: string[] = []
  for (const node of session.nodes) {
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

// ---- 历史导航状态机（纯函数，可单测） ----

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

// ---- 键盘处理 ----

/** 找到 composer 的 textarea（会话输入框）。 */
function findComposerTextarea(): HTMLTextAreaElement | null {
  // composer 的 textarea：优先按 placeholder 特征找，退化为会话区域内的 textarea。
  const candidates = document.querySelectorAll<HTMLTextAreaElement>('textarea')
  for (const el of candidates) {
    // 排除设置/搜索等非 composer 的 textarea：composer textarea 通常在
    // 包含 aria-multiline 或特定 class 的容器里。这里用启发式：可见 + 可编辑。
    if (!el.disabled && el.offsetParent !== null) return el
  }
  return candidates[0] ?? null
}

/** 用原生 setter 写 textarea 值并触发 input 事件（React 受控组件同步）。 */
function setDraftText(textarea: HTMLTextAreaElement, text: string): void {
  const proto = Object.getPrototypeOf(textarea) as HTMLTextAreaElement
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set
  if (setter !== undefined) {
    setter.call(textarea, text)
  } else {
    textarea.value = text
  }
  textarea.dispatchEvent(new Event('input', { bubbles: true }))
}

/** 光标是否在首行（用于 ↑ 接管条件）。 */
function caretAtFirstLine(textarea: HTMLTextAreaElement): boolean {
  const caret = textarea.selectionStart ?? 0
  const text = textarea.value
  const firstNewline = text.indexOf('\n')
  return firstNewline === -1 ? caret <= text.length : caret <= firstNewline
}

/** 光标是否在末尾（用于 ↓ 接管条件）。 */
function caretAtEnd(textarea: HTMLTextAreaElement): boolean {
  const caret = textarea.selectionEnd ?? 0
  return caret >= textarea.value.length
}

// ---- 组件：输入框左端不可见 hook（借 slot 生命周期拿 useSession） ----

interface HistoryHookProps {
  useSession: (selector: (s: unknown) => unknown) => unknown
}

/** 输入框左端占位（不渲染可见内容，仅借会话 slot 生命周期订阅快照 + 挂键盘监听）。 */
function HistoryHook(props: HistoryHookProps): JSX.Element | null {
  const session = props.useSession((s) => s) as SessionSnapshotLike | undefined
  const stateRef = useRef<{ history: string[]; index: number }>({ history: [], index: -1 })

  // 会话变化时刷新历史。
  const history = extractUserMessages(session)
  stateRef.current.history = history
  if (stateRef.current.index >= history.length) stateRef.current.index = -1

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return
      const textarea = findComposerTextarea()
      if (!textarea) return
      if (document.activeElement !== textarea) return // 焦点不在输入框时不接管

      const { history: hist, index } = stateRef.current
      const browsing = index !== -1
      const draft = textarea.value

      if (e.key === 'ArrowUp') {
        // 接管条件：正在浏览（任意光标位置），或未浏览但草稿为空且光标在首行。
        const takeOver = browsing || (draft === '' && caretAtFirstLine(textarea))
        if (!takeOver) return
        e.preventDefault()
        e.stopPropagation()
        const next = navigateHistory(hist, index, 'up')
        stateRef.current.index = next.index
        if (next.index !== -1) {
          setDraftText(textarea, next.text)
          textarea.setSelectionRange(next.text.length, next.text.length)
        }
        return
      }

      // ArrowDown：仅浏览中接管。
      if (e.key === 'ArrowDown') {
        if (!browsing) return
        e.preventDefault()
        e.stopPropagation()
        const next = navigateHistory(hist, index, 'down')
        stateRef.current.index = next.index
        setDraftText(textarea, next.text)
        textarea.setSelectionRange(next.text.length, next.text.length)
      }
    }
    document.addEventListener('keydown', onKeyDown, true)
    return () => document.removeEventListener('keydown', onKeyDown, true)
  }, [])

  return null
}

// ---- 入口 ----

export function apply(ctx: Context) {
  // 注册输入框工具行左端的不可见 hook（仅借会话 slot 生命周期）。
  ctx.slots.inject('conversation.input.left', () =>
    ctx.slots.register(
      {
        name: 'conversation.input.left',
        id: 'dsh-input-history-hook',
        inject: () => ({}),
      },
      HistoryHook,
    ),
  )
}
