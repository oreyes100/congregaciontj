'use client';

import { useEffect, useState } from 'react';

export type Device = 'mobile' | 'tablet' | 'desktop';

/**
 * Resolves the current device class from viewport width, with a coarse-pointer
 * check so a small laptop window is not mistaken for a tablet.
 *
 * Breakpoints line up with Tailwind's: <768 mobile, <1280 tablet, else desktop.
 * Returns 'desktop' during SSR so the first paint matches the common case.
 */
export function useDevice(): Device {
  const [device, setDevice] = useState<Device>('desktop');

  useEffect(() => {
    const read = () => {
      const w = window.innerWidth;
      const coarse = window.matchMedia('(pointer: coarse)').matches;
      if (w < 768) setDevice('mobile');
      else if (w < 1280 && coarse) setDevice('tablet');
      else if (w < 1024) setDevice('tablet');
      else setDevice('desktop');
    };
    read();
    window.addEventListener('resize', read);
    window.addEventListener('orientationchange', read);
    return () => {
      window.removeEventListener('resize', read);
      window.removeEventListener('orientationchange', read);
    };
  }, []);

  return device;
}
