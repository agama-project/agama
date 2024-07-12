/*
 * Copyright (c) [2022] SUSE LLC
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
 * Wrapper component for centering vertically its children
 *
 * @note It could be replaced by the 'vertically-centered' CSS utility class once Firefox add support
 *   by default for the :has selector, which allows having something like
 *
 *   .parent:has(.vertically-centered) {
 *     display: grid;
 *     place-items: center;
 *     block-size: 100%;
 *   }
 *
 *   .vertically-centered { inline-size: 100%; }
 *
 *   We can use \@support CSS at rule and use a workaround when :has not available, but somehow
 *   prefer waiting until Firefox gets support.
 *
 *   To know more, read
 *     - https://www.w3.org/TR/selectors-4/#relational
 *     - https://ishadeed.com/article/css-has-parent-selector/
 *
 * @param {object} props
 * @param {React.ReactNode} props.children
 * @param {React.HTMLAttributes} props.htmlProps
 */
const Center = ({ children, ...htmlProps }) => (
  <div className="vertically-centered" {...htmlProps}>
    <div className="full-width stack">{children}</div>
  </div>
);

export default Center;
