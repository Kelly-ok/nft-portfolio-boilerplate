'use client';

import { siGithub } from 'simple-icons';

interface GitHubIconProps {
  className?: string;
  size?: number;
}

export default function GitHubIcon({ className = '', size = 16 }: GitHubIconProps) {
  return (
    <svg
      role="img"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      className={className}
      fill="currentColor"
    >
      <title>GitHub</title>
      <path d={siGithub.path} />
    </svg>
  );
}
