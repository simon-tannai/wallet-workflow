/**
 * Capitalizes first letter of a string.
 * @param {string} s String to capitalize.
 * @returns {string} Returns capitalized string.
 */
export function capitalizeFirstLetter(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function chooseRandom(array: any[]) {
  return array[Math.floor(Math.random() * array.length)];
}
