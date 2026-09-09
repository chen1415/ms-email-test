export const graphStats = {
  status401: 0,
  status429: 0,
  status5xx: 0,
  duplicatePrevented: 0,
};

export function recordGraphStatus(status: number): void {
  if (status === 401) graphStats.status401 += 1;
  else if (status === 429) graphStats.status429 += 1;
  else if (status >= 500) graphStats.status5xx += 1;
}

export function recordDuplicate(): void {
  graphStats.duplicatePrevented += 1;
}
