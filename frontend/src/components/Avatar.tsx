import { getInitials } from '../lib/initials';

const sizeClass = {
  sm: 'h-8 w-8 text-[10px] ring-1 ring-white/10',
  md: 'h-9 w-9 text-xs ring-1 ring-white/10',
  lg: 'h-11 w-11 text-sm ring-1 ring-white/10',
} as const;

type Size = keyof typeof sizeClass;

type Props = {
  name: string;
  size?: Size;
  className?: string;
  /** Outgoing bubble style (on accent background) */
  variant?: 'default' | 'accent';
};

export function Avatar({ name, size = 'md', className = '', variant = 'default' }: Props) {
  const initials = getInitials(name);
  const base =
    variant === 'accent'
      ? 'bg-white/20 text-white'
      : 'bg-surface-elevated text-slate-200 shadow-inner';

  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full font-semibold tracking-tight ${sizeClass[size]} ${base} ${className}`}
      aria-hidden
    >
      {initials}
    </div>
  );
}
