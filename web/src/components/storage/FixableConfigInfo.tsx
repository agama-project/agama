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
import { Content, List, ListItem } from "@patternfly/react-core";
import AlertWithDetailsPopup from "~/components/core/AlertWithDetailsPopup";
import { _, n_ } from "~/i18n";
import type { TranslatedString } from "~/i18n";
import type { Issue } from "~/model/issue";

const Description = ({ issues }: { issues: Issue[] }) => {
  const intro = n_(
    "The configuration must be adapted to address the following issue.",
    "The configuration must be adapted to address the following issues.",
    issues.length,
  );

  return (
    <>
      <Content component="p">{intro}</Content>
      <List>
        {issues.map((e, i) => (
          <ListItem key={i}>{e.description}</ListItem>
        ))}
      </List>
    </>
  );
};

type FixableConfigInfoProps = {
  issues: Issue[];
};

/** The one line saying how many issues there are to fix. */
function fixableConfigTitle(): TranslatedString {
  return _("The configuration is not valid to install the system");
}

/**
 * Information about a wrong but fixable storage configuration: how many issues
 * there are in one line, and the list of them one action away.
 */
export default function FixableConfigInfo({ issues }: FixableConfigInfoProps) {
  return (
    <AlertWithDetailsPopup
      variant="warning"
      title={fixableConfigTitle()}
      // TRANSLATORS: opens a popup listing the problems of the storage settings.
      actionLabel={_("Show issues")}
      // TRANSLATORS: title of the popup listing the problems of the storage
      // settings.
      popupTitle={_("Invalid storage configuration")}
    >
      <Description issues={issues} />
    </AlertWithDetailsPopup>
  );
}

export { fixableConfigTitle };
