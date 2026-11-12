const UNITS = ['B', 'KB', 'MB', 'GB', 'TB']

export function formatBytes(value: number, digits = 1) {
  if (!Number.isFinite(value) || value <= 0) return '0 B'
  let size = value
  let index = 0
  while (size >= 1024 && index < UNITS.length - 1) {
    size /= 1024
    index += 1
  }
  return `${size.toFixed(index === 0 ? 0 : digits)} ${UNITS[index]}`
}

export function formatRate(value: number) {
  return `${formatBytes(value, 1)}/s`
}

export function formatUptime(seconds: number, locale: string) {
  const total = Math.max(0, Math.floor(seconds))
  const days = Math.floor(total / 86400)
  const hours = Math.floor((total % 86400) / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const format = (value: number, unit: 'day' | 'hour' | 'minute') =>
    new Intl.NumberFormat(locale, { style: 'unit', unit, unitDisplay: 'narrow' }).format(value)

  if (days > 0) return `${format(days, 'day')} ${format(hours, 'hour')}`
  if (hours > 0) return `${format(hours, 'hour')} ${format(minutes, 'minute')}`
  return format(minutes, 'minute')
}

export function percent(part: number, whole: number) {
  if (!Number.isFinite(part) || !Number.isFinite(whole) || whole <= 0) return 0
  return Math.max(0, Math.min(100, (part / whole) * 100))
}
