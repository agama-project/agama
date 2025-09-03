/*
 * Copyright (c) [2025] SUSE LLC
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
import { SkipToContent, SkipToContentProps } from "@patternfly/react-core";
import { _ } from "~/i18n";

type SkipToProps = Omit<SkipToContentProps, "href" | "onClick"> & {
  /**
   * The ID (without the "#" prefix) of the element to jump to when the link is activated.
   *
   * The target element must be focusable — either natively (like a <button> or <a>)
   * or by adding `tabIndex={-1}`. Avoid using `tabIndex={0}` to prevent creating an
   * unwanted tab stop in the page’s focus order.
   *
   * Learn more about `tabIndex`:
   * - https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/tabindex
   * - https://allyant.com/blog/mastering-the-aria-tabindex-attribute-for-enhanced-web-accessibility/
   */
  contentId?: string;
};

/**
 * A wrapper around PatternFly's SkipToContent component.
 *
 * Provides an accessible link that helps screen reader and keyboard-only users
 * bypass navigation and other non-essential focusable elements, allowing them
 * to jump directly to the main content of the page by default.
 *
 * The target section and link text can be customized to support navigation to
 * different parts of the page.
 *
 * The link is only visible when the user agent applies the `:focus-visible`
 * pseudo-class, ensuring it appears during keyboard navigation or when
 * visible focus is explicitly required.
 */
export default function SkipToContentLink({
  children,
  contentId = "main-content",
  ...props
}: SkipToProps) {
  const onClick = (e) => {
    e.preventDefault();

    const element = document.getElementById(contentId);
    if (element) {
      element.focus();
      element.scrollIntoView();
    }
  };
  return (
    <SkipToContent href={`#${contentId}`} onClick={onClick} {...props}>
      {children || _("Skip to content")}
    </SkipToContent>
  );
}
