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

export interface NotificationResult {
  id: string
  title: string
  body: string
  sentCount: number
  failedCount: number
  createdAt: string
}
