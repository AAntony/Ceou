/** SQL may return a date or a timestamp without timezone. The reset date is always UTC. */
export function resetDate(value: string, language: string): string {
  return new Date(`${value.slice(0,10)}T00:00:00Z`).toLocaleDateString(language,{day:'numeric',month:'long',timeZone:'UTC'});
}
