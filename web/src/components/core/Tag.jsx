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

// @ts-check

import React from "react";

/**
 * Simple component that helps wrapped content stand out visually. The variant
 * prop determines what kind of enhancement is applied.
 * @component
 *
 * @param {object} props
 * @param {("simple"|"teal"|"orange"|"gray-highlight")} [props.variant="simple"]
 * @param {React.ReactNode} props.children
 */
export default function Tag ({ variant = "simple", children }) {
  return (
    <span data-type="agama/tag" data-variant={variant}>
      {children}
    </span>
  );
}
