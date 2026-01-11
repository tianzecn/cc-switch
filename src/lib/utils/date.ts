/**
 * 时间格式化工具
 *
 * 用于处理后端返回的 Unix 时间戳（秒）并格式化为用户友好的日期时间字符串
 */

/**
 * 将 Unix 时间戳（秒）转换为 Date 对象
 * @param timestamp Unix 时间戳（秒）
 * @returns Date 对象，如果时间戳无效则返回 null
 */
export function timestampToDate(
  timestamp: number | null | undefined,
): Date | null {
  if (timestamp == null || timestamp === 0 || isNaN(timestamp)) {
    return null;
  }
  // Unix 时间戳是秒，JavaScript Date 需要毫秒
  return new Date(timestamp * 1000);
}

/**
 * 格式化安装/更新时间为绝对时间格式
 * @param timestamp Unix 时间戳（秒）
 * @param locale 语言环境，默认使用浏览器语言
 * @returns 格式化后的时间字符串，如 "2026-01-10 14:30"
 */
export function formatInstallTime(
  timestamp: number | null | undefined,
  locale?: string,
): string {
  const date = timestampToDate(timestamp);
  if (!date) {
    return "未知";
  }

  // 使用 Intl.DateTimeFormat 进行本地化格式化
  return new Intl.DateTimeFormat(locale || navigator.language, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

/**
 * 格式化更新信息摘要
 * @param updateCount 更新次数
 * @param lastUpdatedAt 最后更新时间戳（秒）
 * @returns 格式化后的摘要字符串，如 "3 次 | 最后: 2026-01-09 18:20"
 */
export function formatUpdateSummary(
  updateCount: number | null | undefined,
  lastUpdatedAt: number | null | undefined,
): string | null {
  if (!updateCount || updateCount === 0) {
    return null;
  }

  const lastUpdatedStr = formatInstallTime(lastUpdatedAt);
  return `${updateCount} 次 | 最后: ${lastUpdatedStr}`;
}
