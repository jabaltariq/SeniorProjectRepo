import React, { useEffect, useState } from 'react';

interface UserAvatarProps {
  initials: string;
  imageUrl?: string | null;
  alt: string;
  className?: string;
  textClassName?: string;
}

export const UserAvatar: React.FC<UserAvatarProps> = ({
  initials,
  imageUrl,
  alt,
  className = 'h-10 w-10 rounded-xl',
  textClassName = 'text-blue-400',
}) => {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const shouldShowImage = Boolean(imageUrl && imageUrl !== failedUrl);

  useEffect(() => {
    setFailedUrl(null);
  }, [imageUrl]);

  return (
    <div className={`${className} overflow-hidden border border-slate-700 bg-slate-800 flex items-center justify-center font-bold ${textClassName}`}>
      {shouldShowImage ? (
        <img
          src={imageUrl ?? undefined}
          alt={alt}
          className="h-full w-full object-cover"
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailedUrl(imageUrl ?? null)}
        />
      ) : (
        <span>{initials}</span>
      )}
    </div>
  );
};
