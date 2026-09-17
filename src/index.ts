// dsh-session-input-history — host 半侧（无 host 行为）。
//
// 本插件是纯 client 插件：所有能力（方向键历史导航）都在浏览器端实现。
// host 半侧为空 apply，仅使插件出现在 loader 树中，client bundle 由
// package.json 的 dsh.client 声明发现。

export const name = 'dsh-session-input-history'

export function apply() {
  // 无 host 行为。
}
