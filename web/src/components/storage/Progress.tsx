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

import React, { useEffect, useState } from "react";
import {
  Content,
  Flex,
  ProgressStep,
  ProgressStepper,
  ProgressStepProps,
  Spinner,
} from "@patternfly/react-core";
import { _ } from "~/i18n";
import { useProgress, useProgressChanges, useResetProgress } from "~/queries/progress";
import sizingStyles from "@patternfly/react-styles/css/utilities/Sizing/sizing";
import { STORAGE } from "~/routes/paths";
import { useNavigate } from "react-router-dom";

type StepProps = {
  id: string;
  titleId: string;
  isCurrent: boolean;
  variant?: ProgressStepProps["variant"];
  description?: ProgressStepProps["description"];
};

const ProgressContent = ({ steps, step }) => {
  const stepProperties = (stepNumber: number): StepProps => {
    const properties: StepProps = {
      isCurrent: stepNumber === step.current,
      id: `step-${stepNumber}-id`,
      titleId: `step-${stepNumber}-title`,
    };

    if (stepNumber > step.current) {
      properties.variant = "pending";
      properties.description = <div>{_("Pending")}</div>;
    }

    if (properties.isCurrent) {
      properties.variant = "info";
    }

    if (stepNumber < step.current || step.finished) {
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
function Progress() {
  useResetProgress();
  useProgressChanges();
  const navigate = useNavigate();

  const progress = useProgress("storage");
  const [steps, setSteps] = useState(progress?.steps);

  useEffect(() => {
    if (!progress) return;
    if (progress.steps.length === 0) return;
    if (progress.finished) navigate(STORAGE.root);

    setSteps(progress.steps);
  }, [progress, steps, navigate]);

  if (!progress) return;

  return (
    <Flex
      direction={{ default: "column" }}
      rowGap={{ default: "rowGapMd" }}
      alignItems={{ default: "alignItemsCenter" }}
      justifyContent={{ default: "justifyContentCenter" }}
      className={sizingStyles.h_100OnMd}
    >
      <Spinner size="xl" />
      <Content component="h1">{_("Loading storage")}</Content>
      <ProgressContent steps={steps} step={progress} />
    </Flex>
  );
}

export default Progress;
