/*
 * TEMPORARY: primary/detail layout for the storage configuration.
 *
 * The real storage page, laid out differently. It reads the real config model
 * and the real proposal, edits through the real hooks, and navigates to the
 * real forms. Nothing is mocked, so it needs a running backend and it shows
 * whatever that backend currently proposes.
 *
 * What changes against `ProposalPage`:
 *
 *   - The configuration is a flat list. One row per configured device, with no
 *     disclosure widgets: the partitions section and the space policy menu are
 *     no longer nested inside the row, they are in the panel.
 *   - Selecting a row opens that device in a side panel, inline from xl up and
 *     an overlay below it.
 *   - The device actions live in the panel head, not as a section of its body.
 *   - The space policy is a set of radios rather than a menu. The custom policy
 *     still hands over to its own page.
 *   - The result is not a second card competing for vertical space. Where it
 *     goes is the open question, so the placements can be compared.
 *
 * The page carries no playground controls, so any state is worth a screenshot.
 * Drive it from the browser console instead:
 *
 *     storagePlayground.help()
 *     storagePlayground.result("strip")   // panel | strip | none
 *     storagePlayground.panel(false)
 *     storagePlayground.select("drives:0")
 *     storagePlayground.shade("content")  // content | panel | none
 *
 * There is no per-device result placement. A planned action carries the sid of
 * the device it touches, and actions that create something refer to devices
 * that do not exist in the system yet, so an action cannot be attributed back
 * to the configured device it belongs to. Distributing the result across the
 * rows would need the backend to say which entry each action came from.
 *
 * There is no reset either: the configuration is the real one, and the way
 * back is "Reset to defaults" on the real page.
 *
 * NOT meant to be committed. Reach it at `#/storage-primary-detail-playground`
 * while the temporary route in router.tsx is in place.
 */

import React, { useEffect, useId, useState } from "react";
import { useNavigate } from "react-router";
import {
  Button,
  Content,
  DataList,
  DataListAction,
  DataListCell,
  DataListItem,
  DataListItemCells,
  DataListItemRow,
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
  Label,
  LabelGroup,
  PageSection,
  Radio,
  Stack,
  StackItem,
  Title,
} from "@patternfly/react-core";
import ConfigureDeviceMenu from "~/components/storage/ConfigureDeviceMenu";
import DriveHeader from "~/components/storage/DriveHeader";
import Icon from "~/components/layout/Icon";
import MdRaidHeader from "~/components/storage/MdRaidHeader";
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
import { generateEncodedPath } from "~/utils";
import { typeWithSize } from "~/components/storage/utils/partition";
import { useActions } from "~/hooks/model/proposal/storage";
import { useDevice } from "~/hooks/model/system/storage";
import {
  useConfigModel,
  useDeleteDrive,
  useDeleteLogicalVolume,
  useDeleteMdRaid,
  useDeletePartition,
  useDevice as useDeviceConfig,
  usePartitionable,
  useSetSpacePolicy,
  useVolumeGroup,
} from "~/hooks/model/storage/config-model";
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

