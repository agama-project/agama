/*
 * TEMPORARY: primary/detail for the storage configuration, following the
 * PatternFly "primary detail simple list in card" demo.
 *
 * Same content as the `storage-primary-detail` playground, arranged the way
 * PatternFly arranges it. Both can be enabled at once, so the two skeletons
 * can be compared against the same configuration.
 *
 * What is taken from the demo:
 *
 *   - The card wraps the drawer instead of sitting inside it. That is what
 *     lets the content side shade at all: a filled card otherwise paints over
 *     the drawer background.
 *   - `isStatic` rather than `isInline`, so the panel is part of the flow with
 *     no overlay and no animation.
 *   - `widths` per breakpoint instead of the minSize, defaultSize and
 *     isResizable trio.
 *
 * What is not taken: the demo builds its list from `SimpleList`, which renders
 * a button per item and marks the current one with a class alone, so a screen
 * reader is told nothing about which item is selected. `DataList` with
 * `selectedDataListItemId` renders a screen reader only radio reflecting the
 * selection and handles arrow keys, which matters on a page whose whole point
 * is which device is being edited. It also leaves room for per-row menus,
 * which a SimpleList item can never hold.
 *
 * `isStatic` is dropped below xl, where the panel goes back to an overlay with
 * a focus trap. PatternFly asks for no focus trap while static, so the two
 * never apply together.
 *
 * Nothing is mocked. It reads the real config model and the real proposal,
 * edits through the real hooks, and navigates to the real forms, so it needs a
 * running backend.
 *
 * Console driven, so the page stays screenshot clean:
 *
 *     storagePlayground.help()
 *     storagePlayground.result("strip")    // panel | strip | none
 *     storagePlayground.panel(false)
 *     storagePlayground.select("drives:0")
 *     storagePlayground.shade("content")   // content | panel | none
 *
 * NOT meant to be committed. Reach it at
 * `#/storage-primary-detail-card-playground` while the temporary route in
 * router.tsx is in place.
 */

import React, { useEffect, useId, useState } from "react";
import { useNavigate } from "react-router";
import spacingStyles from "@patternfly/react-styles/css/utilities/Spacing/spacing";
import {
  Button,
  Content,
  DataList,
  DataListAction,
  DataListCell,
  DataListItem,
  DataListItemCells,
  DataListItemRow,
  SimpleList,
  SimpleListItem,
  Divider,
  Drawer,
  DrawerActions,
  DrawerCloseButton,
  DrawerContent,
  DrawerContentBody,
  DrawerHead,
  DrawerPanelBody,
  DrawerPanelContent,
  EmptyState,
  EmptyStateBody,
  ExpandableSection,
  Flex,
  FlexItem,
  JumpLinks,
  JumpLinksItem,
  Label,
  LabelGroup,
  PageSection,
  Radio,
  Stack,
  StackItem,
  Tab,
  Tabs,
  TabTitleText,
  Title,
  ToggleGroup,
  ToggleGroupItem,
  Tooltip,
} from "@patternfly/react-core";
import ConfigureDeviceMenu from "~/components/storage/ConfigureDeviceMenu";
import Icon from "~/components/layout/Icon";
import MenuButton from "~/components/core/MenuButton";
import NestedContent from "~/components/core/NestedContent";
import Page from "~/components/core/Page";
import ProposalResultSection from "~/components/storage/ProposalResultSection";
import SearchedDeviceMenu from "~/components/storage/SearchedDeviceMenu";
import SearchedVolumeGroupMenu from "~/components/storage/SearchedVolumeGroupMenu";
import Text from "~/components/core/Text";
import configModel from "~/model/storage/config-model";
import * as driveUtils from "~/components/storage/utils/drive";
import * as volumeGroupUtils from "~/components/storage/utils/volume-group";
import * as deviceUtils from "~/components/storage/utils/device";
import {
  deviceBaseName,
  deviceChildren,
  deviceLabel,
  deviceSize,
  partitionableSpacePolicyLabel,
  volumeGroupSpacePolicyLabel,
} from "~/components/storage/utils";
import { formatList } from "~/i18n";
import { generateEncodedPath } from "~/utils";
import { typeWithSize } from "~/components/storage/utils/partition";
import { useActions } from "~/hooks/model/proposal/storage";
import { useDevice } from "~/hooks/model/system/storage";
import {
  useConfigModel,
  useAddPartition,
  useDeleteDrive,
  useDeleteLogicalVolume,
  useDeleteMdRaid,
  useDeletePartition,
  useMissingMountPaths,
  useDevice as useDeviceConfig,
  usePartitionable,
  useSetSpacePolicy,
  useVolumeGroup,
} from "~/hooks/model/storage/config-model";
import { PROPOSAL_QUERY_KEY, EXTENDED_CONFIG_QUERY_KEY } from "~/hooks/model/proposal";
import { STORAGE_MODEL_QUERY_KEY } from "~/hooks/model/storage/config-model";
import { STORAGE as PATHS } from "~/routes/paths";

import type { ConfigModel } from "~/model/storage/config-model";
import type { Storage } from "~/model/system";
import type { TranslatedString } from "~/i18n";

/** Marks a literal as translated. Playground text never reaches the catalogs. */
const t = (text: string): TranslatedString => text as TranslatedString;

type Collection = "drives" | "mdRaids" | "volumeGroups";
type Selection = { collection: Collection; index: number };

type ResultPlacement = "panel" | "strip" | "none";

/** Which side of the drawer reads as the recessed surface. */
type Shade = "content" | "panel" | "none";

/** How the space policy is offered: one radio per option, or a segmented control. */
type PolicyControl = "toggle" | "radios";

/**
 * How the panel arranges its sections, which is the open question once a device
 * has more partitions than fit on screen:
 *
 *   - `stacked`: volumes first, space policy under them. The policy is out of
 *     sight on a long list.
 *   - `space-first`: the same, the other way round. The bounded section leads,
 *     so only the unbounded one scrolls away.
 *   - `tabs`: both always labelled, one shown at a time.
 *   - `anchors`: vertical jump links beside the content, everything scrollable,
 *     nothing hidden.
 *   - `sticky`: stacked, with each heading pinned as its section scrolls, so
 *     what exists stays visible even when its content does not.
 *   - `scroll`: stacked, with the volume list bounded so the policy stays put.
 */
type PanelLayout = "stacked" | "space-first" | "sticky" | "tabs" | "anchors" | "scroll";

/** Console API, so the page itself carries no playground controls. */
type CardPlaygroundApi = {
  help: () => void;
  result: (placement: ResultPlacement) => void;
  panel: (open: boolean) => void;
  select: (id: string | null) => void;
  shade: (side: Shade) => void;
  panelLayout: (layout: PanelLayout) => void;
  policyControl: (control: PolicyControl) => void;
};

declare global {
  interface Window {
    /* Loosely typed on purpose: both storage playgrounds claim this name, and
       only one of them is mounted at a time. */
    storagePlayground?: unknown;
  }
}

const idOf = ({ collection, index }: Selection): string => `${collection}:${index}`;

const parseId = (id: string): Selection | null => {
  const [collection, index] = id.split(":");
  if (!["drives", "mdRaids", "volumeGroups"].includes(collection)) return null;
  return { collection: collection as Collection, index: Number(index) };
};

const PanelLayoutContext = React.createContext<PanelLayout>("tabs");
const PolicyControlContext = React.createContext<PolicyControl>("toggle");

/* Fixed ids: jump links address the scroll container and the sections by selector. */
const PANEL_ID = "storage-detail-panel";
const FIRST_SECTION_ID = "storage-detail-volumes";
const SECOND_SECTION_ID = "storage-detail-space";

const SPACE_POLICIES: ConfigModel.SpacePolicy[] = ["delete", "resize", "keep", "custom"];

