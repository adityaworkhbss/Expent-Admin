import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Send, Loader2, Bell, X, Check, AlertTriangle } from 'lucide-react'
import { clsx } from 'clsx'
import type { AxiosError } from 'axios'
import { apiClient } from '../api/client'
import { Button } from '../components/Button'
import { Input, Textarea } from '../components/Input'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/Card'
import type { ApiResponse, NotificationResult } from '../types'

const notificationSchema = z.object({
  title: z.string().min(1, 'Title is required').max(100, 'Title must be less than 100 characters'),
  body: z.string().min(1, 'Message body is required').max(1000, 'Message must be less than 1000 characters'),
})

type NotificationFormData = z.infer<typeof notificationSchema>

interface SendResult {
  status: 'success' | 'partial' | 'error'
  message: string
  sentCount?: number
  failedCount?: number
}

export function NotificationsPage() {
  const [isSending, setIsSending] = useState(false)
  const [sendResult, setSendResult] = useState<SendResult | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<NotificationFormData>({
    resolver: zodResolver(notificationSchema),
    defaultValues: { title: '', body: '' },
  })

  const onSubmit = async (data: NotificationFormData) => {
    setIsSending(true)
    setSendResult(null)

    try {
      const response = await apiClient.createNotification({ title: data.title, body: data.body })
      if (response.success) {
        const { sentCount, failedCount } = response.data
        setSendResult({
          status: failedCount > 0 && sentCount === 0 ? 'error' : failedCount > 0 ? 'partial' : 'success',
          message: response.message,
          sentCount,
          failedCount,
        })
        reset()
      } else {
        setSendResult({ status: 'error', message: response.message || 'Failed to send notification' })
      }
    } catch (err) {
      const axiosErr = err as AxiosError<ApiResponse<NotificationResult>>
      const message = axiosErr.response?.data?.message || 'Failed to send notification'
      setSendResult({ status: 'error', message })
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Notifications</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Send a push notification to every registered device.
        </p>
      </div>

      {sendResult && (
        <div
          className={clsx(
            'p-4 rounded-lg flex items-start gap-3',
            sendResult.status === 'success' &&
              'bg-green-50 text-green-800 dark:bg-green-900/30 dark:text-green-400 border border-green-200 dark:border-green-800',
            sendResult.status === 'partial' &&
              'bg-orange-50 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400 border border-orange-200 dark:border-orange-800',
            sendResult.status === 'error' &&
              'bg-red-50 text-red-800 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-800'
          )}
          role="alert"
        >
          {sendResult.status === 'success' && <Check className="h-5 w-5 flex-shrink-0 mt-0.5" />}
          {sendResult.status === 'partial' && <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5" />}
          {sendResult.status === 'error' && <X className="h-5 w-5 flex-shrink-0 mt-0.5" />}
          <div className="flex-1">
            <p>{sendResult.message}</p>
            {(sendResult.sentCount !== undefined || sendResult.failedCount !== undefined) && (
              <p className="text-sm opacity-80 mt-1">
                Delivered: {sendResult.sentCount ?? 0} · Failed: {sendResult.failedCount ?? 0}
              </p>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={() => setSendResult(null)} aria-label="Dismiss">
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-purple-600" />
            Compose Notification
          </CardTitle>
          <CardDescription>This will be pushed to every device currently registered with the app.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <Input
              label="Title"
              placeholder="Enter notification title"
              error={errors.title?.message}
              maxLength={100}
              {...register('title')}
            />
            <Textarea
              label="Message"
              placeholder="Enter notification message"
              error={errors.body?.message}
              maxLength={1000}
              rows={4}
              {...register('body')}
            />

            <div className="flex items-center gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
              <Button type="submit" size="lg" loading={isSending} className="flex-1 sm:flex-none">
                {isSending && <Loader2 className="h-4 w-4" />}
                <Send className="h-4 w-4" />
                Send Notification
              </Button>
              <Button type="button" variant="outline" onClick={() => reset()}>
                Clear
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
