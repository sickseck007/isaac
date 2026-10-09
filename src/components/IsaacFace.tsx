export default function IsaacFace({ className = '' }: { className?: string }) {
  return <svg className={className} viewBox="0 0 64 64" fill="none" aria-hidden="true"><path d="M14 32C14 17 21 8 32 8s18 9 18 24c0 14-7 23-18 23S14 46 14 32Z" fill="currentColor" /><ellipse cx="25" cy="29" rx="3.5" ry="5" fill="#242126"/><ellipse cx="40" cy="29" rx="3.5" ry="5" fill="#242126"/><path d="m25 35-4 12m19-12 4 12" stroke="#85b6c2" strokeWidth="5"/><path d="M28 43q4-5 9 0" stroke="#242126" strokeWidth="2.5" strokeLinecap="round"/></svg>;
}
