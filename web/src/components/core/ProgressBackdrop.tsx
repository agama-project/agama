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
import { concat } from "radashi";
import { sprintf } from "sprintf-js";
import {
  Alert,
  Backdrop,
  Card,
  CardBody,
  CardTitle,
  Flex,
  FlexItem,
  Spinner,
} from "@patternfly/react-core";
import NestedContent from "~/components/core/NestedContent";
import { COMMON_PROPOSAL_KEYS } from "~/hooks/model/proposal";
import { useProgressTracking } from "~/hooks/use-progress-tracking";
import { _ } from "~/i18n";

import type { Scope } from "~/model/status";

import textStyles from "@patternfly/react-styles/css/utilities/Text/text";
import sizingStyles from "@patternfly/react-styles/css/utilities/Sizing/sizing";
import spacingStyles from "@patternfly/react-styles/css/utilities/Spacing/spacing";
import shadowStyles from "@patternfly/react-styles/css/utilities/BoxShadow/box-shadow";

/**
 * Props for the ProgressBackdrop component.
 */
export type ProgressBackdropProps = {
  /**
   * Scope identifier to filter which progresses trigger the backgrop
   * overlay. If undefined or no matching tasks exist, the backdrop won't be
   * displayed.
   */
  scope: Scope;
  /**
   * Additional query keys to track during progress operations.
   *
   * The progress backdrop automatically tracks common proposal-related queries.
   * Use this prop to specify additional query keys that must complete
   * refetching before the backdrop unblocks the UI.
   *
   * This is useful when a page needs to wait for additional queries beyond the
   * common proposal-related ones, either because the page depends on them or
   * because operations on the page invalidate them.
   *
   * @example
   * // Track storage model updates in addition to common proposal queries
   * <ProgressBackdrop track={{ scope: "storage", ensureRefecthed={STORAGE_MODEL_KEY}} />
   *
   * @example
   * // Track multiple additional queries
   * <ProgressBackdrop
   *   track="network"
   *   ensureRefecthed={[NETWORK_CONFIG_KEY, CONNECTIONS_KEY]}
   * >
   */
  ensureRefetched?: string | string[];
  /**
   * Additional content to render below the progress information.
   *
   * Use this to display extra UI within the backdrop overlay, such as
   * per-device progress details for long-running operations.
   *
   * @example
   * <ProgressBackdrop scope="dasd" extraContent={<DASDFormatProgress />} />
   */
  extraContent?: React.ReactNode;
  /**
   * Label displayed when no active progress step is available but the backdrop
   * is still visible because queries have not finished refetching yet.
   *
   * Defaults to `"Refreshing data..."` if not provided.
   *
   * @example
   * <ProgressBackdrop scope="storage" waitingLabel={_("Applying changes...")} />
   */
  waitingLabel?: string;
};

/**
 * Helper component that blocks user interaction by displaying a blurred overlay
 * with progress information while operations matching the specified scope are
 * active.
 *
 * @remarks
 * Visibility is controlled through two mechanisms:
 * - Monitors active tasks from `useStatus()` that match the provided scope.
 * - Tracks refetches for common proposal queries as well as any queries
 *   specified via `ensureRefetched`.
 *
 * Once shown, the backdrop remains visible until all involved queries have been
 * refetched after the tracked progress has finished, ensuring the UI does not
 * unblock prematurely.
 */
export default function ProgressBackdrop({
  scope,
  ensureRefetched,
  extraContent,
  // TRANSLATORS: Message shown next to a spinner while the UI is being updated
  // after an operation has completed.
  waitingLabel = _("Refreshing data..."),
}: ProgressBackdropProps): React.ReactNode {
  const { loading: isBlocked, progress } = useProgressTracking(
    scope,
    concat(COMMON_PROPOSAL_KEYS, ensureRefetched),
  );

  if (!isBlocked) return null;

  return (
    <Backdrop
      role="alert"
      aria-labelledby="progressStatus"
      className={["agm-main-content-overlay", spacingStyles.pt_4xl, spacingStyles.pt_0OnMd].join(
        " ",
      )}
    >
      <Flex
        alignContent={{ default: "alignContentFlexStart", md: "alignContentCenter" }}
        justifyContent={{ default: "justifyContentCenter" }}
        className={sizingStyles.h_100}
      >
        <Card
          isCompact
          className={[
            sizingStyles.w_100,
            sizingStyles.w_75OnMd,
            sizingStyles.w_50OnLg,
            spacingStyles.mxMd,
            spacingStyles.mx_0OnMd,
            shadowStyles.boxShadowMdBottom,
          ].join(" ")}
          style={{ maxHeight: "90%", overflow: "hidden" }}
        >
          <CardTitle>
            <Alert
              isPlain
              customIcon={<></>}
              title={
                <Flex
                  id="progressStatus"
                  gap={{ default: "gapMd" }}
                  alignItems={{ default: "alignItemsCenter" }}
                  flexWrap={{ default: "nowrap" }}
                  className={textStyles.fontSizeLg}
                  style={{ textWrap: "balance" }}
                >
                  <Spinner size="md" aria-hidden />
                  <FlexItem>
                    {progress ? (
                      <>
                        {progress.step}{" "}
                        <small>
                          {sprintf(_("(step %s of %s)"), progress.index, progress.size)}
                        </small>
                      </>
                    ) : (
                      <>{waitingLabel}</>
                    )}
                  </FlexItem>
                </Flex>
              }
            />
          </CardTitle>
          <CardBody style={{ overflow: "auto" }}>
            {extraContent && <NestedContent margin="mxXl">{extraContent}</NestedContent>}
          </CardBody>
        </Card>
      </Flex>
    </Backdrop>
  );
}
