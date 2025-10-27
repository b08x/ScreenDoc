/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

/**
 * Processes markdown content for preview by replacing image placeholders with actual screenshots.
 * Matches patterns like [Image: description at HH:MM:SS.sss] or [Image: description at MM:SS.sss]
 * and replaces them with markdown image syntax.
 */
export function processContentForPreview(
  content: string,
  screenshots: Record<string, string>,
): string {
  return content.replace(
    /\[Image:\s*(.+?)\s+at\s+(\d{1,2}:\d{2}:\d{2}(?:\.\d{3})?)\]/gi,
    (match, description, timecode) => {
      const screenshot = screenshots[timecode];
      if (screenshot) {
        return `![${description}](data:image/png;base64,${screenshot})`;
      }
      return match;
    },
  );
}
