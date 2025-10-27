/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

/**
 * Converts a File object to a base64-encoded string.
 * Supports optional progress callback for long operations.
 */
export function fileToBase64(file: File, onProgress?: (percent: number) => void): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);

    if (onProgress) {
      reader.onprogress = (event) => {
        if (event.lengthComputable) {
          const percentLoaded = (event.loaded / event.total) * 100;
          onProgress(percentLoaded);
        }
      };
    }

    reader.onload = () => {
      if (onProgress) {
        onProgress(100);
      }
      // result is "data:video/webm;base64,..."
      // we need to strip the prefix
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      resolve(base64);
    };

    reader.onerror = reject;
  });
}

/**
 * Simulates progress for a long-running task by gradually increasing a progress indicator.
 * Progress increases to 95% and then waits for the actual task to complete.
 */
export function simulateProgress<T>(
  task: Promise<T>,
  onProgress: (percent: number) => void,
): Promise<T> {
  let progress = 0;
  onProgress(progress);

  const interval = setInterval(() => {
    progress += Math.random() * 5;
    if (progress >= 95) {
      clearInterval(interval);
      // Don't go to 100, wait for the promise to resolve
      onProgress(95);
    } else {
      onProgress(progress);
    }
  }, 200);

  return task
    .then(result => {
      clearInterval(interval);
      onProgress(100);
      return result;
    })
    .catch(error => {
      clearInterval(interval);
      onProgress(0);
      throw error;
    });
}

/**
 * Simulates progress for a shorter task.
 * Used for cosmetic loading steps to improve UX feedback.
 */
export function simulateShortProgress(onProgress: (percent: number) => void): Promise<void> {
  return new Promise(resolve => {
    let progress = 0;
    onProgress(progress);
    const interval = setInterval(() => {
      progress += 15 + Math.random() * 10; // Faster progress
      if (progress >= 100) {
        clearInterval(interval);
        onProgress(100);
        // A short delay before resolving to ensure 100% is visible
        setTimeout(resolve, 100);
      } else {
        onProgress(progress);
      }
    }, 120); // Faster interval
  });
}

/**
 * Extracts a single frame from a video at the specified time.
 * Returns a Blob that can be used with JSZip or other file operations.
 */
export function extractFrame(videoUrl: string, time: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.style.display = 'none';
    video.muted = true;
    video.crossOrigin = 'anonymous';

    const onSeeked = () => {
      video.removeEventListener('seeked', onSeeked);
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => {
          document.body.removeChild(video);
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Canvas to Blob conversion failed.'));
          }
        }, 'image/png');
      } else {
        document.body.removeChild(video);
        reject(new Error('Could not get canvas context.'));
      }
    };

    const onLoadedMetadata = () => {
      video.removeEventListener('loadedmetadata', onLoadedMetadata);
      // Clamp time to be within video duration
      video.currentTime = Math.max(0, Math.min(time, video.duration));
    };

    video.addEventListener('loadedmetadata', onLoadedMetadata);
    video.addEventListener('seeked', onSeeked);
    video.addEventListener('error', () => {
      document.body.removeChild(video);
      reject(new Error(`Video loading error: ${video.error?.message || 'unknown error'}`));
    });

    video.src = videoUrl;
    document.body.appendChild(video);
  });
}
