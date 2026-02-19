export const IPC_CHANNELS = {
  GET_SETTINGS: 'settings:get',
  UPDATE_SETTINGS: 'settings:update',
  SCAN_SESSIONS: 'sessions:scan',
  LOAD_SESSION: 'sessions:load',
  EXPORT_MARKDOWN: 'export:markdown',
  QUICK_EXPORT_LATEST: 'export:quick-latest',
  PICK_EXPORT_PATH: 'dialog:pick-export-path'
} as const

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS]
