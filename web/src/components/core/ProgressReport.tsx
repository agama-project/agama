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
import { sprintf } from "sprintf-js";
import {
  Flex,
  ProgressStep,
  ProgressStepper,
  ProgressStepProps,
  Spinner,
  Truncate,
} from "@patternfly/react-core";
import Text from "~/components/core/Text";
import { _ } from "~/i18n";
import { useStatus } from "~/hooks/model/status";
import type { Progress as ProgressType } from "~/model/status";

const Progress = ({
  steps,
  step,
  detail,
}: {
  steps: string[];
  step: ProgressType;
  detail: ProgressType | undefined;
}) => {
  const stepProperties = (stepNumber: number) => {
    const properties: ProgressStepProps = {
      isCurrent: stepNumber === step.index,
      id: `step-${stepNumber}-id`,
      titleId: `step-${stepNumber}-title`,
    };

    if (stepNumber > step.index) {
      properties.variant = "pending";
    }

    if (properties.isCurrent) {
      properties.variant = "info";
      properties.icon = <Spinner size="sm" />;
      if (detail && detail.step !== "") {
        const { step: message, index, size } = detail;
        properties.description = (
          <Flex direction={{ default: "column" }} rowGap={{ default: "rowGapXs" }}>
            <Truncate content={message} trailingNumChars={12} position="middle" />
            <Text component="small">{sprintf(_("Step %1$d of %2$d"), index, size)}</Text>
          </Flex>
        );
      }
    }

    if (stepNumber < step.index) {
      properties.variant = "success";
    }

    return properties;
  };

  return (
    <ProgressStepper isVertical>
      {steps.map((description, idx: number) => {
        return (
          <ProgressStep key={idx} {...stepProperties(idx + 1)}>
            {description}
          </ProgressStep>
        );
      })}
    </ProgressStepper>
  );
};

/**
 * Renders progress with a PF/ProgresStepper
 */
export default function ProgressReport() {
  const { progresses } = useStatus();

  const managerProgress = progresses.find((t) => t.scope === "manager");
  const softwareProgress = progresses.find((t) => t.scope === "software");
  const storageProgress = progresses.find((t) => t.scope === "storage");

  if (!managerProgress) return;

  const detail = softwareProgress || storageProgress;

  return <Progress steps={managerProgress.steps} step={managerProgress} detail={detail} />;
}