/**
 * The verb for each outcome, as a chip reports it.
 *
 * The same terms the control uses, in a different grammar. A control is
 * addressed by the reader, so it says "delete all"; a chip reports a plan, so
 * it says "deleting everything". Sharing the imperative made the chips read as
 * buttons, which is what they must never look like.
 */
const spacePolicyVerb: Record<"delete" | "resize" | "keep", string> = {
  delete: "Deleting",
  resize: "Shrinking",
  keep: "Keeping",
};

type Chip = {
  /** What the chip reads. Short: a row carries several of them. */
  text: string;
  /**
   * Whether this is the outcome that loses data.
   *
   * Colour is reserved for it and nothing else, in an outline treatment: a
   * filled label is the loudest thing PatternFly offers and reads as a button,
   * which a status must never do.
   */
  isDestructive?: boolean;
};

/**
 * What the device is for, as a phrase after its name.
 *
 * Tried as chips first, which lost the relationship between the parts: hosting
 * a volume group and defining partitions of its own are one arrangement, not
 * two labels sitting side by side, and chips cannot say "and". How many volumes
 * the device carries belongs in the same sentence for the same reason.
 *
 * `expandGroups` names the volume groups instead of counting them. The row
 * keeps to a count so it stays one line; the panel, which is about this device
 * alone, has room to say which ones.
 *
 * Returns undefined when the configuration has nothing to say about the device.
 */
const rolePhrase = (
  config: ConfigModel.Config,
  deviceConfig: ConfigModel.Drive | ConfigModel.MdRaid | ConfigModel.VolumeGroup,
  { expandGroups = false }: { expandGroups?: boolean } = {},
): string | undefined => {
  const name = deviceConfig.name;
  const isBoot = configModel.boot.hasDevice(config, name);
  const hostsLvm = configModel.isTargetDevice(config, name);
  const isPartitionable = "partitions" in deviceConfig;
  const volumes = isPartitionable
    ? (deviceConfig as ConfigModel.Drive).partitions.filter((p) => p.mountPath)
    : (deviceConfig as ConfigModel.VolumeGroup).logicalVolumes;
  const mountPaths = volumes.map((v) => v.mountPath);
  const noun = isPartitionable ? "partition" : "logical volume";
  const plural = isPartitionable ? "partitions" : "logical volumes";

  const parts: string[] = [];

  if (mountPaths.includes("/")) parts.push("install");
  if (isBoot) parts.push("boot");

  if (hostsLvm) {
    const groups = (
      isPartitionable
        ? configModel.partitionable.filterVolumeGroups(config, deviceConfig as ConfigModel.Drive)
        : []
    ).map((vg) => vg.vgName);

    if (!groups.length) parts.push("host LVM");
    else if (expandGroups || groups.length === 1) {
      parts.push(`host ${formatList(groups.map((vgName) => `'${vgName}'`))} LVM`);
    } else {
      parts.push(`host ${groups.length} LVM groups`);
    }
  }

  if (volumes.length) {
    parts.push(`define ${volumes.length} ${volumes.length === 1 ? noun : plural}`);
  }

  return parts.length ? formatList(parts) : undefined;
};

/**
 * What installing will do to what is already on the device.
 *
 * The wording matches the control that sets it, verb for verb, and the icon
 * says the same thing again for anyone scanning rather than reading. Colour is
 * carried only by what destroys data, so the difference never rests on it
 * alone.
 *
 * The custom policy says what was actually decided rather than that a decision
 * exists: how many partitions the plan deletes and how many it shrinks.
 * "Decided per partition" tells the reader nothing they can act on.
 */
const spacePolicyChips = (
  deviceConfig: ConfigModel.Drive | ConfigModel.MdRaid | ConfigModel.VolumeGroup,
  isVolumeGroup: boolean,
): Chip[] => {
  const noun = isVolumeGroup ? "volume" : "partition";
  const plural = isVolumeGroup ? "volumes" : "partitions";
  const count = (n: number) => `${n} ${n === 1 ? noun : plural}`;

  switch (deviceConfig.spacePolicy) {
    case "delete":
      return [{ text: `${spacePolicyVerb.delete} everything`, isDestructive: true }];
    case "resize":
      return [{ text: `${spacePolicyVerb.resize} existing ${plural}` }];
    case "keep":
      return [{ text: `${spacePolicyVerb.keep} everything` }];
    case "custom": {
      const volumes = configModel.device.volumes(deviceConfig).filter((v) => v.name);
      const erased = volumes.filter((v) => v.delete).length;
      const shrunk = volumes.filter((v) => v.resizeIfNeeded).length;
      const chips: Chip[] = [];

      // Always the same order, whichever of them applies: a chip that moves
      // between rows has to be read rather than recognised.
      if (shrunk) chips.push({ text: `${spacePolicyVerb.resize} ${count(shrunk)}` });
      if (erased) {
        chips.push({ text: `${spacePolicyVerb.delete} ${count(erased)}`, isDestructive: true });
      }
      if (!chips.length) chips.push({ text: `${spacePolicyVerb.keep} everything` });

      return chips;
    }
    default:
      return [];
  }
};

/* ------------------------------------------------------------ breakpoints */

const XL = "(min-width: 1200px)";

