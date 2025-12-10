/**
 * 日期时间格式化工具
 *
 * 提供统一的 YYYY-MM-DD HH:mm:ss 格式化方法，方便在各个业务模块复用。
 */

/**
 * 将时间值格式化为字符串：YYYY-MM-DD HH:mm:ss
 *
 * @param value 时间值，可以是字符串、时间戳或 Date 对象
 * @returns 格式化后的时间字符串；如果无效则返回空字符串或原始值字符串
 */
export const formatDateTime = (value?: string | number | Date | null): string => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value ?? '')

  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`)
  const Y = date.getFullYear()
  const M = pad(date.getMonth() + 1)
  const D = pad(date.getDate())
  const h = pad(date.getHours())
  const m = pad(date.getMinutes())
  const s = pad(date.getSeconds())
  return `${Y}-${M}-${D} ${h}:${m}:${s}`
}
