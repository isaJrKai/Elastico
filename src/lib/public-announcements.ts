export interface PublicAnnouncement {
  id: string
  title: string
  message: string
  type: string
  isBreaking: boolean
  createdAt: string
}

/** Expose only fields intended for anonymous login-page announcements. */
export function toPublicAnnouncement(announcement: {
  id: string
  title: string
  content: string
  type: string
  createdAt: Date | string
}): PublicAnnouncement {
  return {
    id: announcement.id,
    title: announcement.title,
    message: announcement.content,
    type: announcement.type,
    isBreaking: announcement.type === 'error' || announcement.type === 'warning',
    createdAt: new Date(announcement.createdAt).toISOString(),
  }
}