/** True from PatternFly's xl breakpoint up, where the panel sits inline. */
const useIsWide = (): boolean => {
  const [isWide, setIsWide] = useState(() => window.matchMedia(XL).matches);

  useEffect(() => {
    const query = window.matchMedia(XL);
    const update = (event: MediaQueryListEvent) => setIsWide(event.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return isWide;
};

/* ------------------------------------------------------------ panel parts */

type PanelSectionProps = React.PropsWithChildren<{
  title: TranslatedString;
  description?: React.ReactNode;
  /** Anchor target, when the panel is navigated by jump links. */
  id?: string;
  /** Whether the heading stays pinned while its content scrolls past it. */
  isSticky?: boolean;
  /** Action for this section, kept in the heading row so scrolling cannot hide it. */
  actions?: React.ReactNode;
}>;

/**
 * One section of the panel: a heading, an optional line under it, a rule, and
 * the content indented beneath. A fieldset would box the content in, which is
 * too much furniture for a panel that is already a region of its own.
 */
const PanelSection = ({
  title,
  description,
  id,
  isSticky,
  actions,
  children,
}: PanelSectionProps) => (
  <Stack hasGutter>
    <StackItem
      // Pinned against the panel's own scroll container, so the heading of the
      // section you are inside stays readable.
      style={
        isSticky
          ? {
              position: "sticky",
              insetBlockStart: 0,
              zIndex: 1,
              background: "var(--pf-t--global--background--color--primary--default)",
            }
          : undefined
      }
    >
      <Flex
        alignItems={{ default: "alignItemsCenter" }}
        justifyContent={{ default: "justifyContentSpaceBetween" }}
        flexWrap={{ default: "nowrap" }}
      >
        <FlexItem>
          <Title headingLevel="h4" id={id}>
            {title}
          </Title>
        </FlexItem>
        {actions && <FlexItem>{actions}</FlexItem>}
      </Flex>
      {description && <Text textStyle="textColorSubtle">{description}</Text>}
    </StackItem>
    <StackItem>
      <Divider />
    </StackItem>
    <StackItem>
      <NestedContent>{children}</NestedContent>
    </StackItem>
  </Stack>
);

/**
 * A tab's content with its action above it. The tab title already names the
 * section, so there is no heading here to hang the action from.
 */
/** Beyond this many rows the action also goes up top, where scrolling cannot
    take it away. Below it, under the list is where it belongs: next to what it
    adds to. */
const ACTION_IN_HEADER_FROM = 5;

type TabPanelProps = React.PropsWithChildren<{
  intro?: React.ReactNode;
  actions?: React.ReactNode;
  /** How many rows the content holds, which decides where the action goes. */
  rowCount?: number;
}>;

const TabPanel = ({ intro, actions, rowCount = 0, children }: TabPanelProps) => {
  const isLong = rowCount >= ACTION_IN_HEADER_FROM;

  return (
    <Stack hasGutter>
      {intro && (
        <StackItem>
          <Text component="small" textStyle="textColorSubtle">
            {intro}
          </Text>
        </StackItem>
      )}
      {actions && isLong && (
        <StackItem>
          <Flex justifyContent={{ default: "justifyContentFlexEnd" }}>
            <FlexItem>{actions}</FlexItem>
          </Flex>
        </StackItem>
      )}
      <StackItem>{children}</StackItem>
      {actions && !isLong && <StackItem>{actions}</StackItem>}
    </Stack>
  );
};

type PanelPart = {
  title: TranslatedString;
  /** One line saying what this part of the panel is about. */
  intro?: React.ReactNode;
  content: React.ReactNode;
  /** The one thing this part of the panel adds. */
  actions?: React.ReactNode;
  /** How many rows the content holds, which decides where the action goes. */
  rowCount?: number;
};

/**
 * The two things a device detail says: what goes on it, and what happens to
 * what is already there.
 *
 * Stacked, a long list of partitions pushes the space policy out of sight, and
 * a choice about destroying data should not need scrolling to be found. Tabs
 * put both one click away at the cost of showing one at a time. Which is right
 * is the open question, so the panel can be switched between them.
 */
const PanelBody = ({ first, second }: { first: PanelPart; second: PanelPart }) => {
  const layout = React.useContext(PanelLayoutContext);
  const [tab, setTab] = useState<string | number>(0);

  if (layout === "anchors") {
    return (
      <Flex
        flexWrap={{ default: "nowrap" }}
        gap={{ default: "gapLg" }}
        alignItems={{ default: "alignItemsFlexStart" }}
      >
        <FlexItem
          // A rail, not a column: the links exist to point, not to compete with
          // the content for width.
          style={{ flex: "0 0 9rem" }}
        >
          <JumpLinks
            isVertical
            aria-label={t("Sections of this device")}
            scrollableSelector={`#${PANEL_ID}`}
          >
            <JumpLinksItem href={`#${FIRST_SECTION_ID}`}>{first.title}</JumpLinksItem>
            <JumpLinksItem href={`#${SECOND_SECTION_ID}`}>{second.title}</JumpLinksItem>
          </JumpLinks>
        </FlexItem>
        <FlexItem grow={{ default: "grow" }}>
          <Stack hasGutter>
            <StackItem>
              <PanelSection id={FIRST_SECTION_ID} title={first.title} actions={first.actions}>
                {first.content}
              </PanelSection>
            </StackItem>
            <StackItem>
              <PanelSection id={SECOND_SECTION_ID} title={second.title} actions={second.actions}>
                {second.content}
              </PanelSection>
            </StackItem>
          </Stack>
        </FlexItem>
      </Flex>
    );
  }

  if (layout === "tabs") {
    return (
      <Tabs activeKey={tab} onSelect={(_event, key) => setTab(key)} role="region">
        <Tab eventKey={0} title={<TabTitleText>{first.title}</TabTitleText>}>
          <NestedContent margin="mtMd">
            <TabPanel intro={first.intro} actions={first.actions} rowCount={first.rowCount}>
              {first.content}
            </TabPanel>
          </NestedContent>
        </Tab>
        <Tab eventKey={1} title={<TabTitleText>{second.title}</TabTitleText>}>
          <NestedContent margin="mtMd">
            <TabPanel intro={second.intro} actions={second.actions} rowCount={second.rowCount}>
              {second.content}
            </TabPanel>
          </NestedContent>
        </Tab>
      </Tabs>
    );
  }

  if (layout === "sticky") {
    return (
      <Stack hasGutter>
        <StackItem>
          <PanelSection isSticky title={first.title} actions={first.actions}>
            {first.content}
          </PanelSection>
        </StackItem>
        <StackItem>
          <PanelSection isSticky title={second.title} actions={second.actions}>
            {second.content}
          </PanelSection>
        </StackItem>
      </Stack>
    );
  }

  if (layout === "space-first") {
    return (
      <Stack hasGutter>
        <StackItem>
          <PanelSection title={second.title} actions={second.actions}>
            {second.content}
          </PanelSection>
        </StackItem>
        <StackItem>
          <PanelSection title={first.title} actions={first.actions}>
            {first.content}
          </PanelSection>
        </StackItem>
      </Stack>
    );
  }

  if (layout === "scroll") {
    return (
      <Stack hasGutter>
        <StackItem>
          <PanelSection title={first.title} actions={first.actions}>
            {/* A bounded region so the section below never leaves the screen.
                The section action lives in the heading, so scrolling the list
                never takes it away. */}
            <div style={{ maxHeight: "40vh", overflow: "auto" }}>{first.content}</div>
          </PanelSection>
        </StackItem>
        <StackItem>
          <PanelSection title={second.title} actions={second.actions}>
            {second.content}
          </PanelSection>
        </StackItem>
      </Stack>
    );
  }

  return (
    <Stack hasGutter>
      <StackItem>
        <PanelSection title={first.title} actions={first.actions}>
          {first.content}
        </PanelSection>
      </StackItem>
      <StackItem>
        <PanelSection title={second.title} actions={second.actions}>
          {second.content}
        </PanelSection>
      </StackItem>
    </Stack>
  );
};

type SpaceAction = "keep" | "resizeIfNeeded" | "delete";

const spaceActionLabels: Record<SpaceAction, string> = {
  keep: "Keep as is",
  resizeIfNeeded: "Shrink if needed",
  delete: "Delete",
};

/** What the configuration currently plans for one existing partition. */
const spaceActionOf = (
  deviceConfig: ConfigModel.Drive | ConfigModel.MdRaid | ConfigModel.VolumeGroup,
  partitionName: string,
): SpaceAction => {
  const entry = configModel.device.volumes(deviceConfig).find((v) => v.name === partitionName);

  if (!entry) return "keep";
  if (entry.delete) return "delete";
  if (entry.resizeIfNeeded) return "resizeIfNeeded";

  return "keep";
};

/** The mount path the new system gives an existing partition, if it adopts it. */
const reusedAs = (
  deviceConfig: ConfigModel.Drive | ConfigModel.MdRaid | ConfigModel.VolumeGroup,
  partitionName: string,
): string | undefined =>
  configModel.device.volumes(deviceConfig).find((v) => v.name === partitionName)?.mountPath;

type ContentRowProps = {
  collection: Collection;
  index: number;
  partition: Storage.Device;
  /** Whether each partition is being decided one by one. */
  isCustom: boolean;
};

/**
 * One existing partition, with what is planned for it.
 *
 * Two separate questions live here. Whether the new system adopts the partition
 * is asked on every row, since it has nothing to do with making space. What
 * happens to it if space is needed is asked only while the custom policy is
 * chosen, because otherwise the policy above already answered it for everything.
 */
const ContentRow = ({ collection, index, partition, isCustom }: ContentRowProps) => {
  const navigate = useNavigate();
  const selectId = useId();
  const deviceConfig = useDeviceConfig(collection, index);
  const setSpacePolicy = useSetSpacePolicy();
  const mountPath = reusedAs(deviceConfig, partition.name);
  const stored = spaceActionOf(deviceConfig, partition.name);

  // Same reason as the policy toggle: show the answer, then let the model
  // catch up.
  const [pending, setPending] = useState<SpaceAction | null>(null);
  const current = pending || stored;

  useEffect(() => {
    if (pending && stored === pending) setPending(null);
  }, [pending, stored]);
  const reusePath =
    collection === "volumeGroups"
      ? generateEncodedPath(PATHS.volumeGroup.logicalVolume.add, {
          id: (deviceConfig as ConfigModel.VolumeGroup).vgName,
        })
      : generateEncodedPath(PATHS.reusePartition, {
          collection,
          index: String(index),
          deviceName: partition.name,
        });

  const choose = (action: SpaceAction) => {
    setPending(action);

    // Every row's choice travels together: a custom policy is the whole list.
    const actions = configModel.device
      .volumes(deviceConfig)
      .filter((v) => v.name && v.name !== partition.name)
      .map((v) => ({
        deviceName: v.name,
        value: v.delete ? ("delete" as const) : ("resizeIfNeeded" as const),
      }))
      .filter((a) => a.value);

    if (action !== "keep") {
      actions.push({
        deviceName: partition.name,
        value: action === "delete" ? ("delete" as const) : ("resizeIfNeeded" as const),
      });
    }

    setSpacePolicy(collection, index, { type: "custom", actions });
  };

  const trailing = () => {
    if (mountPath) {
      return <Text textStyle="textColorSubtle">{t(`Used for ${mountPath}`)}</Text>;
    }

    return (
      <Button variant="link" isInline onClick={() => navigate(reusePath)}>
        {t("Reuse")}
      </Button>
    );
  };

  return (
    <DataListItem>
      <DataListItemRow>
        <DataListItemCells
          dataListCells={[
            <DataListCell key="name" width={1}>
              <Text isBold>{deviceBaseName(partition)}</Text>
            </DataListCell>,
            <DataListCell key="description" width={2}>
              {deviceUtils.contentDescription(partition)}
            </DataListCell>,
            <DataListCell key="size" width={1}>
              {partition.block?.size ? deviceSize(partition.block.size) : null}
            </DataListCell>,
            <DataListCell key="plan" width={2}>
              {isCustom && !mountPath ? (
                // A native select renders its list wherever the browser likes,
                // which inside a drawer lands nowhere near the row. The menu
                // used everywhere else anchors to its own toggle.
                <MenuButton
                  menuProps={{ popperProps: { position: "end", appendTo: "inline" } }}
                  toggleProps={{
                    id: `${selectId}-action`,
                    variant: "plainText",
                    "aria-label": t(`What to do with ${deviceBaseName(partition)}`),
                  }}
                  items={(Object.keys(spaceActionLabels) as SpaceAction[]).map((action) => (
                    <MenuButton.Item
                      key={action}
                      isSelected={current === action}
                      onClick={() => choose(action)}
                    >
                      {spaceActionLabels[action]}
                    </MenuButton.Item>
                  ))}
                >
                  {spaceActionLabels[current]}
                </MenuButton>
              ) : (
                trailing()
              )}
            </DataListCell>,
          ]}
        />
      </DataListItemRow>
    </DataListItem>
  );
};

/**
 * What the device holds today: its partitions, or the logical volumes of a
 * volume group, as they exist in the system right now.
 */
const CurrentContent = ({
  collection,
  index,
  isCustom,
}: {
  collection: Collection;
  index: number;
  isCustom: boolean;
}) => {
  const deviceConfig = useDeviceConfig(collection, index);
  const device = useDevice(deviceConfig?.name);
  const children = device ? deviceChildren(device) : [];
  const existing = children.filter((child) => "name" in child) as Storage.Device[];

  if (existing.length === 0) {
    return <Content component="p">{t("The device holds nothing at the moment.")}</Content>;
  }

  return (
    <DataList isCompact aria-label={t("Current content")}>
      {existing.map((child) => (
        <ContentRow
          key={child.sid}
          collection={collection}
          index={index}
          partition={child}
          isCustom={isCustom}
        />
      ))}
    </DataList>
  );
};

/* ------------------------------------------------------------- detail bits */

type PolicyRadioProps = {
  policy: ConfigModel.SpacePolicy;
  groupName: string;
  isChecked: boolean;
  label: TranslatedString;
  description: React.ReactNode;
  onChoose: () => void;
};

const PolicyRadio = ({
  policy,
  groupName,
  isChecked,
  label,
  description,
  onChoose,
}: PolicyRadioProps) => (
  <Radio
    id={`${groupName}-${policy}`}
    name={groupName}
    label={label}
    description={description}
    isChecked={isChecked}
    onChange={onChoose}
  />
);

type PolicyOptionProps = {
  collection: Collection;
  index: number;
  policy: ConfigModel.SpacePolicy;
  groupName: string;
  onChoose: () => void;
};

/**
 * One space policy option for a disk or software RAID.
 *
 * Its own component because the description reads the config model. Keeping
 * that call unconditional, in a component whose type never changes, is what
 * keeps the hook order stable.
 */
const PartitionablePolicyOption = ({
  collection,
  index,
  policy,
  groupName,
  onChoose,
}: PolicyOptionProps) => {
  const deviceConfig = useDeviceConfig(collection, index) as ConfigModel.Drive;
  const description = driveUtils.contentActionsDescription(deviceConfig, policy);

  return (
    <PolicyRadio
      policy={policy}
      groupName={groupName}
      isChecked={deviceConfig.spacePolicy === policy}
      label={partitionableSpacePolicyLabel(policy)}
      description={description}
      onChoose={onChoose}
    />
  );
};

/** One space policy option for a volume group. Reads no model. */
const VolumeGroupPolicyOption = ({
  collection,
  index,
  policy,
  groupName,
  onChoose,
}: PolicyOptionProps) => {
  const deviceConfig = useDeviceConfig(collection, index) as ConfigModel.VolumeGroup;

  return (
    <PolicyRadio
      policy={policy}
      groupName={groupName}
      isChecked={deviceConfig.spacePolicy === policy}
      label={volumeGroupSpacePolicyLabel(policy)}
      description={volumeGroupUtils.contentActionsDescription(deviceConfig, policy)}
      onChoose={onChoose}
    />
  );
};

/**
 * Short labels for the segmented control.
 *
 * The full labels are sentences: four of them side by side wrap into a wall of
 * text in a panel this wide. The whole label still reaches a screen reader
 * through each button's accessible name, and the chosen option is spelled out
 * underneath.
 *
 * If this control ships, the real strings need short variants rather than a
 * table like this one.
 *
 * Three of them say what happens to what is already there, and the fourth says
 * that the answer is given row by row instead. Bare verbs were tried first and
 * read as a row of commands, with the odd one out having no verb at all.
 */
const shortPolicyLabel = (policy: ConfigModel.SpacePolicy, isVolumeGroup: boolean): string => {
  switch (policy) {
    case "delete":
      return "Delete all";
    case "resize":
      return "Shrink existing";
    case "keep":
      return "Keep all";
    case "custom":
      return isVolumeGroup ? "Define per volume" : "Define per partition";
  }
};

type PolicyToggleProps = {
  collection: Collection;
  index: number;
  isCustom: boolean;
  onChoose: (policy: ConfigModel.SpacePolicy) => void;
};

type PolicyToggleViewProps = {
  current: ConfigModel.SpacePolicy | null;
  isVolumeGroup: boolean;
  /** Explanation per option, already resolved by the caller. */
  descriptions: Record<ConfigModel.SpacePolicy, string>;
  onChoose: (policy: ConfigModel.SpacePolicy) => void;
};

/**
 * The space policy as a segmented control, with the chosen option explained
 * underneath.
 *
 * Each button carries its own explanation in its accessible name, because
 * PatternFly spreads extra props onto the item's wrapper rather than its
 * button: a tooltip's `aria-describedby` would land on an element nobody can
 * focus, and would never be read. The tooltip stays as a convenience for
 * pointer users, never as the only way to learn what an option does.
 */
const PolicyToggleView = ({
  current,
  isVolumeGroup,
  descriptions,
  onChoose,
}: PolicyToggleViewProps) => {
  const label = (policy: ConfigModel.SpacePolicy) =>
    isVolumeGroup ? volumeGroupSpacePolicyLabel(policy) : partitionableSpacePolicyLabel(policy);

  return (
    <Stack hasGutter>
      <StackItem>
        <ToggleGroup isCompact aria-label={t("What to do with the current content")}>
          {SPACE_POLICIES.map((policy) => (
            <ToggleGroupItem
              key={policy}
              text={shortPolicyLabel(policy, isVolumeGroup)}
              buttonId={`space-policy-${policy}`}
              isSelected={current === policy}
              aria-label={t(`${label(policy)}. ${descriptions[policy]}`)}
              onChange={() => onChoose(policy)}
            />
          ))}
        </ToggleGroup>
        {/* Anchored to each button by id: a Tooltip wrapping the item would sit
            between the group and its buttons and break the segmented look, and
            its aria-describedby would land on an element nobody can focus.
            Below, so it never covers the rest of the group. */}
        {SPACE_POLICIES.map((policy) => (
          <Tooltip
            key={policy}
            position="bottom"
            aria="none"
            content={descriptions[policy]}
            triggerRef={() => document.getElementById(`space-policy-${policy}`)}
          />
        ))}
      </StackItem>
      <StackItem>
        {/* The custom option explains itself through the controls it reveals,
            so repeating "select what to do with each partition" says nothing
            the reader cannot already see. */}
        <Text>{current && current !== "custom" ? descriptions[current] : null}</Text>
      </StackItem>
    </Stack>
  );
};

/**
 * Resolves what each option means for a disk or software RAID.
 *
 * Its own component because those explanations read the config model. Keeping
 * the calls unconditional, in a component whose type never changes, is what
 * keeps the hook order stable: the volume group version below reads nothing,
 * and a single component choosing between them with a condition would render a
 * different number of hooks depending on what is selected.
 */
const PartitionablePolicyToggle = ({ collection, index, current, onChoose }) => {
  const deviceConfig = useDeviceConfig(collection, index) as ConfigModel.Drive;
  const descriptions = Object.fromEntries(
    SPACE_POLICIES.map((policy) => [
      policy,
      driveUtils.contentActionsDescription(deviceConfig, policy),
    ]),
  ) as Record<ConfigModel.SpacePolicy, string>;

  return (
    <PolicyToggleView
      current={current}
      isVolumeGroup={false}
      descriptions={descriptions}
      onChoose={onChoose}
    />
  );
};

/** The same for a volume group, whose explanations read no model. */
const VolumeGroupPolicyToggle = ({ collection, index, current, onChoose }) => {
  const deviceConfig = useDeviceConfig(collection, index) as ConfigModel.VolumeGroup;
  const descriptions = Object.fromEntries(
    SPACE_POLICIES.map((policy) => [
      policy,
      volumeGroupUtils.contentActionsDescription(deviceConfig, policy),
    ]),
  ) as Record<ConfigModel.SpacePolicy, string>;

  return (
    <PolicyToggleView
      current={current}
      isVolumeGroup
      descriptions={descriptions}
      onChoose={onChoose}
    />
  );
};

const PolicyToggle = ({ collection, index, isCustom, onChoose }: PolicyToggleProps) => {
  const deviceConfig = useDeviceConfig(collection, index);
  const stored = isCustom ? "custom" : deviceConfig.spacePolicy;

  // Every edit here writes the whole model and waits for the query to come
  // back, so a control that only reflects stored state stays on the old option
  // for a moment and invites a second click. What was just asked for wins until
  // the model agrees.
  const [pending, setPending] = useState<ConfigModel.SpacePolicy | null>(null);
  const current = pending || stored;

  useEffect(() => {
    if (pending && stored === pending) setPending(null);
  }, [pending, stored]);

  const chooseNow = (policy: ConfigModel.SpacePolicy) => {
    setPending(policy);
    onChoose(policy);
  };

  const Toggle =
    collection === "volumeGroups" ? VolumeGroupPolicyToggle : PartitionablePolicyToggle;

  return <Toggle collection={collection} index={index} current={current} onChoose={chooseNow} />;
};

type SpacePolicyFieldsProps = {
  collection: Collection;
  index: number;
  /** Whether the per row controls are showing. */
  isCustom: boolean;
  onCustomChange: (wanted: boolean) => void;
};

/**
 * The space policy as radios rather than a menu, so every option and its
 * consequence is visible at once. The custom policy still hands over to its own
 * page, which is where the per-partition table lives.
 */
const SpacePolicyFields = ({
  collection,
  index,
  isCustom,
  onCustomChange,
}: SpacePolicyFieldsProps) => {
  const groupName = useId();
  const setSpacePolicy = useSetSpacePolicy();
  const deviceConfig = useDeviceConfig(collection, index);
  const Option =
    collection === "volumeGroups" ? VolumeGroupPolicyOption : PartitionablePolicyOption;

  const choose = (policy: ConfigModel.SpacePolicy) => {
    onCustomChange(policy === "custom");

    if (policy !== "custom") {
      setSpacePolicy(collection, index, { type: policy });
      return;
    }

    // Custom reveals the per partition controls in the list below rather than
    // leaving for a page of its own. Whatever the previous policy implied is
    // carried over, so the list starts from where the user already was.
    const actions = configModel.device
      .volumes(deviceConfig)
      .filter((v) => v.name)
      .map((v) => ({
        deviceName: v.name,
        value: v.delete ? ("delete" as const) : ("resizeIfNeeded" as const),
      }))
      .filter((a) => a.value);

    setSpacePolicy(collection, index, { type: "custom", actions });
  };

  if (React.useContext(PolicyControlContext) === "toggle") {
    return (
      <PolicyToggle collection={collection} index={index} isCustom={isCustom} onChoose={choose} />
    );
  }

  return (
    <Stack hasGutter>
      {SPACE_POLICIES.map((policy) => (
        <StackItem key={policy}>
          <Option
            collection={collection}
            index={index}
            policy={policy}
            groupName={groupName}
            onChoose={() => choose(policy)}
          />
        </StackItem>
      ))}
    </Stack>
  );
};

type VolumeRowProps = {
  mountPath: string;
  description: React.ReactNode;
  editPath: string;
  onDelete: () => void;
};

const VolumeRow = ({ mountPath, description, editPath, onDelete }: VolumeRowProps) => {
  const navigate = useNavigate();

  return (
    <DataListItem>
      <DataListItemRow>
        <DataListItemCells
          dataListCells={[
            <DataListCell key="path" width={1}>
              <Text isBold>{mountPath}</Text>
            </DataListCell>,
            <DataListCell key="description" width={3}>
              {description}
            </DataListCell>,
          ]}
        />
        <DataListAction
          id={`actions-${mountPath}`}
          aria-labelledby={`actions-${mountPath}`}
          aria-label={t(`Options for ${mountPath}`)}
        >
          <MenuButton
            menuProps={{ popperProps: { position: "end" } }}
            toggleProps={{ variant: "plain", "aria-label": t(`Options for ${mountPath}`) }}
            items={[
              <MenuButton.Item key="edit" onClick={() => navigate(editPath)}>
                <Icon name="edit_square" /> {t("Edit")}
              </MenuButton.Item>,
              <MenuButton.Item key="delete" isDanger onClick={onDelete}>
                <Icon name="delete" /> {t("Delete")}
              </MenuButton.Item>,
            ]}
          >
            <Icon name="more_horiz" className="agm-three-dots-icon" />
          </MenuButton>
        </DataListAction>
      </DataListItemRow>
    </DataListItem>
  );
};

type PresetsProps = {
  collection: "drives" | "mdRaids";
  index: number;
};

/**
 * What to offer for a device nobody has configured yet.
 *
 * The plain way in stays the primary action, in the words the rest of the
 * interface already uses. The presets are the shortcuts beside it: what the
 * installer knows how to do on its own, so nobody has to know what a good
 * layout looks like before starting. A preset is only a small payload written
 * to the config model, and the solver fills in the sizes.
 */
const DevicePresets = ({ collection, index }: PresetsProps) => {
  const navigate = useNavigate();
  const addPartition = useAddPartition();
  const missingMountPaths = useMissingMountPaths();
  const addPath = generateEncodedPath(PATHS.addPartition, { collection, index: String(index) });

  const apply = (mountPaths: string[]) =>
    mountPaths.forEach((mountPath) => addPartition(collection, index, { mountPath }));

  // The system needs a root; the product may ask for more alongside it.
  const canHostSystem = missingMountPaths.includes("/");
  const systemPaths = canHostSystem ? missingMountPaths : [];
  const otherPaths = missingMountPaths.filter((path) => path !== "/").slice(0, 2);
  const hasPresets = canHostSystem || otherPaths.length > 0;

  return (
    <Stack hasGutter>
      <StackItem>
        <Content component="p">{t("Nothing is planned for this device yet.")}</Content>
      </StackItem>
      <StackItem>
        <Button variant="primary" onClick={() => navigate(addPath)}>
          {t("Add or use partition")}
        </Button>
      </StackItem>
      {hasPresets && (
        <StackItem>
          <Stack>
            <StackItem>
              <Text textStyle="textColorSubtle">{t("Or let the installer set it up:")}</Text>
            </StackItem>
            {canHostSystem && (
              <StackItem>
                <Button variant="link" isInline onClick={() => apply(systemPaths)}>
                  {t("Install the system here")}
                </Button>
                <Text textStyle={["textColorSubtle", "fontSizeSm"]}>
                  {t(` (creates ${systemPaths.join(", ")})`)}
                </Text>
              </StackItem>
            )}
            {otherPaths.map((mountPath) => (
              <StackItem key={mountPath}>
                <Button variant="link" isInline onClick={() => apply([mountPath])}>
                  {t(`Use it for ${mountPath}`)}
                </Button>
              </StackItem>
            ))}
          </Stack>
        </StackItem>
      )}
    </Stack>
  );
};

type SpaceSectionProps = {
  collection: Collection;
  index: number;
};

/**
 * What is on the device, and what happens to it.
 *
 * Holds whether the per row controls are showing. The model cannot answer that
 * on its own: a custom policy where every row is left alone is the same thing
 * as keeping everything, so the backend stores it as "keep" and the choice
 * would spring back the moment it was made. Once asked for, the rows stay until
 * another policy is chosen.
 */
const SpaceSection = ({ collection, index }: SpaceSectionProps) => {
  const deviceConfig = useDeviceConfig(collection, index);
  const [wantsRows, setWantsRows] = useState(false);
  const isCustom = deviceConfig?.spacePolicy === "custom" || wantsRows;

  return (
    <Stack hasGutter>
      <StackItem>
        <SpacePolicyFields
          collection={collection}
          index={index}
          isCustom={isCustom}
          onCustomChange={setWantsRows}
        />
      </StackItem>
      <StackItem>
        <CurrentContent collection={collection} index={index} isCustom={isCustom} />
      </StackItem>
    </Stack>
  );
};

type PartitionableDetailProps = {
  collection: "drives" | "mdRaids";
  index: number;
};

const PartitionableDetail = ({ collection, index }: PartitionableDetailProps) => {
  const navigate = useNavigate();
  const config = useConfigModel();
  const deviceConfig = usePartitionable(collection, index);
  const deletePartition = useDeletePartition();
  const isUsed =
    configModel.partitionable.isUsed(config, deviceConfig.name) ||
    configModel.boot.hasDevice(config, deviceConfig.name);
  const partitions = deviceConfig.partitions.filter((p) => p.mountPath);
  const addPath = generateEncodedPath(PATHS.addPartition, { collection, index: String(index) });

  if (!isUsed) {
    return <DevicePresets collection={collection} index={index} />;
  }

  const partitionsContent = (
    <>
      {partitions.length > 0 && (
        <DataList isCompact aria-label={t("Partitions")}>
          {partitions.map((partition) => (
            <VolumeRow
              key={partition.mountPath}
              mountPath={partition.mountPath}
              description={typeWithSize(partition)}
              editPath={generateEncodedPath(PATHS.editPartition, {
                collection,
                index: String(index),
                partitionId: partition.mountPath,
              })}
              onDelete={() => deletePartition(collection, index, partition.mountPath)}
            />
          ))}
        </DataList>
      )}
    </>
  );

  return (
    <PanelBody
      first={{
        title: t("Partitions"),
        intro: t("What the new system will have on this disk."),
        content: partitionsContent,
        rowCount: partitions.length,
        actions: (
          <Button variant="link" isInline onClick={() => navigate(addPath)}>
            <Flex alignItems={{ default: "alignItemsCenter" }} gap={{ default: "gapXs" }}>
              <Icon name="add_circle" /> {t("Add or use partition")}
            </Flex>
          </Button>
        ),
      }}
      second={{
        title: t("Current content"),
        intro: t("What the disk holds today, and what installing will do to it."),
        content: <SpaceSection collection={collection} index={index} />,
      }}
    />
  );
};

const VolumeGroupDetail = ({ index }: { index: number }) => {
  const navigate = useNavigate();
  const vg = useVolumeGroup(index);
  const deleteLogicalVolume = useDeleteLogicalVolume();
  const addPath = generateEncodedPath(PATHS.volumeGroup.logicalVolume.add, { id: vg.vgName });

  const volumesContent = (
    <>
      {vg.logicalVolumes.length > 0 && (
        <DataList isCompact aria-label={t("Logical volumes")}>
          {vg.logicalVolumes.map((lv) => (
            <VolumeRow
              key={lv.mountPath}
              mountPath={lv.mountPath}
              description={typeWithSize(lv)}
              editPath={generateEncodedPath(PATHS.volumeGroup.logicalVolume.edit, {
                id: vg.vgName,
                logicalVolumeId: lv.mountPath,
              })}
              onDelete={() => deleteLogicalVolume(vg.vgName, lv.mountPath)}
            />
          ))}
        </DataList>
      )}
    </>
  );

  return (
    <PanelBody
      first={{
        title: t("Logical volumes"),
        intro: t("What the new system will have on this volume group."),
        content: volumesContent,
        rowCount: vg.logicalVolumes.length,
        actions: (
          <Button variant="link" isInline onClick={() => navigate(addPath)}>
            <Flex alignItems={{ default: "alignItemsCenter" }} gap={{ default: "gapXs" }}>
              <Icon name="add_circle" /> {t("Add logical volume")}
            </Flex>
          </Button>
        ),
      }}
      second={{
        title: t("Current content"),
        intro: t("What the volume group holds today, and what installing will do to it."),
        content: <SpaceSection collection="volumeGroups" index={index} />,
      }}
    />
  );
};

/* --------------------------------------------------------------- the rows */

type RowShellProps = React.PropsWithChildren<{
  selection: Selection;
  isActive: boolean;
  onSelect: () => void;
}>;

/**
 * The row chrome, shared by every kind of configured device.
 *
 * `aria-current` is set by hand: PatternFly marks the current item with a class
 * only, which tells a screen reader nothing about what is selected.
 */
const RowShell = ({ selection, isActive, onSelect, children }: RowShellProps) => (
  <SimpleListItem
    itemId={idOf(selection)}
    isActive={isActive}
    onClick={onSelect}
    componentProps={{
      "aria-current": isActive ? "true" : undefined,
      // What makes a selected tab read as selected is the accent line, not a
      // fill: the fill alone was either invisible or a wall of brand colour,
      // depending on which token it borrowed. The line marks the row the same
      // way, and the faint background is PatternFly's own.
      style: isActive
        ? {
            borderInlineStart:
              "var(--pf-t--global--border--width--strong) solid var(--pf-t--global--border--color--brand--default)",
            backgroundColor: "var(--pf-t--global--background--color--action--plain--clicked)",
          }
        : { borderInlineStart: "var(--pf-t--global--border--width--strong) solid transparent" },
    }}
  >
    <Stack hasGutter>{children}</Stack>
  </SimpleListItem>
);

/**
 * The chips of one row.
 *
 * No tooltips: a chip is static text, and PatternFly does not make a tooltip's
 * trigger focusable, so a keyboard would never reach one. Making them focusable
 * to fix that turns every chip into a tab stop that leads nowhere, and a list of
 * six devices carries close to twenty of them.
 *
 * The chip text therefore has to stand on its own, and the panel carries the
 * long form for the device the reader has selected.
 */
/**
 * The device's name, then what it is for.
 *
 * A device nobody has configured says so and steps back: nothing is planned for
 * it, so it should not compete with the rows that carry decisions. The words say
 * it too, since a grey row is not something everyone can see.
 */
const RowTitle = ({ label, purpose }: { label: string; purpose?: string }) => {
  // Nothing is planned for it, so the whole line steps back, name included:
  // emphasising the name of a device with no decisions behind it would put it
  // level with the rows that carry them.
  if (!purpose) {
    return (
      <StackItem>
        <Text textStyle="textColorSubtle">{`${label} ${t("not configured yet")}`}</Text>
      </StackItem>
    );
  }

  return (
    <StackItem>
      <Text component="strong">{label}</Text> <Text>{purpose}</Text>
    </StackItem>
  );
};

const RowSummary = ({ chips }: { chips: (Chip | undefined)[] }) => (
  <StackItem>
    <LabelGroup numLabels={5}>
      {chips.filter(Boolean).map((chip) => (
        <Label
          key={chip.text}
          isCompact
          variant="outline"
          color={chip.isDestructive ? "red" : undefined}
          icon={chip.isDestructive ? <Icon name="warning" /> : undefined}
        >
          {chip.text}
        </Label>
      ))}
    </LabelGroup>
  </StackItem>
);

type RowProps = {
  selection: Selection;
  isActive: boolean;
  onSelect: () => void;
};

/**
 * A disk or software RAID as one row: the sentence the real page uses as its
 * header, plus the content and space summaries. No menu, no expander: the
 * device actions live in the panel head.
 *
 * `driveUtils.contentActionsSummary` reads the config model, so it is called
 * before any early return.
 */
const PartitionableRow = ({ selection, isActive, onSelect }: RowProps) => {
  const { collection, index } = selection;
  const config = useConfigModel();
  const deviceConfig = configModel.findDevice(config, collection, index) as ConfigModel.Drive;
  const device = useDevice(deviceConfig?.name);
  if (!device) return null;

  const purpose = rolePhrase(config, deviceConfig);

  return (
    <RowShell selection={selection} isActive={isActive} onSelect={onSelect}>
      <RowTitle label={deviceLabel(device)} purpose={purpose} />
      {purpose && <RowSummary chips={spacePolicyChips(deviceConfig, false)} />}
    </RowShell>
  );
};

/** A volume group as one row. Its summaries read no model, unlike a drive's. */
const VolumeGroupRow = ({ selection, isActive, onSelect }: RowProps) => {
  const config = useConfigModel();
  const vg = configModel.findDevice(
    config,
    selection.collection,
    selection.index,
  ) as ConfigModel.VolumeGroup;
  const device = useDevice(vg?.name);

  if (!vg) return null;

  const label = device ? deviceLabel(device) : vg.vgName;
  const purpose = rolePhrase(config, vg);

  return (
    <RowShell selection={selection} isActive={isActive} onSelect={onSelect}>
      <RowTitle label={label} purpose={purpose} />
      {purpose && <RowSummary chips={spacePolicyChips(vg, true)} />}
    </RowShell>
  );
};

const DeviceRow = (props: RowProps) =>
  props.selection.collection === "volumeGroups" ? (
    <VolumeGroupRow {...props} />
  ) : (
    <PartitionableRow {...props} />
  );

/* ------------------------------------------------------------- panel head */

/** The selected device's label, as the panel heading. */
const SelectionTitle = ({ selection }: { selection: Selection }) => {
  const config = useConfigModel();
  const deviceConfig = configModel.findDevice(config, selection.collection, selection.index);
  const device = useDevice(deviceConfig?.name);

  if (device) return <>{deviceLabel(device)}</>;

  // A volume group the user just created lives only in the configuration.
  return <>{(deviceConfig as ConfigModel.VolumeGroup)?.vgName || deviceConfig?.name}</>;
};

/** What the selected device is used for, shown under the panel heading. */
const SelectionRole = ({ selection }: { selection: Selection }) => {
  const config = useConfigModel();
  const deviceConfig = configModel.findDevice(config, selection.collection, selection.index);

  if (!deviceConfig) return null;

  const purpose = rolePhrase(config, deviceConfig, { expandGroups: true });

  return <Text textStyle="textColorSubtle">{t(purpose || "Not configured yet")}</Text>;
};

/** The device actions, in the panel head rather than as a section of its body. */
const PanelDeviceActions = ({ selection }: { selection: Selection }) => {
  const { collection, index } = selection;
  const config = useConfigModel();
  const deviceConfig = configModel.findDevice(config, collection, index);
  const device = useDevice(deviceConfig?.name);
  const deleteDrive = useDeleteDrive();
  const deleteMdRaid = useDeleteMdRaid();

  if (!deviceConfig) return null;

  if (collection === "volumeGroups") {
    if (!device) return null;

    return (
      <SearchedVolumeGroupMenu
        deviceConfig={deviceConfig as ConfigModel.VolumeGroup}
        device={device}
      />
    );
  }

  if (!device) return null;

  const deleteFn = () => (collection === "drives" ? deleteDrive(index) : deleteMdRaid(index));

  return (
    <SearchedDeviceMenu
      modelDevice={deviceConfig as ConfigModel.Drive}
      selected={device}
      deleteFn={deleteFn}
    />
  );
};

/* ------------------------------------------------------------ result view */

/** Result placement candidate: a sticky line at the bottom of the page. */
const ResultStrip = () => {
  const [isOpen, setIsOpen] = useState(false);
  const actions = useActions();
  const destructive = actions.filter((a) => a.delete && !a.subvol).length;
  const other = actions.length - destructive;

  const toggleText = [
    destructive === 1 ? "1 destructive action" : `${destructive} destructive actions`,
    other === 1 ? "1 other change" : `${other} other changes`,
  ].join(", ");

  return (
    <PageSection stickyOnBreakpoint={{ default: "bottom" }} hasBodyWrapper={false} component="div">
      <ExpandableSection
        isExpanded={isOpen}
        onToggle={() => setIsOpen(!isOpen)}
        toggleText={t(toggleText)}
      >
        <ProposalResultSection />
      </ExpandableSection>
    </PageSection>
  );
};

/* ----------------------------------------------------------------- layout */

function PrimaryDetail(): React.ReactNode {
  const config = useConfigModel();
  const actions = useActions();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [placement, setPlacement] = useState<ResultPlacement>("none");
  const [isPanelOpen, setIsPanelOpen] = useState(true);
  const [shade, setShade] = useState<Shade>("none");
  const [panelLayout, setPanelLayout] = useState<PanelLayout>("tabs");
  const [policyControl, setPolicyControl] = useState<PolicyControl>("toggle");
  const isWide = useIsWide();

  /* Console driven, so the page itself stays screenshot clean. */
  useEffect(() => {
    const api: CardPlaygroundApi = {
      help: () => {
        console.info(
          [
            "storagePlayground",
            '  result("panel" | "strip" | "none")   where the result goes',
            "  panel(true | false)                  open or close the side panel",
            '  select("drives:0" | null)            put a device in the panel',
            '  shade("content" | "panel" | "none")  which side looks recessed',
            "  panelLayout(...)                     how the panel arranges its sections",
            '                                       "stacked" | "space-first" | "sticky"',
            '  policyControl("toggle" | "radios")   how the space policy is offered',
            '                                       | "tabs" | "anchors" | "scroll"',
          ].join("\n"),
        );
      },
      result: (next) => {
        setPlacement(next);
        if (next === "panel") setIsPanelOpen(true);
      },
      panel: (open) => setIsPanelOpen(open),
      select: (id) => {
        setSelectedId(id);
        if (id) setIsPanelOpen(true);
      },
      shade: (side) => setShade(side),
      panelLayout: (next) => setPanelLayout(next),
      policyControl: (next) => setPolicyControl(next),
    };

    window.storagePlayground = api;
    api.help();

    return () => {
      delete window.storagePlayground;
    };
  }, []);

  if (!config) {
    return (
      <EmptyState titleText={t("No configuration model")} headingLevel="h3">
        <EmptyStateBody>
          {t("This layout needs the storage model, which the backend is not offering.")}
        </EmptyStateBody>
      </EmptyState>
    );
  }

  const selection = selectedId ? parseId(selectedId) : null;
  const destructive = actions.filter((a) => a.delete && !a.subvol).length;

  const groups: { title: string; id: string; members: Selection[] }[] = [
    {
      title: "Volume groups",
      id: "configured-volume-groups",
      members: config.volumeGroups.map((_vg, index) => ({
        collection: "volumeGroups" as const,
        index,
      })),
    },
    {
      title: "RAID devices",
      id: "configured-md-raids",
      members: config.mdRaids.map((_md, index) => ({ collection: "mdRaids" as const, index })),
    },
    {
      title: "Disks",
      id: "configured-drives",
      members: config.drives.map((_drive, index) => ({ collection: "drives" as const, index })),
    },
  ].filter((group) => group.members.length > 0);

  const rows: Selection[] = groups.flatMap((group) => group.members);

  /** The panel falls back to the result only where the result lives in it. */
  const panelShowsResult = !selection && placement === "panel";
  const hasPanelContent = selection !== null || panelShowsResult;

  const panelDetail = () => {
    if (!selection) return null;
    if (selection.collection === "volumeGroups")
      return <VolumeGroupDetail index={selection.index} />;
    return <PartitionableDetail collection={selection.collection} index={selection.index} />;
  };

  const panel = (
    <DrawerPanelContent
      id={PANEL_ID}
      widths={{ default: "width_100", lg: "width_50", xl: "width_50" }}
      // The section card is the only box on screen: the list and the panel are
      // two regions inside it, separated by the drawer's own divider.
      isPlain
      // PatternFly asks for no focus trap while the drawer is static, so this
      // only applies below xl, where the panel overlays the list.
      focusTrap={{ enabled: !isWide }}
      colorVariant={shade === "panel" ? "secondary" : "default"}
    >
      <DrawerHead>
        <Stack>
          {selection && placement === "panel" && (
            <StackItem>
              <Button variant="link" isInline onClick={() => setSelectedId(null)}>
                <Flex alignItems={{ default: "alignItemsCenter" }} gap={{ default: "gapXs" }}>
                  <Icon name="chevron_left" /> {t("Result")}
                </Flex>
              </Button>
            </StackItem>
          )}
          <StackItem>
            <Title headingLevel="h3">
              {selection ? <SelectionTitle selection={selection} /> : t("Result")}
            </Title>
          </StackItem>
          <StackItem>
            {selection ? (
              <SelectionRole selection={selection} />
            ) : (
              <Text textStyle="textColorSubtle">{t("What happens during installation")}</Text>
            )}
          </StackItem>
        </Stack>
        <DrawerActions>
          {selection && <PanelDeviceActions selection={selection} />}
          <DrawerCloseButton
            onClick={() => {
              setSelectedId(null);
              if (!isWide || placement !== "panel") setIsPanelOpen(false);
            }}
          />
        </DrawerActions>
      </DrawerHead>
      <DrawerPanelBody>
        {panelDetail()}
        {panelShowsResult && <ProposalResultSection />}
      </DrawerPanelBody>
    </DrawerPanelContent>
  );

  const titleActions = (
    <Flex>
      <FlexItem grow={{ default: "grow" }} />
      {destructive > 0 && (
        <FlexItem>
          <Button
            variant="link"
            isInline
            onClick={() => {
              setSelectedId(null);
              setIsPanelOpen(true);
            }}
          >
            <Flex alignItems={{ default: "alignItemsCenter" }} gap={{ default: "gapXs" }}>
              <Icon name="warning" />
              {destructive === 1
                ? t("1 destructive action planned")
                : t(`${destructive} destructive actions planned`)}
            </Flex>
          </Button>
        </FlexItem>
      )}
      <FlexItem>
        <Button
          variant="secondary"
          onClick={() => setIsPanelOpen(!isPanelOpen)}
          aria-expanded={isPanelOpen && hasPanelContent}
          aria-controls={PANEL_ID}
        >
          {isPanelOpen ? t("Hide panel") : t("Show panel")}
        </Button>
      </FlexItem>
    </Flex>
  );

  return (
    <PanelLayoutContext.Provider value={panelLayout}>
      <PolicyControlContext.Provider value={policyControl}>
        <Page.Section
          title={t("Installation devices")}
          description={t(
            "Structure of the new system, including disks to use and additional devices like LVM volume groups.",
          )}
          titleActions={titleActions}
          pfCardProps={{ isFullHeight: true }}
          // The body has to fill the card, and stop imposing its content's height
          // on it, for the drawer inside to have a height to scroll within.
          pfCardBodyProps={{ isFilled: true, style: { minHeight: 0 } }}
        >
          <Drawer
            isExpanded={isWide || (isPanelOpen && hasPanelContent)}
            isStatic={isWide}
            // PatternFly already scrolls the list and the panel separately, but
            // only once the drawer has a height of its own. Without this the
            // drawer grows with its content and the whole page scrolls instead.
            style={{ height: "100%", minHeight: 0 }}
          >
            <DrawerContent
              colorVariant={shade === "content" ? "secondary" : "default"}
              panelContent={panel}
            >
              <DrawerContentBody>
                {rows.length === 0 && (
                  <Content component="p">{t("No device is configured yet.")}</Content>
                )}
                {rows.length > 0 && (
                  <Stack hasGutter>
                    {groups.map(({ title, id, members }) => (
                      <StackItem key={id}>
                        <Title headingLevel="h4" id={id}>
                          {t(title)}
                        </Title>
                        <Divider />
                        {/* One list per group rather than PatternFly's grouped
                            list, which carries no rule under its heading.
                            
                            No rules between the rows: a line running into the
                            selected row's background breaks against it, and the
                            selection already separates one row from the next.
                            
                            The selected row keeps PatternFly's own treatment.
                            Two overrides were tried and both were wrong: the
                            token the current tab uses is transparent, since a
                            tab shows its state through an underline, and the
                            highlight token is a full brand yellow in this
                            theme. Selection wants a design decision, not
                            another token swap. */}
                        <SimpleList
                          isControlled={false}
                          aria-labelledby={id}
                          onSelect={() => undefined}
                          className={spacingStyles.plSm}
                        >
                          {members.map((row) => (
                            <DeviceRow
                              key={idOf(row)}
                              selection={row}
                              isActive={selectedId === idOf(row)}
                              onSelect={() => {
                                setSelectedId(idOf(row));
                                setIsPanelOpen(true);
                              }}
                            />
                          ))}
                        </SimpleList>
                      </StackItem>
                    ))}
                  </Stack>
                )}
                <NestedContent margin={["mtMd", "mx_0"]}>
                  <Flex>
                    <ConfigureDeviceMenu />
                  </Flex>
                </NestedContent>
              </DrawerContentBody>
            </DrawerContent>
          </Drawer>
        </Page.Section>

        {placement === "strip" && <ResultStrip />}
      </PolicyControlContext.Provider>
    </PanelLayoutContext.Provider>
  );
}

export default function StoragePrimaryDetailCardPlayground(): React.ReactNode {
  return (
    <Page
      breadcrumbs={[{ label: t("Storage") }]}
      // What the real storage page does: every edit rewrites the whole model,
      // and this shields the interface until the proposal has caught up.
      progress={{
        scope: "storage",
        awaitQueriesRefetch: [
          PROPOSAL_QUERY_KEY,
          EXTENDED_CONFIG_QUERY_KEY,
          STORAGE_MODEL_QUERY_KEY,
        ],
      }}
    >
      <Page.Content>
        <PrimaryDetail />
      </Page.Content>
    </Page>
  );
}
