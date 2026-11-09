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
 * To contact SUSE LLC about this file by physical or electronic mail, you may
 * find current contact information at www.suse.com.
 */

import React from "react";
import { Flex, FlexItem, Title } from "@patternfly/react-core";
import { css } from "@patternfly/react-styles";
import spacingStyles from "@patternfly/react-styles/css/utilities/Spacing/spacing";
import ResultPreview from "~/components/storage/storage-page/ResultPreview";
import { SideDockClose } from "~/components/layout/SideDock";
import Summary from "~/components/storage/storage-page/Summary";
import { useProposal } from "~/hooks/model/proposal/storage";
import { useUnseenChanges } from "~/components/storage/storage-page/use-unseen-changes";
import { _ } from "~/i18n";

/**
 * The preview of the storage result, docked beside the storage page: its
 * summary and the same content as its popup, for readers who want it in sight
 * while they work.
 */
export default function ResultPreviewPanel() {
  const proposal = useProposal();
  const { markSeen } = useUnseenChanges();

  /* In sight the whole time it is docked, so every change is seen as it
     happens: nothing is left to flag as updated once it is put away. */
  React.useEffect(() => markSeen(), [markSeen]);

  return (
    <>
      <Flex
        alignItems={{ default: "alignItemsCenter" }}
        justifyContent={{ default: "justifyContentSpaceBetween" }}
        flexWrap={{ default: "nowrap" }}
        className={css(
          spacingStyles.plLg,
          spacingStyles.prMd,
          spacingStyles.ptMd,
          spacingStyles.pbSm,
        )}
      >
        <FlexItem>
          <Title headingLevel="h2">
            {/* TRANSLATORS: title of a panel beside the storage settings, with
                what the disks will look like and the actions to get there.
                Nothing is applied until the installation starts. */}
            {_("Result preview")}
          </Title>
        </FlexItem>
        <FlexItem>
          <SideDockClose
            // TRANSLATORS: name and tooltip of the button closing the panel
            // beside the storage settings with the storage result preview.
            label={_("Close storage result preview")}
          />
        </FlexItem>
      </Flex>
      <div className={css("agm-side-dock__body", spacingStyles.pxLg, spacingStyles.pbLg)}>
        {proposal && (
          <div className={spacingStyles.mbMd}>
            <Summary isDocked />
          </div>
        )}
        <ResultPreview />
      </div>
    </>
  );
}
