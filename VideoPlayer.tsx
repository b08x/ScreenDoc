/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
/* tslint:disable */
// Copyright 2024 Google LLC

// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at

//     https://www.apache.org/licenses/LICENSE-2.0

// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// FIX: Import the 'React' namespace to resolve the 'Cannot find namespace React' error for types like React.MouseEvent.
import React, {useEffect, useRef, useState} from 'react';
import {timeToSecs} from './utils';
import { Caption } from './api';

export default function VideoPlayer({
  url,
  captions,
}: {
  url: string;
  captions: Caption[];
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentCaption, setCurrentCaption] = useState('');

  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      const handleTimeUpdate = () => {
        setCurrentTime(video.currentTime);
        // Find current caption
        const current = [...captions]
          .reverse()
          .find((c) => video.currentTime >= timeToSecs(c.startTime));
        setCurrentCaption(current ? current.text : '');
      };

      const handleLoadedMetadata = () => {
        setDuration(video.duration);
      };

      video.addEventListener('timeupdate', handleTimeUpdate);
      video.addEventListener('loadedmetadata', handleLoadedMetadata);
      video.load();

      return () => {
        video.removeEventListener('timeupdate', handleTimeUpdate);
        video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      };
    }
  }, [url, captions]);

  if (!url) {
    return null;
  }

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const video = videoRef.current;
    if (video && duration > 0) {
      const progressBar = e.currentTarget;
      const clickPosition = e.clientX - progressBar.getBoundingClientRect().left;
      const percentage = clickPosition / progressBar.offsetWidth;
      video.currentTime = duration * percentage;
    }
  };

  const jumpToTimecode = (seconds: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = seconds;
      if (videoRef.current.paused) {
        videoRef.current.play();
      }
    }
  };

  return (
    <div className="videoPlayer">
      <div className="video-container">
        <video
          ref={videoRef}
          src={url}
          controls
          preload="auto"
          crossOrigin="anonymous"
        />
        {currentCaption && (
          <div className="caption-overlay">{currentCaption}</div>
        )}
      </div>

      {captions && captions.length > 0 && duration > 0 && (
        <div className="custom-timeline-container">
          <div className="custom-timeline" onClick={handleSeek}>
            <div
              className="progress"
              style={{width: `${(currentTime / duration) * 100}%`}}></div>
            {captions.map((caption, index) => {
              const seconds = timeToSecs(caption.startTime);
              const position = (seconds / duration) * 100;
              if (position > 100) return null;
              return (
                <div
                  key={index}
                  className="timeline-marker"
                  style={{left: `${position}%`}}
                  onClick={(e) => {
                    e.stopPropagation();
                    jumpToTimecode(seconds);
                  }}>
                  <div className="tooltip">{caption.text}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}