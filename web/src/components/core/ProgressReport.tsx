/*
 * Copyright (c) [2022-2025] SUSE LLC
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
import {
  Content,
  Flex,
  ProgressStep,
  ProgressStepper,
  ProgressStepProps,
  Spinner,
  Truncate,
} from "@patternfly/react-core";
import sizingStyles from "@patternfly/react-styles/css/utilities/Sizing/sizing";
import { _ } from "~/i18n";
import { useStatus } from "~/hooks/model/status";
import type { Progress as ProgressType } from "~/model/status";

type StepProps = {
  id: string;
  titleId: string;
  isCurrent: boolean;
  variant?: ProgressStepProps["variant"];
  description?: ProgressStepProps["description"];
};

const Progress = ({
  steps,
  step,
  firstStep,
  detail,
}: {
  steps: string[];
  step: ProgressType;
  firstStep: React.ReactNode;
  detail: ProgressType | undefined;
}) => {
  const stepProperties = (stepNumber: number): StepProps => {
    const properties: StepProps = {
      isCurrent: stepNumber === step.index,
      id: `step-${stepNumber}-id`,
      titleId: `step-${stepNumber}-title`,
    };

    if (stepNumber > step.index) {
      properties.variant = "pending";
      properties.description = <div>{_("Pending")}</div>;
    }

    if (properties.isCurrent) {
      properties.variant = "info";
      if (detail && detail.step !== "") {
        const { step: message, index, size } = detail;
        properties.description = (
          <Flex direction={{ default: "column" }} rowGap={{ default: "rowGapXs" }}>
            <div>{_("In progress")}</div>
            <div>
              <Truncate content={message} trailingNumChars={12} position="middle" />
            </div>
            <div>{`(${index}/${size})`}</div>
          </Flex>
        );
      }
    }

    if (stepNumber < step.index) {
      properties.variant = "success";
      properties.description = <div>{_("Finished")}</div>;
    }

    return properties;
  };

  return (
    <ProgressStepper
      isCenterAligned
      className={[sizingStyles.w_100, sizingStyles.h_33OnMd].join(" ")}
    >
      {firstStep && (
        <ProgressStep key="initial" variant="success">
          {firstStep}
        </ProgressStep>
      )}
      {steps.map((description: StepProps["description"], idx: number) => {
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
 * Shows progress steps when a product is selected.
 */
function ProgressReport({ title, firstStep }: { title: string; firstStep?: React.ReactNode }) {
  const { progresses } = useStatus();

  const managerProgress = progresses.find((t) => t.scope === "manager");
  const softwareProgress = progresses.find((t) => t.scope === "software");
  const storageProgress = progresses.find((t) => t.scope === "storage");

  if (!managerProgress) return;

  const detail = softwareProgress || storageProgress;

  return (
    <Flex
      direction={{ default: "column" }}
      rowGap={{ default: "rowGapMd" }}
      alignItems={{ default: "alignItemsCenter" }}
      justifyContent={{ default: "justifyContentCenter" }}
      className={sizingStyles.h_100OnMd}
    >
      <Spinner size="xl" />
      <Content component="h1">{title}</Content>
      <Progress
        steps={managerProgress.steps}
        step={managerProgress}
        detail={detail}
        firstStep={firstStep}
      />
    </Flex>
  );
}

export default ProgressReport;
