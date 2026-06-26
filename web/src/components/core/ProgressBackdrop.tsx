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
   * Scope identifier to filter which progresses trigger the backdrop
   * overlay. If no matching tasks exist, the backdrop won't be displayed.
   */
  scope: Scope;
  /**
   * Query keys to wait for after progress completes.
   *
   * Specify the TanStack Query keys for data that the page displays. The
   * backdrop will not dismiss until all specified queries have refetched with
   * fresh data after the operation completes.
   *
   * If omitted or empty, the backdrop dismisses as soon as the backend
   * operation completes without waiting for query refetches.
   *
   * Include the `*_QUERY_KEY` constant exported by each data hook the page
   * uses. For example, a page calling `useProposal()` might include
   * `PROPOSAL_QUERY_KEY` and `EXTENDED_CONFIG_QUERY_KEY`.
   *
   * @example
   * <ProgressBackdrop
   *   scope="storage"
   *   waitFor={[PROPOSAL_QUERY_KEY, EXTENDED_CONFIG_QUERY_KEY, STORAGE_MODEL_QUERY_KEY]}
   * />
   *
   * @example
   * <ProgressBackdrop scope="iscsi" waitFor={[SYSTEM_QUERY_KEY, CONFIG_QUERY_KEY]} />
   *
   * @example
   * // Omitting waitFor dismisses the backdrop as soon as progress ends,
   * // without waiting for any query refetch.
   * <ProgressBackdrop scope="zfcp" />
   */
  waitFor?: readonly string[];
  /**
   * Additional content to render below the progress information.
   *
   * Use this to display extra UI within the backdrop overlay, such as
   * per-device progress details for long-running operations.
   *
   * @example
   * <ProgressBackdrop scope="dasd" waitFor={[...]} extraContent={<DASDFormatProgress />} />
   */
  extraContent?: React.ReactNode;
  /**
   * Label displayed when no active progress step is available but the backdrop
   * is still visible because queries have not finished refetching yet.
   *
   * Defaults to `"Refreshing data..."` if not provided.
   *
   * @example
   * <ProgressBackdrop scope="storage" waitFor={[...]} waitingLabel={_("Applying changes...")} />
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
 * - Tracks refetches for all queries specified in `waitFor`.
 *
 * Once shown, the backdrop remains visible until all specified queries have been
 * refetched after the tracked progress has finished, ensuring the UI does not
 * unblock prematurely with stale data.
 */
export default function ProgressBackdrop({
  scope,
  waitFor,
  extraContent,
  // TRANSLATORS: Message shown next to a spinner while the UI is being updated
  // after an operation has completed.
  waitingLabel = _("Refreshing data..."),
}: ProgressBackdropProps): React.ReactNode {
  const { loading: isBlocked, progress } = useProgressTracking(scope, waitFor);

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
              isInline
              customIcon={<></>}
              title={
                <Flex
                  id="progressStatus"
                  gap={{ default: "gapMd" }}
                  alignItems={{ default: "alignItemsCenter" }}
                  flexWrap={{ default: "nowrap" }}
                  className={[textStyles.fontSizeLg, "text-balance"].join(" ")}
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
