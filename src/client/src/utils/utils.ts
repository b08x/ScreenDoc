export const timeToSecs = (timecode: string): number => {
  if (!timecode) return 0;
  const parts = timecode.split(':');
  
  if (parts.length === 3) { // HH:MM:SS.ms
    const ssms = parts[2].split('.').map(parseFloat);
    const seconds = ssms[0] || 0;
    const ms = ssms[1] || 0;
    return (parseFloat(parts[0]) * 3600) + (parseFloat(parts[1]) * 60) + seconds + (ms / 1000);
  }
  
  if (parts.length === 2) { // MM:SS.ms
    const ssms = parts[1].split('.').map(parseFloat);
    const seconds = ssms[0] || 0;
    const ms = ssms[1] || 0;
    return (parseFloat(parts[0]) * 60) + seconds + (ms / 1000);
  }

  if (parts.length === 1) { // SS.ms
    const ssms = parts[0].split('.').map(parseFloat);
    const seconds = ssms[0] || 0;
    const ms = ssms[1] || 0;
    return seconds + (ms / 1000);
  }

  return 0;
};
