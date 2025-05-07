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

type SkipToContentLinkProps = Omit<SkipToContentProps, "href" | "onClick"> & {
  contentId?: string;
};

/**
 * Skip to content
 */
export default function SkipToContentLink({
  children,
  contentId = "main-content",
  ...props
}: SkipToContentLinkProps) {
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
