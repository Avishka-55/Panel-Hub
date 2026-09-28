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

/**
 * Shortens a UUID or long key for compact display (e.g. "c1a11111...5555").
 */
export function formatShortId(id, prefixLen = 8, suffixLen = 4) {
  if (!id) return '';
  const str = String(id).trim();
  if (str.length <= prefixLen + suffixLen + 3) return str;
  return `${str.slice(0, prefixLen)}...${str.slice(-suffixLen)}`;
}

/**
 * Formats timestamp to human readable relative time (e.g. "5m ago", "2h ago").
 */
export function formatRelativeTime(timestamp) {
  if (!timestamp || isNaN(Number(timestamp))) return null;
  const time = Number(timestamp);
  if (time <= 0) return null;
  const now = Date.now();
  const diffSec = Math.max(0, Math.floor((now - time) / 1000));
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

