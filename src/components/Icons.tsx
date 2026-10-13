export function JointMark() {
  return (
    <svg viewBox="0 0 36 36" fill="none" aria-hidden="true">
      <path d="M7 27 18 8l11 19H7Z" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="7" cy="27" r="4.6" fill="currentColor" />
      <circle cx="18" cy="8" r="4.6" fill="currentColor" />
      <circle cx="29" cy="27" r="4.6" fill="currentColor" />
    </svg>
  );
}
export function Arrow() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path
        d="M3 10h13m-5-5 5 5-5 5"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
      />
    </svg>
  );
}
export function PlaybackIcon({ playing }: { playing: boolean }) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      {playing ? (
        <>
          <rect x="4" y="3" width="4" height="14" fill="currentColor" />
          <rect x="12" y="3" width="4" height="14" fill="currentColor" />
        </>
      ) : (
        <path d="m5 3 12 7-12 7Z" fill="currentColor" />
      )}
    </svg>
  );
}
