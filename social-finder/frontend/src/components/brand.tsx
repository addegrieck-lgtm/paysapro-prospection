import { cn } from '../lib/format';

export function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn('size-4', className)} fill="none" stroke="currentColor" strokeWidth="2" aria-label="Instagram" role="img">
      <rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}
export function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn('size-4', className)} fill="currentColor" aria-label="Facebook" role="img">
      <path d="M13.5 21v-7.5h2.6l.4-3h-3V8.6c0-.9.3-1.5 1.5-1.5h1.6V4.4c-.3 0-1.2-.1-2.3-.1-2.3 0-3.8 1.4-3.8 3.9v2.3H7.9v3h2.6V21h3z" />
    </svg>
  );
}
export function PlatformIcon({ platform, className }: { platform: string; className?: string }) {
  return platform === 'instagram'
    ? <InstagramIcon className={cn('text-[#c13584]', className)} />
    : <FacebookIcon className={cn('text-[#1877f2]', className)} />;
}

export function Logo({ compact }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <svg viewBox="0 0 64 64" className="size-9 shrink-0" aria-hidden>
        <rect width="64" height="64" rx="14" fill="#16294a" />
        <path d="M12 41c6.5-8 13-8 19.5 0s13 8 19.5 0" fill="none" stroke="#c9a45c" strokeWidth="5" strokeLinecap="round" />
        <circle cx="42" cy="22" r="7" fill="none" stroke="#fff" strokeWidth="4" /><path d="M47 27l6 6" stroke="#fff" strokeWidth="4" strokeLinecap="round" />
      </svg>
      {!compact && (
        <div className="leading-tight">
          <div className="font-display text-[17px] text-white">S&amp;S Social Finder</div>
          <div className="text-[10.5px] uppercase tracking-[0.18em] text-[#c9a45c]">Signe &amp; Seine</div>
        </div>
      )}
    </div>
  );
}
