/*
 * Copyright (c) [2024] SUSE LLC
 *
 * All Rights Reserved.
 *
 * This program is free software; you can redistribute it and/or modify it
 * under the terms of version 2 of the GNU General Public License as published
 * by the Free Software Foundation.
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
import { useHref } from "react-router-dom";

type LinkProps = Omit<ButtonProps, "component"> & {
  /** The target route */
  to: string;
  /** Whether use PF/Button primary variant */
  isPrimary?: boolean;
};

/**
 * Returns an HTML `<a>` tag built on top of PF/Button and useHref ReactRouter hook
 *
 * @note when isPrimary not given or false and props does not contain a variant prop,
 * it will default to "secondary" variant
 */
export default function Link({ to, isPrimary, variant, children, ...props }: LinkProps) {
  const href = useHref(to);
  const linkVariant = isPrimary ? "primary" : variant || "secondary";
  return (
    <Button component="a" href={href} variant={linkVariant} {...props}>
      {children}
    </Button>
  );
}
