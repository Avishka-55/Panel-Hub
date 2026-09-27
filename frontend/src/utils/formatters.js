/**
 * Formats bytes to human readable format (KB, MB, GB, TB).
 */
export function formatBytes(bytes, decimals = 2) {
  if (!bytes || isNaN(bytes) || bytes === 0) return '0 B';
  if (bytes < 0) return 'Unlimited';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));
  if (i >= sizes.length) return `${(bytes / Math.pow(k, sizes.length - 1)).toFixed(dm)} ${sizes[sizes.length - 1]}`;

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

/**
 * Formats unix timestamp in milliseconds to localized date string.
 */
export function formatExpiry(timestamp) {
  if (!timestamp || timestamp === 0) return 'Never Expires';
  if (timestamp < 0) {
    const days = Math.abs(Math.round(timestamp / 86400000));
    return `First use + ${days} days`;
  }

  const date = new Date(timestamp);
  const now = new Date();
  const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  const dateString = date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });

  if (diffDays < 0) {
    return `${dateString} (Expired ${Math.abs(diffDays)}d ago)`;
  }
  if (diffDays === 0) {
    return `${dateString} (Expires today)`;
  }
  return `${dateString} (${diffDays}d left)`;
}

/**
 * Checks if a timestamp is expired.
 */
export function isExpired(timestamp) {
  if (!timestamp || timestamp <= 0) return false;
  return new Date(timestamp).getTime() < Date.now();
}
