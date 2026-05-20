import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

const base: IconProps = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

export function IconLeaf(p: IconProps) {
  return (
    <svg {...base} {...p}>
      <path d="M11 20A7 7 0 0 1 4 13c0-5 4-9 9-10 0 5-1 7-3 9s-4 3-4 3" />
      <path d="M2 22c1-3 4-7 9-8" />
    </svg>
  );
}

export function IconPalm(p: IconProps) {
  return (
    <svg {...base} {...p}>
      <path d="M12 22V8" />
      <path d="M12 8c0-3-3-5-7-4 1 3 4 5 7 4Z" />
      <path d="M12 8c0-3 3-5 7-4-1 3-4 5-7 4Z" />
      <path d="M12 8c-1-3 0-6 3-7 1 3 0 6-3 7Z" />
      <path d="M12 8c1-3 0-6-3-7-1 3 0 6 3 7Z" />
      <path d="M9 22h6" />
    </svg>
  );
}

export function IconCheck(p: IconProps) {
  return (
    <svg {...base} strokeWidth={2.2} {...p}>
      <path d="M5 12l5 5L20 7" />
    </svg>
  );
}

export function IconCheckSmall(p: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...p}>
      <path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z" />
    </svg>
  );
}

export function IconMail(p: IconProps) {
  return (
    <svg {...base} {...p}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </svg>
  );
}

export function IconLock(p: IconProps) {
  return (
    <svg {...base} {...p}>
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 1 1 8 0v4" />
    </svg>
  );
}

export function IconEye(p: IconProps) {
  return (
    <svg {...base} {...p}>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function IconEyeOff(p: IconProps) {
  return (
    <svg {...base} {...p}>
      <path d="M3 3l18 18" />
      <path d="M10.6 6.1A9.4 9.4 0 0 1 12 6c6.5 0 10 6 10 6a18 18 0 0 1-3 3.5M6.7 6.7A18 18 0 0 0 2 12s3.5 6 10 6a9 9 0 0 0 4-1" />
      <path d="M14.1 14.1a3 3 0 0 1-4.2-4.2" />
    </svg>
  );
}

export function IconArrow(p: IconProps) {
  return (
    <svg {...base} strokeWidth={2} {...p}>
      <path d="M5 12h14M13 5l7 7-7 7" />
    </svg>
  );
}

export function IconSearch(p: IconProps) {
  return (
    <svg {...base} {...p}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

export function IconUsers(p: IconProps) {
  return (
    <svg {...base} {...p}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

export function IconShield(p: IconProps) {
  return (
    <svg {...base} {...p}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
    </svg>
  );
}

export function IconClipboard(p: IconProps) {
  return (
    <svg {...base} {...p}>
      <rect x="6" y="4" width="12" height="18" rx="2" />
      <path d="M9 4V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1" />
      <path d="M9 12h6M9 16h4" />
    </svg>
  );
}

export function IconTablet(p: IconProps) {
  return (
    <svg {...base} {...p}>
      <rect x="4" y="2" width="16" height="20" rx="2" />
      <path d="M11 18h2" />
    </svg>
  );
}

export function IconCalendar(p: IconProps) {
  return (
    <svg {...base} {...p}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 9h18M8 3v4M16 3v4" />
    </svg>
  );
}

export function IconUpload(p: IconProps) {
  return (
    <svg {...base} {...p}>
      <path d="M12 16V4M7 9l5-5 5 5" />
      <path d="M3 16v3a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-3" />
    </svg>
  );
}

export function IconListCheck(p: IconProps) {
  return (
    <svg {...base} {...p}>
      <path d="M3 6h13M3 12h13M3 18h9" />
      <path d="m17 16 2 2 4-4" />
    </svg>
  );
}

export function IconOil(p: IconProps) {
  return (
    <svg {...base} {...p}>
      <path d="M12 22c-4 0-7-3-7-7 0-4 7-13 7-13s7 9 7 13c0 4-3 7-7 7Z" />
    </svg>
  );
}

export function IconDoor(p: IconProps) {
  return (
    <svg {...base} {...p}>
      <path d="M5 22V3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v19" />
      <path d="M3 22h18" />
      <circle cx="15" cy="13" r="1" fill="currentColor" />
    </svg>
  );
}

export function IconUser(p: IconProps) {
  return (
    <svg {...base} {...p}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  );
}

export function IconIdCard(p: IconProps) {
  return (
    <svg {...base} {...p}>
      <rect x="2" y="5" width="20" height="15" rx="2" />
      <circle cx="8" cy="12" r="2" />
      <path d="M14 11h4M14 15h3" />
    </svg>
  );
}

export function IconCar(p: IconProps) {
  return (
    <svg {...base} {...p}>
      <path d="M5 17H3a1 1 0 0 1-1-1v-4l2.5-5h15L22 12v4a1 1 0 0 1-1 1h-2" />
      <circle cx="7.5" cy="17.5" r="2.5" />
      <circle cx="16.5" cy="17.5" r="2.5" />
    </svg>
  );
}
