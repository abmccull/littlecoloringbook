"use client";

import Link, { type LinkProps } from "next/link";
import type { AnchorHTMLAttributes, MouseEvent } from "react";
import { trackEvent } from "./analytics-provider";

type TrackedLinkProps = LinkProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof LinkProps> & {
    eventName: string;
    eventProperties?: Record<string, unknown>;
  };

export function TrackedLink({ eventName, eventProperties, onClick, ...props }: TrackedLinkProps) {
  return (
    <Link
      {...props}
      onClick={(event: MouseEvent<HTMLAnchorElement>) => {
        trackEvent(eventName, eventProperties ?? {});
        onClick?.(event);
      }}
    />
  );
}
