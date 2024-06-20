/*
 * Copyright (c) [2022-2024] SUSE LLC
 *
 * All Rights Reserved.
 *
 * This program is free software; you can redistribute it and/or modify it
 * under the terms of version 2 of the GNU General Public License as published
 * by the Free Software Foundation.
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
  Card,
  CardBody,
  Grid,
  GridItem,
  ProgressStepper,
  ProgressStep,
  Spinner,
  Stack,
} from "@patternfly/react-core";

import { _ } from "~/i18n";
import { Center } from "~/components/layout";
import { useInstallerClient } from "~/context/installer";

const Progress = ({ steps, step, firstStep, detail }) => {
  const variant = (index) => {
    if (index < step.current) return "success";
    if (index === step.current) return "info";
    if (index > step.current) return "pending";
  };

  const stepProperties = (stepNumber) => {
    const properties = {
      variant: variant(stepNumber),
      isCurrent: stepNumber === step.current,
      id: `step-${stepNumber}-id`,
      titleId: `step-${stepNumber}-title`,
    };

    if (properties.isCurrent) {
      properties.icon = <Spinner />;
      if (detail && detail.message !== "") {
        const { message, current, total } = detail;
        properties.description = `${message} (${current}/${total})`;
      }
    }

    return properties;
  };

  return (
    <ProgressStepper isCenterAligned>
      {firstStep && (
        <ProgressStep key="initial" variant="success">
          {firstStep}
        </ProgressStep>
      )}
      {steps.map((description, idx) => {
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
 * @component
 *
 * Shows progress steps when a product is selected.
 */
function ProgressReport({ title, firstStep }) {
  const { manager, storage, software } = useInstallerClient();
  const [steps, setSteps] = useState();
  const [step, setStep] = useState();
  const [detail, setDetail] = useState();

  useEffect(() => software.onProgressChange(setDetail), [software, setDetail]);
  useEffect(() => storage.onProgressChange(setDetail), [storage, setDetail]);

  useEffect(() => {
    manager.getProgress().then((progress) => {
      setSteps(progress.steps);
      setStep(progress);
    });

    return manager.onProgressChange(setStep);
  }, [manager, setSteps]);

  const Content = () => {
    if (!steps) {
      return;
    }

    return (
      <Progress
        titleId="progress-title"
        steps={steps}
        step={step}
        detail={detail}
        firstStep={firstStep}
        currentStep={false}
      />
    );
  };

  const progressTitle = !steps ? _("Waiting for progress status...") : title;
  return (
    <Center>
      <Grid hasGutter>
        <GridItem sm={8} smOffset={2}>
          <Card isPlain>
            <CardBody>
              <Stack hasGutter>
                <h1 id="progress-title" style={{ textAlign: "center" }}>
                  {progressTitle}
                </h1>
                <Content />
              </Stack>
            </CardBody>
          </Card>
        </GridItem>
      </Grid>
    </Center>
  );
}

export default ProgressReport;
