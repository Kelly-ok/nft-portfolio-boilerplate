'use client';

import { useState, useEffect } from 'react';
import { getMediaInfo, getMediaInfoSync, MediaType, MediaInfo } from '@/utils/ipfs';

interface NFTMediaProps {
  src: string | undefined | null;
  alt?: string;
  className?: string;
  onLoad?: () => void;
  onError?: (e: React.SyntheticEvent<HTMLImageElement | HTMLVideoElement, Event>) => void;
  gateway?: string;
  showControls?: boolean;
  autoPlay?: boolean;
  loop?: boolean;
  muted?: boolean;
  playsInline?: boolean;
}

/**
 * NFTMedia component that handles different media types (images, videos, etc.)
 * for NFT display. It automatically detects the media type and renders the appropriate element.
 */
export default function NFTMedia({
  src,
  alt = 'NFT Media',
  className = '',
  onLoad,
  onError,
  gateway = 'https://ipfs.io',
  showControls = true,
  autoPlay = false,
  loop = true,
  muted = true,
  playsInline = true
}: NFTMediaProps) {
  // Start with a synchronous media info to avoid initial rendering issues
  const [mediaInfo, setMediaInfo] = useState<MediaInfo>(() => getMediaInfoSync(src, gateway));
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);

  // Update media info when src changes
  useEffect(() => {
    // First set with the sync version to avoid flickering
    setMediaInfo(getMediaInfoSync(src, gateway));
    setIsLoading(true);
    setIsError(false);

    // Then fetch the accurate media type asynchronously
    const fetchMediaInfo = async () => {
      try {
        const info = await getMediaInfo(src, gateway);
        setMediaInfo(info);
      } catch (error) {
        console.error('Error fetching media info:', error);
      }
    };

    fetchMediaInfo();
  }, [src, gateway]);

  const handleLoad = () => {
    setIsLoading(false);
    if (onLoad) onLoad();
  };

  const handleError = (e: React.SyntheticEvent<HTMLElement, Event>) => {
    setIsLoading(false);
    setIsError(true);
    if (onError) onError(e as React.SyntheticEvent<HTMLImageElement | HTMLVideoElement, Event>);
  };


  // Show loading indicator while media is loading
  const loadingIndicator = isLoading ? (
    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900">
      <div className="h-10 w-10 animate-spin rounded-full border-3 border-gray-200 border-t-indigo-500 border-r-purple-500 shadow-lg" />
    </div>
  ) : null;


  // Render based on media type
  switch (mediaInfo.type) {
    case MediaType.VIDEO:
      return (
        <div className="relative w-full h-full">
          {loadingIndicator}
          <video
            src={mediaInfo.url}
            className={`${className} ${isLoading ? 'opacity-0' : 'opacity-100'} transition-opacity duration-300`}
            controls={showControls}
            autoPlay={autoPlay}
            loop={loop}
            muted={muted}
            playsInline={playsInline}
          />
        </div>
      );

    case MediaType.AUDIO:
      return (
        <div className="relative w-full h-full flex items-center justify-center">
          {loadingIndicator}
          <div className={`w-full ${isLoading ? 'opacity-0' : 'opacity-100'} transition-opacity duration-300`}>
            <img
              src="/images/audio-placeholder.svg"
              alt={alt}
              className={`${className} object-contain`}
              onLoad={handleLoad}
            />
            <audio
              src={mediaInfo.url}
              className="w-full mt-2"
              controls={showControls}
              autoPlay={autoPlay}
              loop={loop}
              muted={muted}
              onLoadedData={handleLoad}
              onError={(e) => handleError(e as unknown as React.SyntheticEvent<HTMLElement, Event>)}
            />
          </div>
        </div>
      );

    case MediaType.IMAGE:
    default:
      return (
        <div className="relative w-full h-full">
          {loadingIndicator}
          <img
            src={mediaInfo.url}
            alt={alt}
            className={`${className} ${isLoading ? 'opacity-0' : 'opacity-100'} transition-opacity duration-300`}
            onLoad={handleLoad}
            onError={handleError}
            loading="lazy"
          />
        </div>
      );
  }
}
