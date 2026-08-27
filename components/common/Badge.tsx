export function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 text-xs font-bold leading-5 text-white">
      {children}
    </span>
  );
}
