/**
 * Форматирует время в секундах в формат MM:SS
 * @param {number} seconds - Количество секунд
 * @returns {string} - Отформатированное время в виде MM:SS
 */
export function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  
  const formattedMinutes = String(minutes).padStart(2, '0');
  const formattedSeconds = String(remainingSeconds).padStart(2, '0');
  
  return `${formattedMinutes}:${formattedSeconds}`;
}

/**
 * Форматирует дату в читаемый формат
 * @param {number} timestamp - Unix timestamp в миллисекундах
 * @returns {string} - Отформатированная дата в виде DD.MM.YYYY HH:MM
 */
export function formatDate(timestamp) {
  const date = new Date(timestamp);
  
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  
  return `${day}.${month}.${year} ${hours}:${minutes}`;
}

/**
 * Форматирует размер файла в читаемый формат
 * @param {number} bytes - Размер в байтах
 * @returns {string} - Отформатированный размер (например, "2.5 MB")
 */
export function formatFileSize(bytes) {
  if (bytes < 1024) {
    return `${bytes} B`;
  } else if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  } else {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
}