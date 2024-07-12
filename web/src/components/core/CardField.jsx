/*
 * Copyright (c) [2024] SUSE LLC
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

// @ts-check

import React from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardBody,
  CardFooter,
  Flex,
  FlexItem,
} from "@patternfly/react-core";
import textStyles from "@patternfly/react-styles/css/utilities/Text/text";

// FIXME: improve name and documentation
// TODO: allows having a drawer, see storage/ProposalResultActions

/**
 * Field wrapper built on top of PF/Card
 * @component
 *
 * @todo write documentation
 */
const CardField = ({
  label = undefined,
  value = undefined,
  description = undefined,
  actions = undefined,
  children,
  cardProps = {},
  cardHeaderProps = {},
  cardDescriptionProps = {},
}) => {
  // TODO: replace aria-label with the proper aria-labelledby
  return (
    <Card isCompact isFullHeight isRounded role="region" aria-label={label} {...cardProps}>
      <CardHeader {...cardHeaderProps}>
        <CardTitle>
          <Flex alignItems={{ default: "alignItemsCenter" }}>
            {label && (
              <FlexItem spacer={{ default: "spacerSm" }}>
                <h3>{label}</h3>
              </FlexItem>
            )}
            {value && (
              <FlexItem grow={{ default: "grow" }} className={textStyles.fontSizeXl}>
                {value}
              </FlexItem>
            )}
          </Flex>
        </CardTitle>
      </CardHeader>
      {description && (
        <CardBody isFilled={false} {...cardDescriptionProps}>
          <div className={textStyles.color_200}>{description}</div>
        </CardBody>
      )}
      {children}
      {actions && <CardFooter>{actions}</CardFooter>}
    </Card>
  );
};

CardField.Content = CardBody;
export default CardField;
