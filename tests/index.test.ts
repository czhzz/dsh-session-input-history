// dsh-input-history 纯函数单测。

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { extractUserMessages, navigateHistory } from '../src/client/index.ts'

test('extractUserMessages: 提取用户文本消息', () => {
  const session = {
    nodes: [
      { kind: 'user', content: [{ type: 'text', text: '你好' }] },
      { kind: 'assistant', content: [{ type: 'text', text: '回复' }] },
      { kind: 'user', content: [{ type: 'text', text: '第二条' }, { type: 'tool-result', content: [] }] },
    ],
  }
  assert.deepEqual(extractUserMessages(session as never), ['你好', '第二条'])
})

test('extractUserMessages: 跳过空白与纯工具消息', () => {
  const session = {
    nodes: [
      { kind: 'user', content: [{ type: 'text', text: '   ' }] },
      { kind: 'user', content: [{ type: 'tool-call', name: 'bash' }] },
      { kind: 'user', content: [{ type: 'text', text: '有效' }] },
    ],
  }
  assert.deepEqual(extractUserMessages(session as never), ['有效'])
})

test('extractUserMessages: 相邻重复消息去重', () => {
  const session = {
    nodes: [
      { kind: 'user', content: [{ type: 'text', text: '重发' }] },
      { kind: 'user', content: [{ type: 'text', text: '重发' }] },
      { kind: 'user', content: [{ type: 'text', text: '别的' }] },
    ],
  }
  assert.deepEqual(extractUserMessages(session as never), ['重发', '别的'])
})

test('extractUserMessages: 空/缺失快照', () => {
  assert.deepEqual(extractUserMessages(undefined), [])
  assert.deepEqual(extractUserMessages({}), [])
  assert.deepEqual(extractUserMessages({ nodes: [] } as never), [])
})

test('navigateHistory: 空历史不导航', () => {
  assert.deepEqual(navigateHistory([], -1, 'up'), { index: -1, text: '' })
  assert.deepEqual(navigateHistory([], -1, 'down'), { index: -1, text: '' })
})

test('navigateHistory: up 从基线进入最新一条', () => {
  const hist = ['a', 'b', 'c']
  assert.deepEqual(navigateHistory(hist, -1, 'up'), { index: 2, text: 'c' })
})

test('navigateHistory: up 连续向前', () => {
  const hist = ['a', 'b', 'c']
  assert.deepEqual(navigateHistory(hist, 2, 'up'), { index: 1, text: 'b' })
  assert.deepEqual(navigateHistory(hist, 1, 'up'), { index: 0, text: 'a' })
  assert.deepEqual(navigateHistory(hist, 0, 'up'), { index: 0, text: 'a' }) // 已到最旧，停留
})

test('navigateHistory: down 向后到最新后退出', () => {
  const hist = ['a', 'b', 'c']
  assert.deepEqual(navigateHistory(hist, 0, 'down'), { index: 1, text: 'b' })
  assert.deepEqual(navigateHistory(hist, 2, 'down'), { index: -1, text: '' })
  assert.deepEqual(navigateHistory(hist, -1, 'down'), { index: -1, text: '' })
})

test('navigateHistory: 最新一条 down 直接退出', () => {
  const hist = ['only']
  assert.deepEqual(navigateHistory(hist, 0, 'down'), { index: -1, text: '' })
})
