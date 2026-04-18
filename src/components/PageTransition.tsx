import { ReactNode, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

/**
 * iOS-style page transition wrapper. Re-mounts on route change so the
 * `animate-ios-fade` + slight slide-up plays on every navigation,
 * mimicking UIKit push/pop transitions.
 */
const PageTransition = ({ children }: { children: ReactNode }) => {
  const location = useLocation();
  const [key, setKey] = useState(location.pathname);

  useEffect(() => {
    setKey(location.pathname);
  }, [location.pathname]);

  return (
    <div key={key} className="animate-ios-fade min-h-full">
      {children}
    </div>
  );
};

export default PageTransition;
