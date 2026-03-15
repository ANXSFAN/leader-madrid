"use client";

import { useState, useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export function useLocation() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [location, setLocation] = useState(pathname);

  useEffect(() => {
    const queryString = searchParams.toString();
    setLocation(queryString ? `${pathname}?${queryString}` : pathname);
  }, [pathname, searchParams]);

  return location;
}
