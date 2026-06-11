import { useEffect, useState } from "react";

export type Viewport = {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  width: number;
};

const TABLET_BREAKPOINT = 768;
const DESKTOP_BREAKPOINT = 1280;

function getViewport(): Viewport {
  if (typeof window === "undefined") {
    return { isMobile: true, isTablet: false, isDesktop: false, width: 0 };
  }
  const width = window.innerWidth;
  return {
    width,
    isMobile: width < TABLET_BREAKPOINT,
    isTablet: width >= TABLET_BREAKPOINT && width < DESKTOP_BREAKPOINT,
    isDesktop: width >= DESKTOP_BREAKPOINT,
  };
}

export function useViewport(): Viewport {
  const [viewport, setViewport] = useState<Viewport>(getViewport);

  useEffect(() => {
    const handleResize = () => setViewport(getViewport());
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return viewport;
}
