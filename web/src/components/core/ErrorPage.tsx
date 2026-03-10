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
import { isError, isString } from "radashi";
import { isRouteErrorResponse, useRouteError, ErrorResponse } from "react-router";
import { Content, Skeleton, Stack } from "@patternfly/react-core";
import NestedContent from "~/components/core/NestedContent";
import Page from "~/components/core/Page";
import Text from "~/components/core/Text";
import SplitInfoLayout from "~/components/layout/SplitInfoLayout";
import { _ } from "~/i18n";

/**
 * Returns first-party frames from a stack, falling back to the full stack
 * if filtering leaves nothing (e.g. all frames are third-party).
 */
const relevantTrace = (stack: StackTracey) => stack.filter((x) => !x.thirdParty) || stack;

/**
 * Renders a formatted, source-mapped stack trace for any thrown value.
 *
 * Uses **StackTracey** to parse and enrich the stack with original source
 * locations via `.withSourcesAsync()`. {@link relevantFrames} filters out
 * third-party frames, falling back to the full stack if none remain.
 * If `.withSourcesAsync()` rejects (e.g. source maps unavailable), the
 * same filtering is applied to the raw stack instead.
 *
 * For non-`Error` values (checked via `isError` from **radashi**), the value
 * is JSON-serialised and displayed as-is.
 *
 * A skeleton placeholder is shown while async resolution is in progress.
 *
 * ### Dependency note
 *
 * `.asTable()` delegates to `as-table`, which in turn depends only on
 * `printable-characters` (no further dependencies) — all three packages share
 * the same author as `stacktracey`. It can be dropped at any point if any
 * problem is found, but for now it gives us better formatted error messages
 * at almost no cost.
 */
function ErrorTrace({ error }) {
  const [trace, setTrace] = useState<string | null>(null);

  useEffect(() => {
    if (isError(error)) {
      const stackTracey = new StackTracey(error);
      stackTracey
        .withSourcesAsync()
        .then((stack) => {
          setTrace(relevantTrace(stack).asTable());
        })
        .catch(() => {
          setTrace(relevantTrace(stackTracey).asTable());
        });
    } else {
      setTrace(JSON.stringify(error));
    }
  }, [error]);

  if (trace) return trace;

  return (
    <Stack hasGutter>
      <Skeleton fontSize="sm" size={90} screenreaderText={_("Retrieving error details")} />
      <Skeleton fontSize="sm" width="75%" aria-hidden />
      <Skeleton fontSize="sm" width="40%" aria-hidden />
    </Stack>
  );
}

/**
 * Rendered when React Router surfaces an `ErrorResponse`.
 *
 * Typically a 4xx/5xx thrown from a loader or action via `json()`, or an
 * automatic 404 for an unmatched route.
 *
 * The `data` payload is rendered as-is when it is a string, or
 * JSON-serialised otherwise.
 */
function RouteError({ error }: { error: ErrorResponse }) {
  return (
    <SplitInfoLayout
      icon="deployed_code_alert"
      firstRowStart={`${error.status} ${error.statusText}`}
      firstRowEnd={
        <NestedContent margin="mtSm">
          <Text isBold textStyle={["fontFamilyHeading", "fontSizeLg"]}>
            {isString(error.data) ? error.data : JSON.stringify(error.data)}
          </Text>
        </NestedContent>
      }
    />
  );
}

/**
 * Rendered for any error that is not a React Router `ErrorResponse`.
 *
 * Most commonly an unhandled `Error` thrown inside a component, loader, or
 * action.
 *
 * The heading varies depending on the thrown value:
 * - `"Unexpected error"` for proper `Error` instances (checked via `isError`
 *   from **radashi**), with the error's `.message` shown below.
 * - `"Something went wrong"` for any other value (plain objects, strings,
 *   etc.), with `"Unknown error"` as the message.
 *
 * In both cases {@link ErrorTrace} renders below the message, showing a
 * skeleton placeholder while source-map enrichment is in progress.
 */
function UnexpectedError({ error }: { error: unknown }) {
  const isAnError = isError(error);
  const title = isAnError ? _("Unexpected error") : _("Something went wrong");
  const message = isAnError ? error.message : _("Unknown error");

  return (
    <SplitInfoLayout
      icon="deployed_code_alert"
      firstRowStart={title}
      firstRowEnd={
        <NestedContent margin="mtSm">
          <Text isBold textStyle={["fontFamilyHeading", "fontSizeLg"]}>
            {message}
          </Text>
          <Content component="pre">
            <NestedContent margin="mtSm">
              <ErrorTrace error={error} />
            </NestedContent>
          </Content>
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
