import { cn } from '../../utils/formatters';

export function Button({ children, className = '', variant = 'primary', ...props }) {
  const variants = {
    primary: 'bg-enterprise-blue text-white hover:bg-enterprise-blueDark',
    subtle: 'bg-slate-100 text-slate-700 hover:bg-slate-200',
    ghost: 'bg-transparent text-enterprise-blueDark hover:bg-blue-50'
  };

  return (
    <button
      className={cn(
        'inline-flex min-h-10 items-center justify-center gap-2 rounded-md px-4 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-60',
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
