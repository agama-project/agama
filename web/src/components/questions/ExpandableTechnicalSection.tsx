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

import React from "react";
import { CodeBlock, ExpandableSection } from "@patternfly/react-core";
import { NestedContent } from "~/components/core";
import { _ } from "~/i18n";

/**
 * Component for rendering technical details in an expandable section
 *
 * @param text - the technical details to display
 */
export default function ExpandableTechnicalSection({ text }: { text?: string }): React.ReactNode {
  if (!text) return null;

  return (
    <ExpandableSection
      toggleTextExpanded={
        /* TRANSLATORS: Clickable text to hide technical details at a popup window */
        _("Hide technical details")
      }
      toggleTextCollapsed={
        /* TRANSLATORS: Clickable text to show technical details at a popup window */
        _("Show technical details")
      }
    >
      <NestedContent>
        <CodeBlock>
          <pre className={"mh-60dvh"}>{text}</pre>
        </CodeBlock>
      </NestedContent>
    </ExpandableSection>
  );
}
