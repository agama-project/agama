/*
 * Copyright (c) [2022-2026] SUSE LLC
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

import React, { useEffect, useState } from "react";
import StackTracey from "stacktracey";
import { isRouteErrorResponse, useRouteError, ErrorResponse } from "react-router";
import { Content, Skeleton, Stack } from "@patternfly/react-core";
import NestedContent from "~/components/core/NestedContent";
import Page from "~/components/core/Page";
import Text from "~/components/core/Text";
import SplitInfoLayout from "~/components/layout/SplitInfoLayout";
import { _ } from "~/i18n";

/**
 * Rendered when React Router surfaces an `ErrorResponse`.
 *
 * Typically a 4xx/5xx thrown from a loader or action via `json()`, or an
 * automatic 404 for an unmatched route.
 */
function RouteError({ error }: { error: ErrorResponse }) {
  return (
    <SplitInfoLayout
      icon="deployed_code_alert"
      firstRowStart={`${error.status} ${error.statusText}`}
      firstRowEnd={
        <NestedContent margin="mtSm">
          <Text isBold textStyle={["fontFamilyHeading", "fontSizeLg"]}>
            {error.data}
          </Text>
        </NestedContent>
      }
    />
  );
}

/**
 * Rendered for any error that is not a React Router `ErrorResponse`
 *
 * Most commonly an unhandled `Error` thrown inside a component, loader, or
 * action.
 *
 * The error's `.message` is shown as the primary heading. When the value is a
 * proper `Error` instance, its stack trace is parsed by **StackTracey**,
 * enriched with original source locations via `.withSourcesAsync()`, stripped of
 * third-party frames, and formatted as a plain-text table via `.asTable()`.
 *
 * ### Dependency note
 *
 * `.asTable()` delegates to `as-table`, which in turn depends only on
 * `printable-characters` (no further dependencies), and both are from
 * the same share author as `stacktracey`. It can be dropped at any point if any
 * problem is found, but for now it provided better formatted error messages
 * at almost no cost.
 */
function UnexpectedError({ error }: { error: unknown }) {
  const [trace, setTrace] = useState<string | null>(null);
  const message = error instanceof Error ? error.message : _("Unknown error");

  useEffect(() => {
    if (!(error instanceof Error)) return;

    const stackTracey = new StackTracey(error.stack);
    stackTracey
      .withSourcesAsync()
      .then((stack) => setTrace(stack.filter((x) => !x.thirdParty).asTable()));
  }, [error]);

  return (
    <SplitInfoLayout
      icon="deployed_code_alert"
      firstRowStart={_("Unexpected error")}
      firstRowEnd={
        <NestedContent margin="mtSm">
          <Text isBold textStyle={["fontFamilyHeading", "fontSizeLg"]}>
            {message}
          </Text>
          {error instanceof Error &&
            (trace ? (
              <Content component="pre">{trace}</Content>
            ) : (
              <NestedContent margin="mtSm">
                <Stack hasGutter>
                  <Skeleton
                    fontSize="sm"
                    size={90}
                    screenreaderText={_("Retrieving error details")}
                  />
                  <Skeleton fontSize="sm" width="75%" aria-hidden />
                  <Skeleton fontSize="sm" width="40%" aria-hidden />
                </Stack>
              </NestedContent>
            ))}
        </NestedContent>
      }
    />
  );
}

/**
 * Top-level error boundary rendered by React Router when an unhandled error
 * propagates out of a route's component tree, loader, or action.
 */
export default function ErrorPage() {
  const error = useRouteError();

  return (
    <Page variant="minimal">
      <Page.Content>
        {isRouteErrorResponse(error) ? (
          <RouteError error={error} />
        ) : (
          <UnexpectedError error={error} />
        )}
      </Page.Content>
    </Page>
  );
}
