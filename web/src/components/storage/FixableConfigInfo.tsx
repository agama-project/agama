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
import { List, ListItem } from "@patternfly/react-core";
import { sprintf } from "sprintf-js";
import AlertWithDetailsPopup from "~/components/core/AlertWithDetailsPopup";
import { _, n_ } from "~/i18n";
import type { TranslatedString } from "~/i18n";
import type { Issue } from "~/model/issue";

const Description = ({ issues }: { issues: Issue[] }) => {
  return (
    <List isPlain>
      {issues.map((e, i) => (
        <ListItem key={i}>{e.description}</ListItem>
      ))}
    </List>
  );
};

type FixableConfigInfoProps = {
  issues: Issue[];
};

/** The one line saying how many issues there are to fix. */
function fixableConfigTitle(issues: Issue[]): TranslatedString {
  return sprintf(
    // TRANSLATORS: reported at the top of the storage page when the storage
    // settings have problems that can be fixed on that page. %d is the number
    // of problems.
    n_(
      "The configuration has %d issue to fix.",
      "The configuration has %d issues to fix.",
      issues.length,
    ),
    issues.length,
  );
}

/**
 * Information about a wrong but fixable storage configuration: how many issues
 * there are in one line, and the list of them one action away.
 */
export default function FixableConfigInfo({ issues }: FixableConfigInfoProps) {
  return (
    <AlertWithDetailsPopup
      variant="warning"
      title={fixableConfigTitle(issues)}
      // TRANSLATORS: opens a popup listing the problems of the storage settings.
      actionLabel={_("See issues")}
      // TRANSLATORS: title of the popup listing the problems of the storage
      // settings.
      popupTitle={_("Issues to fix")}
    >
      <Description issues={issues} />
    </AlertWithDetailsPopup>
  );
}

export { fixableConfigTitle };
