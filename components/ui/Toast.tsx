'use client'
import { useToastStore, type Toast } from '@/store/toastStore'

interface ToastContainerProps {
  toasts: Toast[]
}

const TOAST_ICONS: Record<Toast['type'], string> = {
  success: '✅',
  error: '❌',
  warning: '⚠️',
  info: 'ℹ️',
}

export default function ToastContainer({ toasts }: ToastContainerProps) {
  const { removeToast } = useToastStore()

  if (toasts.length === 0) return null

  return (
    <div className="toast-container">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast toast--${toast.type}`}>
          <span>{TOAST_ICONS[toast.type]}</span>
          <span className="toast__message">{toast.message}</span>
          <button
            onClick={() => removeToast(toast.id)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--color-text-muted)',
              cursor: 'pointer',
              fontSize: 'var(--text-lg)',
              lineHeight: 1,
              padding: '0 var(--space-1)',
            }}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  )
}
