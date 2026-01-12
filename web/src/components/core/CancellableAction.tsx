/*
 * Copyright (c) [2025-2026] SUSE LLC
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

import React, { useState, useEffect } from "react";
import { Bullseye, Button, Flex, FlexItem, Title } from "@patternfly/react-core";
import { sprintf } from "sprintf-js";
import { n_, _ } from "~/i18n";

export default function CancellableAction({ initialSeconds = 10, onComplete, onCancel }) {
  const [seconds, setSeconds] = useState(initialSeconds);

  useEffect(() => {
    if (seconds <= 0) {
      onComplete?.();
      return;
    }

    const timer = setInterval(() => {
      setSeconds((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [seconds, onComplete]);

  return (
    <Bullseye>
      <Flex
        gap={{ default: "gapLg" }}
        direction={{ default: "column" }}
        alignItems={{ default: "alignItemsCenter" }}
      >
        <Title headingLevel="h1">
          <span role="timer" aria-live="polite" aria-atomic="true">
            {sprintf(
              n_(
                "Installation will start in %s second",
                "Installation will start in %s seconds",
                seconds,
              ),
              seconds,
            )}
          </span>
        </Title>
        <FlexItem>
          <Button onClick={onCancel} size="lg" variant="secondary">
            {_("Cancel")}
          </Button>
        </FlexItem>
      </Flex>
    </Bullseye>
  );
}
