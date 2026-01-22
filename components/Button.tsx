import React from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "success";
type ButtonSize = "sm" | "md" | "lg";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
};

const base =
  "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition " +
  "focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed";

const sizes: Record<ButtonSize, string> = {
  sm: "h-9 px-3 text-sm",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-5 text-base",
};

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-[#0F4C81] text-white hover:bg-[#0D3F6A] focus:ring-[#0F4C81]/40 shadow-sm",
  secondary:
    "bg-white text-slate-800 border border-slate-200 hover:bg-slate-50 focus:ring-slate-300",
  ghost:
    "bg-transparent text-slate-700 hover:bg-slate-100 focus:ring-slate-300",
  success:
    "bg-[#2E7D32] text-white hover:bg-[#256528] focus:ring-[#2E7D32]/40 shadow-sm",
  danger:
    "bg-[#C62828] text-white hover:bg-[#A81F1F] focus:ring-[#C62828]/40 shadow-sm",
};

export default function Button({
  variant = "primary",
  size = "md",
  leftIcon,
  rightIcon,
  className = "",
  children,
  ...props
}: Props) {
  return (
    <button
      className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}
      {...props}
    >
      {leftIcon ? <span className="text-[1.1em] flex items-center">{leftIcon}</span> : null}
      <span>{children}</span>
      {rightIcon ? <span className="text-[1.1em] flex items-center">{rightIcon}</span> : null}
    </button>
  );
}
