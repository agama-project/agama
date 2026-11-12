/*
 * Copyright (c) [2026] SUSE LLC
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

import React, { useEffect, useRef, useState } from "react";
import { Flex, PageSection } from "@patternfly/react-core";

/**
 * The actions of a page with a form, in a page section of their own right
 * after the page content.
 *
 * It follows the content like any form actions, and sticks to the bottom of
 * the screen only when the content is taller than the screen, so the main
 * action stays in reach on long pages without covering short ones. The
 * separator and shadow of a sticky section show only while it is stuck.
 *
 * Its buttons live outside the form element, so they point to it with the
 * `form` attribute.
 *
 * @see https://www.patternfly.org/components/page#pagesection
 *
 * @example
 * <Page.Content>
 *   <Form id="welcomeForm">...</Form>
 * </Page.Content>
 * <StickyActions>
 *   <form.SubmitButton form="welcomeForm" />
 * </StickyActions>
 */
export default function StickyActions({ children }: React.PropsWithChildren) {
  const endRef = useRef<HTMLDivElement>(null);
  const [isStuck, setIsStuck] = useState(false);

  useEffect(() => {
    const end = endRef.current;
    if (!end || !("IntersectionObserver" in window)) return;

    // The mark right after the section is in view when the section is in its
    // own place, at the end of the content, and out of view while the section
    // sticks over the content. Unlike checking the section itself, this holds
    // when its place ends a fraction of a pixel past the visible area.
    const observer = new IntersectionObserver(([entry]) => setIsStuck(!entry.isIntersecting));
    observer.observe(end);

    return () => observer.disconnect();
  }, []);

  return (
    <>
      <PageSection
        hasBodyWrapper={false}
        stickyOnBreakpoint={{ default: "bottom" }}
        className="agm-sticky-actions"
        data-stuck={isStuck}
      >
        <Flex gap={{ default: "gapMd" }} alignItems={{ default: "alignItemsCenter" }}>
          {children}
        </Flex>
      </PageSection>
      <div ref={endRef} className="agm-sticky-actions-end" aria-hidden />
    </>
  );
}
