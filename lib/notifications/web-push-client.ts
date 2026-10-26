"use client"

/**
 * Checks if the current browser environment supports notifications and service workers
 */
export function isPushNotificationSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "Notification" in window &&
    "serviceWorker" in navigator
  )
}

/**
 * Gets current notification permission status: 'default', 'granted', or 'denied'
 */
export function getNotificationPermissionState(): NotificationPermission | "unsupported" {
  if (!isPushNotificationSupported()) return "unsupported"
  return Notification.permission
}

/**
 * Requests browser notification permission and registers with the backend
 */
export async function enablePushNotifications(): Promise<{
  granted: boolean
  status: NotificationPermission | "unsupported"
  error?: string
}> {
  if (!isPushNotificationSupported()) {
    return { granted: false, status: "unsupported", error: "Notifications not supported by this browser" }
  }

  try {
    const permission = await Notification.requestPermission()
    if (permission !== "granted") {
      return { granted: false, status: permission }
    }

    // Register service worker if not already registered
    let registration: ServiceWorkerRegistration | undefined
    try {
      registration = await navigator.serviceWorker.register("/sw.js")
      await navigator.serviceWorker.ready
    } catch (swErr) {
      console.warn("[WebPushClient] Service worker registration notice:", swErr)
    }

    // Register active subscription with backend
    try {
      let subscription: PushSubscription | null = null
      if (registration && "pushManager" in registration) {
        subscription = await registration.pushManager.getSubscription()
      }

      const endpoint = subscription ? subscription.endpoint : `web-client-${window.crypto?.randomUUID?.() || Date.now()}`
      const jsonSub = subscription?.toJSON?.()

      await fetch("/api/notifications/register-subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint,
          keys: jsonSub?.keys || null,
          device_type: "web",
        }),
      })
    } catch (regErr) {
      console.warn("[WebPushClient] Push registration error:", regErr)
    }

    return { granted: true, status: "granted" }
  } catch (err: any) {
    console.error("[WebPushClient] Permission request error:", err)
    return { granted: false, status: "denied", error: err?.message }
  }
}

/**
 * Shows an immediate browser notification if permission is granted
 */
export function displayLocalBrowserNotification(title: string, options?: NotificationOptions) {
  if (typeof window === "undefined" || !("Notification" in window)) return
  if (Notification.permission === "granted") {
    try {
      new Notification(title, {
        icon: "/miko.png",
        badge: "/miko.png",
        ...options,
      })
    } catch (e) {
      // On mobile browsers, serviceWorker.showNotification is preferred
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.ready.then((reg) => {
          reg.showNotification(title, {
            icon: "/miko.png",
            badge: "/miko.png",
            ...options,
          })
        }).catch(() => {})
      }
    }
  }
}
