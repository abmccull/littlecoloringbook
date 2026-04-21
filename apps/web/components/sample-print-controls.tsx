"use client";

import { useEffect, useRef, useState } from "react";

type OpenSamplePrintButtonProps = {
  token: string;
  className?: string;
  children: React.ReactNode;
};

export function OpenSamplePrintButton({ token, className, children }: OpenSamplePrintButtonProps) {
  const [isOpening, setIsOpening] = useState(false);
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => {
      cleanupRef.current?.();
    };
  }, []);

  function handleClick() {
    cleanupRef.current?.();
    setIsOpening(true);
    const targetHref = `/sample/${encodeURIComponent(token)}/print`;
    const iframe = document.createElement("iframe");
    iframe.setAttribute("aria-hidden", "true");
    iframe.tabIndex = -1;
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    iframe.style.opacity = "0";
    iframe.style.pointerEvents = "none";

    let resolved = false;

    const finish = () => {
      if (resolved) {
        return;
      }
      resolved = true;
      cleanupRef.current?.();
      cleanupRef.current = null;
      setIsOpening(false);
    };

    const loadTimeoutId = window.setTimeout(() => {
      finish();
    }, 15000);

    const cleanup = () => {
      window.clearTimeout(loadTimeoutId);
      iframe.onload = null;
      iframe.remove();
    };

    cleanupRef.current = cleanup;

    iframe.onload = () => {
      window.clearTimeout(loadTimeoutId);
      const frameWindow = iframe.contentWindow;

      if (!frameWindow) {
        finish();
        return;
      }

      const afterPrintHandler = () => {
        frameWindow.removeEventListener("afterprint", afterPrintHandler);
        window.setTimeout(finish, 80);
      };

      frameWindow.addEventListener("afterprint", afterPrintHandler, { once: true });

      window.setTimeout(() => {
        try {
          frameWindow.focus();
          frameWindow.print();
        } catch {
          finish();
          return;
        }

        window.setTimeout(finish, 60000);
      }, 80);
    };

    document.body.appendChild(iframe);
    iframe.src = targetHref;
  }

  return (
    <button className={className ?? "button button-secondary"} disabled={isOpening} onClick={handleClick} type="button">
      {isOpening ? "Opening print dialog..." : children}
    </button>
  );
}

type PrintDialogButtonProps = {
  className?: string;
  children: React.ReactNode;
};

export function PrintDialogButton({ className, children }: PrintDialogButtonProps) {
  return (
    <button className={className ?? "button button-primary"} onClick={() => window.print()} type="button">
      {children}
    </button>
  );
}
