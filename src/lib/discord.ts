/**
 * ELASTICO — Discord Notification Helper
 * Sends formatted notifications to Discord webhook.
 */

const WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL || ''

interface DiscordEmbed {
  title: string
  description?: string
  color?: number
  fields?: { name: string; value: string; inline?: boolean }[]
  footer?: { text: string }
  timestamp?: string
}

export async function sendDiscordNotification(
  message: string,
  embed?: DiscordEmbed
): Promise<boolean> {
  if (!WEBHOOK_URL) return false

  try {
    const payload: Record<string, unknown> = {
      content: message,
      username: 'ELASTICO',
    }

    if (embed) {
      payload.embeds = [{
        title: embed.title,
        description: embed.description,
        color: embed.color || 0x00e676, // ELASTICO green
        fields: embed.fields,
        footer: embed.footer ? { text: embed.footer.text } : undefined,
        timestamp: embed.timestamp || new Date().toISOString(),
      }]
    }

    await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    return true
  } catch (err) {
    console.error('[Discord] Notification failed:', err)
    return false
  }
}

/** Send a live match goal alert */
export async function sendGoalAlert(
  competition: string,
  homeTeam: string,
  awayTeam: string,
  scorer: string,
  minute: number,
  homeScore: number,
  awayScore: number
): Promise<void> {
  await sendDiscordNotification(
    `⚽ **GOAL!** ${scorer} (${minute}')`,
    {
      title: `${homeScore} - ${awayScore}`,
      description: `${competition}`,
      color: 0x00e676,
      fields: [
        { name: 'Match', value: `${homeTeam} vs ${awayTeam}`, inline: false },
        { name: 'Minute', value: `${minute}'`, inline: true },
        { name: 'Score', value: `${homeScore} - ${awayScore}`, inline: true },
      ],
      timestamp: new Date().toISOString(),
    }
  )
}

/** Send system status notification */
export async function sendSystemAlert(
  title: string,
  message: string,
  level: 'info' | 'warn' | 'error' = 'info'
): Promise<void> {
  const colors = { info: 0x3b82f6, warn: 0xf59e0b, error: 0xef4444 }
  await sendDiscordNotification('⚠️ System Alert', {
    title,
    description: message,
    color: colors[level],
    timestamp: new Date().toISOString(),
  })
}