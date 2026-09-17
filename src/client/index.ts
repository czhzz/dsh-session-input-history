// dsh-session-input-history — client 半侧（会话隔离的输入历史导航）。
//
// 在对话输入框中按 ↑/↓ 方向键遍历当前会话发送过的消息（shell history 式）。
//
// 实现要点（对齐 dsh 0.1.6-alpha 一代的公开契约）：
//  - 通过 conversation.input.left slot 挂一个不可见组件；该 slot 是 session
//    scope，框架按 scope 注入标准 props：useInput / useConversation /
//    inputActions；
//  - 历史来源是 chat 视图快照（ConversationViewSnapshotMap 的 'chat' 槽）。
//    视图快照按会话隔离，因此历史天然是「当前会话」的；
//  - 草稿读写全部走公开面：useInput 读 draft，inputActions.setDraft 写回。
//    旧版那套「原生 setter 改 textarea.value + 派发 input 事件」的受控组件
//    hack 不再需要——新版 composer 是 Lexical 编辑器，也不再是 textarea；
//  - 键盘接管：新版的 ComposerKeyboard 是包内私有面（契约明确写了不跨插件
//    边界），插件拿不到官方键盘仲裁，因此在 document 捕获阶段自行接管方向键，
//    用 composer 的 data-lexical-editor 标记确认焦点确实在输入框里。
//
// 纯逻辑（历史提取 + 导航状态机）在 ./history.ts，单测直接加载那个模块。

import type { Context } from '@deepseek-ai/cordis'
import { useEffect, useRef } from 'react'

import { extractUserMessages, navigateHistory, type ChatSnapshotLike } from './history.ts'

export const inject = ['slots']

/** 会话快照中本插件读取的部分。 */
interface ConversationLike {
  views?: { get: (target: string) => unknown }
}

/** 输入状态中本插件读取的部分。 */
interface InputStateLike {
  draft?: string
}

/** 公开输入动作面中本插件使用的方法。 */
interface InputActionsLike {
  setDraft: (text: string) => void
}

/** 当前聚焦的 composer 编辑器；新版 composer 是 Lexical 的 contenteditable。 */
function focusedComposer(): HTMLElement | null {
  const active = document.activeElement
  if (
    active instanceof HTMLElement &&
    active.isContentEditable &&
    active.hasAttribute('data-lexical-editor')
  ) {
    return active
  }
  return null
}

// ---- 组件：输入框工具行左端的不可见 hook ----

interface HistoryHookProps {
  useInput: (selector: (state: InputStateLike) => unknown) => unknown
  useConversation: (selector: (snapshot: ConversationLike) => unknown) => unknown
  inputActions: InputActionsLike
}

/** 不渲染任何内容，仅订阅会话快照 + 输入状态并接管方向键。 */
function HistoryHook(props: HistoryHookProps): null {
  const draft = (props.useInput((state) => state.draft) as string | undefined) ?? ''
  const chat = props.useConversation((snapshot) => snapshot.views?.get('chat')) as
    | ChatSnapshotLike
    | undefined

  // 快照引用变化时才重新提取，避免每次重渲染都铺一遍节点。
  const derivedRef = useRef<{ source: unknown; history: string[] }>({
    source: undefined,
    history: [],
  })
  if (derivedRef.current.source !== chat) {
    derivedRef.current = { source: chat, history: extractUserMessages(chat) }
  }

  // 键盘监听只挂一次，用 ref 读取最新状态与动作面。
  const stateRef = useRef<{ history: string[]; index: number; draft: string }>({
    history: [],
    index: -1,
    draft: '',
  })
  const actionsRef = useRef(props.inputActions)

  const history = derivedRef.current.history
  stateRef.current.history = history
  stateRef.current.draft = draft
  // 历史变短（切会话）时丢弃越界的浏览位置。
  if (stateRef.current.index >= history.length) stateRef.current.index = -1
  actionsRef.current = props.inputActions

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return
      // 组合键（选择、按词移动等）保持原生行为，不接管。
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
      if (focusedComposer() === null) return

      const { history: hist, index, draft: current } = stateRef.current
      const browsing = index !== -1

      if (event.key === 'ArrowUp') {
        // 接管条件：正在浏览（任意草稿），或未浏览但草稿为空。
        if (!browsing && current !== '') return
        const next = navigateHistory(hist, index, 'up')
        if (next.index === -1) return // 无历史：保持原生行为
        event.preventDefault()
        event.stopPropagation()
        stateRef.current.index = next.index
        actionsRef.current.setDraft(next.text)
        return
      }

      // ArrowDown：仅浏览中接管。
      if (!browsing) return
      event.preventDefault()
      event.stopPropagation()
      const next = navigateHistory(hist, index, 'down')
      stateRef.current.index = next.index
      actionsRef.current.setDraft(next.text)
    }

    document.addEventListener('keydown', onKeyDown, true)
    return () => document.removeEventListener('keydown', onKeyDown, true)
  }, [])

  return null
}

// ---- 入口 ----

export function apply(ctx: Context) {
  // 注册输入框工具行左端的不可见 hook（借 session scope 拿标准 props）。
  ctx.slots.inject('conversation.input.left', () =>
    ctx.slots.register(
      {
        name: 'conversation.input.left',
        id: 'dsh-session-input-history',
        order: 0,
      },
      HistoryHook,
    ),
  )
}
