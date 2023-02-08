/**
 * Make delay
 *
 * @format
 * @param {number} ms - Milliseconds
 */

export function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const isUndefined = (val: any): boolean => typeof val === 'undefined';
export const isNull = (val: any): boolean => val === null;
export const isNil = (val: any): boolean => isUndefined(val) || isNull(val);
