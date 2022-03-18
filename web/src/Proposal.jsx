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
import { List, ListItem, ExpandableSection } from "@patternfly/react-core";

const renderActionsList = actions => {
  const items = actions.map((a, i) => {
    return (
      <ListItem key={i} className={a.delete ? "delete-action" : null}>
        {a.text}
      </ListItem>
    );
  });
  return <List className="proposal-actions">{items}</List>;
};

const Proposal = ({ data = [] }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (data.length === 0) {
    return null;
  }

  const generalActions = data.filter(a => !a.subvol);
  const subvolActions = data.filter(a => a.subvol);
  const detailsText = isExpanded ? "hide details" : "see details";
  const toggleText = `${subvolActions.length} subvolumes actions (${detailsText})`;

  return (
    <>
      {renderActionsList(generalActions)}
      {subvolActions.length > 0 && (
        <ExpandableSection
          isExpanded={isExpanded}
          onToggle={() => setIsExpanded(!isExpanded)}
          toggleText={toggleText}
          className="expandable-actions"
        >
          {renderActionsList(subvolActions)}
        </ExpandableSection>
      )}
    </>
  );
};

export default Proposal;
