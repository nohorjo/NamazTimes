export  type HourMinuteStrings = [string, string];

export const ONE_DAY = 1000 * 60 * 60 * 24;

function pad(n: number): string {
  return n < 10 ? `0${n}` : n.toString();
}

export function capitalise(s: string): string {
  return s.replace(/./, c => c.toUpperCase());
}

export function toHMS(millis: number): string {
  let formatString = '';
  const hours = Math.floor(millis / 3600000);
  if (hours) {
    formatString += `${pad(hours)}h `;
  }
  millis -= 3600000 * hours;
  const minutes = Math.floor(millis / 60000);
  if (formatString || minutes) {
    formatString += `${pad(minutes)}m `;
  }
  millis -= 60000 * minutes;
  const seconds = Math.floor(millis / 1000);
  formatString += `${pad(seconds)}s `;

  return formatString;
}

export function toDate([hours, minutes]: HourMinuteStrings, date = new Date): Date {
  date = new Date(date);
  date.setHours(parseInt(hours), parseInt(minutes), 0, 0);
  return date;
}