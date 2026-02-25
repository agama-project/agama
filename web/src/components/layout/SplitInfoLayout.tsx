import React from "react";
import { isEmpty } from "radashi";
import { Grid, GridItem, Title } from "@patternfly/react-core";
import Icon, { IconProps } from "./Icon";

import textStyles from "@patternfly/react-styles/css/utilities/Text/text";

export type SplitInfoLayoutProps = {
  /**
   * Optional icon name to display at the top
   */
  icon?: IconProps["name"];

  /**
   * Size of the icon (width and height)
   */
  iconSize?: string;

  /**
   * Primary content (rendered as h1 heading) - appears in left column on
   * viewports over "md" size
   */
  firstRowStart: React.ReactNode;

  /**
   * Content for right side of first row (typically primary action button)
   */
  firstRowEnd?: React.ReactNode;

  /**
   * Secondary content (typically description) - appears in left column on
   * viewports over "md" size
   */
  secondRowStart?: React.ReactNode;

  /**
   * Content for right side of second row (typically secondary action button)
   */
  secondRowEnd?: React.ReactNode;
};

/**
 * Responsive layout component
 *
 * A responsive layout component that displays content in a two-column split
 * design on viewports over medium breakpoint, with a vertical divider line
 * between columns. On small viewports, content flows vertically in a single
 * column.
 *
 * @example
 * ```tsx
 * <SplitInfoLayout
 *   icon="error"
 *   iconSize="3rem"
 *   firstRowStart={<h1>Installation failed</h1>}
 *   firstRowEnd={<Button>Reboot</Button>}
 *   secondRowStart={<p>Review logs and try again</p>}
 *   secondRowEnd={<Button>Download logs</Button>}
 * />
 * ```
 *
 * Behavior:
 *
 * On small viewports (< 768px):
 * Despite the prop names suggesting "rows" and "start/end", content actually flows vertically:
 *   1. Icon (if provided, full width)
 *   2. firstRowStart (full width)
 *   3. firstRowEnd (full width)
 *   4. secondRowStart (full width)
 *   5. secondRowEnd (full width)
 *
 * On viewports over medium breakpoint (≥ 768px):
 *
 * Content is arranged in a 2-column grid with a vertical divider:
 *
 *   LEFT COLUMN (right-aligned):  |  RIGHT COLUMN (left-aligned):
 *    - Icon (order: 1)            |   - Empty space (order: 2)
 *    - firstRowStart (order: 3)   |   - firstRowEnd (order: 4)
 *    - secondRowStart (order: 5)  |   - secondRowEnd (order: 6)
 *
 *
 * NOTE: The prop names "Row" and "Start/End" refer to the viewport over "md"
 * breakpoint layout, not the small viewport layout. On small viewports, all
 * content stacks vertically regardless of the "start/end" naming.
 */
export default function SplitInfoLayout({
  icon,
  iconSize = "3rem",
  firstRowStart,
  firstRowEnd,
  secondRowStart,
  secondRowEnd,
}: SplitInfoLayoutProps) {
  return (
    <Grid className="agm-split-info-layout-container">
      <Grid hasGutter className="agm-split-info-layout">
        {icon && (
          <>
            <GridItem span={12} md={6} order={{ md: "1" }}>
              <Icon name={icon} width={iconSize} height={iconSize} />
            </GridItem>
            <GridItem span={12} md={6} order={{ md: "2" }} />
          </>
        )}

        <GridItem md={6} order={{ md: "3" }}>
          <Title
            headingLevel="h1"
            style={{ textWrap: "balance" }}
            className={textStyles.fontSize_3xl}
          >
            {firstRowStart}
          </Title>
        </GridItem>

        <GridItem md={6} order={{ md: "5" }}>
          {secondRowStart}
        </GridItem>

        <GridItem sm={6} order={{ md: "4" }} rowSpan={isEmpty(secondRowEnd) ? 4 : 1}>
          {firstRowEnd}
        </GridItem>

        <GridItem sm={6} order={{ md: "6" }}>
          {secondRowEnd}
        </GridItem>
      </Grid>
    </Grid>
  );
}
