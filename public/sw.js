// Micky Mobile Ethiopia Service Worker for Web Push Notifications

self.addEventListener("install", (event) => {
  self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener("push", (event) => {
  let data = {
    title: "Micky Mobile Ethiopia",
    body: "You have a new update!",
    icon: "/miko.png",
    badge: "/miko.png",
    url: "/client",
  }

  if (event.data) {
    try {
      data = Object.assign(data, event.data.json())
    } catch (e) {
      data.body = event.data.text()
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || "/miko.png",
    badge: data.badge || "/miko.png",
    data: {
      url: data.url || "/client",
    },
    vibrate: [100, 50, 100],
    actions: [
      { action: "open", title: "View Update" },
      { action: "close", title: "Dismiss" },
    ],
  }

  event.waitUntil(self.registration.showNotification(data.title, options))
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()

  if (event.action === "close") return

  const targetUrl = (event.notification.data && event.notification.data.url) || "/"

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.navigate(targetUrl)
          return client.focus()
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl)
      }
    })
  )
})
