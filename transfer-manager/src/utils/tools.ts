/**
 * Capitalizes first letter of a string.
 * @param {string} s String to capitalize.
 * @returns {string} Returns capitalized string.
 */
export default function capitalizeFirstLetter(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
