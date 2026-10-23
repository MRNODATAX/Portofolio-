/** Displaced frames sharing a path: a signal between people and ideas. */
export default function RelayMark({ className = '' }: { className?: string }) {
  return <svg className={`relay-mark ${className}`} viewBox="0 0 64 64" fill="none" aria-hidden="true"><path className="relay-frame-a" d="M12 40V16h27M12 40h15" stroke="currentColor" strokeWidth="4" strokeLinecap="square"/><path className="relay-frame-b" d="M52 24v24H25M52 24H37" stroke="currentColor" strokeWidth="4" strokeLinecap="square"/><path className="relay-signal" d="M24 34h10l8-10M24 34l8-10" stroke="currentColor" strokeWidth="3" strokeLinejoin="round"/></svg>;
}
