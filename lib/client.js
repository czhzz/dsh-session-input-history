window.__ModuleLoader__.load({ id: "dsh-session-input-history", factory: (require) => {
var module = { exports: {} }; var exports = module.exports;
"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client/index.ts
var index_exports = {};
__export(index_exports, {
  apply: () => apply,
  inject: () => inject
});
module.exports = __toCommonJS(index_exports);
var import_react = require("react");

// src/client/history.ts
function messageNodes(chat) {
  const legacy = chat?.legacy?.nodes;
  if (legacy !== void 0) return legacy;
  const order = chat?.order;
  const store = chat?.nodes;
  if (order === void 0 || store === void 0) return [];
  const out = [];
  for (const key of order) {
    const node = store.get(key);
    if (node !== void 0) out.push(node);
  }
  return out;
}
function extractUserMessages(chat) {
  const out = [];
  for (const node of messageNodes(chat)) {
    if (node?.kind !== "user") continue;
    const parts = [];
    for (const block of node.content ?? []) {
      if (block?.type === "text" && typeof block.text === "string" && block.text.trim() !== "") {
        parts.push(block.text);
      }
    }
    const text = parts.join("\n").trim();
    if (text !== "" && out[out.length - 1] !== text) out.push(text);
  }
  return out;
}
function navigateHistory(history, currentIndex, direction) {
  if (history.length === 0) return { index: -1, text: "" };
  if (direction === "up") {
    const next2 = currentIndex === -1 ? history.length - 1 : Math.max(0, currentIndex - 1);
    return { index: next2, text: history[next2] };
  }
  if (currentIndex === -1 || currentIndex >= history.length - 1) return { index: -1, text: "" };
  const next = currentIndex + 1;
  return { index: next, text: history[next] };
}

// src/client/index.ts
var inject = ["slots"];
function focusedComposer() {
  const active = document.activeElement;
  if (active instanceof HTMLElement && active.isContentEditable && active.hasAttribute("data-lexical-editor")) {
    return active;
  }
  return null;
}
function HistoryHook(props) {
  const draft = props.useInput((state) => state.draft) ?? "";
  const chat = props.useConversation((snapshot) => snapshot.views?.get("chat"));
  const derivedRef = (0, import_react.useRef)({
    source: void 0,
    history: []
  });
  if (derivedRef.current.source !== chat) {
    derivedRef.current = { source: chat, history: extractUserMessages(chat) };
  }
  const stateRef = (0, import_react.useRef)({
    history: [],
    index: -1,
    draft: ""
  });
  const actionsRef = (0, import_react.useRef)(props.inputActions);
  const history = derivedRef.current.history;
  stateRef.current.history = history;
  stateRef.current.draft = draft;
  if (stateRef.current.index >= history.length) stateRef.current.index = -1;
  actionsRef.current = props.inputActions;
  (0, import_react.useEffect)(() => {
    const onKeyDown = (event) => {
      if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      if (focusedComposer() === null) return;
      const { history: hist, index, draft: current } = stateRef.current;
      const browsing = index !== -1;
      if (event.key === "ArrowUp") {
        if (!browsing && current !== "") return;
        const next2 = navigateHistory(hist, index, "up");
        if (next2.index === -1) return;
        event.preventDefault();
        event.stopPropagation();
        stateRef.current.index = next2.index;
        actionsRef.current.setDraft(next2.text);
        return;
      }
      if (!browsing) return;
      event.preventDefault();
      event.stopPropagation();
      const next = navigateHistory(hist, index, "down");
      stateRef.current.index = next.index;
      actionsRef.current.setDraft(next.text);
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, []);
  return null;
}
function apply(ctx) {
  ctx.slots.inject(
    "conversation.input.left",
    () => ctx.slots.register(
      {
        name: "conversation.input.left",
        id: "dsh-session-input-history",
        order: 0
      },
      HistoryHook
    )
  );
}
return module.exports; } });
