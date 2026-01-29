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

import React from "react";
import { Flex, EmptyState, Spinner, SpinnerProps } from "@patternfly/react-core";
import sizingStyles from "@patternfly/react-styles/css/utilities/Sizing/sizing";
import spacingStyles from "@patternfly/react-styles/css/utilities/Spacing/spacing";
import { isEmpty } from "radashi";
import { _, TranslatedString } from "~/i18n";

type LoadingProps = {
  /** Text to be rendered alongside the spinner */
  text?: TranslatedString;
  /** Accessible text, required when rendering only the spinner */
  "aria-label"?: string;
  /** Loader style, full screen or inline */
  variant?: "full-screen" | "inline";
  /** Size for the spinner icon */
  spinnerSize?: SpinnerProps["size"];
};

/**
 * Renders a loader centered in the screen
 */
const FullScreenLoading = ({
  text,
  "aria-label": ariaLabel,
  spinnerSize,
}: Omit<LoadingProps, "variant">) => {
  return (
    <Flex
      className={sizingStyles.h_100vh}
      alignContent={{ default: "alignContentCenter" }}
      justifyContent={{ default: "justifyContentCenter" }}
    >
      {isEmpty(text) ? (
        <Spinner
          size={spinnerSize}
          aria-label={ariaLabel}
          aria-hidden={isEmpty(ariaLabel) || undefined}
        />
      ) : (
        <EmptyState
          variant="xl"
          titleText={text}
          headingLevel="h1"
          icon={() => <Spinner size={spinnerSize} aria-hidden />}
        />
      )}
    </Flex>
  );
};

/**
 * Renders an inline loader
 */
const InlineLoading = ({
  text,
  "aria-label": ariaLabel,
  spinnerSize,
}: Omit<LoadingProps, "variant">) => {
  return (
    <Flex gap={{ default: "gapMd" }} className={spacingStyles.pMd}>
      <Spinner
        size={spinnerSize}
        aria-label={ariaLabel}
        aria-hidden={(!isEmpty(text) && isEmpty(ariaLabel)) || undefined}
      />
      {text}
    </Flex>
  );
};

function Loading({
  text,
  "aria-label": ariaLabel,
  variant = "full-screen",
  spinnerSize,
}: LoadingProps) {
  const LoadingComponent = variant === "full-screen" ? FullScreenLoading : InlineLoading;
  const defaultSpinnerSize = variant === "full-screen" ? "xl" : "sm";
  const defaultAriaLabel = _("Loading");

  return (
    <LoadingComponent
      text={text}
      aria-label={ariaLabel || (isEmpty(text) ? defaultAriaLabel : undefined)}
      spinnerSize={spinnerSize || defaultSpinnerSize}
    />
  );
}

export default Loading;
