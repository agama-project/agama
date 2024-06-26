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
  Flex,
  Grid,
  GridItem,
  ProgressStep,
  ProgressStepper,
  Spinner,
  Stack,
  Truncate
} from "@patternfly/react-core";

import { _ } from "~/i18n";
import { Center } from "~/components/layout";
import { useInstallerClient } from "~/context/installer";

const Progress = ({ steps, step, firstStep, detail }) => {
  const stepProperties = (stepNumber) => {
    const properties = {
      isCurrent: stepNumber === step.current,
      id: `step-${stepNumber}-id`,
      titleId: `step-${stepNumber}-title`,
    };

    if (stepNumber < step.current) {
      properties.variant = "success";
      properties.description = <div>{_("Finished")}</div>;
    }

    if (properties.isCurrent) {
      properties.variant = "info";
      if (detail && detail.message !== "") {
        const { message, current, total } = detail;
        properties.description = (
          <Stack hasGutter>
            <div>{_("In progress")}</div>
            <div>
              <Truncate content={`${message} (${current}/${total})`} trailingNumChars={12} position="middle" />
            </div>
          </Stack>
        );
      }
    }

    if (stepNumber > step.current) {
      properties.variant = "pending";
      properties.description = <div>{_("Pending")}</div>;
    }

    return properties;
  };

  return (
    <ProgressStepper isCenterAligned className="progress-report">
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
        <GridItem sm={10} smOffset={1}>
          <Card isPlain>
            <CardBody>
              <Flex direction={{ default: "column" }} rowGap={{ default: "rowGap2xl" }} alignItems={{ default: "alignItemsCenter" }}>
                <Spinner size="xl" />
                <h1 id="progress-title" style={{ textAlign: "center" }}>
                  {progressTitle}
                </h1>
                <Content />
              </Flex>
            </CardBody>
          </Card>
        </GridItem>
      </Grid>
    </Center>
  );
}

export default ProgressReport;
