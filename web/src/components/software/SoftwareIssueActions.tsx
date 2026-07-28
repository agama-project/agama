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
import { Button, Flex } from "@patternfly/react-core";
import Link from "~/components/core/Link";
import { useProgressTracking } from "~/hooks/use-progress-tracking";
import { ISSUES_QUERY_KEY } from "~/hooks/model/issue";
import { probeAction } from "~/api";
import { NETWORK } from "~/routes/paths";
import { _ } from "~/i18n";

export type SoftwareIssueActionsProps = {
  /**
   * Whether to render a smaller button, to sit better next to text instead of
   * standing on its own.
   */
  isCompact?: boolean;
};

/**
 * Actions offered when the software information could not be read.
 *
 * Reading the repositories requires a working connection, so two things are
 * offered: a way to review the network settings, and a way to read the
 * software information again once the connection is in place.
 *
 * Reading again is an explicit user action. Setting up a connection does not
 * make the installer retry on its own, so without this the user is left on a
 * screen that never recovers.
 *
 * Reading takes a while, so the button reports its own busy state instead of
 * relying on a page-wide overlay. That keeps the surrounding page usable and
 * prevents a second read from being started while one is running.
 *
 * FIXME: "Reload" is borrowed from another screen while translations are
 * frozen. Revisit the wording, here and in the surrounding texts, once the
 * catalog accepts new strings.
 *
 * FIXME: a disabled button is all the feedback there is, so nothing says what
 * is happening or how far it got, and screen reader users are not told that it
 * started at all. The backend does report the step being performed. Once new
 * strings are allowed, describe the operation and announce it through the
 * global live region added by https://github.com/agama-project/agama/pull/3759.
 *
 * @example
 * <UnavailableState title={...} description={...} actions={<SoftwareIssueActions />} />
 */
export default function SoftwareIssueActions({ isCompact }: SoftwareIssueActionsProps) {
  const { loading } = useProgressTracking("software", [ISSUES_QUERY_KEY]);

  return (
    // The containers rendering these actions lay them out differently and
    // neither of them centers what it holds. Keep them aligned and spaced here
    // so they look the same wherever they go.
    <Flex
      alignItems={{ default: "alignItemsCenter" }}
      gap={{ default: "gapSm" }}
      flexWrap={{ default: "wrap" }}
    >
      <Button
        variant="secondary"
        size={isCompact ? "sm" : "default"}
        onClick={() => probeAction(["software"])}
        isLoading={loading}
        isDisabled={loading}
        // Without this the spinner contributes a hardcoded English "Loading..."
        // to the accessible name of the button.
        spinnerAriaValueText={_("Loading")}
      >
        {/* TRANSLATORS: button to read the software information again */}
        {_("Reload")}
      </Button>
      <Link to={NETWORK.root} variant="link" isInline isDisabled={loading}>
        {/* TRANSLATORS: link to go to network settings */}
        {_("Go to network settings")}
      </Link>
    </Flex>
  );
}
