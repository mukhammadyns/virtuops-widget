# @virtuops/widget-react

## 0.2.1

### Patch Changes

- Fixed the widget being unusable on plain `http://` pages: `crypto.randomUUID` is secure-context only, so the visitor id fell back to a non-UUID value that the API rejected on every request. A valid UUIDv4 is now generated locally, and an invalid id already in `localStorage` is reissued.

  Fixed the ESM build inlining `react-dom/client`, which reached into react-dom internals and broke under React 19. Both `react` and `react-dom` sub-paths are now external.

  Fixed `window.VirtuOpsWidget.init()` being undefined in the CDN build — the bundle overwrote the global with its exports. `init` is now a module export, so it survives in both builds.

  Fixed `<Chat />` from `@virtuops/widget-react` potentially rendering an empty tag: `sideEffects: false` allowed bundlers to drop the import that registers the `<virtuops-chat>` element.

  The bot's `offlineMessage` now shows when a conversation is handed to a human (the backend signals the handoff over SSE), and it is only added when actually configured instead of duplicating the bot's own handoff line.

  A failed message send no longer disappears silently — the visitor sees a system notice instead of a vanished bubble.

- Updated dependencies
  - @virtuops/widget@0.2.1

## 0.2.0

### Minor Changes

- 4a521f7: Added photo lightbox: clicking any image in the chat opens a full-screen preview with navigation arrows, counter, caption, and Esc/click-outside to close.

  Added `theme` prop override: passing `theme="light"`, `theme="dark"`, or `theme="auto"` via `window.VirtuOps`, `VirtuOpsWidget.init()`, web-component attribute, or React `<Chat theme="..." />` now takes priority over the backend config theme.

  Added file/voice attachment support: visitors can upload images, audio, and video directly in the chat; attachments are previewed in the message bubble and forwarded to the AI stream.

  Fixed photos disappearing after page refresh: the history endpoint now restores `segments`, `media`, and `attachments` on reload so previously sent images remain visible.

### Patch Changes

- Updated dependencies [4a521f7]
  - @virtuops/widget@0.2.0
