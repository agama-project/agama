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
import { Alert, Button, Content, Flex } from "@patternfly/react-core";
import Popup from "~/components/core/Popup";
import Icon from "~/components/layout/Icon";
import { useFailedDetails } from "~/components/storage/storage-page/playground-switches";
import { _ } from "~/i18n";

export type FailureAlertProps = {
  /** The one sentence the reader needs first. */
  title: React.ReactNode;
  /** What went wrong, shown in place under the title. */
  body: React.ReactNode;
  /** The title of the popup with the suggestions, also its name. */
  popupTitle: React.ReactNode;
  /** Suggestions on how to get out of the problem, behind an action. */
  suggestions?: React.ReactNode;
};

/**
 * PLAYGROUND: the storage page's report of a setup that cannot be applied.
 *
 * A caution, unlike the summary it replaces: nothing can be installed until it
 * is dealt with. What went wrong is said in place, so the reader does not have
 * to ask for it. Only the suggestions on how to fix it wait behind an action,
 * which opens them either in a popup or in place, switched from the console
 * with `agamaFailedDetails`.
 *
 * In place, the action is a disclosure button (aria-expanded) right before
 * what it reveals, following the APG disclosure pattern:
 * https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/
 */
export default function FailureAlert({
  title,
  body,
  popupTitle,
  suggestions,
}: FailureAlertProps): React.ReactNode {
  const mode = useFailedDetails();
  const [isOpen, setIsOpen] = React.useState(false);
  const regionId = React.useId();
  const isExpandable = mode === "expandable";

  let action: React.ReactNode = null;
  if (suggestions && isExpandable) {
    action = (
      <Button
        variant="link"
        isInline
        icon={<Icon name={isOpen ? "keyboard_arrow_down" : "chevron_right"} />}
        aria-expanded={isOpen}
        aria-controls={regionId}
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen
          ? // TRANSLATORS: hides the suggestions on how to fix a storage setup
            // that cannot be applied.
            _("Hide suggestions")
          : // TRANSLATORS: shows, in place, suggestions on how to fix a
            // storage setup that cannot be applied.
            _("See suggestions")}
      </Button>
    );
  } else if (suggestions) {
    action = (
      <Button
        variant="tertiary"
        size="sm"
        // TRANSLATORS: full name of the "See suggestions…" button, for screen
        // readers. It must start with the same words as the visible label.
        aria-label={_("See suggestions to make the storage setup fit")}
        onClick={() => setIsOpen(true)}
      >
        {/* TRANSLATORS: opens a popup with suggestions on how to fix a storage
            setup that cannot be applied. */}
        {_("See suggestions…")}
      </Button>
    );
  }

  return (
    <>
      <Alert isInline variant="warning" component="p" title={title}>
        <Flex
          direction={{ default: "column" }}
          alignItems={{ default: "alignItemsFlexStart" }}
          gap={{ default: "gapSm" }}
        >
          <Content>{body}</Content>
          {action}
          {isExpandable && suggestions && (
            <div id={regionId} hidden={!isOpen}>
              {suggestions}
            </div>
          )}
        </Flex>
      </Alert>
      {!isExpandable && isOpen && (
        <Popup isOpen title={popupTitle} onClose={() => setIsOpen(false)} actions={<Popup.Close />}>
          {suggestions}
        </Popup>
      )}
    </>
  );
}
