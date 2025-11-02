export interface Caption {
  startTime: string; // e.g., "00:01:23.456"
  endTime: string;
  text: string;
}

export interface DiarizedSegment {
  speaker: string;
  startTime: string; // e.g., "00:01:23.456"
  endTime: string;
  text: string;
}
