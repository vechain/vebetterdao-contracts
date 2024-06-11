export const chunk = <T>(array: T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(array.length / size) }, (v, i) => array.slice(i * size, i * size + size))
