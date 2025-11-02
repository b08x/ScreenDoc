import React, { useEffect, useRef, useState } from 'react';
import { timeToSecs } from '../utils/utils';
import { Caption } from '../types';

interface VideoPlayerProps {
  url: string;
  captions: Caption[];
}

export default function VideoPlayer({ url, captions }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentCaption, setCurrentCaption] = useState('');

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onTimeUpdate = () => {
      setCurrentTime(video.currentTime);
      const current = [...captions].reverse().find(c => video.currentTime >= timeToSecs(c.startTime));
      setCurrentCaption(current ? current.text : '');
    };
    const onLoadedMetadata = () => setDuration(video.duration);

    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('loadedmetadata', onLoadedMetadata);
    video.load();

    return () => {
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('loadedmetadata', onLoadedMetadata);
    };
  }, [url, captions]);

  if (!url) return null;

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!videoRef.current || duration <= 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const percentage = (e.clientX - rect.left) / rect.width;
    videoRef.current.currentTime = duration * percentage;
  };

  const jumpToTimecode = (seconds: number) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = seconds;
    videoRef.current.paused && videoRef.current.play();
  };

  return (
    <div className="w-full mt-4 rounded-lg overflow-hidden">
      <div className="relative bg-black rounded-lg overflow-hidden">
        <video ref={videoRef} src={url} controls preload="auto" crossOrigin="anonymous" className="w-full max-h-72 block" />
        {currentCaption && (
          <div className="absolute bottom-16 left-1/2 -translate-x-1/2 bg-black/70 text-white px-4 py-2 rounded-md text-base text-center max-w-[90%] pointer-events-none transition-opacity">
            {currentCaption}
          </div>
        )}
      </div>

      {captions.length > 0 && duration > 0 && (
        <div className="py-4 bg-[--background-secondary] border-t border-[--border]">
          <div className="relative w-[98%] mx-auto h-2 bg-[--border] rounded-full cursor-pointer" onClick={handleSeek}>
            <div className="absolute top-0 left-0 h-full bg-blue-500 rounded-full" style={{ width: `${(currentTime / duration) * 100}%` }}></div>
            {captions.map((caption, index) => {
              const seconds = timeToSecs(caption.startTime);
              const position = (seconds / duration) * 100;
              if (position > 100) return null;
              return (
                <div key={index} className="group absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-white border-2 border-blue-500 rounded-full cursor-pointer z-10" style={{ left: `${position}%` }} onClick={(e) => { e.stopPropagation(); jumpToTimecode(seconds); }}>
                  <div className="invisible opacity-0 group-hover:visible group-hover:opacity-100 absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-[--background] text-[--text] px-2 py-1 rounded-md border border-[--border] shadow-md w-52 text-center text-xs transition-opacity pointer-events-none z-20">{caption.text}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
