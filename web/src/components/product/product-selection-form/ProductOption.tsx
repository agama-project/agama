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
import { isEmpty } from "radashi";
import { sprintf } from "sprintf-js";
import {
  Card,
  CardBody,
  Divider,
  ExpandableSection,
  Label,
  ListItem,
  Radio,
  Split,
  SplitItem,
  Stack,
} from "@patternfly/react-core";
import { SubtleContent } from "~/components/core";
import ProductLogo from "~/components/product/ProductLogo";
import Text from "~/components/core/Text";
import { Mode, Product } from "~/model/system";
import { n_, _ } from "~/i18n";

import pfTextStyles from "@patternfly/react-styles/css/utilities/Text/text";

/**
 * Props for ProductOption component
 */
export type ProductOptionProps = {
  product: Product;
  isCurrent: boolean;
  isChecked: boolean;
  selectedModeId?: Mode["id"];
  currentModeId?: Mode["id"];
  onChange: () => void;
  onModeChange: (mode: Mode) => void;
};

/**
 * Renders a single product option as a radio button with expandable details.
 */
export default function ProductOption({
  product,
  currentModeId,
  selectedModeId,
  isCurrent,
  isChecked,
  onChange,
  onModeChange,
}: ProductOptionProps) {
  const detailsId = `${product.id}-details`;

  const availableModes = product.modes?.filter((mode) =>
    isCurrent ? mode.id !== currentModeId : true,
  );

  const modesCount = availableModes?.length || 0;
  const modesLabel = isCurrent
    ? sprintf(n_("%d other mode available", "%d other modes available", modesCount), modesCount)
    : sprintf(n_("%d mode available", "%d modes available", modesCount), modesCount);

  return (
    <ListItem aria-label={product.name}>
      <Card isPlain={!isChecked} isCompact variant={isChecked ? "secondary" : "default"}>
        <CardBody>
          <Radio
            id={product.id}
            name="product"
            isChecked={isChecked}
            onChange={onChange}
            aria-details={detailsId}
            label={
              <Text isBold className={pfTextStyles.fontSizeLg}>
                <ProductLogo product={product} width="var(--agm-t--logo--size--inline, 2em)" />{" "}
                {product.name}
              </Text>
            }
            body={
              <Stack hasGutter id={detailsId}>
                {(product.license || !isEmpty(availableModes)) && (
                  <Split hasGutter>
                    {product.license && (
                      <Label variant="outline" isCompact>
                        {_("License acceptance required")}
                      </Label>
                    )}
                    {!isEmpty(availableModes) && (
                      <Label variant="outline" isCompact>
                        {modesLabel}
                      </Label>
                    )}
                  </Split>
                )}

                <ExpandableSection
                  variant="truncate"
                  truncateMaxLines={2}
                  toggleTextCollapsed={_("Show more")}
                  toggleTextExpanded={_("Show less")}
                >
                  <SubtleContent>{product.description}</SubtleContent>
                </ExpandableSection>

                {isChecked && !isEmpty(availableModes) && (
                  <>
                    <Divider />
                    <Split hasGutter>
                      {availableModes.map((mode) => (
                        <SplitItem key={mode.id}>
                          <Radio
                            id={mode.id}
                            name="mode"
                            isChecked={mode.id === selectedModeId}
                            onChange={() => onModeChange(mode)}
                            label={<Text isBold>{mode.name}</Text>}
                            description={mode.description}
                          />
                        </SplitItem>
                      ))}
                    </Split>
                  </>
                )}
              </Stack>
            }
          />
        </CardBody>
      </Card>
    </ListItem>
  );
}
