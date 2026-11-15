/*
 * Copyright (c) [2026] SUSE LLC
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
import {
  Card,
  CardBody,
  ExpandableSection,
  Label,
  ListItem,
  Radio,
  Split,
  Stack,
} from "@patternfly/react-core";
import { SubtleContent } from "~/components/core";
import ProductLogo from "~/components/product/ProductLogo";
import Text from "~/components/core/Text";
import { _ } from "~/i18n";

import type { Product } from "~/model/system";

import pfTextStyles from "@patternfly/react-styles/css/utilities/Text/text";

export type ProductSummaryProps = {
  product: Product;
  /** Whether the product is the picked one. */
  isChecked: boolean;
  /** Called when the user picks the product. */
  onChange: () => void;
  /** What to tell about the product modes, if anything. */
  modesLabel?: string;
  /** Content shown after the description, such as choices of the product. */
  children?: React.ReactNode;
};

/**
 * A product in a list to pick one from: a radio with its logo and name, labels
 * telling whether it needs a license accepted and what about its modes, and its
 * description, truncated to two lines with a way to show it all.
 *
 * Meant to be a list item of a plain `List` acting as a radio group.
 */
export default function ProductSummary({
  product,
  isChecked,
  onChange,
  modesLabel,
  children,
}: ProductSummaryProps) {
  const detailsId = `${product.id}-details`;
  const needsLicense = !isEmpty(product.licenses);

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
                {(needsLicense || modesLabel) && (
                  <Split hasGutter>
                    {needsLicense && (
                      <Label variant="outline" isCompact>
                        {/* TRANSLATORS: tag on a product whose license must be accepted to install it */}
                        {_("License acceptance required")}
                      </Label>
                    )}
                    {modesLabel && (
                      <Label variant="outline" isCompact>
                        {modesLabel}
                      </Label>
                    )}
                  </Split>
                )}
                <ExpandableSection
                  variant="truncate"
                  toggleTextCollapsed={
                    // TRANSLATORS: expands a shortened text to show all of it
                    _("Show more")
                  }
                  toggleTextExpanded={
                    // TRANSLATORS: shortens the text back to its first lines
                    _("Show less")
                  }
                  truncateMaxLines={2}
                >
                  <SubtleContent>{product.description}</SubtleContent>
                </ExpandableSection>
                {children}
              </Stack>
            }
          />
        </CardBody>
      </Card>
    </ListItem>
  );
}
