/*
 * Copyright (c) [2024-2026] SUSE LLC
 *
 * All Rights Reserved.
 *
 * This program is free software; you can redistribute it and/or modify it
 * under the terms of the GNU General Public License as published by the Free
 * Software Foundation; either version 2 of the License, or (at your option)
 * any later version.
 *
 * This program is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
 * FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General Public License for
 * more details.
 *
 * You should have received a copy of the GNU General Public License along
 * with this program; if not, contact SUSE LLC.
 *
 * To contact SUSE LLC about this file by physical or electronic mail, you may
 * find current contact information at www.suse.com.
 */

import React from "react";
import { Button, ButtonProps } from "@patternfly/react-core";
import { To, useHref, useLinkClickHandler, useLocation } from "react-router";
import { isUndefined } from "radashi";

export type LinkProps = Omit<ButtonProps, "component"> & {
  /** The target route */
  to: string | To;
  /** Whether the link should replace the current entry in the browser history */
  replace?: boolean;
  /** Whether use PF/Button primary variant */
  isPrimary?: boolean;
  /** Whether preserve the URL query string or not */
  keepQuery?: boolean;
};

function LinkWithHooks({
  to,
  replace = false,
  isPrimary,
  variant,
  children,
  state,
  keepQuery = false,
  onClick,
  ...props
}: LinkProps) {
  const location = useLocation();
  const href = useHref(to);
  const linkVariant = isPrimary ? "primary" : variant || "secondary";
  const destination = keepQuery ? ({ pathname: to, search: location.search } as To) : to;
  const handleClick = useLinkClickHandler(destination, { replace });

  return (
    <Button
      component="a"
      href={href}
      variant={linkVariant}
      onClick={(event: React.MouseEvent<HTMLElement>) => {
        onClick?.(event as React.MouseEvent<HTMLButtonElement, MouseEvent>);
        handleClick(event as React.MouseEvent<HTMLAnchorElement, MouseEvent>);
      }}
      {...props}
    >
      {children}
    </Button>
  );
}

/**
 * Returns an HTML `<a>` tag built on top of PF/Button and useHref ReactRouter hook
 *
 * @note when isPrimary not given or false and props does not contain a variant prop,
 * it will default to "secondary" variant
 */
export default function Link({ to, children, ...props }: LinkProps) {
  if (isUndefined(to)) return children;

  return (
    <LinkWithHooks to={to} {...props}>
      {children}
    </LinkWithHooks>
  );
}
