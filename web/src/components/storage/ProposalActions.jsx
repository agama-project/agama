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

import React, { useState } from "react";
import {
  Stack,
  StackItem,
  List,
  ListItem,
  ExpandableSection,
  Text
} from "@patternfly/react-core";

// Some actions (e.g., deleting a LV) are reported as several actions joined by a line break
const actionItems = (action, id) => {
  return action.text.split("\n").map((text, index) => {
    return (
      <ListItem key={`${id}-${index}`} className={action.delete ? "proposal-action--delete" : null}>
        {text}
      </ListItem>
    );
  });
};

// TODO: would be nice adding an aria-description to these lists, but aria-description still in
// draft yet and aria-describedby should be used... which id not ideal right now
// https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Attributes/aria-description
const renderActionsList = actions => {
  const items = actions.map(actionItems).flat();
  return <List className="proposal-actions">{items}</List>;
};

export default function ProposalActions ({ actions = [] }) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (actions.length === 0) {
    return null;
  }

  const generalActions = actions.filter(a => !a.subvol);
  const subvolActions = actions.filter(a => a.subvol);
  const userAction = isExpanded ? "Hide" : "Show";
  const toggleText = `${userAction} ${subvolActions.length} subvolumes actions`;

  return (
    <Stack hasGutter>
      <StackItem>
        <Text>
          Actions to perform for creating the file systems and for ensuring the system boots.
        </Text>
      </StackItem>
      <StackItem>
        {renderActionsList(generalActions)}
        {subvolActions.length > 0 && (
          <ExpandableSection
            isIndented
            isExpanded={isExpanded}
            onToggle={() => setIsExpanded(!isExpanded)}
            toggleText={toggleText}
            className="expandable-actions"
          >
            {renderActionsList(subvolActions)}
          </ExpandableSection>
        )}
      </StackItem>
    </Stack>
  );
}