/** Console API, so the page itself carries no playground controls. */
type PlaygroundApi = {
  help: () => void;
  result: (placement: ResultPlacement) => void;
  panel: (open: boolean) => void;
  select: (id: string | null) => void;
  shade: (side: Shade) => void;
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

const SPACE_POLICIES: ConfigModel.SpacePolicy[] = ["delete", "resize", "keep", "custom"];

/**
 * What the configuration uses a device for, in a few words.
 *
 * The panel takes the whole screen on a narrow viewport, where the list is not
 * there to say it, so the panel has to carry it itself.
 */
const roleOf = (
  config: ConfigModel.Config,
  deviceConfig: ConfigModel.Drive | ConfigModel.MdRaid | ConfigModel.VolumeGroup,
): string => {
  const name = deviceConfig.name;
  const isBoot = configModel.boot.hasDevice(config, name);
  const hostsLvm = configModel.isTargetDevice(config, name);
  const mountPaths =
    "partitions" in deviceConfig
      ? configModel.partitionable.usedMountPaths(deviceConfig as ConfigModel.Drive)
      : (deviceConfig as ConfigModel.VolumeGroup).logicalVolumes.map((lv) => lv.mountPath);
  const hasRoot = mountPaths.includes("/");

  if (hasRoot && isBoot && hostsLvm) return "Used to install, host LVM and boot";
  if (hasRoot && isBoot) return "Used to install and boot";
  if (hasRoot && hostsLvm) return "Used to install and host LVM";
  if (hasRoot) return "Used to install";
  if (isBoot && hostsLvm) return "Used to boot and host LVM";
  if (isBoot) return "Used to boot";
  if (hostsLvm) return "Used to host LVM";
  if (mountPaths.length) return "Used for extra file systems";

  return "Not configured yet";
};

/** How many volumes the configuration defines on a device, as a label. */
const volumeCountLabel = (count: number, isVolumeGroup: boolean): string | undefined => {
  if (count === 0) return undefined;
  if (isVolumeGroup) return count === 1 ? "1 logical volume" : `${count} logical volumes`;
  return count === 1 ? "1 partition" : `${count} partitions`;
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
}>;

/**
 * One section of the panel: a heading, an optional line under it, a rule, and
 * the content indented beneath. A fieldset would box the content in, which is
 * too much furniture for a panel that is already a region of its own.
 */
const PanelSection = ({ title, description, children }: PanelSectionProps) => (
  <Stack hasGutter>
    <StackItem>
      <Title headingLevel="h4">{title}</Title>
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
 * What the device holds today: its partitions, or the logical volumes of a
 * volume group, as they exist in the system right now.
 *
 * The section that asks what to do with this content is the one place a user
 * needs to see it, and until now the answer lived only behind the custom space
 * policy page.
 */
const CurrentContent = ({ deviceName }: { deviceName: string }) => {
  const device = useDevice(deviceName);
  const children = device ? deviceChildren(device) : [];
  const existing = children.filter((child) => "name" in child) as Storage.Device[];

  if (existing.length === 0) {
    return <Content component="p">{t("The device holds nothing at the moment.")}</Content>;
  }

  return (
    <DataList isCompact aria-label={t("Current content")}>
      {existing.map((child) => (
        <DataListItem key={child.sid}>
          <DataListItemRow>
            <DataListItemCells
              dataListCells={[
                <DataListCell key="name" width={1}>
                  <Text isBold>{deviceBaseName(child)}</Text>
                </DataListCell>,
                <DataListCell key="description" width={3}>
                  {deviceUtils.contentDescription(child)}
                </DataListCell>,
                <DataListCell key="size" width={1}>
                  {child.block?.size ? deviceSize(child.block.size) : null}
                </DataListCell>,
              ]}
            />
          </DataListItemRow>
        </DataListItem>
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

type SpacePolicyFieldsProps = {
  collection: Collection;
  index: number;
};

/**
 * The space policy as radios rather than a menu, so every option and its
 * consequence is visible at once. The custom policy still hands over to its own
 * page, which is where the per-partition table lives.
 */
const SpacePolicyFields = ({ collection, index }: SpacePolicyFieldsProps) => {
  const navigate = useNavigate();
  const groupName = useId();
  const setSpacePolicy = useSetSpacePolicy();
  const Option =
    collection === "volumeGroups" ? VolumeGroupPolicyOption : PartitionablePolicyOption;

  const choose = (policy: ConfigModel.SpacePolicy) => {
    if (policy === "custom") {
      navigate(generateEncodedPath(PATHS.editSpacePolicy, { collection, index: String(index) }));
      return;
    }
    setSpacePolicy(collection, index, { type: policy });
  };

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
    return (
      <EmptyState titleText={t("Not configured yet")} headingLevel="h4" variant="sm">
        <EmptyStateBody>
          <Stack hasGutter>
            <StackItem>
              {t("Nothing is planned here. Add a partition to start using this device.")}
            </StackItem>
            <StackItem>
              <Button variant="secondary" onClick={() => navigate(addPath)}>
                {t("Add or use partition")}
              </Button>
            </StackItem>
          </Stack>
        </EmptyStateBody>
      </EmptyState>
    );
  }

  return (
    <Stack hasGutter>
      <StackItem>
        <PanelSection title={t("Partitions")}>
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
          <NestedContent margin={["mtMd", "mx_0"]}>
            <Button variant="secondary" onClick={() => navigate(addPath)}>
              <Flex alignItems={{ default: "alignItemsCenter" }} gap={{ default: "gapXs" }}>
                <Icon name="add_circle" /> {t("Add or use partition")}
              </Flex>
            </Button>
          </NestedContent>
        </PanelSection>
      </StackItem>

      <StackItem>
        <PanelSection title={t("Current content")}>
          <Stack hasGutter>
            <StackItem>
              <CurrentContent deviceName={deviceConfig.name} />
            </StackItem>
            <StackItem>
              <Title headingLevel="h5">{t("What to do with it")}</Title>
            </StackItem>
            <StackItem>
              <SpacePolicyFields collection={collection} index={index} />
            </StackItem>
          </Stack>
        </PanelSection>
      </StackItem>
    </Stack>
  );
};

const VolumeGroupDetail = ({ index }: { index: number }) => {
  const navigate = useNavigate();
  const vg = useVolumeGroup(index);
  const deleteLogicalVolume = useDeleteLogicalVolume();
  const addPath = generateEncodedPath(PATHS.volumeGroup.logicalVolume.add, { id: vg.vgName });

  return (
    <Stack hasGutter>
      <StackItem>
        <PanelSection title={t("Logical volumes")}>
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
          <NestedContent margin={["mtMd", "mx_0"]}>
            <Button variant="secondary" onClick={() => navigate(addPath)}>
              <Flex alignItems={{ default: "alignItemsCenter" }} gap={{ default: "gapXs" }}>
                <Icon name="add_circle" /> {t("Add logical volume")}
              </Flex>
            </Button>
          </NestedContent>
        </PanelSection>
      </StackItem>

      <StackItem>
        <PanelSection title={t("Current content")}>
          <Stack hasGutter>
            <StackItem>
              <CurrentContent deviceName={vg.name} />
            </StackItem>
            <StackItem>
              <Title headingLevel="h5">{t("What to do with it")}</Title>
            </StackItem>
            <StackItem>
              <SpacePolicyFields collection="volumeGroups" index={index} />
            </StackItem>
          </Stack>
        </PanelSection>
      </StackItem>
    </Stack>
  );
};

/* --------------------------------------------------------------- the rows */

type RowShellProps = React.PropsWithChildren<{ selection: Selection }>;

/** The row chrome, shared by every kind of configured device. */
const RowShell = ({ selection, children }: RowShellProps) => (
  <DataListItem id={idOf(selection)}>
    <DataListItemRow>
      <DataListItemCells
        dataListCells={[
          <DataListCell key="content">
            <Stack hasGutter>{children}</Stack>
          </DataListCell>,
        ]}
      />
    </DataListItemRow>
  </DataListItem>
);

const RowSummary = ({ pieces }: { pieces: (string | undefined)[] }) => (
  <StackItem>
    <LabelGroup>
      {pieces.filter(Boolean).map((piece) => (
        <Label key={piece} isCompact variant="outline">
          {piece}
        </Label>
      ))}
    </LabelGroup>
  </StackItem>
);

/**
 * A disk or software RAID as one row: the sentence the real page uses as its
 * header, plus the content and space summaries. Nothing to unfold.
 *
 * `driveUtils.contentActionsSummary` reads the config model, so it is called
 * before any early return.
 */
const PartitionableRow = ({ selection }: { selection: Selection }) => {
  const { collection, index } = selection;
  const config = useConfigModel();
  const deviceConfig = configModel.findDevice(config, collection, index) as ConfigModel.Drive;
  const device = useDevice(deviceConfig?.name);
  const spaceSummary = driveUtils.contentActionsSummary(deviceConfig);

  if (!device) return null;

  const header =
    collection === "drives" ? (
      <DriveHeader drive={deviceConfig} device={device} />
    ) : (
      <MdRaidHeader raid={deviceConfig as unknown as ConfigModel.MdRaid} device={device} />
    );

  return (
    <RowShell selection={selection}>
      <StackItem>
        <Text isBold>{header}</Text>
      </StackItem>
      <RowSummary
        pieces={[
          volumeCountLabel(deviceConfig.partitions.filter((p) => p.mountPath).length, false),
          spaceSummary,
        ]}
      />
    </RowShell>
  );
};

/** A volume group as one row. Its summaries read no model, unlike a drive's. */
const VolumeGroupRow = ({ selection }: { selection: Selection }) => {
  const config = useConfigModel();
  const vg = configModel.findDevice(
    config,
    selection.collection,
    selection.index,
  ) as ConfigModel.VolumeGroup;
  const device = useDevice(vg?.name);

  if (!device) return null;

  return (
    <RowShell selection={selection}>
      <StackItem>
        <Text isBold>{deviceLabel(device)}</Text>
      </StackItem>
      <RowSummary
        pieces={[
          volumeCountLabel(vg.logicalVolumes.length, true),
          volumeGroupUtils.contentActionsSummary(vg),
        ]}
      />
    </RowShell>
  );
};

const DeviceRow = ({ selection }: { selection: Selection }) =>
  selection.collection === "volumeGroups" ? (
    <VolumeGroupRow selection={selection} />
  ) : (
    <PartitionableRow selection={selection} />
  );

/* ------------------------------------------------------------- panel head */

/** The selected device's label, as the panel heading. */
const SelectionTitle = ({ selection }: { selection: Selection }) => {
  const config = useConfigModel();
  const deviceConfig = configModel.findDevice(config, selection.collection, selection.index);
  const device = useDevice(deviceConfig?.name);

  return <>{device ? deviceLabel(device) : deviceConfig?.name}</>;
};

/** What the selected device is used for, shown under the panel heading. */
const SelectionRole = ({ selection }: { selection: Selection }) => {
  const config = useConfigModel();
  const deviceConfig = configModel.findDevice(config, selection.collection, selection.index);

  if (!deviceConfig) return null;

  return <Text textStyle="textColorSubtle">{t(roleOf(config, deviceConfig))}</Text>;
};

/** The device actions, in the panel head rather than as a section of its body. */
const PanelDeviceActions = ({ selection }: { selection: Selection }) => {
  const { collection, index } = selection;
  const config = useConfigModel();
  const deviceConfig = configModel.findDevice(config, collection, index);
  const device = useDevice(deviceConfig?.name);
  const deleteDrive = useDeleteDrive();
  const deleteMdRaid = useDeleteMdRaid();

  if (!deviceConfig || !device) return null;

  if (collection === "volumeGroups") {
    return (
      <SearchedVolumeGroupMenu
        deviceConfig={deviceConfig as ConfigModel.VolumeGroup}
        device={device}
      />
    );
  }

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
  const [placement, setPlacement] = useState<ResultPlacement>("panel");
  const [isPanelOpen, setIsPanelOpen] = useState(true);
  const [shade, setShade] = useState<Shade>("none");
  const isWide = useIsWide();
  const panelId = useId();

  /* Console driven, so the page itself stays screenshot clean. */
  useEffect(() => {
    const api: PlaygroundApi = {
      help: () => {
        console.info(
          [
            "storagePlayground",
            '  result("panel" | "strip" | "none")   where the result goes',
            "  panel(true | false)                  open or close the side panel",
            '  select("drives:0" | null)            put a device in the panel',
            '  shade("content" | "panel" | "none")  which side looks recessed',
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

  const rows: Selection[] = [
    ...config.volumeGroups.map((_vg, index) => ({ collection: "volumeGroups" as const, index })),
    ...config.mdRaids.map((_md, index) => ({ collection: "mdRaids" as const, index })),
    ...config.drives.map((_drive, index) => ({ collection: "drives" as const, index })),
  ];

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
      id={panelId}
      isResizable
      minSize="360px"
      defaultSize="38%"
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
          aria-controls={panelId}
        >
          {isPanelOpen ? t("Hide panel") : t("Show panel")}
        </Button>
      </FlexItem>
    </Flex>
  );

  return (
    <>
      <Drawer isExpanded={isPanelOpen && hasPanelContent} isInline={isWide}>
        <DrawerContent
          colorVariant={shade === "content" ? "secondary" : "default"}
          panelContent={panel}
        >
          <DrawerContentBody>
            <Page.Section
              title={t("Installation devices")}
              description={t(
                "Structure of the new system, including disks to use and additional devices like LVM volume groups.",
              )}
              titleActions={titleActions}
              // The drawer paints the content background, and a filled card
              // would cover it. Going plain is what makes shade("content")
              // visible at all.
              pfCardProps={shade === "content" ? { isPlain: true } : undefined}
            >
              {rows.length === 0 && (
                <Content component="p">{t("No device is configured yet.")}</Content>
              )}
              {rows.length > 0 && (
                <DataList
                  aria-label={t("Configured devices")}
                  isCompact
                  selectedDataListItemId={selectedId || ""}
                  onSelectDataListItem={(_event, id) => {
                    setSelectedId(id);
                    setIsPanelOpen(true);
                  }}
                >
                  {rows.map((row) => (
                    <DeviceRow key={idOf(row)} selection={row} />
                  ))}
                </DataList>
              )}
              <NestedContent margin={["mtMd", "mx_0"]}>
                <Flex>
                  <ConfigureDeviceMenu />
                </Flex>
              </NestedContent>
            </Page.Section>
          </DrawerContentBody>
        </DrawerContent>
      </Drawer>

      {placement === "strip" && <ResultStrip />}
    </>
  );
}

export default function StoragePrimaryDetailPlayground(): React.ReactNode {
  return (
    <Page breadcrumbs={[{ label: t("Storage") }]}>
      <Page.Content>
        <PrimaryDetail />
      </Page.Content>
    </Page>
  );
}
