export interface AdminUser {
  id: string
  email: string
  name?: string
}

export interface ApiError {
  success: false
  message: string
}

export interface ApiSuccess<T> {
  success: true
  message: string
  data: T
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError

export interface AdminLoginData {
  accessToken: string
  admin: AdminUser
}

export interface NotificationRequest {
  title: string
  body: string
}

/** Text values in the app config: a string, a list of strings, or a nested group. */
export type ConfigValue = string | string[] | ConfigGroup
export interface ConfigGroup {
  [key: string]: ConfigValue
}

export interface RemoteConfig {
  serverUrl: string
  content: ConfigGroup
  [key: string]: unknown
}

export interface AppConfigData {
  config: RemoteConfig
  /** Hash of the stored config; sent back as baseVersion so concurrent edits are detected. */
  version: string
  /** False while KV is still empty and the config shown is the live worker's. */
  storedInKv: boolean
}

export interface NotificationResult {
  id: string
  title: string
  body: string
  sentCount: number
  failedCount: number
  createdAt: string
}
