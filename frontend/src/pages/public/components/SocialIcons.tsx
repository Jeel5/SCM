type SocialIconProps = {
  className?: string;
};

export function YouTubeIcon({ className }: SocialIconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="currentColor">
      <path d="M23.5 6.2a3.1 3.1 0 0 0-2.2-2.2C19.4 3.5 12 3.5 12 3.5s-7.4 0-9.3.5A3.1 3.1 0 0 0 .5 6.2 32.6 32.6 0 0 0 0 12c0 2 .2 3.9.5 5.8a3.1 3.1 0 0 0 2.2 2.2c1.9.5 9.3.5 9.3.5s7.4 0 9.3-.5a3.1 3.1 0 0 0 2.2-2.2c.3-1.9.5-3.8.5-5.8s-.2-3.9-.5-5.8ZM9.6 15.6V8.4l6.3 3.6-6.3 3.6Z" />
    </svg>
  );
}

export function LinkedInIcon({ className }: SocialIconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="currentColor">
      <path d="M4.98 3.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5ZM3 9.75h3.96V21H3V9.75Zm7.2 0H14v1.54h.06c.53-1 1.82-2.05 3.74-2.05 4 0 4.74 2.63 4.74 6.04V21h-3.96v-5.02c0-1.2-.02-2.74-1.67-2.74-1.67 0-1.93 1.3-1.93 2.65V21H10.2V9.75Z" />
    </svg>
  );
}

export function XIcon({ className }: SocialIconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="currentColor">
      <path d="M18.901 1.153h3.68l-8.043 9.19L24 22.847h-7.406l-5.8-7.584-6.639 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932 6.064-6.933Zm-1.291 19.495h2.039L6.486 3.24H4.298L17.61 20.648Z" />
    </svg>
  );
}

export function FacebookIcon({ className }: SocialIconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="currentColor">
      <path d="M22 12a10 10 0 1 0-11.56 9.87v-6.98H7.9V12h2.54V9.8c0-2.5 1.49-3.89 3.78-3.89 1.1 0 2.25.2 2.25.2v2.46h-1.27c-1.25 0-1.64.77-1.64 1.57V12h2.8l-.45 2.89h-2.35v6.98A10 10 0 0 0 22 12Z" />
    </svg>
  );
}

export function InstagramIcon({ className }: SocialIconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="currentColor">
      <path d="M7.75 2h8.5A5.75 5.75 0 0 1 22 7.75v8.5A5.75 5.75 0 0 1 16.25 22h-8.5A5.75 5.75 0 0 1 2 16.25v-8.5A5.75 5.75 0 0 1 7.75 2Zm0 1.8A3.95 3.95 0 0 0 3.8 7.75v8.5a3.95 3.95 0 0 0 3.95 3.95h8.5a3.95 3.95 0 0 0 3.95-3.95v-8.5a3.95 3.95 0 0 0-3.95-3.95h-8.5Zm8.93 1.45a1.12 1.12 0 1 1 0 2.24 1.12 1.12 0 0 1 0-2.24ZM12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10Zm0 1.8A3.2 3.2 0 1 0 12 15.2 3.2 3.2 0 0 0 12 8.8Z" />
    </svg>
  );
}