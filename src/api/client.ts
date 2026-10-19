import axios, { type AxiosInstance, type AxiosError } from 'axios'
import type { ApiResponse, AdminLoginData, NotificationRequest, NotificationResult } from '../types'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080'
const API_PREFIX = import.meta.env.VITE_API_PREFIX || 'api/v1'

class ApiClient {
  private client: AxiosInstance
  private accessToken: string | null = null

  constructor() {
    this.client = axios.create({
      baseURL: `${API_BASE_URL}/${API_PREFIX}`,
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    })

    this.client.interceptors.request.use(
      (config) => {
        if (this.accessToken && config.headers) {
          config.headers.Authorization = `Bearer ${this.accessToken}`
        }
        return config
      },
      (error: AxiosError) => Promise.reject(error)
    )

    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        if (error.response?.status === 401) {
          this.clearTokens()
          if (window.location.pathname !== '/login') {
            window.location.href = '/login'
          }
        }
        return Promise.reject(error)
      }
    )
  }

  setTokens(accessToken: string) {
    this.accessToken = accessToken
    localStorage.setItem('adminAccessToken', accessToken)
  }

  loadTokens() {
    this.accessToken = localStorage.getItem('adminAccessToken')
  }

  clearTokens() {
    this.accessToken = null
    localStorage.removeItem('adminAccessToken')
    localStorage.removeItem('adminUser')
  }

  isAuthenticated(): boolean {
    return !!this.accessToken
  }

  async adminLogin(email: string, password: string): Promise<ApiResponse<AdminLoginData>> {
    const response = await this.client.post<ApiResponse<AdminLoginData>>('/admin/login', { email, password })
    return response.data
  }

  async createNotification(notification: NotificationRequest): Promise<ApiResponse<NotificationResult>> {
    const response = await this.client.post<ApiResponse<NotificationResult>>('/notifications', notification)
    return response.data
  }
}

export const apiClient = new ApiClient()
