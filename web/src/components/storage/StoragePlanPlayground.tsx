/*
 * TEMPORARY: the main storage page, redesigned as a plan.
 *
 * Two pages and a sheet. The page reports what the installation will do and
 * routes to where it can be changed; the sheet does the work. A plan of one
 * device gets a sentence about that device; a plan of several gets a sentence
 * about the plan and an index of its entries under it. Both open with the same
 * skeleton, so a reader who learned the page with one disk recognises it with
 * eight.
 *
 * What it looks like now, what was decided and why, and what is still open:
 * `agama-notes/web/storage-main-page-iteration-2.md`. The rounds before it are
 * in `storage-main-page-iteration-1.md` and the plan that started this one.
 * Read the iteration note first: this file is the drawing, that is the argument.
 *
 * Nothing is mocked. It reads the real config model, the real system and the
 * real proposal, writes through the real endpoint, and navigates to the real
 * forms, so it needs a running backend. Reach it at `#/storage-plan-playground`
 * while the temporary route in `router.tsx` is in place.
 *
 * Because the machine it runs on has the disks it has, and the states worth
 * arguing about are the ones nobody has to hand, it can also be pointed at a
 * scenario: a machine and a configuration written out in
 * `StoragePlanScenarios.ts`, with an approximation of the solver behind it so
 * that changing a space policy still moves the page.
 *
 *     storagePlan.data("alongside-windows")
 *
 * Every arrangement still under discussion is a switch. They are in the
 * Variants panel at the bottom right of the page, and on the console, which
 * lists them all:
 *
 *     storagePlan.help()
 *
 * The two that hold open questions are `wayIn`, which decides whether the
 * device sheet is opened by the device named in the sentence or by a button
 * under it, and `spaceShape`, which decides whether the space decision shows
 * all four answers or the one the plan has. Everything else is either settled
 * or a way of reaching a state that is hard to reach otherwise: `panelMode`
 * ("inline" is the only way to see the page's narrow arrangements on a wide
 * screen), and `page`, which falls back to the device list this replaced.
 *
 * NOT meant to be committed, and neither is the route that reaches it.
 */

import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import {
  Alert,
  Button,
  Content,
  Drawer,
  DrawerContent,
  DrawerContentBody,
  DrawerPanelBody,
  DrawerPanelContent,
  Dropdown,
  DescriptionList,
  DescriptionListDescription,
  DescriptionListGroup,
  DescriptionListTerm,
  Divider,
  DropdownItem,
  DropdownList,
  EmptyState,
  EmptyStateActions,
  EmptyStateBody,
  EmptyStateFooter,
  Flex,
  FlexItem,
  HelperText,
  HelperTextItem,
  Label,
  LabelGroup,
  MenuToggle,
  Stack,
  StackItem,
  Tab,
  Tabs,
  TabTitleIcon,
  ToggleGroup,
  ToggleGroupItem,
  Tooltip,
  TabTitleText,
  Title,
} from "@patternfly/react-core";
import Icon from "~/components/layout/Icon";
import Interpolate from "~/components/core/Interpolate";
import NestedContent from "~/components/core/NestedContent";
import Page from "~/components/core/Page";
import DeviceSelectorModal from "~/components/storage/DeviceSelectorModal";
import ConfigureDeviceMenu from "~/components/storage/ConfigureDeviceMenu";
import ConnectedDevicesMenu from "~/components/storage/ConnectedDevicesMenu";
import ProposalActions from "~/components/storage/ProposalActions";
import ProposalResultTable from "~/components/storage/ProposalResultTable";
import DevicesManager from "~/model/storage/devices-manager";
import SearchedVolumeGroupMenu from "~/components/storage/SearchedVolumeGroupMenu";
import Text from "~/components/core/Text";
import configModel from "~/model/storage/config-model";
import { putStorageModel, solveStorageModel } from "~/api";
import {
  baseName,
  deviceChildren,
  deviceSize,
  filesystemType,
  sizeDescription,
} from "~/components/storage/utils";
import { deviceSystems, supportShrink } from "~/model/storage/device";
import { formatList } from "~/i18n";
import { unique } from "radashi";
import { SCENARIOS, simulate } from "~/components/storage/StoragePlanScenarios";
import { generateEncodedPath } from "~/utils";
import { typeDescription } from "~/components/storage/utils/device";
import {
  useActions as useRealActions,
  useProposal as useRealStorageProposal,
  useDevices as useRealStagingTree,
  useFlattenDevices as useRealStagingDevices,
} from "~/hooks/model/proposal/storage";
import { useAnnounce } from "~/context/announcer";
import { useIssues as useRealIssues } from "~/hooks/model/issue";
import { useReset as useRealReset } from "~/hooks/model/config/storage";
import { useSystem as useBootloaderSystem } from "~/hooks/model/system/bootloader";
import {
  useAvailableDevices as useRealAvailableDevices,
  useDevice as useRealDevice,
  useFlattenDevices as useRealFlattenDevices,
} from "~/hooks/model/system/storage";
import { isDrive, isMd, isVolumeGroup } from "~/model/storage/device";
import {
  useConfigModel as useRealConfigModel,
  useConvertPartitionableToVolumeGroup,
  STORAGE_MODEL_QUERY_KEY,
} from "~/hooks/model/storage/config-model";
import { PROPOSAL_QUERY_KEY, EXTENDED_CONFIG_QUERY_KEY } from "~/hooks/model/proposal";
import { STORAGE as PATHS } from "~/routes/paths";

import type { ConfigModel } from "~/model/storage/config-model";
import type { Bootloader, Storage } from "~/model/system";
import type { Storage as Proposal } from "~/model/proposal";
import type { TranslatedString } from "~/i18n";
import type { ScenarioKey } from "~/components/storage/StoragePlanScenarios";

/** Marks a literal as translated. Playground text never reaches the catalogs. */
const t = (text: string): TranslatedString => text as TranslatedString;

/* ------------------------------------------------------------------ *
 * Playground plumbing
 * ------------------------------------------------------------------ */

type Collection = "drives" | "mdRaids" | "volumeGroups";
/** The collections whose entries carry partitions. */
type PartitionableCollection = "drives" | "mdRaids";
type Selection = { collection: Collection; index: number };

type CostStyle = "text" | "chips";
type PanelSections = "stacked" | "tabs";
type PanelTab = "result" | "planned" | "members" | "current";
/** Whether the tab strip runs across the top of the panel or down its side. */
type TabLayout = "horizontal" | "vertical";
/** How the sentence a tab opens with is set out. */
type TabNoteStyle = "dimmed" | "statement";
type PanelScroll = "body" | "sections";
type Density = "comfortable" | "compact";
/** How much weight the panel's own type carries, next to its tables. */
type TypeScale = "current" | "quiet";
/** Whether a mount path is set apart from the text around it. */
type MountPaths = "plain" | "italic";
/** The two candidate labels for the space decision. */
type SpaceLabel = "terse" | "plain";
/** How the space decision is offered: four buttons, or one menu. */
type SpaceControl = "menu" | "segmented";
/** Where the device actions live: the panel alone, the panel plus narrow rows, or both. */
type RowActions = "panel" | "narrow" | "always";
/** How the panel body is arranged: three named blocks, or the flat stack of round ten. */
type PanelStructure = "blocks" | "flat";
/** Where the space decision is offered: with the other settings, or over the table it governs. */
type SpacePlacement = "settings" | "content";
/** Whether every setting explains itself, or only the ones whose value leaves a question. */
type Explanations = "always" | "sparse";
/** Whether the settings take a column of their own, or sit above the content. */
type SettingsPlacement = "beside" | "above";
/** The mark on a row naming what a device is made of, or what it belongs to. */
type RelationIcon = "device_hub" | "network_node" | "graph_3" | "graph_4" | "apps";
/** How the second line under a value in a table is set: as text, or boxed. */
type RowNote = "outlined" | "plain";
/** Whether those lines take a colour from what they report. */
type NoteColor = "status" | "none";
/** Whether the final layout opens with a row for the device the panel is about. */
type DeviceRow = "hidden" | "shown";
/** Whether a dashed rule separates the statements above a tab's content. */
type StatementRule = "between" | "all" | "none";
/** Which shape the page in front of the sheet takes. */
type PageShape = "summary" | "list";
/** Whether the one device page offers the space decision itself. */
type SummarySpace = "shown" | "hidden";
/** Which shape that decision takes on the page: all four answers, or the one it has. */
type SpaceShape = "toggles" | "value";
/** How the one device page opens the sheet: from a button, or from the device's name. */
type WayIn = "button" | "name";
/** Which machine the page reads: this one, or one of the scenarios. */
type DataSource = "real" | ScenarioKey;
/** How the drawer holding the sheet opens. */
type PanelMode = "aside" | "over" | "inline";
type Variants = {
  cost: CostStyle;
  sections: PanelSections;
  tabLayout: TabLayout;
  tabNote: TabNoteStyle;
  /** Whether a tab carries a phrase under its name, or only the name. */
  tabSummary: boolean;
  /** PatternFly's box styling: each tab drawn as a box rather than as a label. */
  tabBox: boolean;
  /** PatternFly's filled layout: the tabs share the width of the strip. */
  tabFill: boolean;
  scroll: PanelScroll;
  offers: boolean;
  density: Density;
  rowActions: RowActions;
  gutter: boolean;
  typeScale: TypeScale;
  mountPaths: MountPaths;
  spaceLabel: SpaceLabel;
  spaceControl: SpaceControl;
  structure: PanelStructure;
  spacePlacement: SpacePlacement;
  explanations: Explanations;
  settings: SettingsPlacement;
  relationIcon: RelationIcon;
  statementRule: StatementRule;
  deviceRow: DeviceRow;
  rowNote: RowNote;
  noteColor: NoteColor;
  page: PageShape;
  summarySpace: SummarySpace;
  spaceShape: SpaceShape;
  wayIn: WayIn;
  data: DataSource;
  panelMode: PanelMode;
};

const DEFAULT_VARIANTS: Variants = {
  cost: "text",
  sections: "tabs",
  tabLayout: "horizontal",
  tabNote: "statement",
  tabSummary: false,
  tabBox: false,
  tabFill: false,
  scroll: "sections",
  offers: true,
  density: "comfortable",
  rowActions: "narrow",
  gutter: false,
  typeScale: "current",
  mountPaths: "plain",
  spaceLabel: "terse",
  spaceControl: "segmented",
  structure: "blocks",
  spacePlacement: "content",
  /* The version that teaches comes first: a reader meeting this page is being
     asked to understand what an installer may do to their disks. How tall the
     block gets is the reason the other setting exists. */
  explanations: "always",
  settings: "beside",
  relationIcon: "network_node",
  /* Between every statement above a tab's content, the sentence about the tab
     included. Each of them is about something else, and reading down the block
     there was nothing to say where one ended. */
  statementRule: "all",
  /* The panel is about one device and says which in its title, so a row naming
     it again buys nothing and indents everything under it by a level. */
  deviceRow: "hidden",
  /* Plain text, uncoloured: these lines qualify a value rather than report a
     status of their own, and a page of boxes reads as a page of marks. Both are
     switchable, since what they say is worth telling apart. */
  rowNote: "plain",
  noteColor: "none",
  /* The shape being designed comes first, and the list it replaces stays one
     switch away, so the two are compared on real disks rather than from
     memory. The summary only fits a plan of one entry; anything longer reads
     as the list until the index exists. */
  page: "summary",
  /* The decision that changes that sentence, offered where the sentence is
     read. An experiment: it is the one setting a single disk reader is likely
     to want, and the sheet is a click away for everything else. */
  summarySpace: "shown",
  /* All four answers at once, which is what makes the decision quick for the
     reader who came to change it. The value line, quieter and shaped like
     every other setting on the page, is one switch away. */
  spaceShape: "toggles",
  /* The name. The page carries one button fewer, and the way in is the word the
     sheet is about, which is where a reader looks for it: the disk is what they
     came to open. The button under the sentence is one switch away. */
  wayIn: "name",
  /* The machine the playground runs on, which is the only data that is
     true. The scenarios are for the states it does not have. */
  data: "real",
  /* The sheet comes over the page and the page moves aside for it, keeping the
     arrangement it had. Laying it out again in the width it is left with was
     tried and dropped: rearranging a page nobody can touch spends a relayout on
     something the reader is not reading, and the summary they were looking at
     is not where they left it when the sheet closes.

     A shift rather than a re-centring, and a modest one: the page is behind the
     sheet to say what the reader came from, and moving it far enough to centre
     what is left cuts the start off anything as wide as the measure. */
  panelMode: "aside",
};

type PlanApi = {
  help: () => void;
  select: (id: string | null) => void;
  panel: (open: boolean) => void;
  cost: (style: CostStyle) => void;
  sections: (mode: PanelSections) => void;
  tabLayout: (mode: TabLayout) => void;
  tabNote: (style: TabNoteStyle) => void;
  tabSummary: (on: boolean) => void;
  tabBox: (on: boolean) => void;
  tabFill: (on: boolean) => void;
  scroll: (mode: PanelScroll) => void;
  offers: (on: boolean) => void;
  density: (mode: Density) => void;
  rowActions: (mode: RowActions) => void;
  gutter: (on: boolean) => void;
  typeScale: (mode: TypeScale) => void;
  mountPaths: (mode: MountPaths) => void;
  spaceLabel: (mode: SpaceLabel) => void;
  spaceControl: (mode: SpaceControl) => void;
  structure: (mode: PanelStructure) => void;
  spacePlacement: (mode: SpacePlacement) => void;
  explanations: (mode: Explanations) => void;
  settings: (mode: SettingsPlacement) => void;
  relationIcon: (name: RelationIcon) => void;
  statementRule: (mode: StatementRule) => void;
  deviceRow: (mode: DeviceRow) => void;
  rowNote: (mode: RowNote) => void;
  noteColor: (mode: NoteColor) => void;
  page: (shape: PageShape) => void;
  summarySpace: (mode: SummarySpace) => void;
  spaceShape: (mode: SpaceShape) => void;
  wayIn: (mode: WayIn) => void;
  data: (source: DataSource) => void;
  panelMode: (mode: PanelMode) => void;
  bootDebug: () => void;
};

declare global {
  interface Window {
    storagePlan?: PlanApi;
  }
}

const VariantsContext = React.createContext<Variants>(DEFAULT_VARIANTS);
const useVariants = (): Variants => React.useContext(VariantsContext);

/* ------------------------------------------------------------------ *
 * Reading a machine that is not this one
 *
 * The playground reads the real backend, which is the right default and a poor
 * way to see a design: the states worth arguing about are the ones nobody has
 * to hand. A scenario puts a machine and a configuration in front of the page
 * instead, and `storagePlan.data("real")` gives the backend back.
 *
 * The interception is one layer thick. Every read below is the app's own hook
 * where no scenario is chosen, and the scenario's answer where one is; every
 * write goes through the same pure transformations the app's mutation hooks
 * use, applied to the scenario's configuration rather than sent to the server.
 * What the installer would make of the result is worked out by the simulator,
 * which is an approximation and says so where it lives.
 *
 * Nothing under a scenario touches the backend, so a machine being installed
 * is safe to look at scenarios on.
 * ------------------------------------------------------------------ */

/** A tree of devices as one list, which is what the app's flat hooks serve. */
const flatten = <T extends { partitions?: T[]; logicalVolumes?: T[] }>(devices: T[]): T[] =>
  devices.flatMap((device) => [
    device,
    ...(device.partitions || []),
    ...(device.logicalVolumes || []),
  ]);

type ScenarioState = {
  /** The configuration as the scenario has it, rewritten by every edit. */
  config: ConfigModel.Config;
  system: Storage.Device[];
  proposal: { devices: Storage.Device[]; actions: Proposal.Action[] };
  write: (config: ConfigModel.Config) => void;
};

const ScenarioContext = React.createContext<ScenarioState | null>(null);
const useScenario = (): ScenarioState | null => React.useContext(ScenarioContext);

/**
 * Holds the chosen scenario, and every edit made to it since it was chosen.
 *
 * The edits are stamped with the scenario they belong to, so picking another
 * machine starts again from its own configuration rather than carrying the
 * previous one's edits into it. Stamped rather than cleared on a change: a
 * cleared state leaves one render where the configuration is the old scenario's
 * and the machine is the new one, and every device the page looks up in that
 * render is missing.
 */
const useScenarioState = (key: DataSource): ScenarioState | null => {
  const [edited, setEdited] = useState<{ key: DataSource; config: ConfigModel.Config } | null>(
    null,
  );

  return useMemo(() => {
    if (key === "real") return null;

    const { system, config: pristine } = SCENARIOS[key];
    const config = edited?.key === key ? edited.config : structuredClone(pristine);

    return {
      config,
      system,
      proposal: simulate(system, config),
      write: (next: ConfigModel.Config) => setEdited({ key, config: next }),
    };
  }, [key, edited]);
};

/* Reads. Each one answers from the scenario where there is one, and from the
   app's own hook where there is not. Both are called either way: a hook that
   runs only sometimes is not a hook. */

const useConfigModel = (): ConfigModel.Config => {
  const scenario = useScenario();
  const real = useRealConfigModel();
  return scenario ? scenario.config : real;
};

const useFlattenDevices = (): Storage.Device[] => {
  const scenario = useScenario();
  const real = useRealFlattenDevices();
  return scenario ? flatten(scenario.system) : real;
};

const useDevice = (name: string): Storage.Device | null => {
  const scenario = useScenario();
  const real = useRealDevice(name);
  if (!scenario) return real;
  return flatten(scenario.system).find((device) => device.name === name) || null;
};

const useAvailableDevices = (): Storage.Device[] => {
  const scenario = useScenario();
  const real = useRealAvailableDevices();
  return scenario ? scenario.system : real;
};

const useStagingTree = (): Proposal.Device[] => {
  const scenario = useScenario();
  const real = useRealStagingTree();
  return scenario ? scenario.proposal.devices : real;
};

const useStagingDevices = (): Proposal.Device[] => {
  const scenario = useScenario();
  const real = useRealStagingDevices();
  return scenario ? flatten(scenario.proposal.devices) : real;
};

const useActions = (): Proposal.Action[] => {
  const scenario = useScenario();
  const real = useRealActions();
  return scenario ? scenario.proposal.actions : real;
};

const useStorageProposal = () => {
  const scenario = useScenario();
  const real = useRealStorageProposal();
  return scenario
    ? { devices: scenario.proposal.devices, actions: scenario.proposal.actions }
    : real;
};

const useIssues = (scope: "storage") => {
  const scenario = useScenario();
  const real = useRealIssues(scope);
  /* A scenario solves by construction: the simulator cannot fail, so there is
     nothing for it to report. */
  return scenario ? [] : real;
};

/* Writes. The app's mutation hooks read the real configuration to build the
   next one, so under a scenario they would rewrite the wrong model and send it
   to a backend the page is not reading. Each one below is the same pure
   transformation the hook uses, over the model the page is actually showing. */

/** Where a rewritten model goes: to the server, or into the scenario. */
const useWriteModel = (): ((config: ConfigModel.Config) => void) => {
  const scenario = useScenario();
  return scenario ? scenario.write : putStorageModel;
};

const useSetSpacePolicy = () => {
  const config = useConfigModel();
  const write = useWriteModel();
  return (collection: Collection, index: number, data: { type: ConfigModel.SpacePolicy }) =>
    write(configModel.device.setSpacePolicy(config, collection, index, data));
};

const useConvertDevice = () => {
  const config = useConfigModel();
  const system = useFlattenDevices();
  const write = useWriteModel();

  return (deviceName: string, targetName: string) => {
    const device = system.find((one) => one.name === deviceName);
    const target = system.find((one) => one.name === targetName);
    if (device && target) write(configModel.device.convert(config, device, target));
  };
};

const useAddDrive = () => {
  const config = useConfigModel();
  const write = useWriteModel();
  return (data: Parameters<typeof configModel.drive.add>[1]) =>
    write(configModel.drive.add(config, data));
};

const useDeleteDrive = () => {
  const config = useConfigModel();
  const write = useWriteModel();
  return (index: number) => write(configModel.drive.remove(config, index));
};

const useAddMdRaid = () => {
  const config = useConfigModel();
  const write = useWriteModel();
  return (data: Parameters<typeof configModel.mdRaid.add>[1]) =>
    write(configModel.mdRaid.add(config, data));
};

const useDeleteMdRaid = () => {
  const config = useConfigModel();
  const write = useWriteModel();
  return (index: number) => write(configModel.mdRaid.remove(config, index));
};

const useAddVolumeGroup = () => {
  const config = useConfigModel();
  const write = useWriteModel();
  return (data: Parameters<typeof configModel.volumeGroup.add>[1], moveContent: boolean) =>
    write(configModel.volumeGroup.add(config, data, moveContent));
};

const useDeleteVolumeGroup = () => {
  const config = useConfigModel();
  const write = useWriteModel();
  return (vgName: string, moveToDrive: boolean) =>
    write(
      moveToDrive
        ? configModel.volumeGroup.convertToPartitionable(config, vgName)
        : configModel.volumeGroup.remove(config, vgName),
    );
};

const useDeleteLogicalVolume = () => {
  const config = useConfigModel();
  const write = useWriteModel();
  return (vgName: string, mountPath: string) =>
    write(configModel.logicalVolume.remove(config, vgName, mountPath));
};

const useDeletePartition = () => {
  const config = useConfigModel();
  const write = useWriteModel();
  return (collection: PartitionableCollection, index: number, mountPath: string) =>
    write(configModel.partition.remove(config, collection, index, mountPath));
};

const useSetBootDevice = () => {
  const config = useConfigModel();
  const write = useWriteModel();
  return (name: string) => write(configModel.boot.setDevice(config, name));
};

const useSetDefaultBootDevice = () => {
  const config = useConfigModel();
  const write = useWriteModel();
  return () => write(configModel.boot.setDefault(config));
};

const useDisableBoot = () => {
  const config = useConfigModel();
  const write = useWriteModel();
  return () => write(configModel.boot.disable(config));
};

const useReset = () => {
  const scenario = useScenario();
  const real = useRealReset();
  return scenario ? () => scenario.write(structuredClone(scenario.config)) : real;
};

const idOf = ({ collection, index }: Selection): string => `${collection}:${index}`;

/** Where a device sits in the configured list, so the panel can point at it. */
const selectionForDevice = (
  config: ConfigModel.Config,
  deviceName: string,
): Selection | undefined => {
  const collections: Collection[] = ["drives", "mdRaids", "volumeGroups"];
  for (const collection of collections) {
    const index = (config[collection] || []).findIndex(
      (entry: { name?: string }) => entry.name === deviceName,
    );
    if (index !== -1) return { collection, index };
  }
  return undefined;
};

const parseId = (id: string): Selection | null => {
  const [collection, index] = id.split(":");
  if (!["drives", "mdRaids", "volumeGroups"].includes(collection)) return null;
  return { collection: collection as Collection, index: Number(index) };
};

const PANEL_ID = "storage-plan-panel";
/** How much of the window the sheet takes when it comes over the page. */
const PANEL_WIDTH = "70%";
const LIST_ID = "storage-plan-list";
const XL = "(min-width: 1200px)";
/* Wide enough for the list to stay readable with a panel over part of it, and
   not wide enough for the two to sit side by side. */
const LG = "(min-width: 992px)";

/**
 * How wide something actually is.
 *
 * The page beside an open sheet is narrow while the window is wide, so what it
 * can afford is a question about the element rather than about the viewport. A
 * media query cannot answer that.
 */
const useWidth = (node: HTMLElement | null): number => {
  const [width, setWidth] = useState(Number.POSITIVE_INFINITY);

  useEffect(() => {
    /* Nothing to measure is not "as narrow as it last was": the page that was
       being watched has gone, and whatever replaces it starts unconstrained. */
    if (!node) {
      setWidth(Number.POSITIVE_INFINITY);
      return;
    }

    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(node);
    return () => observer.disconnect();
  }, [node]);

  return width;
};

/** Under this, the page stops printing what it can put in a menu. */
const TIGHT = 640;

/** Tracks a media query without a resize listener per component. */
const useMedia = (query: string): boolean => {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);

  useEffect(() => {
    const media = window.matchMedia(query);
    const update = () => setMatches(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [query]);

  return matches;
};

/* ------------------------------------------------------------------ *
 * The cost vocabulary
 *
 * Three marks, always in this order, each with a glyph and a word. The control
 * that sets one of these says "Delete"; the line reporting it says "deleted".
 * Same terms, different grammar, which is what keeps a report from reading as
 * a button.
 * ------------------------------------------------------------------ */

type CostKind = "destroys" | "shrinks" | "keeps";

type Cost = { kind: CostKind; text: string };

const COST_ORDER: Record<CostKind, number> = { destroys: 0, shrinks: 1, keeps: 2 };

/** Marks whose meaning travels with their direction, turned to say it. */
const COST_ICON_CLASS: Partial<Record<CostKind, string>> = { shrinks: "agm-u-rotate-90" };

const COST_ICON: Record<CostKind, React.ComponentProps<typeof Icon>["name"]> = {
  destroys: "error_fill",
  /* What happens to the thing itself: it is squeezed into less room, which is
     what the mark shows. Folding is what a list does, not a partition. */
  shrinks: "compress",
  keeps: "check_circle",
};

/**
 * Colour lands on the mark, and on the text only where data is lost. Nothing
 * here relies on colour alone: every mark carries a word next to it.
 */
const COST_CLASS: Record<CostKind, string> = {
  destroys: "agm-plan-cost-destroys",
  shrinks: "agm-plan-cost-shrinks",
  keeps: "agm-plan-cost-keeps",
};

/**
 * A consequence, as a mark and a word.
 *
 * `showIcon` is off where every row in a column would otherwise carry one. A
 * mark on the row that loses data means something next to rows without one; a
 * mark on all of them is a column of decoration, and the one row that matters
 * stops standing out.
 */
const CostLine = ({ cost, showIcon = true }: { cost: Cost; showIcon?: boolean }) => (
  <Flex
    gap={{ default: "gapXs" }}
    alignItems={{ default: "alignItemsFlexStart" }}
    flexWrap={{ default: "nowrap" }}
    className={COST_CLASS[cost.kind]}
  >
    {showIcon && (
      <FlexItem>
        <Icon name={COST_ICON[cost.kind]} className={COST_ICON_CLASS[cost.kind]} size="xs" />
      </FlexItem>
    )}
    <FlexItem>{cost.text}</FlexItem>
  </Flex>
);

/**
 * The shape the first pass landed on and then diagnosed as wrong, kept behind
 * `storagePlan.cost("chips")` so the two can be looked at side by side rather
 * than argued about from memory.
 */
const CostChips = ({ costs }: { costs: Cost[] }) => (
  <LabelGroup numLabels={4}>
    {costs.map((cost, i) => (
      <Label key={i} isCompact status={cost.kind === "destroys" ? "danger" : undefined}>
        {cost.text}
      </Label>
    ))}
  </LabelGroup>
);

const CostSlot = ({ costs }: { costs: Cost[] }) => {
  const { cost: style } = useVariants();

  /* An empty cost slot is empty. "Nothing planned" belongs to the purpose slot,
   * and reusing it here made a device that destroys nothing look like a device
   * nobody has configured. */
  if (costs.length === 0) return null;

  const sorted = [...costs].sort((a, b) => COST_ORDER[a.kind] - COST_ORDER[b.kind]);

  if (style === "chips") return <CostChips costs={sorted} />;

  return (
    <Stack>
      {sorted.map((cost, i) => (
        <StackItem key={i}>
          <CostLine cost={cost} />
        </StackItem>
      ))}
    </Stack>
  );
};

/* ------------------------------------------------------------------ *
 * Reading the plan
 *
 * All pure. None of these calls a hook, which is the trap the earlier pass hit
 * four times: two of the storage prose helpers call `useConfigModel` inside
 * what looks like a util.
 * ------------------------------------------------------------------ */

type Partitionable = ConfigModel.Drive | ConfigModel.MdRaid;

const existingEntries = (device: Partitionable): ConfigModel.Partition[] =>
  (device.partitions || []).filter((p) => p.name !== undefined);

/* A partition asked for by id and nothing else (a BIOS boot or PReP partition
   taken over from the installer) is planned content too: it takes room on the
   device and the configuration asks for it. */
const newEntries = (device: Partitionable): ConfigModel.Partition[] =>
  (device.partitions || []).filter((p) => p.name === undefined && (p.mountPath || p.id));

/** What a partition id is called, for a partition with no mount path to show. */
const PARTITION_ID_LABELS: Partial<Record<ConfigModel.PartitionId, string>> = {
  esp: "EFI system partition",
  prep: "PReP boot partition",
  bios_boot: "BIOS boot partition",
  swap: "Swap partition",
  lvm: "LVM physical volume",
  raid: "RAID member",
  linux: "Linux partition",
};

/** How a planned partition is named in a list: its mount path, or what it is for. */
const entryLabel = (entry: ConfigModel.Partition): string =>
  entry.mountPath || t(PARTITION_ID_LABELS[entry.id] || "Partition");

/** Existing partitions the new system mounts, whether it formats them or not. */
const reusedEntries = (device: Partitionable): ConfigModel.Partition[] =>
  existingEntries(device).filter((p) => p.mountPath);

/** Everything the new system will have here, created or adopted. */
const layoutEntries = (device: Partitionable): ConfigModel.Partition[] => [
  ...newEntries(device),
  ...reusedEntries(device),
];

/**
 * Everything that claims this device: volume groups built on it, RAID devices
 * it is a member of.
 *
 * Deliberately one list of names rather than one list per kind. The reader is
 * asking what else is involved, not what taxonomy it belongs to, and the panel
 * each name opens says what it is.
 */
const usersOf = (
  config: ConfigModel.Config,
  systemDevices: Storage.Device[],
  deviceName: string,
): Related[] => {
  const sid = systemDevices.find((d) => d.name === deviceName)?.sid;

  const groups = (config.volumeGroups || [])
    .map((vg, index) => ({
      name: vg.vgName,
      selection: { collection: "volumeGroups" as const, index },
      targets: vg.targetDevices || [],
    }))
    .filter((vg) => vg.targets.includes(deviceName))
    .map(({ name, selection }) => ({ name, selection }));

  const raids = (config.mdRaids || [])
    .map((raid, index) => ({
      name: baseName(raid.name),
      selection: { collection: "mdRaids" as const, index },
      members: systemDevices.find((d) => d.name === raid.name)?.md?.devices || [],
    }))
    .filter((raid) => sid !== undefined && raid.members.includes(sid))
    .map(({ name, selection }) => ({ name, selection }));

  return [...groups, ...raids];
};

/** The devices a RAID is built from, which the system reports and nothing shows. */
const membersOf = (
  device: Storage.Device | null,
  systemDevices: Storage.Device[],
  config: ConfigModel.Config,
): Related[] =>
  (device?.md?.devices || [])
    .map((sid) => systemDevices.find((d) => d.sid === sid)?.name)
    .filter(Boolean)
    .map((name) => ({ name: baseName(name), selection: selectionForDevice(config, name) }));

/**
 * Which device starts the machine, and on whose decision.
 *
 * "default" is the installer following the root file system, which is a device
 * the reader may never have picked; "chosen" is a device named on purpose.
 */
type BootRole = "none" | "chosen" | "default";

const bootRoleOf = (config: ConfigModel.Config, deviceName: string): BootRole => {
  if (!configModel.boot.hasDevice(config, deviceName)) return "none";

  return configModel.boot.isFollowingRoot(config) ? "default" : "chosen";
};

/* Where a boot loader lands. The EFI flag is the device's own; the paths cover
 * the platforms that boot from a mounted file system instead. */
const BOOT_PATHS = ["/boot", "/boot/efi", "/boot/zipl"];

/* What the backend calls a partition set aside for booting. Every device in the
 * proposal carries a description, and for a partition with no file system it is
 * the partition id in words: "BIOS Boot Partition", "PReP Boot Partition", "EFI
 * System Partition". It is the only place the id reaches the frontend, since
 * the proposal reports no partition id of its own. */
const BOOT_DESCRIPTIONS = /boot|efi|prep|zipl/i;

const isBootPartition = (device: Storage.Device): boolean =>
  device.partition?.efi === true ||
  BOOT_PATHS.includes(device.filesystem?.mountPath || "") ||
  BOOT_DESCRIPTIONS.test(device.description || "");

/**
 * What booting costs this device, read from the proposal rather than from the
 * configuration.
 *
 * Boot partitions are the solver's doing: nothing in the configuration asks for
 * them, so they appear in neither tab and the device looks like it is hosting
 * the boot loader for free. Comparing the proposal against the system says
 * which of them are new and which are partitions the device already had.
 */
const useBootCost = (deviceName: string, systemDevice: Storage.Device | null) => {
  const staging = useStagingDevices();
  const planned = staging.find((device) => device.name === deviceName);
  const known = new Set((systemDevice?.partitions || []).map((p) => p.sid));

  return (planned?.partitions || [])
    .map((partition) => ({
      name: baseName(partition.name),
      size: partition.block?.size,
      isNew: !known.has(partition.sid),
      isBoot:
        isBootPartition(partition) ||
        /* A BIOS boot or PReP partition carries no file system and nothing to
         * mount, so nothing about it says "boot" except that the solver added
         * it and the configuration never asked for it. */
        (!known.has(partition.sid) && !partition.filesystem),
    }))
    .filter((partition) => partition.isBoot);
};

/* ------------------------------------------------------------------ *
 * Boot as a scope of its own
 * ------------------------------------------------------------------ */

/**
 * The three states the model can hold, named for what the reader chooses.
 *
 * They are machine states, not device states: only "chosen" says anything about
 * a particular disk. That is the reason the decision is offered here rather
 * than on a device, where two of the three have nothing to attach to.
 */
type BootMode = "auto" | "chosen" | "off";

const bootModeOf = (config: ConfigModel.Config): BootMode => {
  if (!config.boot?.configure) return "off";
  if (configModel.boot.isDefault(config)) return "auto";
  return "chosen";
};

/* The three words the boot options page already uses, kept as they are: the
   reader meets them in the installer's own documentation and in every earlier
   version of this screen. */
/* Named so the row reads as a sentence: "Boot from the installation disk". The
   automatic state was called "Automatic", which said how the disk is picked
   rather than which disk it is, and left the value of the row unreadable on its
   own. */
const BOOT_MODE_LABELS: Record<BootMode, string> = {
  auto: "The installation disk",
  chosen: "A selected disk",
  /* Every value of this row completes "Boot from", and "do not configure" does
     not. The phrase stays in the description under it, where it is the one the
     boot options page uses. */
  off: "Nowhere",
};

/* A phrase each, not a sentence: these are read inside a menu, where a line
   that wraps three times makes the menu wider than the panel it opens in. The
   full sentence goes under the closed control, where there is room. */
const BOOT_MODE_MEANINGS: Record<BootMode, string> = {
  auto: "Wherever the / file system ends up",
  chosen: "One disk, whatever the plan does",
  off: "Do not configure anything for booting",
};

const BOOTLOADER_LABELS: Record<Bootloader.BootloaderType, string> = {
  grub2: "GRUB 2",
  "grub2-bls": "GRUB 2, boot loader spec layout",
  "systemd-boot": "systemd-boot",
};

/**
 * Everything the proposal says about every partition, in the console.
 *
 * The boot table is assembled by comparing two devicegraphs and matching on
 * what the backend happens to report, so when it comes out empty the question
 * is what the backend said, not what this file did with it.
 */
const useBootDebug = () => {
  const staging = useStagingTree();
  const systemDevices = useFlattenDevices();

  return () => {
    const known = new Set(systemDevices.map((device) => device.sid));
    const rows = staging.flatMap((device) =>
      (device.partitions || []).map((partition) => ({
        device: baseName(device.name),
        partition: baseName(partition.name),
        sid: partition.sid,
        new: !known.has(partition.sid),
        description: partition.description,
        efi: partition.partition?.efi,
        filesystem: partition.filesystem?.type,
        mountPath: partition.filesystem?.mountPath,
        takenAsBoot:
          isBootPartition(partition) || (!known.has(partition.sid) && !partition.filesystem),
      })),
    );

    console.table(rows);
    console.info("staging devices", staging.length, "system devices", systemDevices.length);
  };
};

/**
 * Writes the boot loader type.
 *
 * The model carries it and nothing in the interface sets it yet, so there is no
 * hook to borrow. Written on its own, leaving the device and the mode where
 * they are: the three are independent fields of the same setting.
 */
const useSetBootloader = () => {
  const config = useConfigModel();

  return (bootloader: Bootloader.BootloaderType) => {
    const next = configModel.clone(config);
    next.boot = { ...(next.boot || { configure: true }), bootloader };
    putStorageModel(next);
  };
};

/**
 * That this device boots the machine, and the two things the fact alone leaves
 * open: whether anyone chose it, and what the boot loader takes from it.
 *
 * It carries its own title, so the identity above is left to say what the
 * device is rather than what it has been signed up for.
 */
const BootNote = ({
  deviceName,
  systemDevice,
}: {
  deviceName: string;
  systemDevice: Storage.Device | null;
}) => {
  const config = useConfigModel();
  const role = bootRoleOf(config, deviceName);
  const cost = useBootCost(deviceName, systemDevice);

  if (role === "none") return null;

  /* Two clauses, because the line sits above the tabs and every line it takes
   * pushes them down. Why the installer picked this device, and what the
   * boot loader costs it, are the two answers the panel could not give; how the
   * automatic device is worked out is a longer story, and Boot options is where
   * that story is already told. */
  const why = role === "default" ? t("Boot device, chosen automatically.") : t("Boot device.");

  const parts = cost.map((partition) =>
    partition.isNew
      ? t(`a new partition (${deviceSize(partition.size)})`)
      : t(`${partition.name}, reused`),
  );

  const what = parts.length
    ? t(`Partitions to boot: ${formatList(parts)}.`)
    : t("No partition to boot needed.");

  return (
    <HelperText className="agm-plan-boot">
      <HelperTextItem icon={<Icon name="info" size="xs" />}>
        {why} {what}
      </HelperTextItem>
    </HelperText>
  );
};

/**
 * What the installer will do with a device, as counts.
 *
 * One statement per line and never a name: the list exists to be compared
 * across many devices at a glance, and the panel is where the names are. A row
 * that spells out six mount paths is taller than the entry it points at.
 */
const purposeOf = (
  device: ConfigModel.Drive | ConfigModel.MdRaid,
  groupCount: number,
  raidCount: number,
  boots: boolean,
): string[] => {
  const lines: string[] = [];

  if (device.filesystem) {
    lines.push(device.mountPath ? t(`Format for ${device.mountPath}`) : t("Format as a whole"));
  }

  const created = newEntries(device).length;
  const reused = reusedEntries(device).length;
  if (created) lines.push(t(`Create ${created} ${created === 1 ? "partition" : "partitions"}`));
  if (reused) lines.push(t(`Reuse ${reused} ${reused === 1 ? "partition" : "partitions"}`));

  /* Every line names something the installer does, so the ones about hosted
   * objects take a verb like the rest rather than sitting there as a bare
   * count.
   *
   * Booting joins the hosting line rather than taking one of its own: a disk
   * carrying a volume group and starting the machine is doing two jobs, and
   * the reader takes them in as one answer to "what is this disk for". */
  if (groupCount === 1) {
    lines.push(boots ? t("Host LVM and boot") : t("Host LVM"));
  } else if (groupCount > 1) {
    lines.push(
      boots
        ? t(`Host ${groupCount} LVM volume groups and boot`)
        : t(`Host ${groupCount} LVM volume groups`),
    );
  }
  if (raidCount) {
    lines.push(t(`Host ${raidCount} RAID ${raidCount === 1 ? "device" : "devices"}`));
  }

  /* Nothing else to hang it on, so it is a line of its own. */
  if (boots && !groupCount) lines.push(t("Start the new system"));

  return lines;
};

/**
 * Names the systems a plan removes when the device reports any, and counts
 * partitions when it reports none. "Windows 11 will be removed" is worth more
 * than "1 partition will be deleted", and the page has never said it per device.
 */
const namedOrCounted = (systems: string[], count: number, tail: string): string => {
  if (systems.length) return t(`${formatList(systems)} ${tail}`);
  return t(`${count} ${count === 1 ? "partition" : "partitions"} ${tail}`);
};

/* ------------------------------------------------------------------ *
 * What happens to one existing partition
 *
 * The device's policy sets the rule, and an entry naming that partition
 * overrides it. Reading only the policy claims a wipe on a device whose
 * partitions are individually reused, which is how the row cost and the plan
 * bar ended up contradicting each other.
 * ------------------------------------------------------------------ */

type Outcome =
  | { kind: "keep" }
  | { kind: "reuse"; mountPath: string }
  | { kind: "format"; mountPath: string }
  | { kind: "shrinkIfNeeded" }
  | { kind: "shrinkTo"; size: number }
  | { kind: "deleteIfNeeded" }
  | { kind: "delete" };

/* A partition and a logical volume carry the same space vocabulary, so what
 * becomes of one is worked out the same way as the other. */
type SpaceEntry = ConfigModel.Partition | ConfigModel.LogicalVolume;

const outcomeFor = (
  policy: ConfigModel.SpacePolicy,
  entry: SpaceEntry | undefined,
  currentSize?: number,
): Outcome => {
  if (entry) {
    if (entry.delete) return { kind: "delete" };
    if (entry.deleteIfNeeded) return { kind: "deleteIfNeeded" };
    /* A partition the new system mounts survives whatever the device policy says
     * about the rest. Whether its data does depends on the file system: keeping
     * the existing one keeps the files, and formatting the partition is as
     * destructive as deleting it, so the two are not reported alike. */
    if (entry.mountPath) {
      const keepsData = entry.filesystem?.reuse === true;
      return { kind: keepsData ? "reuse" : "format", mountPath: entry.mountPath };
    }
    /* Only a target that is actually smaller is a shrink. The forms write a
     * size range onto entries they touch, and reading any range as a shrink
     * produced "shrink to 17.99 GiB" on a partition already that size. */
    const target = entry.size?.max;
    if (entry.resize && target !== undefined && currentSize !== undefined && target < currentSize)
      return { kind: "shrinkTo", size: target };
    if (entry.resizeIfNeeded || entry.resize) return { kind: "shrinkIfNeeded" };
    return { kind: "keep" };
  }

  switch (policy) {
    case "delete":
      return { kind: "delete" };
    case "resize":
      return { kind: "shrinkIfNeeded" };
    default:
      return { kind: "keep" };
  }
};

const SPACE_LABELS: Record<Outcome["kind"], string> = {
  keep: "Keep",
  reuse: "Reuse",
  format: "Reuse and format",
  shrinkIfNeeded: "Shrink if needed",
  shrinkTo: "Shrink to a size",
  deleteIfNeeded: "Delete if needed",
  delete: "Delete",
};

/* ------------------------------------------------------------------ *
 * What the solver decided about a conditional outcome
 *
 * "Delete if needed" and "shrink if needed" are configured intents, and whether
 * either one fired is a question only the solver answers. It does answer it:
 * every planned action names the sid of the device it touches, and an existing
 * partition keeps its sid, so an action naming that sid says definitively what
 * became of it. Reporting the intent alone leaves the reader to guess, and lets
 * the plan bar, which counts actions, disagree with the rows, which count
 * intents.
 *
 * Only devices that already exist can be matched this way. One being created
 * has no sid yet, which is what makes its actions unattributable.
 * ------------------------------------------------------------------ */

type Solver = {
  /** Whether the solver decided to delete the device with this sid. */
  deletes: (sid: number) => boolean;
  /** The size the solver left the device at, where it decided to shrink it. */
  shrinksTo: (sid: number) => number | undefined;
};

const useSolver = (): Solver => {
  const actions = useActions();
  const staging = useStagingDevices();

  return useMemo(() => {
    /* A subvolume action names the file system it belongs to, so counting it
     * would report a device as resized because something inside it moved. */
    const touched = (sid: number, kind: "delete" | "resize") =>
      actions.some((action) => action.device === sid && action[kind] && !action.subvol);

    return {
      deletes: (sid) => touched(sid, "delete"),
      shrinksTo: (sid) =>
        touched(sid, "resize") ? staging.find((d) => d.sid === sid)?.block?.size : undefined,
    };
  }, [actions, staging]);
};

/**
 * An outcome as reported, once the solver has answered the conditionals.
 *
 * The extra state is the one the configuration cannot express: a partition the
 * installer was allowed to take and did not need.
 */
type ReportedOutcome = Outcome | { kind: "keptUntouched"; allowed: "delete" | "shrink" };

const reportedOutcome = (outcome: Outcome, sid: number, solver: Solver): ReportedOutcome => {
  if (outcome.kind === "deleteIfNeeded")
    return solver.deletes(sid) ? { kind: "delete" } : { kind: "keptUntouched", allowed: "delete" };

  if (outcome.kind === "shrinkIfNeeded") {
    /* The size comes from staging rather than from the configuration, which
     * only ever said "smaller if that helps". */
    const size = solver.shrinksTo(sid);
    return size === undefined
      ? { kind: "keptUntouched", allowed: "shrink" }
      : { kind: "shrinkTo", size };
  }

  return outcome;
};

/**
 * The reported form of the same decision.
 *
 * Nothing has happened yet, so nothing is written as though it had: a partition
 * is to be deleted, not deleted. The control that sets this says "Delete"; the
 * report says what is going to happen to the partition. Same terms, different
 * grammar, which is what keeps a report from reading as a button.
 *
 * Each phrase stands alone in its column and is capitalised accordingly. The
 * two conditionals keep a form of their own for the moment between a click and
 * the solver's answer, and are replaced by that answer once it arrives.
 */
const outcomeReport = (outcome: ReportedOutcome): Cost => {
  switch (outcome.kind) {
    case "delete":
      return { kind: "destroys", text: t("To be deleted") };
    case "deleteIfNeeded":
      return { kind: "destroys", text: t("To be deleted if needed") };
    case "shrinkIfNeeded":
      return { kind: "shrinks", text: t("To be shrunk if needed") };
    case "shrinkTo":
      /* The size the shrink leaves behind is reported in the size column, next
       * to the size it replaces, rather than spelled out again here. */
      return { kind: "shrinks", text: t("To be shrunk") };
    case "reuse":
      return { kind: "keeps", text: t(`To be reused as ${outcome.mountPath}`) };
    case "format":
      return { kind: "destroys", text: t(`To be formatted as ${outcome.mountPath}`) };
    case "keptUntouched":
      /* Configured as expendable and not spent yet. Saying only "kept" would
       * hide that the installer has permission to take it, and saying the space
       * was not needed reads as a promise about a plan that is still being
       * written: another volume asked for later spends exactly this. Which way
       * it may be taken is the difference between losing the partition and
       * losing room inside it. */
      return {
        kind: "keeps",
        text:
          outcome.allowed === "delete"
            ? t("Kept, deleted if room runs short")
            : t("Kept, shrunk if room runs short"),
      };
    default:
      /* The one entry that is not a change, so it does not take the future
       * form the others share. */
      return { kind: "keeps", text: t("Kept") };
  }
};

/**
 * The size a row ends at, where that is not the size it has now.
 *
 * Showing both in one cell puts the change next to the value it changes, which
 * is a comparison the reader would otherwise make across two columns.
 */
const plannedSize = (outcome: ReportedOutcome): number | undefined =>
  outcome.kind === "shrinkTo" ? outcome.size : undefined;

/**
 * The size column of a content row.
 *
 * One size most of the time. Where a shrink is planned, the size the row ends
 * at, with the size it leaves behind under it.
 */
const SizeCell = ({ size, planned }: { size?: number; planned?: number }) => (
  <td className="agm-plan-size">
    {planned === undefined ? (
      size === undefined ? null : (
        deviceSize(size)
      )
    ) : (
      <>
        <div>{deviceSize(planned)}</div>
        {size !== undefined && (
          <div className="agm-plan-before">{t(`Before ${deviceSize(size)}`)}</div>
        )}
      </>
    )}
  </td>
);

/**
 * What a device costs, summarised from what happens to each of its partitions
 * rather than from the policy alone.
 */
const costsFor = (
  device: Partitionable,
  systemDevice: Storage.Device | null,
  solver: Solver,
): Cost[] => {
  const policy = device.spacePolicy || "keep";
  const partitions = systemDevice?.partitions || [];
  if (partitions.length === 0) return [];

  const entries = device.partitions || [];
  const decided = partitions.map((partition) => ({
    partition,
    /* The solver's answer rather than the configured intent, so a device
     * allowed to lose partitions it did not have to lose reports nothing
     * lost. */
    outcome: reportedOutcome(
      outcomeFor(
        policy,
        entries.find((e) => e.name === partition.name),
        partition.block?.size,
      ),
      partition.sid,
      solver,
    ),
  }));

  const of = (...kinds: ReportedOutcome["kind"][]) =>
    decided.filter(({ outcome }) => kinds.includes(outcome.kind));
  const systemsOf = (group: typeof decided) =>
    group.flatMap(({ partition }) => partition.block?.systems || []);

  const deleted = of("delete");
  const formatted = of("format");
  const shrunk = of("shrinkTo");

  const costs: Cost[] = [];

  if (shrunk.length) {
    costs.push({
      kind: "shrinks",
      text: t(`${shrunk.length} ${shrunk.length === 1 ? "partition" : "partitions"} will shrink`),
    });
  }

  /* Deleting and formatting both lose data and are not the same act, so each
   * keeps its own verb rather than being merged into one vague line. */
  if (formatted.length) {
    costs.push({
      kind: "destroys",
      text: namedOrCounted(systemsOf(formatted), formatted.length, t("will be formatted")),
    });
  }

  if (deleted.length) {
    costs.push({
      kind: "destroys",
      text: namedOrCounted(systemsOf(deleted), deleted.length, t("will be deleted")),
    });
  }

  return costs;
};

/**
 * What happens to one logical volume the group already holds, with the
 * conditionals settled the same way a partition's are.
 */
const logicalVolumeOutcome = (
  lv: ConfigModel.LogicalVolume,
  sid: number | undefined,
  solver: Solver,
): "deleted" | "shrunk" | "kept" => {
  if (lv.delete) return "deleted";
  if (lv.resize) return "shrunk";
  /* A volume the system does not report has no sid to match an action against,
   * so its conditional stays unanswered and it is not claimed as a loss. */
  if (sid === undefined) return "kept";
  if (lv.deleteIfNeeded) return solver.deletes(sid) ? "deleted" : "kept";
  if (lv.resizeIfNeeded) return solver.shrinksTo(sid) === undefined ? "kept" : "shrunk";
  return "kept";
};

const volumeGroupCosts = (
  group: ConfigModel.VolumeGroup,
  systemGroup: Storage.Device | null,
  solver: Solver,
): Cost[] => {
  const existing = (group.logicalVolumes || []).filter((lv) => lv.lvName !== undefined);
  const sidOf = (lvName: string) =>
    (systemGroup?.logicalVolumes || []).find((lv) => baseName(lv.name) === lvName)?.sid;
  const decided = existing.map((lv) => logicalVolumeOutcome(lv, sidOf(lv.lvName), solver));
  const removed = decided.filter((outcome) => outcome === "deleted").length;
  const shrunk = decided.filter((outcome) => outcome === "shrunk").length;
  const costs: Cost[] = [];

  if (group.spacePolicy === "delete" && existing.length) {
    return [
      {
        kind: "destroys",
        text: t(`${existing.length} existing logical volumes will be deleted`),
      },
    ];
  }

  if (shrunk) costs.push({ kind: "shrinks", text: t(`${shrunk} logical volumes will shrink`) });
  if (removed)
    costs.push({ kind: "destroys", text: t(`${removed} logical volumes will be deleted`) });

  return costs;
};

/* ------------------------------------------------------------------ *
 * Writing the plan
 *
 * The space policy hook can only express two of the five per row decisions the
 * config model supports, so the row control writes the model directly. That is
 * the point of the exercise: `deleteIfNeeded` and an explicit shrink target are
 * reachable nowhere in the real interface.
 * ------------------------------------------------------------------ */

const withRowSpace = (
  config: ConfigModel.Config,
  collection: PartitionableCollection,
  index: number,
  deviceName: string,
  outcome: Outcome,
): ConfigModel.Config => {
  const next = configModel.clone(config);
  const device = next[collection]?.[index] as Partitionable | undefined;
  if (!device) return next;

  const partitions = (device.partitions ||= []);
  let entry = partitions.find((p) => p.name === deviceName);
  if (!entry) {
    entry = { name: deviceName };
    partitions.push(entry);
  }

  entry.delete = false;
  entry.deleteIfNeeded = false;
  entry.resize = false;
  entry.resizeIfNeeded = false;
  entry.size = undefined;

  switch (outcome.kind) {
    case "delete":
      entry.delete = true;
      break;
    case "deleteIfNeeded":
      entry.deleteIfNeeded = true;
      break;
    case "shrinkIfNeeded":
      entry.resizeIfNeeded = true;
      break;
    case "shrinkTo":
      entry.resize = true;
      entry.size = { default: false, min: outcome.size, max: outcome.size };
      break;
    default:
      break;
  }

  return next;
};

/**
 * The same write for a logical volume the group already holds.
 *
 * Separate from the partition version rather than generalised over both: the
 * two are reached through different collections, and one function carrying a
 * rule about which list to walk reads worse than two that each walk one.
 */
const withLogicalVolumeSpace = (
  config: ConfigModel.Config,
  index: number,
  lvName: string,
  outcome: Outcome,
): ConfigModel.Config => {
  const next = configModel.clone(config);
  const group = next.volumeGroups?.[index];
  if (!group) return next;

  const volumes = (group.logicalVolumes ||= []);
  let entry = volumes.find((lv) => lv.lvName === lvName);
  if (!entry) {
    entry = { lvName };
    volumes.push(entry);
  }

  entry.delete = false;
  entry.deleteIfNeeded = false;
  entry.resize = false;
  entry.resizeIfNeeded = false;
  entry.size = undefined;

  switch (outcome.kind) {
    case "delete":
      entry.delete = true;
      break;
    case "deleteIfNeeded":
      entry.deleteIfNeeded = true;
      break;
    case "shrinkIfNeeded":
      entry.resizeIfNeeded = true;
      break;
    case "shrinkTo":
      entry.resize = true;
      entry.size = { default: false, min: outcome.size, max: outcome.size };
      break;
    default:
      break;
  }

  return next;
};

/* ------------------------------------------------------------------ *
 * The row
 * ------------------------------------------------------------------ */

/**
 * A plain kebab that a MenuButton can drive.
 *
 * MenuButton clones a custom toggle with its ref, click handler and expanded
 * state, so this has to forward a ref to the button it renders.
 */
/**
 * Whether the plan puts anything on this device that a swap would carry over.
 *
 * What the plan creates here, and not what the device already has. A drive's
 * partition list holds an entry per existing partition the configuration has
 * something to say about, deletions and reuses included, so its length says
 * nothing about whether the plan builds anything: a disk whose whole space goes
 * to a volume group carries entries for the partitions being cleared off it and
 * plans nothing of its own.
 *
 * The group built on such a disk is a different fact, and one the reader is
 * told separately.
 */
const hasPlannedContent = (device: Partitionable): boolean =>
  device.filesystem !== undefined || newEntries(device).length > 0;

/**
 * Why the installation cannot be moved off this device, where it cannot.
 *
 * Swapping a device moves everything planned for it somewhere else, and there
 * are plans that cannot travel: a file system kept as it is, partitions reused
 * where they already are, a group or a boot loader that was put on this disk on
 * purpose. The configuration knows all four; none of them has ever been said to
 * the reader, who saw an offer wearing its own refusal as a title.
 *
 * Returns null where the swap is possible, and the reason where it is not, in
 * words a reader can act on: each one names the decision that would have to
 * change first.
 */
const retargetBlock = (config: ConfigModel.Config, device: Partitionable): string | null => {
  if (device.filesystem?.reuse) {
    return t("Its file system is being kept as it is, and a file system cannot be moved.");
  }

  if (configModel.partitionable.isReusingPartitions(device)) {
    return t("Partitions already on this device are being reused, and they cannot be moved.");
  }

  /* A disk carrying nothing of its own, chosen for something that lives on it.
     Where it also holds mount paths, those can travel and the swap is offered. */
  if (!configModel.partitionable.usedMountPaths(device).length) {
    const groups = configModel.partitionable.filterVolumeGroups(config, device);
    if (groups.length === 1) {
      return t(`The LVM volume group '${groups[0].vgName}' is built on this device.`);
    }
    if (groups.length > 1) {
      return t(`${groups.length} LVM volume groups are built on this device.`);
    }
    if (configModel.boot.hasExplicitDevice(config, device.name)) {
      return t("It was chosen for booting. Change that in Boot options first.");
    }
  }

  return null;
};

/* How anything inside the page or the sheet opens something else in the sheet.
   Declared here because a row's menu is the first thing to use it. */
const PanelNavContext = React.createContext<{
  /** Opens an entry's sheet, on a named tab where the caller has one in mind. */
  goToDevice: (selection: Selection, tab?: PanelTab) => void;
  goToBoot: () => void;
}>({
  goToDevice: () => undefined,
  goToBoot: () => undefined,
});

type ActionItem = {
  title: string;
  onClick: () => void;
  isDanger?: boolean;
  /** What the item does, where the title alone leaves the reader guessing, or
      why it cannot be done where it is offered and refused. */
  description?: string;
  /** Offered and refused. The title stays what the act is called, so a reader
      still finds the thing they came for, and the description says why it is
      out of reach. Aria disabled rather than disabled, so it can still be
      reached by keyboard and the reason still read. */
  isBlocked?: boolean;
  /** Opens a run of items about something else. */
  hasDividerBefore?: boolean;
};

/**
 * The one row menu this playground uses, everywhere.
 *
 * It exists because the two menus in core disagree about which three dots a
 * menu wears: `SimpleDropdown` uses the horizontal glyph and `RowActions` the
 * vertical one. Mixing them, which is what happens when both are reached for,
 * makes rows in the same table look like they do different things. The
 * horizontal glyph is the one this interface uses where it has the choice.
 *
 * The label names the toggle and nothing else. Heading the open menu with it
 * spent a line and a rule on a title the reader had just clicked, in a menu of
 * two or three items; the row the menu belongs to is the row it opened from.
 */
const ActionsMenu = ({
  label,
  items,
  position = "right",
}: {
  label: string;
  items: ActionItem[];
  position?: "right" | "end";
}) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Dropdown
      isOpen={isOpen}
      onSelect={() => setIsOpen(false)}
      onOpenChange={setIsOpen}
      popperProps={{ position }}
      toggle={(toggleRef) => (
        <MenuToggle
          ref={toggleRef}
          onClick={() => setIsOpen(!isOpen)}
          variant="plain"
          aria-label={label}
          isExpanded={isOpen}
        >
          <Icon name="more_horiz" />
        </MenuToggle>
      )}
    >
      <DropdownList>
        {items.map(({ title, onClick, isDanger, description, isBlocked, hasDividerBefore }, i) => (
          <React.Fragment key={i}>
            {/* Always before anything destructive, whatever else the run does:
                a rule is the pause that stops a reader arriving at "Do not use
                this device" with the momentum of the item above it. */}
            {(hasDividerBefore || isDanger) && <Divider />}
            <DropdownItem
              onClick={isBlocked ? undefined : onClick}
              isAriaDisabled={isBlocked}
              isDanger={isDanger}
              description={description}
            >
              {title}
            </DropdownItem>
          </React.Fragment>
        ))}
      </DropdownList>
    </Dropdown>
  );
};

const KebabToggle = React.forwardRef<HTMLButtonElement, { label: string }>(
  ({ label, ...props }, ref) => (
    <MenuToggle ref={ref} variant="plain" aria-label={label} {...props}>
      <Icon name="more_horiz" />
    </MenuToggle>
  ),
);
KebabToggle.displayName = "KebabToggle";

/**
 * The device actions, taken from the interface being redesigned rather than
 * invented here. Changing the device, creating a volume group on it and
 * dropping it from the configuration are what those menus already do, including
 * the device selector dialog and every explanation attached to it.
 */
/**
 * What a row offers about the device it names.
 *
 * Written here rather than taken from `SearchedDeviceMenu`, which the shipping
 * proposal page uses: this is a wording exploration, and the words it wants are
 * not the words that page should change to on the strength of a playground.
 *
 * Opening the device leads, because it is what clicking the row does. A menu
 * whose first item is the row's own act is a menu that says what the row does
 * for a reader who never discovers that rows are clickable, and for one who
 * cannot click.
 *
 * Everything below it is in the vocabulary the rest of the page uses for the
 * same acts, so a reader meets one name per act wherever it is offered.
 */
const PartitionableActions = ({
  collection,
  index,
  opensDevice = true,
}: {
  collection: PartitionableCollection;
  index: number;
  /** False in the sheet's own header, where the reader is already inside it. */
  opensDevice?: boolean;
}) => {
  const config = useConfigModel();
  const deleteDrive = useDeleteDrive();
  const deleteMdRaid = useDeleteMdRaid();
  const convertToVg = useConvertPartitionableToVolumeGroup();
  const convertDevice = useConvertDevice();
  const available = useAvailableDevices();
  const { goToDevice } = React.useContext(PanelNavContext);
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);
  const device = config[collection]?.[index] as Partitionable | undefined;
  const systemDevice = useDevice(device?.name || "");

  if (!device || !systemDevice) return null;

  const name = baseName(device.name);
  /* Every device the plan does not already hold, plus the one it is on, which
     is how the dialog shows what is selected. */
  const usedNames = configModel
    .devices(config)
    .map((entry) => entry.name)
    .filter((used) => used !== device.name);
  const targets = available.filter((candidate) => !usedNames.includes(candidate.name));
  const groups = configModel.partitionable.filterVolumeGroups(config, device);

  const blocked = retargetBlock(config, device);
  const items: ActionItem[] = [
    ...(opensDevice
      ? [{ title: t(`Configure ${name}`), onClick: () => goToDevice({ collection, index }) }]
      : []),
    {
      /* The title stays what the act is called even where the act cannot be
         done, so a reader looking for it finds it and learns why rather than
         hunting for an offer that renamed itself into a refusal. */
      title: t("Use another device"),
      /* What "another device" costs, which the title cannot say: the plan is
         not being rebuilt, it is being moved. A reader who has spent time on
         this device's content needs to know it comes with them.

         Only where there is content to carry. On a disk the plan puts nothing
         of its own on, the sentence promises the move of nothing. */
      description:
        blocked ||
        (hasPlannedContent(device)
          ? t(`Everything planned for ${name} moves to the device you pick.`)
          : undefined),
      isBlocked: blocked !== null,
      onClick: () => setIsSelectorOpen(true),
    },
  ];

  if (!device.filesystem) {
    items.push({
      title: groups.length
        ? t(`Create another LVM volume group on ${name}`)
        : t(`Create LVM volume group on ${name}`),
      onClick: () => convertToVg(device.name),
      hasDividerBefore: true,
    });
  }

  /* Dropping the only device leaves a plan with nowhere to go, so the offer is
     made where there is somewhere else for the installation to live. */
  if (configModel.hasAdditionalDevices(config)) {
    items.push({
      title: t("Do not use this device"),
      isDanger: true,
      onClick: () => (collection === "drives" ? deleteDrive(index) : deleteMdRaid(index)),
    });
  }

  return (
    <>
      <ActionsMenu label={t(`Actions for ${name}`)} items={items} position="end" />
      {isSelectorOpen && (
        <DeviceSelectorModal
          title={t("Use another device")}
          intro={
            hasPlannedContent(device)
              ? t(`The plan stays as it is. Everything ${name} was going to hold moves.`)
              : t("The plan stays as it is.")
          }
          selected={systemDevice}
          disks={targets.filter(isDrive)}
          mdRaids={targets.filter(isMd)}
          volumeGroups={targets.filter(isVolumeGroup)}
          onCancel={() => setIsSelectorOpen(false)}
          onConfirm={([target]) => {
            setIsSelectorOpen(false);
            convertDevice(device.name, target.name);
          }}
        />
      )}
    </>
  );
};

const VolumeGroupActions = ({ index }: { index: number }) => {
  const config = useConfigModel();
  const navigate = useNavigate();
  const deleteVolumeGroup = useDeleteVolumeGroup();
  const group = config.volumeGroups?.[index];
  const systemDevice = useDevice(group?.name || "");

  if (!group) return null;

  /* A volume group found on the system can be swapped for another one; a group
   * this configuration defines cannot, so it gets edit and delete instead. */
  if (group.name) {
    return (
      <SearchedVolumeGroupMenu
        deviceConfig={group}
        device={systemDevice}
        toggle={<KebabToggle label={t(`Actions for ${group.vgName}`)} />}
        popperProps={{ position: "end" }}
      />
    );
  }

  return (
    <ActionsMenu
      label={t(`Actions for ${group.vgName}`)}
      items={[
        {
          title: t("Edit the volume group"),
          onClick: () =>
            navigate(generateEncodedPath(PATHS.volumeGroup.edit, { id: group.vgName })),
        },
        {
          title: t("Do not use"),
          isDanger: true,
          onClick: () => deleteVolumeGroup(group.vgName, false),
        },
      ]}
    />
  );
};

const DeviceActions = ({ selection }: { selection: Selection }) =>
  selection.collection === "volumeGroups" ? (
    <VolumeGroupActions index={selection.index} />
  ) : (
    <PartitionableActions collection={selection.collection} index={selection.index} />
  );

type RowProps = {
  selection: Selection;
  isSelected: boolean;
  onSelect: (selection: Selection) => void;
  registerRef: (index: number, node: HTMLAnchorElement | null) => void;
  position: number;
  showsMenu: boolean;
};

type RowContent = {
  name: string;
  description: string;
  /** Roles the device carries, read beside its name as the panel reads them. */
  marks?: string[];
  /** What the new system will have here, one statement per line. */
  content: string[];
  costs: Cost[];
  isPlanned: boolean;
};

const COLUMN_LABELS = {
  device: "Device",
  content: "Content",
  changes: "Changes",
};

/**
 * What a device is, in one phrase: its size, its kind, and what it sits on.
 *
 * Shared by the row and by the panel header. A device described one way in the
 * list and another way in the panel is two devices as far as the reader is
 * concerned, and the phrase also absorbs the column that used to hold "over
 * vdd" and printed a dash for every disk.
 */
const partitionableDescription = (device: Storage.Device | null): string =>
  [
    device?.block?.size ? deviceSize(device.block.size) : undefined,
    /* A configuration can name a device the machine does not have: a profile
       written for another machine, or a disk that has been unplugged. */
    device ? typeDescription(device) : undefined,
    device?.partitionTable?.type?.toUpperCase(),
  ]
    .filter(Boolean)
    .join("  ·  ");

/* Where a group sits is a relationship, so it belongs on the relationship line
 * rather than inside the phrase saying what the group is. */
const volumeGroupDescription = (): string => t("LVM volume group");

/**
 * One row per configured entry.
 *
 * A table rather than a list of grids, for the reason the panel's content list
 * became one: columns only line up when a single element owns them, and the
 * whole point of the list is comparing devices down a column. It also gives
 * every cell a column header a screen reader announces, and names each row after
 * its device.
 */
const RowShell = ({
  content,
  selection,
  isSelected,
  onSelect,
  registerRef,
  position,
  showsMenu,
}: RowProps & { content: RowContent }) => {
  const { density } = useVariants();
  const labelId = useId();

  /* The device cell is the link. Selection is navigation in the real thing,
   * which buys aria-current, a pasteable URL and a phase that adds forms to the
   * panel without rewriting this. Here it stays local state so the playground
   * needs no route of its own. */
  const link = (
    <a
      id={labelId}
      href="#"
      ref={(node) => registerRef(position, node)}
      aria-current={isSelected ? "true" : undefined}
      className="agm-plan-row-link"
      onClick={(event) => {
        event.preventDefault();
        onSelect(selection);
      }}
    >
      <Text isBold>{content.name}</Text>
      {content.description && (
        <span className="agm-plan-row-description"> {content.description}</span>
      )}
      {content.marks?.map((mark) => (
        <React.Fragment key={mark}>
          {" "}
          <Label isCompact>{mark}</Label>
        </React.Fragment>
      ))}
    </a>
  );

  const classes = [
    "agm-plan-row",
    `agm-plan-row-${density}`,
    isSelected && "agm-plan-row-selected",
    !content.isPlanned && "agm-plan-row-idle",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <tr
      className={classes}
      /* A click anywhere activates the link. A mouse convenience with no
       * keyboard equivalent, which is only acceptable because the link is the
       * dominant element in the row and the row shows a hover rail. */
      onClick={() => onSelect(selection)}
    >
      <th scope="row" data-label={t(COLUMN_LABELS.device)}>
        {link}
      </th>
      <td data-label={t(COLUMN_LABELS.content)}>
        {content.content.length === 0 ? (
          <span className="agm-plan-muted">{t("Nothing planned")}</span>
        ) : (
          content.content.map((line) => <div key={line}>{line}</div>)
        )}
      </td>
      <td data-label={t(COLUMN_LABELS.changes)}>
        <CostSlot costs={content.costs} />
      </td>
      {showsMenu && (
        <td className="agm-plan-row-control" onClick={(event) => event.stopPropagation()}>
          <DeviceActions selection={selection} />
        </td>
      )}
    </tr>
  );
};

/**
 * Split from the volume group row on purpose. Both call hooks, and a single
 * component switching between a drive and a volume group renders a different
 * number of hooks depending on what is selected.
 */
const PartitionableRow = (props: RowProps) => {
  const config = useConfigModel();
  const { collection, index } = props.selection;
  const device = config[collection]?.[index] as Partitionable;
  const systemDevice = useDevice(device?.name || "");
  const allDevices = useFlattenDevices();
  const solver = useSolver();

  if (!device) return null;

  const users = usersOf(config, allDevices, device.name);
  const boots = bootRoleOf(config, device.name) !== "none";
  const content = purposeOf(
    device,
    users.filter((u) => u.selection?.collection === "volumeGroups").length,
    users.filter((u) => u.selection?.collection === "mdRaids").length,
    boots,
  );

  return (
    <RowShell
      {...props}
      content={{
        name: baseName(device.name),
        description: partitionableDescription(systemDevice),
        /* No mark: booting is one of the things the row now says this disk is
           for, written into the line about what it carries. The sheet keeps
           the mark, where the name has no column of purposes beside it. */
        content,
        costs: costsFor(device, systemDevice, solver),
        isPlanned: content.length > 0,
      }}
    />
  );
};

const VolumeGroupRow = (props: RowProps) => {
  const config = useConfigModel();
  const { index } = props.selection;
  const group = config.volumeGroups?.[index];
  const systemDevice = useDevice(group?.name || "");
  const solver = useSolver();

  if (!group) return null;

  /* A count, not a list. Six logical volumes named after long mount paths turn
   * a row into four lines of text, which is the content the panel exists to
   * hold. */
  const count = (group.logicalVolumes || []).length;
  /* Where the group sits, which is what its row lacked: a group's row without
     its disks is a row about something floating, and a reader scanning two rows
     should learn the group lives on the disk from either end. One disk is
     named, several are counted, which is the threshold the rest of the page
     uses. */
  const hosts = (group.targetDevices || []).map((name) => baseName(name));
  const on = (() => {
    if (!hosts.length) return t("Create LVM volume group");
    if (hosts.length === 1) return t(`Create LVM volume group on ${hosts[0]}`);
    return t(`Create LVM volume group on ${hosts.length} disks`);
  })();

  return (
    <RowShell
      {...props}
      content={{
        name: group.vgName,
        /* No second line: the group heading above already says these are
         * volume groups, and what it sits on is one of the lines below. */
        description: "",
        content: [
          on,
          ...(count ? [t(`Define ${count} logical ${count === 1 ? "volume" : "volumes"}`)] : []),
        ],
        costs: volumeGroupCosts(group, systemDevice, solver),
        isPlanned: true,
      }}
    />
  );
};

const DeviceRow = (props: RowProps) =>
  props.selection.collection === "volumeGroups" ? (
    <VolumeGroupRow {...props} />
  ) : (
    <PartitionableRow {...props} />
  );

/* ------------------------------------------------------------------ *
 * The panel: what is on the disk now
 * ------------------------------------------------------------------ */

type ContentItem = Storage.Device | Storage.UnusedSlot;

const isSlot = (item: ContentItem): item is Storage.UnusedSlot =>
  (item as Storage.Device).sid === undefined;

/**
 * One short line each, the length the menus in the interface being redesigned
 * already use. A menu item is a choice, not a paragraph: anything that needs
 * two sentences needs somewhere other than a menu.
 */
const SPACE_DESCRIPTIONS: Partial<Record<Outcome["kind"], string>> = {
  keep: "Left as it is.",
  shrinkIfNeeded: "Resized only if space runs short.",
  deleteIfNeeded: "Removed only if space runs short.",
  delete: "Removed, and its data lost.",
};

/* The three the interface already offers per partition. An explicit shrink
 * target and a conditional delete are states the model can hold and the solver
 * can report, so both are still read; neither is offered as a choice here,
 * because neither is a choice the reader can make anywhere else. */
const SPACE_OUTCOMES: Outcome["kind"][] = ["keep", "shrinkIfNeeded", "delete"];

/**
 * What happens to one partition, under the per partition policy.
 *
 * An option that cannot apply stays in the list, disabled, carrying the
 * reported reason as its own text. A tooltip is not an option here: PatternFly
 * does not make a tooltip trigger focusable, so a keyboard never reaches one on
 * static text, and making it focusable adds a tab stop leading nowhere.
 */
const RowSpaceControl = ({
  device: partition,
  current,
  onChoose,
}: {
  device: Storage.Device;
  current: Outcome;
  onChoose: (kind: Outcome["kind"]) => void;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const canShrink = supportShrink(partition);
  /* The device reports why it cannot shrink in two sentences of prose, which is
   * more than a menu item can hold without pushing the menu past the panel. The
   * item says that it cannot; where the full reason should be read is an open
   * question, and a menu is not the answer. */
  const reason = t("This device cannot be made smaller.");

  const isDisabled = (kind: Outcome["kind"]) => !canShrink && kind === "shrinkIfNeeded";

  return (
    <Dropdown
      isOpen={isOpen}
      onOpenChange={setIsOpen}
      popperProps={{ position: "right" }}
      toggle={(ref) => (
        <MenuToggle
          ref={ref}
          size="sm"
          isExpanded={isOpen}
          onClick={() => setIsOpen((open) => !open)}
          aria-label={t(`Changes allowed for ${baseName(partition.name)}`)}
        >
          {t(SPACE_LABELS[current.kind])}
        </MenuToggle>
      )}
    >
      <DropdownList>
        {SPACE_OUTCOMES.map((kind) => (
          <DropdownItem
            key={kind}
            isSelected={kind === current.kind}
            isDanger={kind === "delete"}
            isDisabled={isDisabled(kind)}
            description={isDisabled(kind) ? reason : SPACE_DESCRIPTIONS[kind]}
            onClick={() => {
              setIsOpen(false);
              onChoose(kind);
            }}
          >
            {t(SPACE_LABELS[kind])}
          </DropdownItem>
        ))}
      </DropdownList>
    </Dropdown>
  );
};

/**
 * One existing partition, or one gap between two of them.
 *
 * Reuse is not a space decision, so it does not hide behind the per partition
 * policy: adopting a partition is about what the new system mounts, and it stays
 * reachable under every policy. That distinction is why it lives in the row menu
 * rather than in the control next to it.
 */
/**
 * The Planned action cell.
 *
 * Reading and deciding are the same column. Under any policy but Custom there
 * is nothing to decide, so the cell reports. Under Custom the row carries a
 * decision, and putting its control in the column that reports the result keeps
 * the two together instead of leaving the reader to pair a value on the left
 * with a control at the far right of the row.
 *
 * A row with no decision to make keeps reporting: a partition the new system
 * mounts is settled by the reuse, and offering to delete it beside that would
 * contradict it.
 *
 * A line under the control only where the solver said something the control did
 * not: "Delete if needed" answered by "Kept, deleted if room runs short" is worth
 * reading, and the same permission echoed back as "To be deleted if needed" is
 * the control's own text a second time.
 */
const PlannedActionCell = ({
  reported,
  device,
  current,
  onChoose,
}: {
  reported: ReportedOutcome | null;
  /** Set only where the row can be decided here. */
  device?: Storage.Device;
  current?: Outcome | null;
  onChoose?: (kind: Outcome["kind"]) => void;
}) => {
  const report = reported ? outcomeReport(reported) : null;

  if (!device || !current || !onChoose)
    return <td>{report && <CostLine cost={report} showIcon={report.kind !== "keeps"} />}</td>;

  return (
    <td>
      <RowSpaceControl device={device} current={current} onChoose={onChoose} />
      {report && reported.kind !== current.kind && (
        <div className="agm-plan-choice-note">{report.text}</div>
      )}
    </td>
  );
};

const ContentRow = ({
  item,
  collection,
  index,
  entry,
  policy,
}: {
  item: ContentItem;
  collection: PartitionableCollection;
  index: number;
  entry: ConfigModel.Partition | undefined;
  policy: ConfigModel.SpacePolicy;
}) => {
  const config = useConfigModel();
  const navigate = useNavigate();
  const deletePartition = useDeletePartition();
  const solver = useSolver();
  const [pending, setPending] = useState<Outcome | null>(null);

  const size = isSlot(item) ? item.size : item.block.size;
  const stored = isSlot(item) ? null : outcomeFor(policy, entry, size);
  /* Every edit is a round trip. Showing the chosen value immediately keeps a
   * control from sitting on its old value long enough to invite a second
   * click. */
  const current = pending || stored;
  /* The control shows what is configured; this column shows what the solver
   * made of it. While a write is in flight the solver has not seen the new
   * configuration yet, so the choice just made is reported as an intent rather
   * than resolved against a stale answer. */
  const reported: ReportedOutcome | null =
    pending || (stored && !isSlot(item) ? reportedOutcome(stored, item.sid, solver) : stored);

  useEffect(() => {
    if (pending && stored && stored.kind === pending.kind) setPending(null);
  }, [pending, stored]);

  if (isSlot(item)) {
    /* Free space is a row, because "keep everything" is a choice with no
     * visible evidence behind it otherwise. */
    return (
      <tr className="agm-plan-free">
        <th scope="row" className="agm-plan-muted">
          {t("Free space")}
        </th>
        <td />
        <td className="agm-plan-size">{deviceSize(size)}</td>
        <td />
        <td />
      </tr>
    );
  }

  const systems = item.block?.systems || [];
  const what = item.filesystem?.type || item.description || t("unrecognised");
  const isSpokenFor = current?.kind === "reuse" || current?.kind === "format";
  const isGoverned = !isSpokenFor;
  const reusedAs = isSpokenFor ? (current as { mountPath: string }).mountPath : undefined;

  const commit = (outcome: Outcome) => {
    setPending(outcome);
    putStorageModel(withRowSpace(config, collection, index, item.name, outcome));
  };

  const choose = (kind: Outcome["kind"]) => commit({ kind } as Outcome);

  const reuseItems = reusedAs
    ? [
        {
          title: t("Edit the reused partition"),
          onClick: () =>
            navigate(
              generateEncodedPath(PATHS.editPartition, {
                collection,
                index: String(index),
                partitionId: reusedAs,
              }),
            ),
        },
        {
          title: t("Stop reusing"),
          onClick: () => deletePartition(collection, index, reusedAs),
        },
      ]
    : [
        {
          title: t("Reuse for the new system…"),
          onClick: () =>
            navigate(
              generateEncodedPath(PATHS.reusePartition, {
                collection,
                index: String(index),
                deviceName: item.name,
              }),
            ),
        },
      ];

  return (
    <>
      <tr>
        <th scope="row">
          <Text isBold>{baseName(item.name)}</Text>
          {item.block?.encrypted && (
            <>
              {" "}
              <Icon name="lock" size="xs" aria-label={t("encrypted")} />
            </>
          )}
        </th>
        {/* What is on the partition. What becomes of it is the next column but
            one, so it is not repeated here. The file system stays in the text
            and a system the device reports sits beside it as a mark: naming
            Windows is what makes a deletion mean something, and dropping the
            file system to make room for it lost the reader the other half. */}
        <td>
          <Flex
            gap={{ default: "gapXs" }}
            alignItems={{ default: "alignItemsCenter" }}
            flexWrap={{ default: "wrap" }}
          >
            <FlexItem>{what}</FlexItem>
            {systems.map((system) => (
              <FlexItem key={system}>
                <Label isCompact>{system}</Label>
              </FlexItem>
            ))}
          </Flex>
        </td>
        {/* Always this column, whatever else the row carries. A size that moves
            with the length of its neighbour cannot be compared down the list. */}
        <SizeCell size={size} planned={reported ? plannedSize(reported) : undefined} />
        <PlannedActionCell
          reported={reported}
          device={policy === "custom" && isGoverned ? item : undefined}
          current={policy === "custom" && isGoverned ? current : undefined}
          onChoose={policy === "custom" && isGoverned ? choose : undefined}
        />
        <td className="agm-plan-row-control">
          <ActionsMenu label={t(`Actions for ${baseName(item.name)}`)} items={reuseItems} />
        </td>
      </tr>
    </>
  );
};

const BULK_POLICIES: ConfigModel.SpacePolicy[] = ["delete", "resize", "keep", "custom"];

const BULK_LABELS: Record<ConfigModel.SpacePolicy, string> = {
  delete: "Delete everything",
  resize: "Shrink if needed",
  keep: "Keep everything",
  custom: "Custom",
};

/* The same four on the page, where the control is not a command but a report of
 * what the plan is doing: the sentence under it reads "Deleting everything" and
 * then says what that costs. In the sheet the reader is acting on a table and
 * the imperative is right; here they are reading. */
const SUMMARY_BULK_LABELS: Record<ConfigModel.SpacePolicy, string> = {
  delete: "Deleting everything",
  resize: "Shrinking if needed",
  keep: "Keeping everything",
  custom: "Custom",
};

/**
 * Four segmented options rather than a dropdown. A dropdown hides three of the
 * four behind a click and gives no sense that a choice exists at all, while the
 * segmented control shows the whole decision and which part of it is taken.
 *
 * Per row controls appear only under "Per partition", so a device following one
 * rule carries one control instead of one per partition.
 *
 * What each option means is a tooltip, so it can be read before the option is
 * taken. The tooltip is addressed to the button by id rather than wrapped
 * around it: a wrapper lands between the group and its buttons and breaks the
 * segmented look, and props on a toggle item reach that wrapper rather than the
 * button.
 */
const SPACE_MEANINGS: Record<ConfigModel.SpacePolicy, string> = {
  delete: "Every existing partition is removed and its data lost.",
  resize: "Existing partitions are made smaller where the installer runs short of room.",
  keep: "Only free space and partitions you reuse are used.",
  custom: "Choose what happens to each partition below.",
};

const SPACE_CONTROL_LABEL_ID = "agm-plan-space-control-label";
const SPACE_SETTING_TOGGLE_ID = "agm-plan-space-setting-toggle";
const SPACE_SETTING_VALUE_ID = "agm-plan-space-setting-value";

/* The same decision written as a sentence about the content rather than as the
 * name of a setting. The term is the subject and the value is what happens to
 * it, which is what lets the row read on its own once it sits above the table
 * it governs rather than on it.
 *
 * "Content" rather than "partitions" because the same row has to work on a
 * volume group, where the things kept or removed are logical volumes. */
const SPACE_SETTING_TERM = "Existing content";

const SPACE_SETTING_VALUES: Record<ConfigModel.SpacePolicy, string> = {
  delete: "removed to make room",
  resize: "made smaller to make room",
  keep: "left as it is",
  custom: "decided item by item",
};

/* Both name a permission rather than an outcome, which is the reading the whole
 * column beside it depends on. The terse one has been on the page since round
 * three; the longer one spells out who is being permitted, at the cost of a
 * label long enough to wrap beside the control. */
const SPACE_HEADINGS: Record<SpaceLabel, string> = {
  terse: "Allowed changes",
  plain: "What the installer may change",
};

const policyButtonId = (policy: ConfigModel.SpacePolicy) => `agm-plan-policy-${policy}`;

const SpacePolicySegments = ({
  current,
  onChoose,
  labels = BULK_LABELS,
}: {
  current: ConfigModel.SpacePolicy;
  onChoose: (policy: ConfigModel.SpacePolicy) => void;
  /** What each option is called, which differs between reading and acting. */
  labels?: Record<ConfigModel.SpacePolicy, string>;
}) => (
  <>
    {/* The group carries the name the row no longer prints: four buttons whose
        text says what each does need saying what they are four of, and a label
        beside them repeats the tab they already sit in. */}
    <ToggleGroup
      isFill
      isCompact
      aria-label={t(SPACE_HEADINGS.terse)}
      className="agm-plan-space-segments"
    >
      {BULK_POLICIES.map((policy) => (
        <ToggleGroupItem
          key={policy}
          text={t(labels[policy])}
          buttonId={policyButtonId(policy)}
          isSelected={policy === current}
          onChange={() => onChoose(policy)}
        />
      ))}
    </ToggleGroup>
    {/* Each button keeps what is written on it as its name, which is what voice
        control reaches it by, and takes what it means as a description while
        the tooltip is open. */}
    {BULK_POLICIES.map((policy) => (
      <Tooltip
        key={policy}
        content={t(SPACE_MEANINGS[policy])}
        triggerRef={() => document.getElementById(policyButtonId(policy))}
      />
    ))}
  </>
);

/**
 * The same decision as one menu.
 *
 * Four buttons spend the whole width of the panel head on a choice that is
 * made once and then read, and they set the four options at the weight of the
 * table's own headings. The menu keeps the chosen value visible, which is what
 * a reader coming back to the panel is looking for, and carries what each
 * option means as its description rather than as a line under the strip.
 */
const SpacePolicyMenu = ({
  current,
  onChoose,
  labelId = SPACE_CONTROL_LABEL_ID,
  labels = BULK_LABELS,
}: {
  current: ConfigModel.SpacePolicy;
  onChoose: (policy: ConfigModel.SpacePolicy) => void;
  /** The term this menu is the value of, which is what names it. */
  labelId?: string;
  /** What each option is called, which differs between reading and acting. */
  labels?: Record<ConfigModel.SpacePolicy, string>;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  /* The page and the sheet can both be on screen at once, and two toggles
     sharing one id name each other. */
  const valueId = useId();

  return (
    <Dropdown
      isOpen={isOpen}
      onOpenChange={setIsOpen}
      popperProps={{ position: "right" }}
      toggle={(ref) => (
        <MenuToggle
          ref={ref}
          size="sm"
          isExpanded={isOpen}
          aria-labelledby={`${labelId} ${valueId}`}
          onClick={() => setIsOpen((open) => !open)}
        >
          <span id={valueId}>{t(labels[current])}</span>
        </MenuToggle>
      )}
    >
      <DropdownList>
        {BULK_POLICIES.map((policy) => (
          <DropdownItem
            key={policy}
            isSelected={policy === current}
            isDanger={policy === "delete"}
            description={t(SPACE_MEANINGS[policy])}
            onClick={() => {
              setIsOpen(false);
              onChoose(policy);
            }}
          >
            {t(labels[policy])}
          </DropdownItem>
        ))}
      </DropdownList>
    </Dropdown>
  );
};

const SpacePolicyControl = ({
  isNarrow = false,
  ...props
}: {
  current: ConfigModel.SpacePolicy;
  onChoose: (policy: ConfigModel.SpacePolicy) => void;
  /* Four buttons do not fit a strip and do not wrap into anything worth
     reading, so there the decision is the menu: one line, and the value it
     holds stays visible. */
  isNarrow?: boolean;
}) => {
  const { spaceControl } = useVariants();

  if (isNarrow || spaceControl === "menu") return <SpacePolicyMenu {...props} />;

  return <SpacePolicySegments {...props} />;
};

/**
 * The same decision on the page, in the two shapes the review asked to compare.
 *
 * The toggles show all four answers at once, which is what makes them quick for
 * a reader who came here to change this. The value line shows the answer the
 * plan currently has, which is what makes it quiet for the reader who did not,
 * and reads the way the sheet already reads a setting: the term is the label
 * and the control is the value.
 *
 * Four toggles at button weight, directly above a row of buttons, is the
 * fatigue the review named. Which of the two costs less is worth judging on a
 * machine with plenty to read rather than on a calm one.
 */
const SummarySpaceDecision = ({
  current,
  onChoose,
  isNarrow,
}: {
  current: ConfigModel.SpacePolicy;
  onChoose: (policy: ConfigModel.SpacePolicy) => void;
  /* Four buttons do not fit a strip and do not wrap into anything worth
     reading, so there the decision is always the value line. */
  isNarrow: boolean;
}) => {
  const { spaceShape } = useVariants();
  const termId = useId();

  if (!isNarrow && spaceShape === "toggles") {
    /* Set smaller than the sentence above it. Four buttons at the size of the
       page's own text read as four things to do; at xs they read as the four
       answers to one question, which is what they are. */
    return (
      <div className="agm-plan-space-quiet">
        <SpacePolicySegments current={current} onChoose={onChoose} labels={SUMMARY_BULK_LABELS} />
      </div>
    );
  }

  return (
    <Flex
      alignItems={{ default: "alignItemsCenter" }}
      justifyContent={{ default: "justifyContentCenter" }}
      gap={{ default: "gapSm" }}
      flexWrap={{ default: "wrap" }}
    >
      <FlexItem id={termId} className="agm-plan-muted">
        {t(SPACE_SETTING_TERM)}
      </FlexItem>
      <FlexItem>
        <SpacePolicyMenu
          current={current}
          onChoose={onChoose}
          labelId={termId}
          labels={SUMMARY_BULK_LABELS}
        />
      </FlexItem>
    </Flex>
  );
};

/**
 * The rule the table under it follows, and what the value it holds means.
 *
 * The label prints beside the menu only. A menu shows one phrase and needs a
 * subject for it; four buttons each say what they do, and the group names
 * itself for a screen reader, so a label beside them says the same thing twice.
 */
const SpaceDecisionRow = ({
  policy,
  onChoose,
}: {
  policy: ConfigModel.SpacePolicy;
  onChoose: (policy: ConfigModel.SpacePolicy) => void;
}) => {
  const { spaceLabel, spaceControl } = useVariants();

  return (
    <Flex
      alignItems={{ default: "alignItemsCenter" }}
      gap={{ default: "gapSm" }}
      className="agm-plan-space-row"
    >
      {spaceControl === "menu" && (
        <span id={SPACE_CONTROL_LABEL_ID} className="agm-plan-space-row-term">
          {t(SPACE_HEADINGS[spaceLabel])}
        </span>
      )}
      <FlexItem grow={{ default: "grow" }}>
        <SpacePolicyControl current={policy} onChoose={onChoose} />
      </FlexItem>
      {/* What the four options mean is read on the options themselves: each
          segment carries its own as a tooltip, on hover and on focus. The menu
          shows three of the four only while it is open, so the value it holds
          keeps its line. */}
      {spaceControl === "menu" && (
        <FlexItem fullWidth={{ default: "fullWidth" }} className="agm-plan-muted">
          {t(SPACE_MEANINGS[policy])}
        </FlexItem>
      )}
    </Flex>
  );
};

/**
 * Which policy the device follows, from the configuration where it can say so
 * and from here where it cannot.
 *
 * "Custom" with no exceptions on any partition is the same configuration as
 * "keep": nothing is deleted and nothing is shrunk. The model has no way to
 * record that the user asked to decide per partition and has not decided
 * anything yet, so it comes back as "keep", and the per row controls that asking
 * was meant to reveal never appear.
 *
 * The request is therefore remembered here. Every other policy follows the
 * configuration, because every other policy is written into it.
 */
/**
 * What was last asked for, per entry.
 *
 * Custom is the one choice the configuration cannot report back: it means the
 * partitions decide for themselves, and a model with no rule over them reads
 * as "keep". Remembering the answer beside the model is what keeps the control
 * on custom after it has been chosen.
 *
 * Above every control rather than inside each one: the page and the sheet both
 * offer this decision, and two memories of it disagree the moment one is used.
 * That is exactly what happened: choosing custom on the page opened a sheet
 * that had never heard of it and showed keep.
 */
const AskedPolicyContext = React.createContext<{
  asked: Record<string, ConfigModel.SpacePolicy>;
  remember: (key: string, policy: ConfigModel.SpacePolicy) => void;
}>({ asked: {}, remember: () => undefined });

const useSpacePolicy = (collection: Collection, index: number, stored: ConfigModel.SpacePolicy) => {
  const setSpacePolicy = useSetSpacePolicy();
  const { asked, remember } = React.useContext(AskedPolicyContext);
  const key = `${collection}:${index}`;

  /* The configuration is the truth, except where it is reporting the value
     custom collapses to and custom is what was asked for. */
  const policy = asked[key] === "custom" && stored === "keep" ? "custom" : stored;

  const choose = (next: ConfigModel.SpacePolicy) => {
    remember(key, next);
    setSpacePolicy(collection, index, { type: next });
  };

  return { policy, choose };
};

/* ------------------------------------------------------------------ *
 * The panel: sections
 * ------------------------------------------------------------------ */

type SectionProps = React.PropsWithChildren<{
  title: string;
  intro?: React.ReactNode;
  action?: React.ReactNode;
  /** Reads before the control row: what the situation is, before changing it. */
  before?: React.ReactNode;
  /** Shown at the leading edge under tabs, where the heading is not rendered. */
  lead?: React.ReactNode;
  /** Marks the section in the gutter, where the gutter is drawn. */
  icon?: React.ComponentProps<typeof Icon>["name"];
  headingId: string;
  /** A section that is not one of a pair of tabs, so nothing else names it. */
  standalone?: boolean;
}>;

/**
 * One half of the panel.
 *
 * Under tabs the tab already names this region and PatternFly wires the panel
 * to it, so repeating the name as a heading says the same thing twice. Only the
 * action stays, and the tables carry their own accessible name either way.
 */
const PanelSection = ({
  title,
  intro,
  action,
  before,
  lead,
  icon,
  headingId,
  standalone = false,
  children,
}: SectionProps) => {
  const { scroll, sections, gutter } = useVariants();
  const isTabbed = sections === "tabs" && !standalone;

  const heading = (
    <Title headingLevel="h3" size="md" id={headingId}>
      {title}
    </Title>
  );

  /* The heading takes the leading slot only when nothing else wants it. A
   * control with its own label keeps that label beside it, and the heading
   * moves above, so the label never ends up naming the section instead. */
  const leading = lead || (isTabbed ? null : heading);

  const head = (
    <div className="agm-plan-section-head">
      {!isTabbed && lead && heading}
      <Flex
        justifyContent={{ default: "justifyContentSpaceBetween" }}
        alignItems={{ default: "alignItemsCenter" }}
        gap={{ default: "gapMd" }}
        flexWrap={{ default: "wrap" }}
      >
        {/* Empty when there is nothing to lead with, which is what keeps a lone
            action against the trailing edge. */}
        <FlexItem>
          <Flex
            display={{ default: "inlineFlex" }}
            alignItems={{ default: "alignItemsCenter" }}
            gap={{ default: "gapSm" }}
          >
            {/* A mark the eye can aim at without a box being drawn around
                anything, and only where there is something for it to mark.
                Decorative: what the section is, the words beside it say. */}
            {gutter && icon && leading && (
              <span className="agm-plan-gutter-mark" aria-hidden="true">
                <Icon name={icon} size="xs" />
              </span>
            )}
            {leading}
          </Flex>
        </FlexItem>
        {action && <FlexItem>{action}</FlexItem>}
      </Flex>
      {intro && <div className="agm-plan-section-intro">{intro}</div>}
    </div>
  );

  const body = <div className="agm-plan-section-body">{children}</div>;

  /* A rule between what the tab says about itself and what it holds. The two
     are different kinds of thing at the same size, and reading down the panel
     there was nothing to say where one ended. */
  const rule = <Divider className="agm-plan-note-rule" />;

  if (isTabbed) {
    /* A tab whose head holds nothing renders none: the head reserves the height
       of a heading it is not drawing, which under tabs pushes the content down
       for no reason a reader can see. */
    const hasHead = Boolean(leading || action || intro);

    return (
      <div className={`agm-plan-section agm-plan-section-scroll-${scroll}`}>
        {before}
        {before && rule}
        {hasHead && head}
        {body}
      </div>
    );
  }

  return (
    <section
      aria-labelledby={headingId}
      className={`agm-plan-section agm-plan-section-scroll-${scroll}`}
    >
      {before}
      {head}
      {body}
    </section>
  );
};

/* Read left to right, the three titles read time forwards: what the device
 * becomes, what the configuration asks of it, what is on it now.
 *
 * "Planned" rather than "New": new is relative, and the reader has to work out
 * relative to what. Two of them keep the word content, which is what makes that
 * pair symmetrical (what should be there, what is there now) and what lets the
 * current half say "the device is empty" honestly: under a heading about
 * content, empty claims no content rather than no bytes. The first borrows the
 * name the result section already uses, since it is the same table narrowed to
 * one device. */
const SECTION_TITLES = {
  result: "Final layout",
  planned: "Planned content",
  members: "Properties",
  current: "Current content",
};

/* One mark each, chosen for what the tab is about rather than for storage:
   the shape the device ends up in, work still to be carried out, and the
   hardware as it stands. */
const TAB_ICONS: Record<PanelTab, React.ComponentProps<typeof Icon>["name"]> = {
  result: "schema",
  planned: "pending_actions",
  /* The only tab about other entries rather than about this one, so it takes
     the mark the page already uses for a relationship. */
  members: "device_hub",
  current: "hard_drive",
};

/* Three phrases of one shape, so the strip reads as one question answered three
   ways: when. Naming the moment each tab is about beats describing it, which is
   what left the middle two saying almost the same thing.

   None of them names partitions or volumes: the same strip serves a disk, a
   RAID and a volume group, and what each holds goes by a different word. */
const TAB_SUMMARIES: Record<PanelTab, string> = {
  result: "After installing",
  planned: "For the new system",
  members: "What it is made of",
  current: "Already here",
};

/**
 * A tab named in a sentence, and the way there.
 *
 * Naming a place is offering the way to it: every tab a sentence mentions is
 * the tab that changes what the sentence describes, so the name is the link.
 * The word "tab" stays outside it, since the name alone is a phrase the
 * sentence happens to share with the strip above.
 */
/**
 * The sentence a tab opens with, set apart from what it describes.
 *
 * Helper text rather than a paragraph of body copy: the sentence is guidance
 * about the tab, and the indent and the mark say so before a word is read.
 */

/**
 * Where the panel can send the reader.
 *
 * The relationship line names objects that live elsewhere in the same list.
 * Naming one without being able to reach it leaves the reader to find it by
 * hand.
 */
type Related = { name: string; selection?: Selection };

type Relationship = { label: string; items: Related[] };

const RelatedName = ({ item }: { item: Related }) => {
  const { goToDevice } = React.useContext(PanelNavContext);

  if (!item.selection) return <>{item.name}</>;

  return (
    <Button variant="link" isInline onClick={() => goToDevice(item.selection)}>
      {item.name}
    </Button>
  );
};

/**
 * What this device is tied to, above the tabs.
 *
 * One line per relationship, the label reading into the names as a sentence
 * would. A description list was the first arrangement and cost more than it
 * returned: a term column wide enough for the longest label leaves a gap beside
 * every shorter one, and the pairs get row spacing meant for a list of facts
 * rather than for a line of links.
 *
 * Deliberately generic labels. A disk may be claimed by a volume group, by a
 * software RAID, and by whatever this interface grows support for next;
 * spelling out which kind each name is would both date the wording and repeat
 * what the destination panel says about itself. A link identifies, and the
 * panel it opens explains.
 *
 * There is no prose summary next to it. The tabs below already say which state
 * can be inspected and the tables in them already name every mount point, so a
 * paragraph restating either is the same information a third time. A summary
 * earns its place by serving a different task, not by being possible.
 */
const RelatedNames = ({ items }: { items: Related[] }) => (
  <>
    {items.map((item, i) => (
      <React.Fragment key={item.name}>
        {i > 0 && (i === items.length - 1 ? t(" and ") : t(", "))}
        <RelatedName item={item} />
      </React.Fragment>
    ))}
  </>
);

const Relationships = ({ groups }: { groups: Relationship[] }) => {
  const shown = groups.filter((group) => group.items.length > 0);

  if (shown.length === 0) return null;

  return (
    <div className="agm-plan-related">
      {shown.map((group) => (
        <p key={group.label}>
          <span className="agm-plan-related-label">{t(group.label)}</span>{" "}
          <RelatedNames items={group.items} />
        </p>
      ))}
    </div>
  );
};

/* ------------------------------------------------------------------ *
 * The panel: the settings block
 *
 * What is decided about the device, and by whom, in one format per row:
 *
 *     [mark]  Term  value
 *             One line saying what it means, or where to go next.
 *
 * The term is the control wherever the decision can be made here, so the word
 * the reader clicks is the word naming the decision and the value reads beside
 * it as plain text. A fact takes the same shape without a control, which is
 * what keeps the block reading as a list of decisions rather than as a form
 * with labels in it.
 *
 * The same three blocks carry every scope: a volume group has no partition
 * table, a volume has no content, and nothing else about the arrangement
 * changes between them.
 * ------------------------------------------------------------------ */

type Setting = {
  key: string;
  /** Marks the row in PatternFly's term gutter, so the marks line up down the list. */
  icon: React.ComponentProps<typeof Icon>["name"];
  term: React.ReactNode;
  /** The value, or the control that sets it. */
  value?: React.ReactNode;
  /** Only where it says something the value does not. */
  explanation?: React.ReactNode;
  /** Overrides how the list reads this one: a value that is a name sits beside
      its term, a value that is a sentence sits under it. */
  layout?: "inline" | "stacked";
};

/**
 * A description list, because every row is a term and a value.
 *
 * Laid out by hand rather than with the horizontal modifier: that one sets the
 * term column to a share of the panel and leaves a gap beside every short term,
 * which is what got an earlier description list removed. Here the gutter is
 * padding, so the term reads into its value as a sentence would and the
 * explanation starts under the term rather than under the value.
 */
const SettingsList = ({
  settings,
  layout = "inline",
}: {
  settings: Setting[];
  /** Inline reads as a sentence; stacked puts the control under its label, the
      way a form does, which suits a list that is mostly controls. */
  layout?: "inline" | "stacked";
}) => {
  /* PatternFly sets the orientation on the list rather than on the entry, and
     one list here holds both: a name reads beside its term, a sentence reads
     under it. Consecutive entries of a kind share a list, which keeps the order
     the caller wrote. */
  const runs: { layout: "inline" | "stacked"; items: Setting[] }[] = [];
  settings.forEach((setting) => {
    const kind = setting.layout || layout;
    const last = runs[runs.length - 1];
    if (last?.layout === kind) last.items.push(setting);
    else runs.push({ layout: kind, items: [setting] });
  });

  return (
    <Stack className="agm-plan-settings-runs">
      {runs.map((run) => (
        <StackItem key={run.items[0].key}>
          <DescriptionList
            className={`agm-plan-settings-${run.layout}`}
            isCompact
            isHorizontal={run.layout === "inline"}
            isFluid={run.layout === "inline"}
          >
            {run.items.map((setting) => (
              <DescriptionListGroup key={setting.key}>
                {/* The mark is decorative: what the row is about, the term
                    beside it says. It is there to give the eye a rail without a
                    box being drawn. */}
                <DescriptionListTerm icon={<Icon name={setting.icon} size="xs" aria-hidden />}>
                  {setting.term}
                </DescriptionListTerm>
                <DescriptionListDescription>
                  {setting.value}
                  {setting.explanation && (
                    <div>
                      <Text component="small" textStyle="textColorSubtle">
                        {setting.explanation}
                      </Text>
                    </div>
                  )}
                </DescriptionListDescription>
              </DescriptionListGroup>
            ))}
          </DescriptionList>
        </StackItem>
      ))}
    </Stack>
  );
};

/**
 * The space decision, as the value of its row.
 *
 * The term stays a label and the control says what is happening to the content
 * now, which is what a reader coming back to the panel is looking for. The menu
 * items keep the imperative wording: "Delete everything" is what the reader is
 * asking for, and "removed to make room" is what the row reports afterwards.
 */
const SpaceSettingMenu = ({
  current,
  onChoose,
}: {
  current: ConfigModel.SpacePolicy;
  onChoose: (policy: ConfigModel.SpacePolicy) => void;
}) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Dropdown
      isOpen={isOpen}
      onOpenChange={setIsOpen}
      toggle={(ref) => (
        <MenuToggle
          ref={ref}
          id={SPACE_SETTING_TOGGLE_ID}
          variant="plainText"
          size="sm"
          isExpanded={isOpen}
          /* Named by the term beside it plus the value written on it, in that
             order, so the row still reads as a pair. */
          aria-labelledby={`${SPACE_CONTROL_LABEL_ID} ${SPACE_SETTING_VALUE_ID}`}
          onClick={() => setIsOpen((open) => !open)}
        >
          <span id={SPACE_SETTING_VALUE_ID}>{t(SPACE_SETTING_VALUES[current])}</span>
        </MenuToggle>
      )}
    >
      <DropdownList>
        {BULK_POLICIES.map((policy) => (
          <DropdownItem
            key={policy}
            isSelected={policy === current}
            isDanger={policy === "delete"}
            description={t(SPACE_MEANINGS[policy])}
            onClick={() => {
              setIsOpen(false);
              onChoose(policy);
            }}
          >
            {t(BULK_LABELS[policy])}
          </DropdownItem>
        ))}
      </DropdownList>
    </Dropdown>
  );
};

type SpaceDecision = {
  policy: ConfigModel.SpacePolicy;
  choose: (p: ConfigModel.SpacePolicy) => void;
};

/**
 * The rule for what is already on the device.
 *
 * Moving it here takes the decision away from the table it governs, and the
 * explanation line is what replaces the proximity: under "decided item by item"
 * it says where the decisions are made and the words naming the place are the
 * route to it.
 */
const spaceSetting = ({
  space,
  explanations,
  entryName,
  onGoToCurrent,
}: {
  space: SpaceDecision;
  explanations: Explanations;
  /** What the reader decides one by one: a partition, or a logical volume. */
  entryName: string;
  onGoToCurrent: () => void;
}): Setting => {
  const { policy, choose } = space;
  const perEntry = policy === "custom";

  const explanation = perEntry ? (
    <>
      {t(`Set each ${entryName}'s own rule under `)}
      <Button variant="link" isInline onClick={onGoToCurrent}>
        {t("Content, Current")}
      </Button>
      {t(".")}
    </>
  ) : (
    explanations === "always" && t(SPACE_MEANINGS[policy])
  );

  return {
    key: "space",
    icon: "hard_drive",
    term: <span id={SPACE_CONTROL_LABEL_ID}>{t(SPACE_SETTING_TERM)}</span>,
    value: <SpaceSettingMenu current={policy} onChoose={choose} />,
    explanation: explanation || undefined,
  };
};
const PTABLE_NAMES: Record<string, string> = {
  gpt: "GPT",
  msdos: "MS-DOS",
  dasd: "DASD",
};

const ptableSetting = (device: Partitionable): Setting | null => {
  if (!device.ptableType) return null;

  return {
    key: "ptable",
    icon: "list_alt",
    term: t("Partition table"),
    value: t(PTABLE_NAMES[device.ptableType] || device.ptableType),
  };
};

/** What the installation settings say, which is what every scope inherits. */
const installationEncryption = (config: ConfigModel.Config): string => {
  const encryption = config.encryption;

  if (!encryption) return "Not encrypted";

  return encryption.tpm ? "LUKS2 with TPM" : "LUKS2";
};

/**
 * Encryption as one planned volume reports it.
 *
 * Encryption is a property of what is created, not of the disk it is created
 * on, so it is read row by row beside the file system rather than as a setting
 * over the whole panel. Where the value came from is a second line under it: a
 * volume that sets its own reads the same way, minus that line.
 */
const EncryptionCell = () => {
  const config = useConfigModel();
  const encrypted = Boolean(config.encryption);

  return (
    <>
      <div>{encrypted ? t(installationEncryption(config)) : t("None")}</div>
      <div className="agm-plan-row-note">{t("Following system")}</div>
    </>
  );
};

/**
 * The mount point of a planned entry, and the partition it lands on where that
 * partition is already there.
 *
 * A new entry says nothing about a source: the installer creates it, and there
 * is no name to give. An entry that reuses one names it, and says whether what
 * is on it survives, which is the difference a reader is looking for.
 */
const PlannedMount = ({
  label,
  source,
  onGoToCurrent,
}: {
  label: string;
  /** The partition already on the device, where the entry takes one. */
  source?: Storage.Device;
  /** Opens the tab where that partition is listed as it stands today. */
  onGoToCurrent?: () => void;
}) => {
  const mount = (
    <Text isBold className="agm-plan-mount">
      {label}
    </Text>
  );

  if (!source) return mount;

  const name = baseName(source.name);
  /* The name opens the tab that holds the partition, where what is on it today
     and what becomes of it are both listed. Nothing else is said here: which
     file system it gets has a column of its own, and whether its data survives
     is what the other tab is about. */
  const link = onGoToCurrent ? (
    <Button variant="link" isInline onClick={onGoToCurrent}>
      {name}
    </Button>
  ) : (
    name
  );

  return (
    <>
      {mount}
      <div className="agm-plan-row-note">
        {t("Reusing")} {link}
      </div>
    </>
  );
};

/**
 * Relationships in the same list, since a value that is a link already reads as
 * one.
 *
 * @param groups - the relationships worth a row; an empty one gets none.
 * @param icon - the mark for every row, so what a device is made of and what it
 *   belongs to carry the same one.
 */
const relationshipSettings = (groups: Relationship[], icon: RelationIcon = "apps"): Setting[] =>
  groups
    .filter((group) => group.items.length > 0)
    .map((group) => ({
      key: group.label,
      icon,
      term: t(group.label),
      value: <RelatedNames items={group.items} />,
    }));

const settingsOf = (candidates: (Setting | null | false)[]): Setting[] =>
  candidates.filter((setting): setting is Setting => Boolean(setting));

/** What a tab holds, and where what it holds is decided. */
type TabExplanation = { lead: React.ReactNode; where?: React.ReactNode };

/**
 * A block set on a dimmed ground.
 *
 * For content that belongs to what surrounds it without being part of it. The
 * tint does what a border would, without drawing a line the eye has to cross.
 */
const Dimmed = ({ children }: React.PropsWithChildren) => (
  <div className="agm-plan-dimmed">{children}</div>
);

/**
 * One block of statements above a tab's content.
 *
 * A block of its own per kind of statement, rather than one list of all of
 * them: what the tab is about and what the device is are written in different
 * places, and the rule between two blocks is what tells them apart.
 */
const Statements = ({ children }: React.PropsWithChildren) => {
  const { statementRule } = useVariants();

  return <div className={`agm-plan-statements agm-plan-rule-${statementRule}`}>{children}</div>;
};

/**
 * The sentence a tab opens with, set apart from what it follows.
 *
 * No mark beside it. Every candidate said something the sentence does not: a
 * status to attend to, an aside to come back to, a warning. The dimmed ground
 * already says the block is not part of what the tab holds.
 */
const TabNote = ({ lead, where }: TabExplanation) => {
  const { tabNote } = useVariants();

  /* Read as one more statement about the device, which puts its mark in the
     same gutter and its lines on the same column as the statements under it.
     What it costs is the tint that said the sentence is about the tab rather
     than about the disk. */
  if (tabNote === "statement") {
    return (
      <Statements>
        <SettingsList
          settings={[
            {
              key: "note",
              /* The line is about the tab it opens, so its mark points into
                 the tab rather than describing anything on the disk. A help
                 circle was tried and reads as a control to press for more; the
                 tab's own mark repeats the strip two lines above. */
              icon: "last_page",
              term: lead,
              explanation: where,
              layout: "stacked",
            },
          ]}
        />
      </Statements>
    );
  }

  return (
    <Dimmed>
      <HelperText>
        <HelperTextItem className="agm-plan-tab-note">
          <div>{lead}</div>
          {where && <div>{where}</div>}
        </HelperTextItem>
      </HelperText>
    </Dimmed>
  );
};

const TabLink = ({ tab, onGoTo }: { tab: PanelTab; onGoTo: (tab: PanelTab) => void }) => (
  <Button variant="link" isInline onClick={() => onGoTo(tab)}>
    {t(SECTION_TITLES[tab])}
  </Button>
);

/**
 * The sentence each tab opens with: what it holds, and where what it holds is
 * decided.
 *
 * None of them addresses the reader or calls the planned content something the
 * reader asked for: the plan starts as the installer's own proposal, and an
 * entry lands on a device for reasons never stated about that device. The
 * subject is the device and the new system, which the word "planned" and the
 * tab titles already carry.
 *
 * @param subject - the device as the sentences name it, such as "this disk".
 * @param tabs - the tabs this panel shows, since a volume group being defined
 *   here has no current content to point at.
 */
const tabExplanations = (
  subject: string,
  tabs: PanelTab[],
  onGoTo: (tab: PanelTab) => void,
): Record<PanelTab, React.ReactNode> => {
  const link = (tab: PanelTab) => <TabLink tab={tab} onGoTo={onGoTo} />;
  const hasCurrent = tabs.includes("current");

  /* Two parts, not one paragraph: what the tab holds, and then where what it
     holds is decided. The second is the one a reader acts on, and it is lost at
     the end of a wrapped sentence. */
  const explanations: Record<PanelTab, TabExplanation> = {
    result: {
      lead: t(`How ${subject} looks once the installer is done.`),
      where: (
        <>
          {t("It follows from the")} {link("planned")}
          {hasCurrent && (
            <>
              {" "}
              {t("and")} {link("current")}
            </>
          )}{" "}
          {hasCurrent
            ? t("tabs, which is where it changes.")
            : t("tab, which is where it changes.")}
        </>
      ),
    },
    planned: {
      lead: t(`What ${subject} will hold for the new system.`),
      where: hasCurrent ? (
        <>
          {t(
            "Making room for it may mean deleting or shrinking what is there today, decided in the",
          )}{" "}
          {link("current")} {t("tab.")}
        </>
      ) : undefined,
    },
    members: {
      lead: t(`What ${subject} is made of, and how it is defined.`),
      where: (
        <>
          {t("What it will hold is in the")} {link("planned")} {t("tab.")}
        </>
      ),
    },
    current: {
      lead: t("What to do with the existing partitions"),
      /* About this tab, not about the control under it: a sentence that points
         at whatever happens to be rendered next breaks the moment anything
         moves, and reads as a caption for it in the meantime. */
      where: (
        <>
          {t("Choose how the installer should use the existing partitions. The")} {link("result")}{" "}
          {t("tab shows the resulting disk layout.")}
        </>
      ),
    },
  };

  return {
    result: <TabNote {...explanations.result} />,
    planned: <TabNote {...explanations.planned} />,
    members: <TabNote {...explanations.members} />,
    current: <TabNote {...explanations.current} />,
  };
};

/**
 * The button that swaps the target without touching the plan.
 *
 * The same dialog the device menu opens and the same write behind it. What
 * changes is where it is: the reader who thinks "wrong disk" is looking at the
 * sentence or the header naming that disk, so the way out is beside the name
 * rather than the fourth item of a menu.
 *
 * The label belongs to the place it is read: a page says what the reader gets
 * out of pressing it, and a header inside the sheet says what happens to the
 * plan they are looking at.
 */
const RetargetButton = ({
  device,
  label,
  variant = "secondary",
  isBlocked = false,
  hintId,
}: {
  device: Partitionable;
  label: string;
  variant?: "link" | "secondary" | "plain" | "primary";
  /** Offered and refused, with the reason printed beside it by the caller. */
  isBlocked?: boolean;
  /** The reason, so the button is described by it rather than only sitting
      near it. */
  hintId?: string;
}) => {
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);
  const config = useConfigModel();
  const convertDevice = useConvertDevice();
  const systemDevice = useDevice(device.name);
  const available = useAvailableDevices();
  const name = baseName(device.name);

  /* Every device the plan does not already hold, plus the one it is on, which
     is how the dialog shows what is selected. */
  const usedNames = configModel
    .devices(config)
    .map((entry) => entry.name)
    .filter((used) => used !== device.name);
  const targets = available.filter((candidate) => !usedNames.includes(candidate.name));

  return (
    <>
      {/* The mark travels with the offer, so the same act is recognisable
          wherever it is made: on the page beside "Add more devices", and in the
          sheet under the content it would move. Two circled glyphs side by side
          read as two offers of the same kind, which is what they are.

          Laid out the way the menu beside it lays out its own, rather than
          through the button's icon slot, which sets the mark smaller and on the
          text's baseline. Side by side the two were visibly a pair of
          different things. */}
      {/* Aria disabled rather than disabled, so a reader can still reach the
          control, hear its name and hear why it will not act. A disabled
          button is skipped, and the explanation beside it is never met. */}
      <Button
        variant={variant}
        isAriaDisabled={isBlocked}
        aria-describedby={hintId}
        onClick={isBlocked ? undefined : () => setIsSelectorOpen(true)}
      >
        <Flex alignItems={{ default: "alignItemsCenter" }} gap={{ default: "gapSm" }}>
          <Icon name="change_circle" /> {label}
        </Flex>
      </Button>
      {isSelectorOpen && (
        <DeviceSelectorModal
          title={label}
          intro={
            hasPlannedContent(device)
              ? t(`The plan stays as it is. Everything ${name} was going to hold moves.`)
              : t("The plan stays as it is.")
          }
          selected={systemDevice}
          disks={targets.filter(isDrive)}
          mdRaids={targets.filter(isMd)}
          volumeGroups={targets.filter(isVolumeGroup)}
          onCancel={() => setIsSelectorOpen(false)}
          onConfirm={([target]) => {
            setIsSelectorOpen(false);
            convertDevice(device.name, target.name);
          }}
        />
      )}
    </>
  );
};

/**
 * What the reader does about the device, rather than about its content.
 *
 * One offer, after the table it belongs under: swapping the target is about
 * this entry as a whole, and it is not worth the weight of a control in the
 * header, which reads as something to do before anything else on the panel.
 *
 * Dropping the device used to sit beside it and does not any more. Anything
 * destructive is offered in one place, the menu in the sheet's header, so a
 * reader learns where those live rather than meeting them wherever a component
 * happened to have room.
 */
const DeviceActionButtons = ({ device }: { device: Partitionable }) => {
  const config = useConfigModel();
  const hintId = useId();
  /* The same answer the menu in the header gives, from the same place. The two
     offered the same act and disagreed about whether it was possible: the menu
     refused it and the button beside the table opened a dialog with one device
     in it. */
  const blocked = retargetBlock(config, device);

  /* This offer belongs to the content above it. Under a tab that has just said
     nothing is planned here, moving what is planned is not an act the reader
     can want, and offering it greyed out is worse than not offering it: it
     asks them to work out why something they were not looking for is refused.

     The device as a whole is still swappable business, and the menu in the
     header is where the device as a whole is dealt with. */
  if (!hasPlannedContent(device)) return null;

  return (
    <Flex direction={{ default: "column" }} gap={{ default: "gapXs" }}>
      <FlexItem>
        <RetargetButton
          device={device}
          label={t("Use another device")}
          variant="link"
          isBlocked={blocked !== null}
          hintId={blocked ? hintId : undefined}
        />
      </FlexItem>
      {/* Under the offer rather than inside it, which is how the rest of the
          interface explains a control it will not let you use: the install
          button, the product form and the device dialog all leave the control
          where it was and put the reason beside it. */}
      {blocked && (
        <FlexItem>
          <HelperText id={hintId}>
            <HelperTextItem variant="indeterminate">{blocked}</HelperTextItem>
          </HelperText>
        </FlexItem>
      )}
    </Flex>
  );
};

/**
 * What a multi device entry is made of, and how it is defined.
 *
 * A volume group and a software RAID are the two entries in the plan that are
 * not a piece of hardware: they are defined, and what defines them is a list of
 * other entries plus a few decisions about how to use them. None of that is
 * content, so none of it belongs in the tab about content, and it was reading
 * there as though the group already sat on those disks.
 *
 * Its own tab instead, which also gives the properties somewhere to grow: today
 * it holds what the entry is built on and how much of it is taken, and the form
 * behind the link at the foot has more to say than the panel wants to repeat.
 */
const EntryPropertiesSection = ({
  members,
  properties,
  editPath,
  editLabel,
  explanation,
}: {
  /** The entries this one is built from. */
  members: Relationship[];
  /** Everything else the configuration says about it. */
  properties?: Setting[];
  /** The form that changes all of it, where there is one. */
  editPath?: string;
  editLabel?: string;
  /** What this tab holds, and which tabs change it. */
  explanation?: React.ReactNode;
}) => {
  const navigate = useNavigate();
  const { relationIcon } = useVariants();
  const headingId = useId();
  const settings = settingsOf([
    ...relationshipSettings(members, relationIcon),
    ...(properties || []),
  ]);

  return (
    <PanelSection
      title={t(SECTION_TITLES.members)}
      icon={TAB_ICONS.members}
      headingId={headingId}
      intro={explanation}
    >
      <SettingsList settings={settings} />
      {/* At the foot, after what it changes. The panel says what the entry is;
          the form is where it becomes something else, and a reader reaches for
          it having read the answer they came for. */}
      {editPath && (
        <Flex className="agm-plan-section-body">
          <Button
            variant="link"
            isInline
            icon={<Icon name="edit_square" size="sm" />}
            onClick={() => navigate(editPath)}
          >
            {editLabel}
          </Button>
        </Flex>
      )}
    </PanelSection>
  );
};

/** What the new system gets on this device. */
const NewSystemSection = ({
  collection,
  index,
  device,
  systemDevice,
  explanation,
  statements,
  deviceActions,
  onGoToCurrent,
}: {
  collection: PartitionableCollection;
  index: number;
  device: Partitionable;
  systemDevice: Storage.Device | null;
  /** Opens the tab holding the partitions the device carries today. */
  onGoToCurrent?: () => void;
  /** What this tab holds, and which tab changes it. */
  explanation?: React.ReactNode;
  /* Statements about the device as a whole. They read here because several of
     them have no row to live in: what the device is used by, and that the
     installer adds partitions to it for booting. */
  statements?: Setting[];
  /* What the reader does about the device rather than about its content: they
     read after the table, beside what adds to it, since they are the same kind
     of thing and none of them is urgent enough for the header. */
  deviceActions?: React.ReactNode;
}) => {
  const navigate = useNavigate();
  const config = useConfigModel();
  const allDevices = useFlattenDevices();
  const deletePartition = useDeletePartition();
  /* Reused partitions belong here. A device whose only plan is to mount an
   * existing partition was being told nothing was planned for it, because the
   * list only counted partitions the installer creates. */
  const volumes = layoutEntries(device);
  const headingId = "agm-plan-new-system";
  /* A device formatted as a whole has nowhere to put a partition, so the tab
     drops the table and the invitation with it. */
  const formatted = device.filesystem;
  const users = usersOf(config, allDevices, device.name);

  const startAdding = () =>
    navigate(generateEncodedPath(PATHS.addPartition, { collection, index: String(index) }));

  /* "Partition" rather than "volume": what this adds to a disk or a RAID is a
     partition, and volume is the word the logical ones own. */
  const addLabel = t("Add partition");

  /* The only thing to do on a device with nothing planned, so it reads as one:
     a button, not a line of text with an underline. */
  const addPrimary = (
    <Button variant="primary" icon={<Icon name="add" size="xs" />} onClick={startAdding}>
      {addLabel}
    </Button>
  );

  /* Beside a table that already lists what is planned, the same offer is one
     option among the row actions rather than the point of the tab. */
  const add = (
    <Button variant="secondary" icon={<Icon name="add" size="xs" />} onClick={startAdding}>
      {addLabel}
    </Button>
  );

  const edit = (
    <Button
      variant="link"
      isInline
      onClick={() =>
        navigate(generateEncodedPath(PATHS.formatDevice, { collection, index: String(index) }))
      }
    >
      {t("Edit")}
    </Button>
  );

  const asWhole = () => {
    const type = filesystemType(formatted) || t("its default file system");

    if (device.mountPath) {
      return t(`This device is formatted as ${type} and mounted at ${device.mountPath}.`);
    }

    return t(`This device is formatted as ${type} and is not mounted.`);
  };

  return (
    <PanelSection
      title={t(SECTION_TITLES.planned)}
      icon="list_alt"
      /* What the tab says about itself and what it says about the device read
         as one block above the rule: both are statements, neither is content.

         Stacked, not inline: these statements carry a sentence rather than a
         value, and a sentence set beside its term runs on from it. */
      before={
        explanation || statements?.length ? (
          <>
            {explanation}
            {statements && statements.length > 0 && (
              <Statements>
                <SettingsList settings={statements} layout="stacked" />
              </Statements>
            )}
          </>
        ) : undefined
      }
      headingId={headingId}
    >
      {formatted && (
        <div className="agm-plan-muted">
          <div>{asWhole()}</div>
          <div>{t("Nothing is partitioned here, so there is nothing else to plan.")}</div>
        </div>
      )}
      {/* With nothing planned, the invitation belongs to the state that says so:
          an empty state and a lone button underneath it are the same offer made
          twice. */}
      {!formatted && volumes.length === 0 && users.length > 0 && (
        /* Everything planned for this device is planned somewhere else: it is
           a member, and what it holds is decided in the panel of whatever it
           is a member of. */
        <EmptyState titleText={t("No partitions are planned here")} headingLevel="h4" variant="sm">
          <EmptyStateBody>
            {t("The whole device goes to")} <RelatedNames items={users} />
          </EmptyStateBody>
          <EmptyStateFooter>
            <EmptyStateActions>{addPrimary}</EmptyStateActions>
          </EmptyStateFooter>
        </EmptyState>
      )}
      {!formatted && volumes.length === 0 && users.length === 0 && (
        /* The state first, the invitation second. A device reaches this panel
           by being part of the plan, so what is empty is its content, not its
           membership: an untouched device is absent from the list entirely. */
        <EmptyState
          titleText={t("Nothing planned for this device yet")}
          headingLevel="h4"
          variant="sm"
        >
          <EmptyStateBody>
            {t("Add a volume, or reuse one of the partitions already on it.")}
          </EmptyStateBody>
          <EmptyStateFooter>
            <EmptyStateActions>{addPrimary}</EmptyStateActions>
          </EmptyStateFooter>
        </EmptyState>
      )}
      {!formatted && volumes.length > 0 && (
        <table className="agm-plan-table" aria-label={t(SECTION_TITLES.planned)}>
          <thead>
            <tr>
              <th scope="col">{t("Mount point")}</th>
              <th scope="col">{t("File system")}</th>
              <th scope="col">{t("Encryption")}</th>
              <th scope="col" className="agm-plan-size">
                {t("Size")}
              </th>
              <th scope="col">
                <Text srOnly>{t("Actions")}</Text>
              </th>
            </tr>
          </thead>
          <tbody>
            {volumes.map((volume) => {
              /* An existing partition brings its own file system and size, so
               * they are read from the device rather than from a request the
               * installer never has to satisfy. */
              const source = volume.name
                ? systemDevice?.partitions?.find((p) => p.name === volume.name)
                : undefined;
              const keepsData = volume.name !== undefined && volume.filesystem?.reuse === true;

              return (
                <tr key={entryLabel(volume)}>
                  <th scope="row">
                    <PlannedMount
                      label={entryLabel(volume)}
                      source={source}
                      onGoToCurrent={onGoToCurrent}
                    />
                  </th>
                  <td>
                    {(keepsData ? source?.filesystem?.type : filesystemType(volume.filesystem)) ||
                      t("default")}
                  </td>
                  <td>
                    <EncryptionCell />
                  </td>
                  <td className="agm-plan-size">
                    {source
                      ? deviceSize(source.block.size)
                      : volume.size
                        ? sizeDescription(volume.size)
                        : t("decided by the installer")}
                  </td>
                  <td className="agm-plan-row-control">
                    {/* Both actions name the partition by its mount path, so a
                        partition asked for by id alone has neither until the
                        form and the model calls learn to take an id. */}
                    {volume.mountPath && (
                      <ActionsMenu
                        label={t(`Actions for ${volume.mountPath}`)}
                        items={[
                          {
                            title: t("Edit"),
                            onClick: () =>
                              navigate(
                                generateEncodedPath(PATHS.editPartition, {
                                  collection,
                                  index: String(index),
                                  partitionId: volume.mountPath,
                                }),
                              ),
                          },
                          {
                            /* Dropping a reused partition removes the plan for
                               it, not the partition, so it does not promise a
                               deletion that never happens. */
                            title: source ? t("Stop reusing") : t("Delete"),
                            isDanger: !source,
                            onClick: () => deletePartition(collection, index, volume.mountPath),
                          },
                        ]}
                      />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      {/* Under what it adds to and against the leading edge, which is where the
          device list offers the same thing. */}
      {(formatted || volumes.length > 0 || deviceActions) && (
        <Flex className="agm-plan-section-action" gap={{ default: "gapSm" }}>
          {(formatted || volumes.length > 0) && (formatted ? edit : add)}
          {deviceActions}
        </Flex>
      )}
    </PanelSection>
  );
};

/** What is on the device now, and what becomes of it. */
const CurrentContentSection = ({
  collection,
  index,
  device,
  systemDevice,
  space,
  onGoToSettings,
  explanation,
}: {
  collection: PartitionableCollection;
  index: number;
  device: Partitionable;
  systemDevice: Storage.Device | null;
  /** What this tab holds, and which tab changes it. */
  explanation?: React.ReactNode;
  /* Held by the panel rather than here, because the same decision is offered
     in two places and the request to decide per partition is remembered
     in front of a model that cannot record it. */
  space: SpaceDecision;
  onGoToSettings: () => void;
}) => {
  const headingId = "agm-plan-current-content";
  const { structure, spacePlacement } = useVariants();
  const children = (systemDevice ? deviceChildren(systemDevice as never) : []) as ContentItem[];
  const entries = device.partitions || [];
  const { policy, choose } = space;
  const inSettings = structure === "blocks" && spacePlacement === "settings";

  /* The route back up. The decision governs this table and no longer sits on
     it, so the table says which rule it is following and how to reach it. */
  const following = (
    <>
      {t(`${SPACE_SETTING_TERM} ${SPACE_SETTING_VALUES[policy]}.`)}{" "}
      <Button variant="link" isInline onClick={onGoToSettings}>
        {t("Change it in Settings")}
      </Button>
    </>
  );

  /* A table rather than a list of grids. Each row being its own grid is why the
   * size column moved with the length of the text beside it: columns can only
   * line up when one element owns them. It also gives every cell a column
   * header a screen reader can announce, which a list of divs never does. */
  return (
    <PanelSection
      title={t(SECTION_TITLES.current)}
      icon="hard_drive"
      before={explanation}
      intro={inSettings ? following : undefined}
      headingId={headingId}
    >
      {/* The decision reads with the table it governs rather than in the head
          of the section: it is about the rows below it, and the head is about
          the tab. A space policy is a permission, not an instruction: it says
          what the installer may do, and the solver decides what it actually
          does. That is the only reading under which "shrink if needed" and
          "delete if needed" make sense, so the label says it. */}
      {!inSettings && <SpaceDecisionRow policy={policy} onChoose={choose} />}
      {children.length === 0 ? (
        <div className="agm-plan-muted">{t("The device is empty.")}</div>
      ) : (
        <table className="agm-plan-table" aria-label={t(SECTION_TITLES.current)}>
          <thead>
            <tr>
              <th scope="col">{t("Partition")}</th>
              <th scope="col">{t("Content")}</th>
              <th scope="col" className="agm-plan-size">
                {t("Size")}
              </th>
              {/* "Planned action" rather than "What happens": nothing has happened, and
                  the column heading is the last place to imply otherwise. */}
              <th scope="col">{t("Planned action")}</th>
              <th scope="col">
                <Text srOnly>{t("Actions")}</Text>
              </th>
            </tr>
          </thead>
          <tbody>
            {children.map((item, i) => (
              <ContentRow
                key={isSlot(item) ? `slot-${i}` : item.sid}
                item={item}
                collection={collection}
                index={index}
                policy={policy}
                entry={isSlot(item) ? undefined : entries.find((e) => e.name === item.name)}
              />
            ))}
          </tbody>
        </table>
      )}
    </PanelSection>
  );
};

/**
 * This device's slice of the result.
 *
 * The same table the result section shows for the whole machine, narrowed to
 * one device, so the reader who came to check a disk gets the answer without
 * leaving the panel. It is also the only place the partitions the solver adds
 * for booting appear, which is what makes the sizes here add up.
 *
 * The proposal is all or nothing, so the tab is empty exactly when the page is
 * already saying why. It says so in a line rather than showing nothing.
 */
const DeviceResultSection = ({
  deviceName,
  explanation,
}: {
  deviceName: string;
  /** What this tab holds, and which tabs change it. */
  explanation?: React.ReactNode;
}) => {
  const config = useConfigModel();
  const proposal = useStorageProposal();
  const system = useFlattenDevices();
  const staging = useStagingDevices();
  const actions = useActions();
  const { deviceRow } = useVariants();

  const { goToDevice } = React.useContext(PanelNavContext);

  const manager = new DevicesManager(system, staging, actions);
  const devices = manager
    .usedDevices(config?.drives?.map((drive) => drive.name) || [])
    .filter((device) => device.name === deviceName);

  const headingId = "agm-plan-device-result";

  /* What the device ends up holding, one row each. The device itself is a row
     only where it is asked for: the panel names it already. A device holding
     nothing of its own keeps its row whatever the setting says, since dropping
     it would leave the tab with no rows at all. */
  const children = devices.flatMap((device) => deviceChildren(device));
  const rows = deviceRow === "shown" || children.length === 0 ? devices : children;

  /* Which group a physical volume belongs to is derived rather than read out of
     words meant for people: the proposal reports a group's physical volumes as
     sids, so a row that is one finds its group by sid. */
  const groupOf = (device: Proposal.Device) =>
    staging.find((candidate) => candidate.volumeGroup?.physicalVolumes.includes(device.sid));

  const deviceLink = (device: Proposal.Device) => {
    const group = groupOf(device);
    if (!group) return null;

    const at = (config.volumeGroups || []).findIndex(
      (entry) => entry.vgName === baseName(group.name),
    );
    if (at === -1) return null;

    return (
      <Button
        variant="link"
        isInline
        onClick={() => goToDevice({ collection: "volumeGroups", index: at })}
      >
        {t(baseName(group.name))}
      </Button>
    );
  };

  return (
    <PanelSection
      title={t(SECTION_TITLES.result)}
      icon="list_alt_check"
      before={explanation}
      headingId={headingId}
    >
      {!proposal && (
        <div className="agm-plan-muted">
          {t("No layout was worked out for this configuration, so there is nothing to show yet.")}
        </div>
      )}
      {proposal && devices.length === 0 && (
        <div className="agm-plan-muted">
          {t("This device is left as it is, so the installer changes nothing on it.")}
        </div>
      )}
      {proposal && devices.length > 0 && (
        <div className="agm-plan-device-layout">
          <ProposalResultTable devicesManager={manager} devices={rows} deviceLink={deviceLink} />
        </div>
      )}
    </PanelSection>
  );
};

/* ------------------------------------------------------------------ *
 * The panel: header and body
 * ------------------------------------------------------------------ */

/**
 * Three lines, packed rather than stacked.
 *
 *   vdd   20 GiB · Disk · GPT
 *   Define 1 partition, host 'system' and 't12'
 *   pci-0000:0a:00.0
 *
 * The name and the facts share a line, because a name on a line of its own
 * spends a whole line saying one word. The purpose comes next, since it is what
 * the panel is about. The stable identifier comes last and smallest: it is a
 * reference to copy, not a line to read.
 */
/**
 * The header says which device this is, and nothing else.
 *
 * The same lines the list's first column carries, so the entry a reader clicked
 * and the panel that opens are visibly the same thing:
 *
 *   vdd  20 GiB · Disk · GPT    <- name and kind, as the list shows them
 *   pci-0000:0a:00.0            <- the identifier that survives a rename
 *
 * Identity only. What the device is tied to points away from it rather than
 * describing it, so it reads in the body instead.
 */
const PanelHeader = ({
  title,
  description,
  marks,
  subtitle,
  path,
  onClose,
  actions,
}: {
  title: string;
  /** Facts about the thing named, read on the title line beside the name. */
  description?: string;
  /** What the thing is, in the words the list marks it with. */
  marks?: string[];
  /** A sentence about it, which needs a line of its own to stay readable. */
  subtitle?: string;
  /** How the system names the device: the identifier that survives a rename
      where the device has one, its kernel name otherwise. */
  path?: string;
  onClose: () => void;
  actions?: React.ReactNode;
}) => (
  <div className="agm-plan-panel-head">
    <Flex
      justifyContent={{ default: "justifyContentSpaceBetween" }}
      alignItems={{ default: "alignItemsFlexStart" }}
      flexWrap={{ default: "nowrap" }}
      gap={{ default: "gapMd" }}
    >
      <FlexItem>
        <h2 className="agm-plan-panel-title" id="agm-plan-panel-title">
          <Text isBold>{title}</Text> <span className="agm-plan-panel-facts">{description}</span>
          {/* The same mark the list puts beside the same name, so the entry a
              reader clicked and the panel that opens carry the same words. */}
          {marks?.map((mark) => (
            <React.Fragment key={mark}>
              {" "}
              <Label isCompact className="agm-plan-panel-mark">
                {mark}
              </Label>
            </React.Fragment>
          ))}
        </h2>
        {subtitle && <div className="agm-plan-panel-subtitle">{subtitle}</div>}
        {/* Where the system keeps the device. For a disk that is the one
            identifier a reboot renaming vdd to vde does not change, which the
            page has never shown; for a volume group it is the name the group
            answers to once it exists. */}
        {path && <div className="agm-plan-path">{path}</div>}
      </FlexItem>
      <FlexItem>
        <Flex gap={{ default: "gapXs" }} flexWrap={{ default: "nowrap" }}>
          {actions && <FlexItem>{actions}</FlexItem>}
          <FlexItem>
            <Button variant="plain" aria-label={t("Close the panel")} onClick={onClose}>
              <Icon name="close" />
            </Button>
          </FlexItem>
        </Flex>
      </FlexItem>
    </Flex>
  </div>
);

/**
 * The arrangement the first pass settled on, kept switchable. Tabs keep both
 * headings visible at any list length, and hide half the answer while the user
 * is deciding whether they can afford the other half.
 */
const PanelTabs = ({
  deviceName,
  tabs,
  active,
  onSelect,
  stripRef,
}: {
  deviceName: string;
  /** The tabs to show, in the order they are read. */
  tabs: { key: PanelTab; content: React.ReactNode }[];
  active: PanelTab;
  onSelect: (tab: PanelTab) => void;
  /** Lets a link elsewhere in the panel move focus onto the tab it opens. */
  stripRef?: React.RefObject<HTMLDivElement>;
}) => {
  const keys = tabs.map((tab) => tab.key);
  const { tabLayout, tabSummary, tabBox, tabFill } = useVariants();
  /* PatternFly styles the strip and leaves the two halves to their container:
     the strip is an inline-flex column and the panel is a plain sibling after
     it, so a container that does not put them in a row gets the panel under the
     strip, which is what the PatternFly demo shows. The wrapper does it. */
  const isVertical = tabLayout === "vertical";
  const own = useRef<HTMLDivElement>(null);
  const strip = stripRef || own;

  /* PatternFly leaves every tab a tab stop and handles no arrow keys, so the
   * strip carries the tablist keyboard model itself: one tab stop, arrows
   * between the tabs, Home and End to the ends, and the panel following the
   * focused tab. Switching is instant, which is the case for activating on
   * arrow rather than asking for a second key.
   * https://www.w3.org/WAI/ARIA/apg/patterns/tabs/ */
  const move = (event: React.KeyboardEvent) => {
    const at = keys.indexOf(active);
    /* The arrows that move along the strip are the ones pointing along it,
       which is what the tabs pattern asks of a vertical tablist. */
    const back = (at - 1 + keys.length) % keys.length;
    const on = (at + 1) % keys.length;
    const along: Record<string, number> = isVertical
      ? { ArrowUp: back, ArrowDown: on }
      : { ArrowLeft: back, ArrowRight: on };
    const to = { ...along, Home: 0, End: keys.length - 1 }[event.key];

    if (to === undefined) return;

    event.preventDefault();
    onSelect(keys[to]);
    strip.current?.querySelectorAll<HTMLElement>('[role="tab"]')[to]?.focus();
  };

  return (
    /* The wrapper is not decoration: PatternFly's Tabs renders a fragment, so a
       className on it lands on the tab strip. Giving the strip a flex height
       stretched it to fill the panel and pushed the content to the bottom. */
    <div
      className={`agm-plan-tabs agm-plan-tabs-${tabLayout}${
        tabSummary ? " agm-plan-tabs-described" : ""
      }`}
      ref={strip}
      onKeyDown={move}
    >
      <Tabs
        activeKey={keys.indexOf(active)}
        onSelect={(_event, key) => onSelect(keys[Number(key)])}
        isBox={tabBox}
        isFilled={tabFill && !isVertical}
        isVertical={isVertical}
        /* Names the tablist itself. The plain aria-label prop names the wrapper
           PatternFly puts around it, which leaves the list of tabs unnamed and
           adds a landmark inside the panel, which is a region already. */
        tabListAriaLabel={t(`Storage content of ${deviceName}`)}
      >
        {tabs.map(({ key, content }, at) => (
          <Tab
            key={key}
            eventKey={at}
            tabIndex={active === key ? 0 : -1}
            title={
              <>
                {/* Decorative: the words beside it say what the tab holds. The
                    mark is there to tell the three apart at a glance, the way
                    the reader tells one row of the device list from another. */}
                <TabTitleIcon>
                  <Icon name={TAB_ICONS[key]} size="sm" />
                </TabTitleIcon>
                <TabTitleText>
                  {t(SECTION_TITLES[key])}
                  {tabSummary && (
                    <span className="agm-plan-tab-summary">{t(TAB_SUMMARIES[key])}</span>
                  )}
                </TabTitleText>
              </>
            }
          >
            {/* Everything the tab holds reads inside the strip above it, the
                sentence it opens with included. */}
            <NestedContent margin={["mxXs", "mtSm"]} className="agm-plan-tab-body">
              {content}
            </NestedContent>
          </Tab>
        ))}
      </Tabs>
    </div>
  );
};

const PartitionableDetail = ({
  collection,
  index,
  tab,
  onTab,
}: {
  collection: PartitionableCollection;
  index: number;
  /** Which half is open. Held above the panel so a link on the page can open
      the sheet on the half it is talking about, and so that comparing two
      disks does not send the reader back to the other tab between them. */
  tab: PanelTab;
  onTab: (tab: PanelTab) => void;
}) => {
  const config = useConfigModel();
  const device = config[collection]?.[index] as Partitionable;
  const systemDevice = useDevice(device?.name || "");
  const allDevices = useFlattenDevices();
  const {
    sections,
    structure,
    spacePlacement,
    explanations,
    relationIcon,
    settings: settingsPlacement,
  } = useVariants();
  const { goToBoot } = React.useContext(PanelNavContext);
  /* Which tab is open lives here rather than in the tab strip, so the summary
   * above it can send the reader to the half it is talking about. It outlives
   * the selection on purpose: comparing what two disks hold today should not
   * send the reader back to the other tab between them. */
  const tabsRef = useRef<HTMLDivElement>(null);
  const space = useSpacePolicy(collection, index, device?.spacePolicy || "keep");
  const bootRole = bootRoleOf(config, device?.name || "");

  if (!device) return null;

  /* A RAID is defined rather than found: it is made of other devices, and what
     it is made of is a property of it, not content on it. A disk is the
     hardware itself and has nothing of the kind to show. */
  const isDefined = collection === "mdRaids";
  const tabOrder: PanelTab[] = isDefined
    ? ["result", "planned", "members", "current"]
    : ["result", "planned", "current"];

  /* A link that opens a tab has to put the reader on it. Without the focus
   * move a keyboard reader is left wherever the link was, several blocks above
   * the table the link just opened. */
  const goToTab = (target: PanelTab) => {
    onTab(target);
    tabsRef.current
      ?.querySelectorAll<HTMLElement>('[role="tab"]')
      [tabOrder.indexOf(target)]?.focus();
  };

  const goToCurrent = () => goToTab("current");

  /* Under tabs only: each sentence names the tab that changes what it
     describes, and a stacked panel has no tabs to name. */
  const notes =
    sections === "tabs"
      ? tabExplanations(
          collection === "drives" ? "this disk" : "this RAID device",
          tabOrder,
          goToTab,
        )
      : undefined;

  const goToSettings = () => document.getElementById(SPACE_SETTING_TOGGLE_ID)?.focus();

  /* Keyed by device, so selecting another one starts its sections fresh. The
   * tabs sit above this and keep their selection, which is what lets two
   * devices be compared on the same tab. */
  const relationships = (
    <>
      <Relationships
        groups={[
          { label: t("Uses"), items: membersOf(systemDevice, allDevices, config) },
          { label: t("Used by"), items: usersOf(config, allDevices, device.name) },
        ]}
      />
      <BootNote deviceName={device.name} systemDevice={systemDevice} />
    </>
  );

  /* What the configuration asks for here, which is a partition each for a
     partitioned device and one for a device formatted as a whole. Read by the
     boot statement, which says "besides the content below" only where there is
     content below. */
  const plannedCount = device.filesystem ? 1 : layoutEntries(device).length;

  /* What the device is used by, and that the installer adds partitions to it
     for booting. Both are statements about what is planned for the device, and
     neither has a row in the table, so they read above it.

     The boot line names neither a count nor a reason. Both are result data: a
     count needs the proposal compared against the system, and the reason a
     boot partition exists is never reported. What is true of the device
     whatever the installer decides is said here, and the tabs holding the rest
     are one click away. */
  const plannedStatements = settingsOf([
    ...relationshipSettings(
      [{ label: t("Used by"), items: usersOf(config, allDevices, device.name) }],
      relationIcon,
    ).map((setting) => ({ ...setting, layout: "inline" as const })),
    bootRole !== "none" && {
      key: "boot",
      icon: "restart_alt" as const,
      term: t("Boot device"),
      /* The statement adds to what the tab lists, so it says so, but only where
         the tab lists anything: on a device whose whole space goes to a volume
         group there is no content below to be beside. */
      value: plannedCount
        ? t(
            "Besides the content below, the partitions needed to start the new system will be added here.",
          )
        : t("The partitions needed to start the new system will be added here."),
      explanation: (
        <>
          {t("See them in the")} <TabLink tab="result" onGoTo={goToTab} /> {t("tab, or adjust the")}{" "}
          <Button variant="link" isInline onClick={goToBoot}>
            {t("Boot options")}
          </Button>
          {t(".")}
        </>
      ),
    },
  ]);

  const key = `${collection}:${index}`;
  const result = (
    <DeviceResultSection key={key} deviceName={device.name} explanation={notes?.result} />
  );
  const first = (
    <NewSystemSection
      key={key}
      collection={collection}
      index={index}
      device={device}
      systemDevice={systemDevice}
      explanation={notes?.planned}
      statements={structure === "blocks" ? plannedStatements : undefined}
      deviceActions={<DeviceActionButtons device={device} />}
      onGoToCurrent={sections === "tabs" ? goToCurrent : undefined}
    />
  );
  const second = (
    <CurrentContentSection
      key={key}
      collection={collection}
      index={index}
      device={device}
      systemDevice={systemDevice}
      space={space}
      onGoToSettings={goToSettings}
      explanation={notes?.current}
    />
  );

  const members = isDefined ? (
    <EntryPropertiesSection
      key={key}
      members={[{ label: t("Uses"), items: membersOf(systemDevice, allDevices, config) }]}
      properties={settingsOf([ptableSetting(device)])}
      explanation={notes?.members}
    />
  ) : null;

  const panels: Partial<Record<PanelTab, React.ReactNode>> = {
    result,
    planned: first,
    members,
    current: second,
  };

  const content =
    sections === "tabs" ? (
      <PanelTabs
        deviceName={baseName(device.name)}
        tabs={tabOrder.map((key) => ({ key, content: panels[key] }))}
        active={tabOrder.includes(tab) ? tab : "result"}
        onSelect={onTab}
        stripRef={tabsRef}
      />
    ) : (
      <Stack className="agm-plan-sections">
        <StackItem isFilled>{first}</StackItem>
        <StackItem isFilled>{second}</StackItem>
      </Stack>
    );

  if (structure === "blocks") {
    /* What the device is to the rest of the plan comes first, because a reader
       opening a panel to check a disk starts by placing it. Then the rule about
       what is already on it, then what it does for booting. Its own facts, like
       the partition table, come last: they are read on purpose rather than
       looked for. */
    const settings = settingsOf([
      /* A RAID reads what it is made of in its own tab; a disk has no such tab
         and nothing to put in one. */
      ...(isDefined
        ? []
        : relationshipSettings(
            [{ label: t("Uses"), items: membersOf(systemDevice, allDevices, config) }],
            relationIcon,
          )),
      spacePlacement === "settings" &&
        spaceSetting({
          space,
          explanations,
          entryName: "partition",
          onGoToCurrent: goToCurrent,
        }),
      isDefined ? false : ptableSetting(device),
    ]);

    return (
      <div className={`agm-plan-split agm-plan-split-${settingsPlacement}`}>
        {/* With the statements read in the tabs that hold them, a device can
            have nothing left to say up here. An empty list still takes a row of
            the grid, and the gap above the tabs is that row. */}
        {settings.length > 0 && <SettingsList settings={settings} />}
        {content}
      </div>
    );
  }

  if (sections === "tabs") {
    return (
      <>
        {relationships}
        {content}
      </>
    );
  }

  return (
    <Stack className="agm-plan-sections">
      <StackItem>{relationships}</StackItem>
      <StackItem isFilled>{first}</StackItem>
      <StackItem isFilled>{second}</StackItem>
    </Stack>
  );
};

/**
 * One logical volume the group already holds.
 *
 * A sibling of the partition row rather than a shared component: the two read
 * different collections and render a different number of hooks, which is the
 * kind of pair React reuses an instance for and then breaks.
 *
 * No reuse entry yet. The model expresses reuse of an existing logical volume
 * the same way it expresses reuse of a partition, but nothing in the interface
 * opens a form for one, so the row offers only the decisions it can carry out.
 */
const LogicalVolumeContentRow = ({
  item,
  index,
  entry,
  policy,
}: {
  item: Storage.Device;
  index: number;
  entry: ConfigModel.LogicalVolume | undefined;
  policy: ConfigModel.SpacePolicy;
}) => {
  const config = useConfigModel();
  const solver = useSolver();
  const [pending, setPending] = useState<Outcome | null>(null);

  const size = item.block?.size;
  const stored = outcomeFor(policy, entry, size);
  const current = pending || stored;
  const reported: ReportedOutcome = pending || reportedOutcome(stored, item.sid, solver);

  useEffect(() => {
    if (pending && stored.kind === pending.kind) setPending(null);
  }, [pending, stored]);

  const choose = (kind: Outcome["kind"]) => {
    const outcome = { kind } as Outcome;
    setPending(outcome);
    putStorageModel(withLogicalVolumeSpace(config, index, baseName(item.name), outcome));
  };

  return (
    <tr>
      <th scope="row">
        <Text isBold>{baseName(item.name)}</Text>
      </th>
      <td>{item.filesystem?.type || item.description || t("unrecognised")}</td>
      <SizeCell size={size} planned={plannedSize(reported)} />
      <PlannedActionCell
        reported={reported}
        device={policy === "custom" ? item : undefined}
        current={policy === "custom" ? current : undefined}
        onChoose={policy === "custom" ? choose : undefined}
      />
    </tr>
  );
};

/**
 * What the group holds today.
 *
 * Only reached for a group that exists on the system: one being defined has no
 * current content, and a tab promising some would open on an empty table.
 */
const VolumeGroupCurrentSection = ({
  index,
  systemDevice,
  space,
  onGoToSettings,
  explanation,
}: {
  index: number;
  systemDevice: Storage.Device;
  space: SpaceDecision;
  onGoToSettings: () => void;
  /** What this tab holds, and which tabs change it. */
  explanation?: React.ReactNode;
}) => {
  const config = useConfigModel();
  const { structure, spacePlacement } = useVariants();
  const group = config.volumeGroups?.[index];
  const { policy, choose } = space;
  const inSettings = structure === "blocks" && spacePlacement === "settings";

  if (!group) return null;

  const following = (
    <>
      {t(`${SPACE_SETTING_TERM} ${SPACE_SETTING_VALUES[policy]}.`)}{" "}
      <Button variant="link" isInline onClick={onGoToSettings}>
        {t("Change it in Settings")}
      </Button>
    </>
  );

  const existing = systemDevice.logicalVolumes || [];
  const entries = group.logicalVolumes || [];

  return (
    <PanelSection
      title={t(SECTION_TITLES.current)}
      icon="hard_drive"
      before={explanation}
      intro={inSettings ? following : undefined}
      headingId="agm-plan-group-current"
    >
      {!inSettings && <SpaceDecisionRow policy={policy} onChoose={choose} />}
      <table className="agm-plan-table" aria-label={t(SECTION_TITLES.current)}>
        <thead>
          <tr>
            <th scope="col">{t("Logical volume")}</th>
            <th scope="col">{t("Content")}</th>
            <th scope="col" className="agm-plan-size">
              {t("Size")}
            </th>
            <th scope="col">{t("Planned action")}</th>
          </tr>
        </thead>
        <tbody>
          {existing.map((item) => (
            <LogicalVolumeContentRow
              key={item.sid}
              item={item}
              index={index}
              policy={policy}
              entry={entries.find((lv) => lv.lvName === baseName(item.name))}
            />
          ))}
        </tbody>
      </table>
    </PanelSection>
  );
};

/** The logical volumes the new system gets. */
const VolumeGroupPlannedSection = ({
  index,
  standalone,
  explanation,
  statements,
}: {
  index: number;
  standalone: boolean;
  /** What this tab holds, and which tab changes it. */
  explanation?: React.ReactNode;
  /** What is planned for the group that has no row in the table. */
  statements?: Setting[];
}) => {
  const config = useConfigModel();
  const navigate = useNavigate();
  const deleteLogicalVolume = useDeleteLogicalVolume();
  const group = config.volumeGroups?.[index];

  if (!group) return null;

  const volumes = group.logicalVolumes || [];

  return (
    <PanelSection
      title={t(SECTION_TITLES.planned)}
      headingId="agm-plan-logical-volumes"
      icon="list_alt"
      standalone={standalone}
      before={
        explanation || statements?.length ? (
          <>
            {explanation}
            {statements && statements.length > 0 && (
              <Statements>
                <SettingsList settings={statements} />
              </Statements>
            )}
          </>
        ) : undefined
      }
      action={
        <Button
          variant="link"
          isInline
          icon={<Icon name="add" size="xs" />}
          onClick={() =>
            navigate(generateEncodedPath(PATHS.volumeGroup.logicalVolume.add, { id: group.vgName }))
          }
        >
          {t("Add logical volume")}
        </Button>
      }
    >
      {volumes.length === 0 ? (
        <div className="agm-plan-muted">
          <div>{t("Nothing planned for this volume group yet.")}</div>
          <div>{t("Add a logical volume to say what it should hold.")}</div>
        </div>
      ) : (
        <table className="agm-plan-table" aria-label={t("Logical volumes")}>
          <thead>
            <tr>
              <th scope="col">{t("Mount point")}</th>
              <th scope="col">{t("File system")}</th>
              <th scope="col">{t("Encryption")}</th>
              <th scope="col" className="agm-plan-size">
                {t("Size")}
              </th>
              <th scope="col">
                <Text srOnly>{t("Actions")}</Text>
              </th>
            </tr>
          </thead>
          <tbody>
            {volumes.map((volume) => (
              <tr key={volume.mountPath || volume.lvName}>
                <th scope="row">
                  <Text isBold className="agm-plan-mount">
                    {volume.mountPath || volume.lvName}
                  </Text>
                </th>
                <td>{filesystemType(volume.filesystem) || t("default")}</td>
                <td>
                  <EncryptionCell />
                </td>
                <td className="agm-plan-size">
                  {volume.size ? sizeDescription(volume.size) : t("decided by the installer")}
                </td>
                <td className="agm-plan-row-control">
                  <ActionsMenu
                    label={t(`Actions for ${volume.mountPath || volume.lvName}`)}
                    items={[
                      {
                        title: t("Edit"),
                        onClick: () =>
                          navigate(
                            generateEncodedPath(PATHS.volumeGroup.logicalVolume.edit, {
                              id: group.vgName,
                              logicalVolumeId: volume.mountPath,
                            }),
                          ),
                      },
                      {
                        title: t("Delete"),
                        isDanger: true,
                        onClick: () => deleteLogicalVolume(group.vgName, volume.mountPath),
                      },
                    ]}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </PanelSection>
  );
};

/**
 * The panel for a volume group.
 *
 * A group that exists on the system holds logical volumes already, so it gets
 * the same three tabs a disk does. One being defined here holds nothing yet, so
 * it drops the current content: a tab named Current content that opens on
 * nothing is worse than no tab at all.
 */
const VolumeGroupDetail = ({
  index,
  tab,
  onTab,
}: {
  index: number;
  /** Which half is open, held above the panel. See {@link PartitionableDetail}. */
  tab: PanelTab;
  onTab: (tab: PanelTab) => void;
}) => {
  const config = useConfigModel();
  const group = config.volumeGroups?.[index];
  const systemDevice = useDevice(group?.name || "");
  const {
    sections,
    structure,
    spacePlacement,
    explanations,
    settings: settingsPlacement,
  } = useVariants();
  const tabsRef = useRef<HTMLDivElement>(null);
  const space = useSpacePolicy("volumeGroups", index, group?.spacePolicy || "keep");

  if (!group) return null;

  const targets: Relationship[] = [
    {
      label: t("Uses"),
      items: (group.targetDevices || []).map((target) => ({
        name: baseName(target),
        selection: selectionForDevice(config, target),
      })),
    },
  ];

  const relationships = <Relationships groups={targets} />;

  const goToSettings = () => document.getElementById(SPACE_SETTING_TOGGLE_ID)?.focus();

  const existing = systemDevice?.logicalVolumes || [];
  /* A group being defined here holds nothing yet, so there is no rule about
     existing content to offer and no tab to name for it. */
  const isNew = existing.length === 0;

  const tabOrder: PanelTab[] = isNew
    ? ["result", "planned", "members"]
    : ["result", "planned", "members", "current"];
  /* A group being defined has no content of its own yet, so a request to open
     the tab about it lands on the one tab every entry has. */
  const active = tabOrder.includes(tab) ? tab : "result";

  const goToTab = (target: PanelTab) => {
    onTab(target);
    tabsRef.current
      ?.querySelectorAll<HTMLElement>('[role="tab"]')
      [tabOrder.indexOf(target)]?.focus();
  };

  const goToCurrent = () => goToTab("current");

  const notes =
    sections === "tabs" ? tabExplanations("this volume group", tabOrder, goToTab) : undefined;

  const settings = settingsOf([
    !isNew &&
      spacePlacement === "settings" &&
      spaceSetting({
        space,
        explanations,
        entryName: "logical volume",
        onGoToCurrent: goToCurrent,
      }),
  ]);

  const result = (
    <DeviceResultSection
      key={group.vgName}
      deviceName={systemDevice?.name || `/dev/${group.vgName}`}
      explanation={notes?.result}
    />
  );

  const planned = (
    <VolumeGroupPlannedSection
      key={group.vgName}
      index={index}
      standalone={isNew && sections === "stacked"}
      explanation={notes?.planned}
    />
  );

  /* How much of the disks under it the group takes, which is the other half of
     what "built on vdd" means and a decision the reader made in the form. */
  const spread: Setting[] = group.targetDevicesPolicy
    ? [
        {
          key: "spread",
          icon: "compress" as const,
          term: t("Space taken"),
          value:
            group.targetDevicesPolicy === "useNeeded"
              ? t("Only what its volumes need")
              : t("All the space available on those devices"),
        },
      ]
    : [];

  const members = (
    <EntryPropertiesSection
      key={group.vgName}
      members={targets}
      properties={spread}
      editPath={generateEncodedPath(PATHS.volumeGroup.edit, { id: group.vgName })}
      editLabel={t("Edit the volume group")}
      explanation={notes?.members}
    />
  );

  const current = isNew ? null : (
    <VolumeGroupCurrentSection
      key={group.vgName}
      index={index}
      systemDevice={systemDevice}
      space={space}
      onGoToSettings={goToSettings}
      explanation={notes?.current}
    />
  );

  const content = (() => {
    if (sections === "stacked") {
      if (isNew) return planned;

      return (
        <Stack className="agm-plan-sections">
          <StackItem isFilled>{planned}</StackItem>
          <StackItem isFilled>{current}</StackItem>
        </Stack>
      );
    }

    const panels = { result, planned, members, current };

    return (
      <PanelTabs
        deviceName={group.vgName}
        tabs={tabOrder.map((key) => ({ key, content: panels[key] }))}
        active={active}
        onSelect={onTab}
        stripRef={tabsRef}
      />
    );
  })();

  if (structure === "blocks") {
    return (
      <div className={`agm-plan-split agm-plan-split-${settingsPlacement}`}>
        {/* With the statements read in the tabs that hold them, a device can
            have nothing left to say up here. An empty list still takes a row of
            the grid, and the gap above the tabs is that row. */}
        {settings.length > 0 && <SettingsList settings={settings} />}
        {content}
      </div>
    );
  }

  if (sections === "stacked" && !isNew) {
    return (
      <Stack className="agm-plan-sections">
        <StackItem>{relationships}</StackItem>
        <StackItem isFilled>{planned}</StackItem>
        <StackItem isFilled>{current}</StackItem>
      </Stack>
    );
  }

  return (
    <>
      {relationships}
      {content}
    </>
  );
};

/* ------------------------------------------------------------------ *
 * Offers for devices nothing is planned for
 *
 * An empty list asks the user to already know what a good layout looks like.
 * The installer knows two or three, and this is the moment to say so. Each
 * offer is solved before it is shown, so its outcome is real rather than
 * estimated, and an offer that cannot be honoured is not made.
 * ------------------------------------------------------------------ */

type Offer = {
  key: string;
  label: string;
  note: string;
  isDestructive: boolean;
  build: (config: ConfigModel.Config) => ConfigModel.Config;
};

const withPreset = (
  config: ConfigModel.Config,
  deviceName: string,
  spacePolicy: ConfigModel.SpacePolicy,
  mountPaths: string[],
): ConfigModel.Config => {
  let next = configModel.drive.add(config, { name: deviceName, spacePolicy });
  const index = (next.drives || []).length - 1;
  mountPaths.forEach((mountPath) => {
    next = configModel.partition.add(next, "drives", index, { mountPath });
  });
  return next;
};

const offersFor = (device: Storage.Device, mountPaths: string[]): Offer[] => {
  const systems = deviceSystems(device);
  const canShrink = (device.partitions || []).some((p) => supportShrink(p));
  const offers: Offer[] = [
    {
      key: "install",
      label: t("Install here"),
      note: systems.length ? t(`removes ${formatList(systems)}`) : t("uses the whole device"),
      isDestructive: systems.length > 0 || (device.partitions || []).length > 0,
      build: (config) => withPreset(config, device.name, "delete", mountPaths),
    },
  ];

  /* Only offered where something on the device can actually be made smaller.
     Offering it otherwise is a promise the solver will break. */
  if (canShrink) {
    offers.push({
      key: "alongside",
      label: t("Install alongside"),
      note: systems.length ? t(`keeps ${formatList(systems)}`) : t("keeps what is there"),
      isDestructive: false,
      build: (config) => withPreset(config, device.name, "resize", mountPaths),
    });
  }

  offers.push({
    key: "manual",
    label: t("Set it up myself"),
    note: t("nothing is decided yet"),
    isDestructive: false,
    build: (config) => configModel.drive.add(config, { name: device.name, spacePolicy: "keep" }),
  });

  return offers;
};

/** Resolves each offer through the solver, so the note under it is not a guess. */
const useOfferOutcomes = (
  config: ConfigModel.Config | null,
  device: Storage.Device,
  offers: Offer[],
): Record<string, string | undefined> => {
  const [outcomes, setOutcomes] = useState<Record<string, string | undefined>>({});
  const signature = `${device.sid}:${offers.map((o) => o.key).join(",")}`;

  useEffect(() => {
    if (!config) return;
    let cancelled = false;

    /* Sequential on purpose: the solver is a single backend, and a burst of
       requests on first paint is exactly the thing worth not shipping. */
    (async () => {
      const found: Record<string, string | undefined> = {};
      for (const offer of offers) {
        if (offer.key === "manual") continue;
        try {
          const solved = await solveStorageModel(offer.build(config));
          const drive = (solved?.drives || []).find((d) => d.name === device.name);
          const total = (drive?.partitions || [])
            .filter((p) => p.name === undefined)
            .reduce((sum, p) => sum + (p.size?.min || 0), 0);
          found[offer.key] = total > 0 ? t(`about ${deviceSize(total)}`) : undefined;
        } catch {
          found[offer.key] = undefined;
        }
      }
      if (!cancelled) setOutcomes(found);
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, config]);

  return outcomes;
};

const DeviceOffer = ({ device, mountPaths }: { device: Storage.Device; mountPaths: string[] }) => {
  const config = useConfigModel();
  const offers = useMemo(() => offersFor(device, mountPaths), [device, mountPaths]);
  const outcomes = useOfferOutcomes(config, device, offers);
  const systems = deviceSystems(device);

  return (
    <li className="agm-plan-offer">
      <div className="agm-plan-offer-head">
        <Text isBold>{baseName(device.name)}</Text>{" "}
        <span className="agm-plan-muted">
          {[
            deviceSize(device.block?.size || 0),
            device.drive?.model || device.description,
            systems.length ? formatList(systems) : t("empty"),
          ]
            .filter(Boolean)
            .join("  ·  ")}
        </span>
      </div>
      <Flex
        flexWrap={{ default: "wrap" }}
        gap={{ default: "gapLg" }}
        className="agm-plan-offer-actions"
      >
        {offers.map((offer) => (
          <div key={offer.key} className="agm-plan-offer-action">
            <Button
              variant={offer.key === "manual" ? "secondary" : "primary"}
              onClick={() => putStorageModel(offer.build(config))}
            >
              {offer.label}
            </Button>
            <div className={offer.isDestructive ? COST_CLASS.destroys : "agm-plan-muted"}>
              {offer.isDestructive && <Icon name={COST_ICON.destroys} size="xs" />}{" "}
              {[offer.note, outcomes[offer.key]].filter(Boolean).join(", ")}
            </div>
          </div>
        ))}
      </Flex>
    </li>
  );
};

/* ------------------------------------------------------------------ *
 * The plan bar
 * ------------------------------------------------------------------ */

/**
 * What the plan costs, what the whole installation has been told, and the way
 * into each of them.
 *
 * The two machine-wide decisions live here rather than in the list. Neither is
 * a device, and a reader scanning a list of disks for what happens to their
 * disks should not have to step over them. Read as values with a way in, they
 * also answer the two questions the list cannot: how this machine will start,
 * and whether what is written is readable by anyone holding the disk.
 */
const PlanBar = ({
  destructive,
  onShowResult,
  onShowBoot,
  onShowEncryption,
}: {
  destructive: number;
  onShowResult: () => void;
  onShowBoot: () => void;
  onShowEncryption: () => void;
}) => {
  const config = useConfigModel();
  const reset = useReset();
  const mode = bootModeOf(config);
  const bootDevice = configModel.boot.findDevice(config);

  const boot = () => {
    if (mode === "off") return t("Not configured");
    if (mode === "auto") return t("Automatic");
    return bootDevice?.name ? baseName(bootDevice.name) : t("No disk selected");
  };

  return (
    <div className="agm-plan-bar">
      <Flex
        justifyContent={{ default: "justifyContentSpaceBetween" }}
        alignItems={{ default: "alignItemsCenter" }}
        gap={{ default: "gapMd" }}
        flexWrap={{ default: "wrap" }}
      >
        <FlexItem>
          {/* The cost is the reason anyone opens the result, so the cost is the
              button: a reader worried by "4 changes destroy data" presses the
              sentence that worries them. */}
          <Button
            variant={destructive > 0 ? "danger" : "secondary"}
            size="sm"
            aria-controls={PANEL_ID}
            icon={<Icon name={destructive > 0 ? COST_ICON.destroys : "info"} size="xs" />}
            onClick={onShowResult}
          >
            {destructive > 0
              ? t(`${destructive} ${destructive === 1 ? "change" : "changes"} destroy data`)
              : t("Nothing on this machine is destroyed")}
          </Button>
        </FlexItem>
        <FlexItem>
          <Flex alignItems={{ default: "alignItemsCenter" }} gap={{ default: "gapSm" }}>
            <FlexItem>
              <span className="agm-plan-muted">{t("Boot")}</span>{" "}
              <Button variant="link" isInline onClick={onShowBoot}>
                {boot()}
              </Button>
            </FlexItem>
            <FlexItem>
              <span className="agm-plan-muted">{t("Encryption")}</span>{" "}
              <Button variant="link" isInline aria-controls={PANEL_ID} onClick={onShowEncryption}>
                {t(installationEncryption(config))}
              </Button>
            </FlexItem>
            <FlexItem>
              <ActionsMenu
                label={t("More actions for this installation")}
                items={[{ title: t("Reset to defaults"), onClick: () => reset() }]}
              />
            </FlexItem>
          </Flex>
        </FlexItem>
      </Flex>
    </div>
  );
};

const PLAN_CSS = `
.agm-plan-bar {
  position: sticky;
  top: 0;
  z-index: 20;
  padding: var(--pf-t--global--spacer--md) var(--pf-t--global--spacer--lg);
  background: var(--pf-t--global--background--color--primary--default);
  border-block-end: 1px solid var(--pf-t--global--border--color--default);
}

/* The size a shrink leaves behind, under the size it ends at. Small and quiet:
   it is the value being replaced, not the one being reported. */
.agm-plan-before {
  font-size: var(--pf-t--global--font--size--body--sm);
  color: var(--pf-t--global--text--color--status--warning--default);
}

/* A rule and an indent rather than a filled box. The count is serious without
   being an interruption, and a box around it in a sticky bar reads as an alert
   that never goes away. */
.agm-plan-bar-danger {
  border-inline-start: 3px solid var(--pf-t--global--border--color--status--danger--default);
  padding-inline-start: var(--pf-t--global--spacer--sm);
}

.agm-plan-muted {
  color: var(--pf-t--global--text--color--subtle);
  font-size: var(--pf-t--global--font--size--body--sm);
}

.agm-plan-cost-destroys {
  color: var(--pf-t--global--text--color--status--danger--default);
}

/* A shrink loses no data: a partition survives, smaller. Colouring the whole
   sentence for it puts it beside deletion, which is a different kind of news,
   so only the mark is coloured. */
.agm-plan-cost-shrinks {
  color: inherit;
}

.agm-plan-cost-keeps {
  color: var(--pf-t--global--text--color--subtle);
}

/* The mark carries the colour even where the text does not, so the three
   states stay apart for a reader who cannot see either. */
.agm-plan-cost-destroys svg { color: var(--pf-t--global--icon--color--status--danger--default); }
.agm-plan-cost-shrinks svg { color: var(--pf-t--global--icon--color--status--warning--default); }
.agm-plan-cost-keeps svg { color: var(--pf-t--global--icon--color--subtle); }

.agm-plan-list {
  padding: var(--pf-t--global--spacer--md) var(--pf-t--global--spacer--md);
}

.agm-plan-devices { table-layout: auto; }

/* Present for a screen reader, absent from the page: a header strip sitting
   once at the top labels columns that have scrolled away from it. */
.agm-plan-sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

.agm-plan-offers {
  list-style: none;
  margin: 0;
  padding: 0;
}

.agm-plan-offers-title {
  font-size: var(--pf-t--global--font--size--body--sm);
  font-weight: var(--pf-t--global--font--weight--body--bold);
  color: var(--pf-t--global--text--color--subtle);
  padding: var(--pf-t--global--spacer--lg) var(--pf-t--global--spacer--lg)
    var(--pf-t--global--spacer--sm);
}

/* Four columns need a screen. Below one, each row becomes a block and every
   cell says which column it came from, since the header row is no longer above
   it to say so. */
@media (max-width: 47.9375em) {
  .agm-plan-devices thead { display: none; }

  .agm-plan-devices tbody tr.agm-plan-row {
    display: block;
    padding-block: var(--pf-t--global--spacer--sm);
    border-block-end: 1px solid var(--pf-t--global--border--color--subtle);
  }

  .agm-plan-devices tbody tr.agm-plan-row > * {
    display: block;
    border-block-end: 0;
    padding-block: var(--pf-t--global--spacer--xs);
  }

  .agm-plan-devices tbody tr.agm-plan-row td[data-label]::before {
    content: attr(data-label) ": ";
    color: var(--pf-t--global--text--color--subtle);
  }

  .agm-plan-devices .agm-plan-group-row th { display: block; }
}

/* One hairline between rows, and none around them. */
.agm-plan-devices tbody tr.agm-plan-row {
  cursor: pointer;
}

.agm-plan-devices tbody tr.agm-plan-row > * {
  border-block-end: 1px solid var(--pf-t--global--border--color--subtle);
}

/* Rows sit under their group name rather than beside it, so the grouping reads
   without the uppercase heading having to be re-read at every row. */
.agm-plan-devices th[scope="row"] {
  border-inline-start: 3px solid transparent;
  padding-inline-start: var(--pf-t--global--spacer--lg);
}

.agm-plan-row:hover > * {
  background: var(--pf-t--global--background--color--action--plain--hover);
}

.agm-plan-row:hover th[scope="row"] {
  border-inline-start-color: var(--pf-t--global--border--color--default);
}

/* What makes a current tab read as current is the accent line, and a row can
   carry the same. The faint background alone is not enough in either theme. */
.agm-plan-row-selected > *,
.agm-plan-row-selected:hover > * {
  background: var(--pf-t--global--background--color--secondary--default);
}

.agm-plan-row-selected th[scope="row"],
.agm-plan-row-selected:hover th[scope="row"] {
  border-inline-start-color: var(--pf-t--global--border--color--brand--default);
}

.agm-plan-row-idle td { color: var(--pf-t--global--text--color--subtle); }

.agm-plan-row-compact > * { padding-block: var(--pf-t--global--spacer--xs); }

.agm-plan-row-link {
  text-decoration: none;
  color: inherit;
  display: block;
}

.agm-plan-row-link:hover { text-decoration: underline; }

/* Name and kind read on one line, the same line the panel header shows. */
.agm-plan-devices th[scope="row"] { min-width: 16rem; }

/* The ring is drawn on the row, so focus reads as "this row" rather than as a
   box around two words. On the row itself and not on its cells: a ring per cell
   is four boxes where the reader is looking for one. */
.agm-plan-row:has(.agm-plan-row-link:focus-visible) {
  outline: 2px solid var(--pf-t--global--border--color--brand--default);
  outline-offset: -2px;
}

.agm-plan-row-link:focus-visible { outline: none; }

/* The name carries the row; what the device is sits under it, quieter and
   smaller, because the panel is where that detail is read rather than scanned. */
.agm-plan-row-description {
  font-size: var(--pf-t--global--font--size--body--sm);
  color: var(--pf-t--global--text--color--subtle);
  line-height: var(--pf-t--global--font--line-height--body);
}

/* The group name is a row of the table rather than a heading outside it, so the
   rows under it are tied to it for a screen reader too. */
.agm-plan-group-row th {
  padding-inline-start: 0;
  font-size: var(--pf-t--global--font--size--body--sm);
  font-weight: var(--pf-t--global--font--weight--body--bold);
  color: var(--pf-t--global--text--color--subtle);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding-block: var(--pf-t--global--spacer--lg) var(--pf-t--global--spacer--xs);
}

.agm-plan-devices tbody:first-of-type .agm-plan-group-row th {
  padding-block-start: var(--pf-t--global--spacer--sm);
}

/* The add actions belong next to what they add to. */
.agm-plan-add {
  padding: var(--pf-t--global--spacer--lg);
}

/* Offers */

.agm-plan-offer {
  border: 1px solid var(--pf-t--global--border--color--default);
  border-radius: var(--pf-t--global--border--radius--medium);
  padding: var(--pf-t--global--spacer--md);
  margin: 0 var(--pf-t--global--spacer--lg) var(--pf-t--global--spacer--md);
}

.agm-plan-offer-actions {
  margin-block-start: var(--pf-t--global--spacer--md);
}

.agm-plan-offer-action { max-width: 18rem; }

.agm-plan-offer-action > div {
  margin-block-start: var(--pf-t--global--spacer--xs);
  font-size: var(--pf-t--global--font--size--body--sm);
}

/* The panel: a background step and a leading border, never an outline. */

.agm-plan-panel {
  display: flex;
  flex-direction: column;
  padding: var(--pf-t--global--spacer--lg) var(--pf-t--global--spacer--xl);
  background: var(--pf-t--global--background--color--primary--default);
  border-inline-start: 1px solid var(--pf-t--global--border--color--default);
}

/* Centred text under fill, which lays the labels out in equal columns: a label
   wrapping to two lines reads ragged against a one-line neighbour otherwise. */
.agm-plan-space-segments .pf-v6-c-toggle-group__button {
  text-align: center;
}

/* What became of a conditional allowance, under the control that granted it. */
.agm-plan-choice-note {
  margin-block-start: var(--pf-t--global--spacer--xs);
  font-size: var(--pf-t--global--font--size--xs, 0.75rem);
  color: var(--pf-t--global--text--color--subtle);
}

.agm-plan-panel-content {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
  gap: var(--pf-t--global--spacer--xl);
}

.agm-plan-panel:focus-visible {
  outline: 2px solid var(--pf-t--global--border--color--brand--default);
  outline-offset: -2px;
}

/* One line of relationships, between the identity above it and the tabs below.
   It orients rather than explains: the names are links, and the panel each one
   opens is what says what it is. */
.agm-plan-related {
  margin-block-end: var(--pf-t--global--spacer--xs);
  font-size: var(--pf-t--global--font--size--body--sm);
}

.agm-plan-related p {
  margin: 0;
}

.agm-plan-related p + p {
  margin-block-start: var(--pf-t--global--spacer--xs);
}

.agm-plan-related-label {
  color: var(--pf-t--global--text--color--subtle);
}

/* A line with a mark, not a block: it reads with the relationship lines above
   it, and the mark is what separates a fact about the device from the links.
   No trailing margin, since the tabs under it bring their own. */
.agm-plan-boot {
  margin-block: var(--pf-t--global--spacer--xs) 0;
}

.agm-plan-boot .pf-v6-c-helper-text__item-text {
  font-size: var(--pf-t--global--font--size--body--sm);
}

.agm-plan-panel-head {
  padding-block-end: var(--pf-t--global--spacer--sm);
  border-block-end: 1px solid var(--pf-t--global--border--color--default);
  margin-block-end: var(--pf-t--global--spacer--sm);
}

/* Two lines, the same two the list's first column carries: the name with the
   identifier that survives a rename beside it, then what the device is. */
.agm-plan-panel-title {
  margin: 0;
  font-size: var(--pf-t--global--font--size--body--lg);
  font-weight: var(--pf-t--global--font--weight--body--default);
  line-height: var(--pf-t--global--font--line-height--heading);
}

/* Also inside the summary's title, where the heading's own size would make a
   phrase about the device read as a second name. */
.pf-v6-c-empty-state__title-text .agm-plan-panel-facts,
.agm-plan-panel-facts {
  font-size: var(--pf-t--global--font--size--body--sm);
  color: var(--pf-t--global--text--color--subtle);
  font-weight: var(--pf-t--global--font--weight--body--default);
}

.agm-plan-path {
  margin-block-start: var(--pf-t--global--spacer--xs);
  font-family: var(--pf-t--global--font--family--mono);
  font-size: var(--pf-t--global--font--size--xs, 0.75rem);
  line-height: 1.4;
  color: var(--pf-t--global--text--color--subtle);
  overflow-wrap: anywhere;
}

.agm-plan-sections {
  display: flex;
  flex-direction: column;
  min-height: 0;
  gap: var(--pf-t--global--spacer--xl);
}

.agm-plan-section { min-height: 0; }

.agm-plan-section-head {
  position: sticky;
  top: 0;
  z-index: 5;
  background: var(--pf-t--global--background--color--primary--default);
  padding-block: var(--pf-t--global--spacer--md);
  font-weight: var(--pf-t--global--font--weight--body--bold);
}

.agm-plan-section-head .pf-v6-c-button { font-weight: var(--pf-t--global--font--weight--body--default); }

/* The tab list is the panel's own boundary, so the section under it does not
   draw a second one right below. */
.agm-plan-sections .agm-plan-section-head {
  border-block-end: 1px solid var(--pf-t--global--border--color--subtle);
}

.agm-plan-tabs {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
}

/* The tab strip keeps its own height; only the panel under it takes the rest. */
/* The strip stays where the reader left it. Whichever scroll model is on, the
   strip is the panel's own boundary and the way between the three tabs, so
   scrolling a long table should not cost the way back. */
.agm-plan-tabs > .pf-v6-c-tabs {
  position: sticky;
  top: 0;
  z-index: 6;
  flex: 0 0 auto;
  background: var(--pf-t--global--background--color--primary--default);
}

/* Under the strip nothing else pins itself: two sticky bars at the same offset
   land on top of each other, and the tab name is already the heading. */
.agm-plan-tabs .agm-plan-section-head {
  position: static;
}

.agm-plan-tabs > .pf-v6-c-tabs .pf-v6-c-tabs__list { margin-block-start: 0; }

.agm-plan-tabs > .pf-v6-c-tab-content:not([hidden]) {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
}

.agm-plan-section-body { padding-block-start: var(--pf-t--global--spacer--xs); }

.agm-plan-section-intro {
  margin-block-start: var(--pf-t--global--spacer--xs);
  font-size: var(--pf-t--global--font--size--body--sm);
  color: var(--pf-t--global--text--color--subtle);
}

/* The note reads as guidance about the tab, so it is set at the size the rest
   of the helper text on the page uses and its mark takes the informative
   colour rather than the text colour around it. */
/* What the tab holds reads at the size of the page's own guidance; where what
   it holds is decided reads under it, quieter, since it is the follow-up rather
   than the answer. */
.agm-plan-tab-note {
  font-size: var(--pf-t--global--font--size--body--sm);
  color: var(--pf-t--global--text--color--regular);
}

.agm-plan-tab-note div + div {
  font-size: var(--pf-t--global--font--size--xs);
  color: var(--pf-t--global--text--color--subtle);
}

.agm-plan-space-row {
  margin-block-end: var(--pf-t--global--spacer--md);
}

.agm-plan-space-row-term { font-weight: var(--pf-t--global--font--weight--body--bold); }

/* The mark and the words sit on the same baseline row: PatternFly lays the two
   out inline, and an icon taller than the text rides above it otherwise. */
.agm-plan-tabs .pf-v6-c-tabs__item-icon {
  display: inline-flex;
  align-items: center;
  height: 1lh;
}

/*
 * The two answers to "can the heading keep the decision reachable".
 *
 * With one scroll container for the whole panel body, a sticky heading only
 * sticks once its own section is on screen. A long enough first section pushes
 * the second heading out of view before it has anything to stick to, which is
 * the objection worth testing rather than asserting away.
 *
 * With one container per section, each heading stays put while its own list
 * scrolls under it, and both sections keep a share of the panel.
 */
.agm-plan-panel-scroll-body { overflow-y: auto; }

.agm-plan-panel-scroll-sections { overflow: hidden; }

.agm-plan-panel-scroll-sections .agm-plan-sections .agm-plan-section-scroll-sections {
  display: flex;
  flex-direction: column;
  flex: 1 1 0;
  min-height: 8rem;
  overflow: hidden;
}

.agm-plan-panel-scroll-sections
  .agm-plan-sections
  .agm-plan-section-scroll-sections
  .agm-plan-section-body {
  overflow-y: auto;
  min-height: 0;
}

/* Existing content */

/* One table, so the columns line up.
 *
 * Each row being its own grid is why the size column moved with the length of
 * the text beside it: columns can only align when one element owns them. A
 * table also gives every cell a column header a screen reader announces, and a
 * row header naming the partition, which a list of divs never does. */
.agm-plan-table {
  width: 100%;
  border-collapse: collapse;
}

.agm-plan-table th,
.agm-plan-table td {
  text-align: start;
  vertical-align: baseline;
  padding-block: var(--pf-t--global--spacer--sm);
  padding-inline-end: var(--pf-t--global--spacer--md);
  font-weight: var(--pf-t--global--font--weight--body--default);
}

.agm-plan-table thead th {
  font-size: var(--pf-t--global--font--size--body--sm);
  color: var(--pf-t--global--text--color--subtle);
  font-weight: var(--pf-t--global--font--weight--body--default);
  border-block-end: 1px solid var(--pf-t--global--border--color--default);
  white-space: nowrap;
}

.agm-plan-table tbody tr { border-block-end: 1px solid var(--pf-t--global--border--color--subtle); }

/* The same answer to the pointer the device list gives. The row is not a link
   here, so this is feedback about where the pointer is rather than a promise
   that the row can be activated. */
.agm-plan-table tbody tr:hover > * {
  background: var(--pf-t--global--background--color--action--plain--hover);
}

.agm-plan-table td,
.agm-plan-table tbody th { font-size: var(--pf-t--global--font--size--body--sm); }

/* Always the same column, and always aligned on the same edge, so sizes can be
   compared by looking down rather than by reading. */
.agm-plan-size {
  text-align: end;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.agm-plan-row-control {
  text-align: end;
  padding-inline-end: 0;
  white-space: nowrap;
}

/* A menu wide enough to read and no wider: a long description would otherwise
   stretch it past the panel it opens in. */
.agm-plan-table .pf-v6-c-menu,
.agm-plan-table .pf-v6-c-dropdown__menu {
  max-width: 22rem;
}

.agm-plan-table .pf-v6-c-menu__item-description {
  white-space: normal;
}

.agm-plan-free th,
.agm-plan-free td { font-style: italic; }

/* One format per row: a mark in a fixed gutter, the term, the value beside it,
   and where it earns the line, one small line under both. Colour and size come
   from PatternFly's text utilities, so what is left here is the arrangement. */
/* The settings in a column of their own, where the panel is wide enough for
   both to be read side by side, and above the content where it is not. The
   width is the viewport's rather than the panel's, since the panel is a fixed
   share of it. */
.agm-plan-split {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--pf-t--global--spacer--xl);
  min-height: 0;
  flex: 1 1 auto;
}

.agm-plan-split > * { min-height: 0; }

@media (min-width: 87.5rem) {
  .agm-plan-split-beside {
    grid-template-columns: minmax(16rem, 1fr) minmax(0, 2fr);
  }
}

/* Volumes */

/* A gutter rather than an icon glued to a word: the marks line up down the
   panel at one width, which is what gives a reader something to aim at without
   any container being drawn. */
.agm-plan-gutter-mark {
  display: inline-flex;
  justify-content: center;
  inline-size: 1.25rem;
  flex: 0 0 1.25rem;
  color: var(--pf-t--global--icon--color--subtle);
}

/* A mount path is a value, not prose, and the panel names it in a column of
   bold names beside file systems and sizes. Italics give it a texture of its
   own without spending a column on it. */
.agm-plan-mounts-italic .agm-plan-mount {
  font-style: italic;
}

/*
 * The quieter type scale.
 *
 * Same information, less furniture: the identity is the only thing set large,
 * the section heads stop competing with it, and the tables carry their column
 * headers as small subtle labels rather than as a second level of heading.
 * Weight is spent on the names inside the rows, which is what a reader scans.
 */
.agm-plan-type-quiet .agm-plan-panel-title {
  font-size: var(--pf-t--global--font--size--heading--h4);
}

.agm-plan-type-quiet .agm-plan-section-head {
  font-weight: var(--pf-t--global--font--weight--body--default);
  font-size: var(--pf-t--global--font--size--body--sm);
  color: var(--pf-t--global--text--color--subtle);
}

.agm-plan-type-quiet .agm-plan-section-head .pf-v6-c-title {
  font-size: var(--pf-t--global--font--size--body--sm);
  font-weight: var(--pf-t--global--font--weight--body--bold);
  color: var(--pf-t--global--text--color--regular);
}

/* No rule under the column headers either: with the head rule and the first
   row rule two pixels apart, the header reads as a box. */
.agm-plan-type-quiet .agm-plan-table thead th {
  font-size: var(--pf-t--global--font--size--xs, 0.75rem);
  font-weight: var(--pf-t--global--font--weight--body--default);
  color: var(--pf-t--global--text--color--subtle);
  border-block-end: none;
}

/* ------------------------------------------------------------------
 * The scroll lives inside the panel, never on the page.
 *
 * A page that scrolls means the panel can open half way down itself:
 * the reader picks a device and the panel appears at whatever offset
 * the page was left at, with its identity header above the fold.
 * Opening a panel should always land on its first line.
 *
 * PatternFly does most of this already: page__main and the group under
 * it are flex columns that grow, and the drawer bounds and scrolls its
 * own panel. What it has no prop for is letting them shrink. The group
 * and the section are flex-shrink: 0 with the default
 * min-height: auto, so both stay as tall as their content, page__main
 * overflows, and its overflow: auto becomes the page's scrollbar.
 *
 * So: let those two shrink to the height they are given, and move the
 * panel's scroll one level in so the identity can stay behind. The list
 * beside the panel needs nothing, since the drawer already makes its
 * content side a flex column that scrolls.
 * ------------------------------------------------------------------ */

.pf-v6-c-page__main-group:has(> .agm-plan-page),
.agm-plan-page {
  flex: 1 1 auto;
  min-height: 0;
}

.agm-plan-page > .pf-v6-c-drawer,
.agm-plan-page > .agm-plan-narrow {
  flex: 1 1 auto;
  min-height: 0;
}

/* The bar sticks to the top of whichever column it sits in, so the
   destructive count never depends on how far the list has scrolled. */
.agm-plan-bar { flex: 0 0 auto; }

/* Which device the panel is about stays on screen while its content
   moves, so a reader at the bottom of a long partition list still knows
   whose partitions these are.
 *
 * The drawer scrolls the whole panel, header included, and its body is a
 * plain block. Take the scroll off the panel, make the body a column,
 * and let each thing under it fill rather than measure, so the scroll
 * lands on the content beneath the header. */
.agm-plan-page .pf-v6-c-drawer__panel { overflow: hidden; }

.agm-plan-page .pf-v6-c-drawer__panel > .pf-v6-c-drawer__body {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
}

.agm-plan-page .agm-plan-panel {
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
}

.agm-plan-panel-head { flex: 0 0 auto; }

.agm-plan-panel > .agm-plan-panel-content { overflow-y: auto; }

/* Only the identity is pinned. Everything under it, the settings and
   the tabs alike, is content and travels with the scroll: a setting
   that stays put while the table moves reads as part of the header,
   which is a promise about what it belongs to that is not true.
 *
 * So the inner scrollers give up. Each of these takes its natural
 * height instead of a share of the panel, which leaves exactly one
 * scroll between the header and the bottom of the tables. */
.agm-plan-page .agm-plan-split,
.agm-plan-page .agm-plan-tabs,
.agm-plan-page .agm-plan-tabs > .pf-v6-c-tab-content:not([hidden]) {
  flex: 0 0 auto;
  min-height: auto;
}

.agm-plan-page .agm-plan-tabs > .pf-v6-c-tab-content:not([hidden]) {
  overflow: visible;
}

/* Below lg the list and the panel take turns in the same frame. The list
   scrolls here, under a bar that sticks to the top of it. The panel does
   not: it fills the frame and keeps its own scroll under its identity,
   the same as it does inside the drawer, so nothing above changes. */
.agm-plan-narrow {
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}

/* A label with its control under it, the way a form reads. One field per line:
   two to a line saves height and costs the reader a straight column of labels
   to run down.

   Per entry rather than per list: a name reads beside its term and a sentence
   reads under it, and one list can hold both. */
/* A sentence about what the panel names, under the name rather than beside it. */
.agm-plan-panel-subtitle {
  margin-block-start: var(--pf-t--global--spacer--xs);
  font-size: var(--pf-t--global--font--size--body--sm);
  color: var(--pf-t--global--text--color--subtle);
}

/* Above the list, where it is read before anything the list says about costs. */
.agm-plan-no-proposal {
  margin-block: var(--pf-t--global--spacer--sm);
}

/* The notice takes the place of the table, so it starts where the table would. */
.agm-plan-boot-notice {
  margin-block-start: var(--pf-t--global--spacer--md);
}

/* Down the side, the strip keeps its width and the panel beside it takes the
   rest, which is the deal the horizontal strip makes with height.
 *
 * Two classes rather than one, and last in the sheet: this file declares
 * .agm-plan-tabs more than once, and a single class here loses to whichever
 * copy comes after it. */
.agm-plan-tabs.agm-plan-tabs-vertical {
  display: flex;
  flex-direction: row;
  align-items: stretch;
  gap: var(--pf-t--global--spacer--md);
}

/* PatternFly gives a vertical strip width 100%, which in a row leaves the panel
   beside it a sliver. Told to take the width of its own labels instead, capped
   by the max-width PatternFly already sets on the list. */
/* Down the side the strip sticks the same way, which needs it to stop being
   stretched to the height of the panel: a box as tall as what scrolls past it
   has nowhere to stick to. */
.agm-plan-tabs.agm-plan-tabs-vertical > .pf-v6-c-tabs {
  --pf-v6-c-tabs--m-vertical--Width: auto;
  flex: 0 0 auto;
  align-self: flex-start;
}

.agm-plan-tabs.agm-plan-tabs-vertical > .pf-v6-c-tab-content:not([hidden]) {
  flex: 1 1 auto;
  min-width: 0;
}

/* The same head as the tables in the tabs beside it: a column name is a label
   for what is under it, not a heading of its own, and two tables in one panel
   disagreeing about that is read as two designs. */
.agm-plan-device-layout .pf-v6-c-table thead th {
  font-size: var(--pf-t--global--font--size--body--sm);
  font-weight: var(--pf-t--global--font--weight--body--default);
  color: var(--pf-t--global--text--color--subtle);
}

/* The name of what a row is about carries the weight, as it does in the tables
   in the tabs beside this one, where the mount point is the row's own heading.
   Here the first cell is that name. */
.agm-plan-device-layout .pf-v6-c-table tbody tr > *:first-child {
  font-weight: var(--pf-t--global--font--weight--body--bold);
}

/* One device to a table, so nothing there is worth collapsing: the toggle only
   offers to hide the rows the tab exists to show. What is nested in what is
   still said by the tree itself. */
.agm-plan-device-layout .pf-v6-c-table__toggle {
  display: none;
}

/* With no toggle to draw, the room PatternFly reserves for one is a first
   column that starts short of its own heading. The top rows take the edge the
   heading takes, and what is nested under them keeps a step of its own.

   Set on the table rather than on anything around it: PatternFly declares these
   on the table itself, and a value declared on the element beats one inherited
   from an ancestor however specific that ancestor is. The negative margin goes
   with them, since it exists to pull the cell back out of that reserved room. */
.agm-plan-device-layout .pf-v6-c-table {
  --pf-v6-c-table__tree-view-main--indent--base: 0;
  --pf-v6-c-table__tree-view-main--nested-indent--base: var(--pf-t--global--spacer--md);
  --pf-v6-c-table__tree-view-main--MarginInlineStart: 0;
}

/* Half a step of grey rather than a whole one. The lightest ground PatternFly
   names is still a shade the eye reads as a box; mixing it back into the
   panel's own background sets the block apart without boxing it, and both
   halves of the mix are tokens, so the tint follows the theme. */
.agm-plan-dimmed {
  background: color-mix(
    in oklab,
    var(--pf-t--global--background--color--secondary--default) 50%,
    var(--pf-t--global--background--color--primary--default)
  );
  border-radius: var(--pf-t--global--border--radius--small);
  padding-block: var(--pf-t--global--spacer--sm);
  padding-inline: var(--pf-t--global--spacer--md);
}

/* A second line under a value in a table: what the value is qualified by, at a
   size and a face that keep it out of the column it sits in. Monospaced,
   because most of what it says is a device name, and because it tells the eye
   scanning the column that the line is not another value. */
.agm-plan-row-note {
  margin-block-start: var(--pf-t--global--spacer--xs);
  font-family: var(--pf-t--global--font--family--mono);
  font-size: var(--pf-t--global--font--size--xs, 0.75rem);
  line-height: 1.4;
  color: var(--pf-t--global--text--color--subtle);
  overflow-wrap: anywhere;
}

/* Room between the invitation and the table it adds to. */
.agm-plan-section-action {
  margin-block: var(--pf-t--global--spacer--md) var(--pf-t--global--spacer--sm);
}

/* What a statement is about, at the weight of a term: the sentence under it is
   long enough that the name has to be findable at a glance. */
.agm-plan-statements .pf-v6-c-description-list__term {
  font-weight: var(--pf-t--global--font--weight--body--bold);
}

/* The term is a flex row, so the mark is stretched to the height of the line
   and its glyph sits wherever the box leaves it. One line box tall, centred
   inside, puts it on the text beside it. */
.agm-plan-statements .pf-v6-c-description-list__term {
  align-items: center;
}

.agm-plan-statements .pf-v6-c-description-list__term-icon {
  display: inline-flex;
  align-items: center;
  height: 1lh;
}

/* The mark keeps a gutter of its own, so what a statement says lines up with
   the name of the statement rather than with the mark beside it. Built from the
   two measurements PatternFly gives the mark, so the column stays true if
   either changes.

   Stacked runs only: there the value starts a line of its own under the term,
   and a value indented to the mark reads as a second column. A value beside its
   term is already past the mark, and the same padding there is a hole. */
.agm-plan-statements .agm-plan-settings-stacked .pf-v6-c-description-list__description {
  padding-inline-start: calc(
    var(--pf-v6-c-description-list__term-icon--MinWidth) +
      var(--pf-v6-c-description-list__term-icon--MarginInlineEnd)
  );
}

/* A term and the name beside it read as a sentence, which asks for a word space
   between them rather than a column. PatternFly sizes the term column for a
   list of many rows, where the values line up under each other; these rows are
   one or two, and what they gain from a column is a gap the eye has to cross.
   The term takes the width of its own words and the gap is one step. */
.agm-plan-settings-inline {
  --pf-v6-c-description-list--m-horizontal__term--width: max-content;
  --pf-v6-c-description-list__group--ColumnGap: var(--pf-t--global--spacer--sm);
  --pf-v6-c-description-list--m-horizontal__description--width: auto;
}

/* Between two blocks of statements, and between two statements where every one
   of them is asked for. Dashed rather than solid: a solid rule at this size
   reads as the edge of a box, and what is being separated are two sentences
   about the same device. */
.agm-plan-rule-between + .agm-plan-rule-between,
.agm-plan-rule-all + .agm-plan-rule-all,
.agm-plan-rule-all .pf-v6-c-description-list__group + .pf-v6-c-description-list__group,
.agm-plan-rule-all .agm-plan-settings-runs > * + * {
  padding-block-start: var(--pf-t--global--spacer--sm);
  border-block-start: 1px dashed var(--pf-t--global--border--color--subtle);
}

/* The rule takes the room the gap was giving, so a block with one above it does
   not get both. */
.agm-plan-rule-between + .agm-plan-rule-between,
.agm-plan-rule-all + .agm-plan-rule-all {
  margin-block-start: var(--pf-t--global--spacer--sm);
}

/* The inset does not cost the panel its own layout: what is inside a tab still
   stretches and scrolls the way it did as a direct child. */
.agm-plan-tab-body {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
}

/* A line under the name of a tab, at the size the rest of the panel gives its
   second lines. The name keeps its own line: the two read as a pair, not as a
   sentence that wrapped. */
.agm-plan-tabs .agm-plan-tab-summary {
  display: block;
  font-size: var(--pf-t--global--font--size--xs);
  font-weight: var(--pf-t--global--font--weight--body--default);
  color: var(--pf-t--global--text--color--subtle);
}

.agm-plan-tabs .pf-v6-c-tabs__item-text {
  display: block;
  text-align: start;
}

/* Both lines start where the name starts, whatever the width of the tab. The
   filled layout centres a tab's contents, which under a two line tab puts the
   phrase in the middle of a name it belongs to the front of. */
.agm-plan-tabs .pf-v6-c-tabs__link {
  align-items: flex-start;
  justify-content: flex-start;
}

/* The switches, over the page rather than beside it: what they change is under
   them, and a reader comparing two settings wants the page to stay put between
   clicks. Minimised to a button, since the page is also what gets screenshot. */
.agm-plan-switches-toggle,
.agm-plan-switches {
  position: fixed;
  inset-block-end: var(--pf-t--global--spacer--md);
  inset-inline-end: var(--pf-t--global--spacer--md);
  z-index: 400;
}

.agm-plan-switches {
  display: flex;
  flex-direction: column;
  max-height: 70vh;
  max-width: 26rem;
  background: var(--pf-t--global--background--color--primary--default);
  border: 1px solid var(--pf-t--global--border--color--default);
  border-radius: var(--pf-t--global--border--radius--small);
  box-shadow: var(--pf-t--global--box-shadow--lg);
}

.agm-plan-switches-head {
  padding: var(--pf-t--global--spacer--sm) var(--pf-t--global--spacer--md);
  border-block-end: 1px solid var(--pf-t--global--border--color--subtle);
}

.agm-plan-switches-body {
  overflow-y: auto;
  padding: var(--pf-t--global--spacer--md);
  display: grid;
  gap: var(--pf-t--global--spacer--sm);
}

.agm-plan-switch {
  font-size: var(--pf-t--global--font--size--body--sm);
}

/* With a phrase under it, the name takes a size of its own: the two lines are
   a name and a gloss, and at one size apart they read as one wrapped sentence
   instead. Only where the phrase is shown, since a lone name has nothing to be
   told apart from. */
.agm-plan-tabs-described .pf-v6-c-tabs__item-text {
  font-size: var(--pf-t--global--font--size--body--lg);
  line-height: var(--pf-t--global--font--line-height--heading);
}

/* The strip gives way rather than scrolling. PatternFly measures the tabs and
   offers arrows once they no longer fit, which in a panel that is already a
   share of the window hides two thirds of the strip behind a button. Wrapping
   costs a line and keeps every tab in view. */
.agm-plan-tabs .pf-v6-c-tabs__list {
  flex-wrap: wrap;
}

.agm-plan-tabs .pf-v6-c-tabs__scroll-button {
  display: none;
}

/* Room on both sides of it, so the rule reads as a break rather than as an
   underline for the line above. */
.agm-plan-note-rule {
  margin-block: var(--pf-t--global--spacer--sm);
}

/* One list of statements split into runs by how each reads, so the gap between
   two runs is the gap between two statements, not the gap between two lists. */
.agm-plan-settings-runs {
  display: flex;
  flex-direction: column;
  gap: var(--pf-t--global--spacer--sm);
}

/* The mark sits on the title line and is not part of the title: at the title's
   size it reads as a second name, so it takes the smallest size the page uses. */
.agm-plan-panel-mark {
  font-size: var(--pf-t--global--font--size--xs);
}

/* What the page reports moves aside for the sheet rather than being laid out
   again inside what is left. Nothing about it changes shape: the same page, a
   little further over, dimmed and out of reach behind the thing the reader is
   in.

   Modest on purpose. Far enough to say the sheet pushed something, and not so
   far that a block as wide as the reading measure loses its start, which is
   what the earlier attempt at this did.

   The line above it stays where it is. It is the page's own furniture rather
   than part of what the sheet is about, and furniture sliding with the content
   it introduces reads as the whole window shifting. */
.agm-plan-page-body {
  transition: transform var(--pf-t--global--motion--duration--fade--default, 200ms) ease-in-out;
}

.agm-plan-drawer-aside .agm-plan-covered .agm-plan-page-body {
  transform: translateX(-8%);
}

/* The column every state of the page opens with. What the empty state used to
   give it and it still needs: room above, and a measure narrow enough that a
   sentence is read in one sweep rather than scanned across a monitor. */
.agm-plan-headline {
  padding-block: var(--pf-t--global--spacer--xl);
  text-align: center;
}

.agm-plan-headline-measure {
  max-width: 44rem;
}

/* The sentence is the page's own heading and reads as one. Its weight is the
   framework's, not a size of ours. */
.agm-plan-headline-title {
  text-wrap: balance;
}

/* A name and a size are a value set into a sentence, and the sentence is a
   heading: at the heading's own size and weight the monospace reads as
   something to press. Smaller and at body weight it reads as what it is, a
   value quoted inside the words about it, and the face is what tells it apart
   rather than a border or a colour.

   Kept whole, since a name and its size are one value and a line break between
   them makes two. */
.agm-plan-headline-device {
  font-family: var(--pf-t--global--font--family--mono);
  font-size: 0.85em;
  font-weight: var(--pf-t--global--font--weight--body--default);
  white-space: nowrap;
}

/* The size is a fact about the name rather than part of it, so it is not set
   as a name: the parentheses hold it apart, and the weight of the heading
   around it is not what the reader needs on a number. */
.agm-plan-headline-size {
  font-size: 0.85em;
  font-weight: var(--pf-t--global--font--weight--body--default);
  white-space: nowrap;
}

/* The space decision on the page, quieter than the same control in the sheet:
   there the reader is acting on the table under it, here they are reading a
   summary and the decision is one line of it. */
.agm-plan-space-quiet .pf-v6-c-toggle-group__button {
  font-size: var(--pf-t--global--font--size--xs);
}

/* A flex item will not shrink below the width of its longest word unless it is
   told it may, which is what turns a row that could hold both halves into two
   rows. Told it may, the sentence wraps inside its own column and the controls
   keep their line. */
.agm-plan-topline-intro {
  min-width: 0;
  text-wrap: pretty;
}

/* The half that never gives way. Squeezed, these three lose their words one
   letter at a time, and a value read at a glance is the whole reason they are
   printed rather than hidden in the menu. */
.agm-plan-topline-controls {
  flex-shrink: 0;
}

/* PatternFly gives a paragraph room under it, which is room this one does not
   want: it is the last line of a block, not a paragraph with another after it. */
.agm-plan-headline-body {
  margin-block-end: 0;
}

/* Short and centred. A rule the width of the text above it divides the page
   in two; this one closes a paragraph of it and lets the actions under it read
   as the answer to what was just reported. */
.agm-plan-headline-rule {
  width: 8rem;
  margin-inline: auto;
}

/* The room a summary keeps under it is the room before whatever it introduces,
   and a list that starts a screen away from the sentence about it reads as a
   second page. */
.agm-plan-headline-tight {
  padding-block-end: var(--pf-t--global--spacer--sm);
}

/* Out of reach, and visibly so: inert takes the page out of the tab order and
   the accessibility tree, and nothing about that reaches a reader who is
   looking at it. Dimmed and softened, it reads as what it is, the page behind
   the thing they are in. */
/* A table has columns to compare, and a strip narrower than they need turns
   them into a stack of wrapped words. It keeps the width it reads at and the
   page scrolls to the rest. */
.agm-plan-page-narrow .agm-plan-table {
  min-width: 32rem;
}

/* Centring on the cross axis has no way to overflow politely: content wider
   than the strip loses its start, which is where a heading begins. Stretched,
   it wraps and stays whole, and the text stays centred by the rule above. */
.agm-plan-page-narrow .agm-plan-headline-measure {
  max-width: 100%;
}

.agm-plan-covered {
  opacity: 0.55;
  filter: blur(2px);
  transition:
    opacity var(--pf-t--global--motion--duration--fade--default, 200ms) ease-in-out,
    filter var(--pf-t--global--motion--duration--fade--default, 200ms) ease-in-out;
}

/* What is wrong reads as prose, not as a centred banner: an alert is a heading
   and a paragraph, and both are read from their own left edge. */
.agm-plan-summary-notice {
  margin-block: var(--pf-t--global--spacer--md);
  text-align: start;
}

`;

/* The outline a label draws, on the second lines under a value: the same words
   and the same face, boxed. Written here rather than in the sheet because it is
   the one rule a switch turns on, and both the tables of this page and the
   final layout table carry these lines. */
const OUTLINED_NOTES_CSS = `
.agm-plan-page .agm-plan-row-note,
.agm-plan-page .agm-row-note {
  display: inline-block;
  padding-block: 0;
  padding-inline: var(--pf-t--global--spacer--sm);
  border: 1px solid currentColor;
  border-radius: var(--pf-t--global--border--radius--pill, 999px);
}

/* A box in a cell of figures takes the line under them rather than the space
   beside them: the column is read down its trailing edge, and a box on the same
   line as the size pushes the size off that edge. */
.agm-plan-page .sizes-column .agm-row-note {
  display: block;
  width: fit-content;
  margin-inline-start: auto;
}
`;

/* A colour per kind of change, so a table can be scanned for what the installer
   does before any of it is read: nothing is lost where a device is created, a
   partition survives smaller where it is shrunk, and what is on a device is
   gone where it is formatted. The outline follows the words, since it is drawn
   in the current colour. */
const STATUS_NOTES_CSS = `
.agm-plan-page .agm-row-note-created {
  color: var(--pf-t--global--icon--color--status--success--default);
}

.agm-plan-page .agm-row-note-shrunk {
  color: var(--pf-t--global--text--color--status--info--default);
}

.agm-plan-page .agm-row-note-reformatted {
  color: var(--pf-t--global--text--color--status--warning--default);
}
`;

const PlanStyles = () => {
  const { rowNote, noteColor } = useVariants();
  const sheet = [
    PLAN_CSS,
    rowNote === "outlined" && OUTLINED_NOTES_CSS,
    noteColor === "status" && STATUS_NOTES_CSS,
  ]
    .filter(Boolean)
    .join("");

  return <style>{sheet}</style>;
};

/**
 * Encryption, as a scope of its own.
 *
 * The same shape as boot: the one machine-wide decision, and under it what that
 * decision reaches. The model holds a single encryption setting, so what it
 * reaches is everything the installation creates, which is worth showing rather
 * than asserting.
 */
const EncryptionDetail = () => {
  const config = useConfigModel();
  const navigate = useNavigate();
  const { settings: settingsPlacement, scroll } = useVariants();

  const encrypted = Boolean(config.encryption);

  const volumes = [
    ...(config.drives || []).flatMap((drive) =>
      (drive.partitions || [])
        .filter((partition) => partition.mountPath && !partition.name)
        .map((partition) => ({
          key: `${drive.name}:${partition.mountPath}`,
          where: baseName(drive.name),
          what: partition.mountPath,
        })),
    ),
    ...(config.volumeGroups || []).flatMap((group) =>
      (group.logicalVolumes || [])
        .filter((volume) => volume.mountPath)
        .map((volume) => ({
          key: `${group.vgName}:${volume.mountPath}`,
          where: group.vgName,
          what: volume.mountPath,
        })),
    ),
  ];

  const settings: Setting[] = [
    {
      key: "encryption",
      icon: "lock",
      term: t("Encryption"),
      value: (
        <Flex
          alignItems={{ default: "alignItemsCenter" }}
          gap={{ default: "gapSm" }}
          display={{ default: "inlineFlex" }}
        >
          {t(installationEncryption(config))}
          <Button
            variant="link"
            isInline
            onClick={() => navigate(generateEncodedPath(PATHS.editEncryption, {}))}
          >
            {t("Change")}
          </Button>
        </Flex>
      ),
      explanation: encrypted
        ? t("The password is asked for once, and again on every start unless the TPM holds it.")
        : t("Everything the installation writes is readable by anyone holding the disk."),
    },
  ];

  return (
    <div className={`agm-plan-split agm-plan-split-${settingsPlacement}`}>
      <SettingsList settings={settings} layout="stacked" />
      <div className={`agm-plan-section agm-plan-section-scroll-${scroll}`}>
        <div className="agm-plan-section-body">
          {volumes.length === 0 && (
            <div className="agm-plan-muted">
              {t("Nothing is planned yet, so there is nothing for this setting to reach.")}
            </div>
          )}
          {volumes.length > 0 && (
            <table className="agm-plan-table" aria-label={t("What this setting reaches")}>
              <thead>
                <tr>
                  <th scope="col">{t("Device")}</th>
                  <th scope="col">{t("Volume")}</th>
                  {/* No note about where the value comes from: this panel is
                      that setting, and the column is what it reaches. */}
                  <th scope="col">{t("Encryption")}</th>
                </tr>
              </thead>
              <tbody>
                {volumes.map((volume) => (
                  <tr key={volume.key}>
                    <th scope="row">
                      <Text isBold>{volume.where}</Text>
                    </th>
                    <td className="agm-plan-mount">{volume.what}</td>
                    <td>{encrypted ? t(installationEncryption(config)) : t("None")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

/**
 * The result, in the panel the devices use.
 *
 * Two halves of the same answer: the changes the installer carries out, and
 * what the machine looks like once it has. Tabs rather than a stack, for the
 * reason the device panel uses them: both headings stay visible whatever the
 * length of the list under them.
 */
const ResultDetail = ({ actions }: { actions: Proposal.Action[] }) => {
  const config = useConfigModel();
  const system = useFlattenDevices();
  const staging = useStagingDevices();
  const [tab, setTab] = useState("actions");
  const devices = new DevicesManager(system, staging, actions);
  const usedDevices = devices.usedDevices(config?.drives?.map((drive) => drive.name) || []);

  return (
    <Tabs
      activeKey={tab}
      onSelect={(_event, key) => setTab(String(key))}
      aria-label={t("What will happen")}
    >
      {/* The same word the count on the page uses, since the count is what
          opens this. Whether both should say "changes" instead is the one
          piece of wording still open: "action" is what the backend calls them,
          "change" is what a reader would say. */}
      <Tab eventKey="actions" title={<TabTitleText>{t("Actions")}</TabTitleText>}>
        <div className="agm-plan-section-body">
          <ProposalActions actions={actions} />
        </div>
      </Tab>
      <Tab eventKey="layout" title={<TabTitleText>{t("Final layout")}</TabTitleText>}>
        <div className="agm-plan-section-body">
          <ProposalResultTable devicesManager={devices} devices={usedDevices} />
        </div>
      </Tab>
    </Tabs>
  );
};

/**
 * What the page is reading, when what it is reading is incomplete.
 *
 * Two states the page cannot show anything useful in, and used to show nothing
 * about: the configuration has issues the backend can name, and the backend has
 * no proposal at all, which is what it reports when the configuration does not
 * solve. Without these, every table quietly reports nothing and the page looks
 * like it is working.
 *
 * The same two states have their own notices on the real storage page.
 */
const usePlanNotice = (): React.ReactNode | null => {
  const proposal = useStorageProposal();
  const issues = useIssues("storage");
  /* The proposal class is the failure itself, which the notice below is about.
     Everything else is something in the configuration to put right. */
  const configIssues = issues.filter((issue) => issue.class !== "proposal");

  /* Null rather than an empty fragment, so a caller can ask whether there is
     anything to say before deciding where to say it. */
  if (proposal && configIssues.length === 0) return null;

  return (
    <>
      {configIssues.length > 0 && (
        <Alert
          variant="danger"
          isInline
          className="agm-plan-no-proposal"
          title={
            configIssues.length === 1
              ? t("The configuration has to be adapted to address this issue")
              : t("The configuration has to be adapted to address these issues")
          }
        >
          <ul>
            {configIssues.map((issue) => (
              <li key={issue.description}>
                {issue.description}
                {issue.details && <div className="agm-plan-muted">{issue.details}</div>}
              </li>
            ))}
          </ul>
        </Alert>
      )}
      {!proposal && configIssues.length === 0 && (
        <Alert
          variant="danger"
          isInline
          className="agm-plan-no-proposal"
          title={t("The installer could not work out a layout for this configuration")}
        >
          {t(
            "Nothing on this page can say what the installation costs until it can: no changes, no sizes, no partitions to boot.",
          )}
        </Alert>
      )}
    </>
  );
};

/** The same notices, where the page has nowhere better to put them. */
const PlanNotices = () => <>{usePlanNotice()}</>;

/**
 * The two add actions, as buttons at the foot of the list they add to.
 *
 * "Add device" opens the same device selector dialog the interface already
 * uses, with the same tabs, intros and side effects. The redesign is about
 * where the action sits, not about replacing what it does.
 */
const AddDeviceActions = () => {
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);
  const navigate = useNavigate();
  const config = useConfigModel();
  const addDrive = useAddDrive();
  const addMdRaid = useAddMdRaid();
  const addVolumeGroup = useAddVolumeGroup();
  const allDevices = useAvailableDevices();

  const usedNames = configModel.devices(config).map((d) => d.name);
  const available = allDevices.filter((d) => !usedNames.includes(d.name));
  const disks = available.filter(isDrive);
  const mdRaids = available.filter(isMd);
  const volumeGroups = available.filter(isVolumeGroup);

  const addDevice = (device: Storage.Device) => {
    if (isDrive(device)) addDrive({ name: device.name, spacePolicy: "keep" });
    if (isMd(device)) addMdRaid({ name: device.name, spacePolicy: "keep" });
    if (isVolumeGroup(device)) addVolumeGroup({ name: device.name, spacePolicy: "keep" }, false);
  };

  const selector = isSelectorOpen && (
    <DeviceSelectorModal
      disks={disks}
      mdRaids={mdRaids}
      volumeGroups={volumeGroups}
      title={t("Add a device")}
      intro={t("Pick a device to define partitions on, to mount, or to hold logical volumes.")}
      tabIntros={{
        disks: t("Choose a disk to define partitions or to mount"),
        mdRaids: t("Choose a RAID device to define partitions or to mount"),
        volumeGroups: t("Choose a volume group to define logical volumes"),
      }}
      onCancel={() => setIsSelectorOpen(false)}
      onConfirm={([device]) => {
        addDevice(device);
        setIsSelectorOpen(false);
      }}
    />
  );

  return (
    <Flex flexWrap={{ default: "wrap" }} gap={{ default: "gapSm" }} className="agm-plan-add">
      <Button
        variant="secondary"
        icon={<Icon name="add" size="xs" />}
        isDisabled={available.length === 0}
        onClick={() => setIsSelectorOpen(true)}
      >
        {t("Add device")}
      </Button>
      <Button
        variant="secondary"
        icon={<Icon name="add" size="xs" />}
        onClick={() => navigate(PATHS.volumeGroup.add)}
      >
        {t("Add LVM volume group")}
      </Button>
      {selector}
    </Flex>
  );
};

/* ------------------------------------------------------------------ *
 * The list
 * ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ *
 * The boot entry
 * ------------------------------------------------------------------ */

const BOOT_MODES: BootMode[] = ["auto", "chosen", "off"];

const BOOT_MODE_LABEL_ID = "agm-plan-boot-mode-label";
const BOOT_MODE_VALUE_ID = "agm-plan-boot-mode-value";
const BOOT_DISK_LABEL_ID = "agm-plan-boot-disk-label";
const BOOT_DISK_VALUE_ID = "agm-plan-boot-disk-value";
const BOOT_LOADER_LABEL_ID = "agm-plan-boot-loader-label";
const BOOT_LOADER_VALUE_ID = "agm-plan-boot-loader-value";

/** Where the boot loader goes, as the value of its row. */
const BootModeMenu = ({
  current,
  canChoose,
  onChoose,
}: {
  current: BootMode;
  canChoose: boolean;
  onChoose: (mode: BootMode) => void;
}) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Dropdown
      isOpen={isOpen}
      onOpenChange={setIsOpen}
      popperProps={{ preventOverflow: true }}
      toggle={(ref) => (
        <MenuToggle
          ref={ref}
          size="sm"
          isExpanded={isOpen}
          aria-labelledby={`${BOOT_MODE_LABEL_ID} ${BOOT_MODE_VALUE_ID}`}
          onClick={() => setIsOpen((open) => !open)}
        >
          <span id={BOOT_MODE_VALUE_ID}>{t(BOOT_MODE_LABELS[current])}</span>
        </MenuToggle>
      )}
    >
      <DropdownList>
        {BOOT_MODES.map((mode) => (
          <DropdownItem
            key={mode}
            isSelected={mode === current}
            /* Nothing to boot from is the one choice that can leave the machine
               unable to start, so it reads as the risk it is. */
            isDanger={mode === "off"}
            isDisabled={mode === "chosen" && !canChoose}
            description={t(BOOT_MODE_MEANINGS[mode])}
            onClick={() => {
              setIsOpen(false);
              /* Picking what is already picked is not a change. Every write
                 here is a round trip that recalculates the proposal, so a
                 no-op write costs a rebuild of the whole page. */
              if (mode !== current) onChoose(mode);
            }}
          >
            {t(BOOT_MODE_LABELS[mode])}
          </DropdownItem>
        ))}
      </DropdownList>
    </Dropdown>
  );
};

/** Which disk the boot loader is written to, once a disk is being chosen. */
const BootDiskMenu = ({
  current,
  devices,
  onChoose,
}: {
  current: string | null;
  devices: Storage.Device[];
  onChoose: (name: string) => void;
}) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Dropdown
      isOpen={isOpen}
      onOpenChange={setIsOpen}
      popperProps={{ preventOverflow: true }}
      toggle={(ref) => (
        <MenuToggle
          ref={ref}
          size="sm"
          isExpanded={isOpen}
          aria-labelledby={`${BOOT_DISK_LABEL_ID} ${BOOT_DISK_VALUE_ID}`}
          onClick={() => setIsOpen((open) => !open)}
        >
          <span id={BOOT_DISK_VALUE_ID}>{current ? baseName(current) : t("Pick a disk")}</span>
        </MenuToggle>
      )}
    >
      <DropdownList>
        {devices.map((device) => (
          <DropdownItem
            key={device.sid}
            isSelected={device.name === current}
            description={partitionableDescription(device)}
            onClick={() => {
              setIsOpen(false);
              if (device.name !== current) onChoose(device.name);
            }}
          >
            {baseName(device.name)}
          </DropdownItem>
        ))}
      </DropdownList>
    </Dropdown>
  );
};

/** Which boot loader is installed, out of the ones this machine can run. */
const BootLoaderMenu = ({
  current,
  available,
  onChoose,
}: {
  current: Bootloader.BootloaderType | null;
  available: Bootloader.Bootloader[];
  onChoose: (type: Bootloader.BootloaderType) => void;
}) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Dropdown
      isOpen={isOpen}
      onOpenChange={setIsOpen}
      popperProps={{ preventOverflow: true }}
      toggle={(ref) => (
        <MenuToggle
          ref={ref}
          size="sm"
          isExpanded={isOpen}
          aria-labelledby={`${BOOT_LOADER_LABEL_ID} ${BOOT_LOADER_VALUE_ID}`}
          onClick={() => setIsOpen((open) => !open)}
        >
          <span id={BOOT_LOADER_VALUE_ID}>
            {current ? t(BOOTLOADER_LABELS[current]) : t("Decided by the installer")}
          </span>
        </MenuToggle>
      )}
    >
      <DropdownList>
        {available.map((bootloader) => (
          <DropdownItem
            key={bootloader.type}
            isSelected={bootloader.type === current}
            description={
              bootloader.encryptionAuth.includes("tpm")
                ? t("Can unlock with the TPM")
                : t("Asks for the password while starting")
            }
            onClick={() => {
              setIsOpen(false);
              if (bootloader.type !== current) onChoose(bootloader.type);
            }}
          >
            {t(BOOTLOADER_LABELS[bootloader.type])}
          </DropdownItem>
        ))}
      </DropdownList>
    </Dropdown>
  );
};

/**
 * Boot, as a scope of its own.
 *
 * The decision is machine wide: two of its three states say nothing about any
 * particular disk, and which boot loader is installed says nothing about
 * storage at all. Gathering them here puts every one of them beside the
 * partitions they cost, which is the only place those partitions are visible.
 */
const BootDetail = () => {
  const config = useConfigModel();
  const availableDevices = useAvailableDevices();
  const bootloaderSystem = useBootloaderSystem();
  const setBootDevice = useSetBootDevice();
  const setDefaultBootDevice = useSetDefaultBootDevice();
  const disableBoot = useDisableBoot();
  const setBootloader = useSetBootloader();
  const proposal = useStorageProposal();
  const { settings: settingsPlacement } = useVariants();
  const { goToDevice } = React.useContext(PanelNavContext);

  const mode = bootModeOf(config);
  const bootDevice = configModel.boot.findDevice(config);
  const bootDeviceName = bootDevice?.name || null;

  /* A disk formatted as a whole has no room for a boot partition, so it is not
     somewhere the boot loader can be sent. */
  const candidates = availableDevices.filter((device) => {
    const drive = (config.drives || []).find((entry) => entry.name === device.name);
    return !drive?.filesystem;
  });

  const chooseMode = (next: BootMode) => {
    if (next === "auto") return setDefaultBootDevice();
    if (next === "off") return disableBoot();

    /* Choosing a disk needs a disk. The current one where there is one, so
       switching away from automatic and back does not move the boot loader. */
    const target = bootDeviceName || candidates[0]?.name;
    if (target) setBootDevice(target);
  };

  const bootDeviceSelection = bootDeviceName
    ? selectionForDevice(config, bootDeviceName)
    : undefined;
  const bootDeviceLink = bootDeviceSelection ? (
    <Button variant="link" isInline onClick={() => goToDevice(bootDeviceSelection)}>
      {t(`See the final layout of ${baseName(bootDeviceName)}`)}
    </Button>
  ) : null;

  /* Only where the value leaves something open. Which disk was picked is the
     row below, and what turning boot off costs is the notice beside it. What
     the decision costs is read on the disk that pays it, so the sentence sends
     the reader there rather than describing it here. */
  const modeExplanation = () => {
    if (mode === "auto") {
      return bootDeviceName ? (
        <>
          {t(
            `Partitions to boot are set up if needed at the installation disk. Currently ${baseName(bootDeviceName)}, based on the location of the / file system.`,
          )}{" "}
          {bootDeviceLink}
        </>
      ) : (
        t(
          "Partitions to boot are set up if needed at the installation disk, based on the location of the / file system.",
        )
      );
    }

    return undefined;
  };

  const available = bootloaderSystem?.availableBootloaders || [];
  const bootloader = configModel.getBootloader(config);

  const bootloaderExplanation = (): string => {
    if (available.length === 0) return t("This machine reports no boot loader to choose between.");

    const entry = available.find((candidate) => candidate.type === bootloader);
    if (entry?.encryptionAuth.includes("tpm"))
      return t("This one can unlock an encrypted system with the TPM.");

    return t("An encrypted system asks for its password while starting.");
  };

  const bootloaderRow: Setting = {
    key: "bootloader",
    icon: "deployed_code_update",
    term: <span id={BOOT_LOADER_LABEL_ID}>{t("Boot loader")}</span>,
    value:
      available.length > 0 ? (
        <BootLoaderMenu current={bootloader} available={available} onChoose={setBootloader} />
      ) : (
        t("Decided by the installer")
      ),
    explanation: bootloaderExplanation(),
  };

  const settings: Setting[] = settingsOf([
    {
      key: "mode",
      icon: "restart_alt",
      term: <span id={BOOT_MODE_LABEL_ID}>{t("Boot from")}</span>,
      value: (
        <BootModeMenu current={mode} canChoose={candidates.length > 0} onChoose={chooseMode} />
      ),
      explanation: modeExplanation(),
    },
    mode === "chosen" && {
      key: "disk",
      icon: "hard_drive",
      term: <span id={BOOT_DISK_LABEL_ID}>{t("Disk")}</span>,
      /* The way to the disk reads as part of the value, not as a line of its
         own: it is the same object the menu names, and a link under a control
         reads as something the control did. */
      value: (
        <Flex
          alignItems={{ default: "alignItemsCenter" }}
          gap={{ default: "gapSm" }}
          display={{ default: "inlineFlex" }}
        >
          <BootDiskMenu
            current={bootDeviceName}
            devices={candidates}
            onChoose={(name) => setBootDevice(name)}
          />
          {bootDeviceLink}
        </Flex>
      ),
      explanation: bootDeviceName
        ? undefined
        : t("No disk is selected, so nothing is set up for booting."),
    },
    /* With nothing set up to boot, which boot loader would have been installed
       is a choice about something that does not happen. */
    mode !== "off" && bootloaderRow,
  ]);

  return (
    <div className={`agm-plan-split agm-plan-split-${settingsPlacement}`}>
      <SettingsList settings={settings} layout="stacked" />
      {mode === "off" && (
        <Alert
          variant="danger"
          isInline
          title={t("The new system may not start")}
          className="agm-plan-boot-notice"
        >
          {t(
            "Nothing is set up for booting. Choose this only when you install a boot loader yourself.",
          )}
        </Alert>
      )}
      {/* The page carries the same notice, and this one says what it costs
          here: with no layout worked out, what booting takes is unknown rather
          than nothing. */}
      {mode !== "off" && !proposal && (
        <Alert
          variant="danger"
          isInline
          title={t("What booting takes is unknown")}
          className="agm-plan-boot-notice"
        >
          {t(
            "The installer could not work out a layout for this configuration, so it has not decided any partition to boot yet.",
          )}
        </Alert>
      )}
    </div>
  );
};

const GROUP_TITLES: Record<Collection, string> = {
  volumeGroups: "Volume groups",
  mdRaids: "RAID devices",
  drives: "Disks",
};

const DeviceList = ({
  rows,
  selectedId,
  onSelect,
  onCrossToPanel,
  unconfigured,
  mountPaths,
  showsAdd = true,
  withMenus = false,
}: {
  rows: Selection[];
  selectedId: string | null;
  onSelect: (selection: Selection) => void;
  onCrossToPanel: () => void;
  unconfigured: Storage.Device[];
  mountPaths: string[];
  /** Off where the page closes with an add control of its own. */
  showsAdd?: boolean;
  /** On where the list is the page rather than a column beside the panel. */
  withMenus?: boolean;
}) => {
  const { offers, rowActions } = useVariants();
  const isWide = useMedia(XL);
  const refs = useRef<(HTMLAnchorElement | null)[]>([]);
  /* Above xl the panel is on screen and holds the device actions, so a copy of
   * them on every row is a second route to the same place and a column that is
   * empty of anything worth a header. Where the list is the page itself there
   * is no panel to hold them, and acting on a device without opening it first
   * is the reason the menu exists. */
  const showsMenu = withMenus || rowActions === "always" || (rowActions === "narrow" && !isWide);

  const registerRef = useCallback((index: number, node: HTMLAnchorElement | null) => {
    refs.current[index] = node;
  }, []);

  /* Arrow keys move between rows without moving focus into the panel: arrowing
   * down a list of five disks while focus jumps away five times makes the list
   * unusable. Crossing into the panel is its own key. */
  const onKeyDown = (event: React.KeyboardEvent) => {
    const nodes = refs.current.filter(Boolean);
    const at = nodes.indexOf(document.activeElement as HTMLAnchorElement);
    if (at === -1) return;

    const focusAt = (next: number) => {
      event.preventDefault();
      nodes[Math.max(0, Math.min(next, nodes.length - 1))]?.focus();
    };

    switch (event.key) {
      case "ArrowDown":
        return focusAt(at + 1);
      case "ArrowUp":
        return focusAt(at - 1);
      case "Home":
        return focusAt(0);
      case "End":
        return focusAt(nodes.length - 1);
      case "ArrowRight":
        event.preventDefault();
        return onCrossToPanel();
      default:
        return undefined;
    }
  };

  const groups = (["volumeGroups", "mdRaids", "drives"] as Collection[])
    .map((collection) => ({
      collection,
      members: rows.filter((row) => row.collection === collection),
    }))
    .filter((group) => group.members.length > 0);

  let position = -1;

  return (
    <div className="agm-plan-list" id={LIST_ID} onKeyDown={onKeyDown}>
      {groups.length > 0 && (
        <table className="agm-plan-table agm-plan-devices" aria-label={t("Configured devices")}>
          <thead className="agm-plan-sr-only">
            <tr>
              <th scope="col">{t(COLUMN_LABELS.device)}</th>
              <th scope="col">{t(COLUMN_LABELS.content)}</th>
              <th scope="col">{t(COLUMN_LABELS.changes)}</th>
              {showsMenu && (
                <th scope="col">
                  <Text srOnly>{t("Actions")}</Text>
                </th>
              )}
            </tr>
          </thead>
          {/* One body per kind, each headed by a row that names the group.
              `rowgroup` scope is what ties the rows under it to that name for a
              screen reader, which a styled heading outside the table cannot. */}
          {groups.map((group) => (
            <tbody key={group.collection}>
              <tr className="agm-plan-group-row">
                <th scope="rowgroup" colSpan={showsMenu ? 4 : 3}>
                  {t(GROUP_TITLES[group.collection])}
                </th>
              </tr>
              {group.members.map((selection) => {
                position += 1;
                return (
                  <DeviceRow
                    key={idOf(selection)}
                    selection={selection}
                    isSelected={selectedId === idOf(selection)}
                    onSelect={onSelect}
                    registerRef={registerRef}
                    position={position}
                    showsMenu={showsMenu}
                  />
                );
              })}
            </tbody>
          ))}
        </table>
      )}

      {/* Offers answer "I have nothing and do not know what good looks like".
          Once anything is configured that question is answered, and a card per
          spare device outweighs the list it is appended to. */}
      {offers && rows.length === 0 && unconfigured.length > 0 && (
        <section aria-labelledby="agm-plan-offers">
          <h2 className="agm-plan-offers-title" id="agm-plan-offers">
            {t("Nothing is configured yet. These devices can hold the new system.")}
          </h2>
          <ul className="agm-plan-offers">
            {unconfigured.map((device) => (
              <DeviceOffer key={device.sid} device={device} mountPaths={mountPaths} />
            ))}
          </ul>
        </section>
      )}

      {showsAdd && <AddDeviceActions />}
    </div>
  );
};

/* ------------------------------------------------------------------ *
 * The panel header for whatever is selected
 * ------------------------------------------------------------------ */

const PartitionableHeader = ({
  collection,
  index,
  onClose,
}: {
  collection: PartitionableCollection;
  index: number;
  onClose: () => void;
}) => {
  const config = useConfigModel();
  const device = config[collection]?.[index] as Partitionable | undefined;
  const systemDevice = useDevice(device?.name || "");
  const boots = bootRoleOf(config, device?.name || "") !== "none";

  if (!device) return null;

  return (
    <PanelHeader
      title={baseName(device.name)}
      description={partitionableDescription(systemDevice)}
      marks={boots ? [t("Boot device")] : []}
      path={systemDevice?.block?.udevPaths?.[0]}
      onClose={onClose}
      /* Identity and its menu. Swapping the target used to sit here as a
         button, which reads as the first thing to do on a panel opened to read
         something else; it is offered under the table it changes instead. */
      actions={<PartitionableActions collection={collection} index={index} opensDevice={false} />}
    />
  );
};

const VolumeGroupHeader = ({ index, onClose }: { index: number; onClose: () => void }) => {
  const config = useConfigModel();
  const group = config.volumeGroups?.[index];
  const systemDevice = useDevice(group?.name || "");

  if (!group) return null;

  return (
    <PanelHeader
      title={group.vgName}
      description={volumeGroupDescription()}
      path={systemDevice?.name || `/dev/${group.vgName}`}
      onClose={onClose}
      actions={<VolumeGroupActions index={index} />}
    />
  );
};

/**
 * Split by device class on purpose. Both branches call hooks, and one component
 * switching between them renders a different number of hooks depending on what
 * is selected, which is the crash the earlier pass hit repeatedly.
 */
const SelectionHeader = ({ selection, onClose }: { selection: Selection; onClose: () => void }) =>
  selection.collection === "volumeGroups" ? (
    <VolumeGroupHeader index={selection.index} onClose={onClose} />
  ) : (
    <PartitionableHeader
      collection={selection.collection}
      index={selection.index}
      onClose={onClose}
    />
  );

/**
 * The two decisions about no device in particular.
 *
 * Read as values with a way in, the way the sheet reads a setting: the label
 * is the term and the control is the value, so "Boot Automatic" says what is
 * true and is itself the way to change it.
 */
const PlanSettings = ({
  onShowBoot,
  onShowEncryption,
  isCompact = false,
}: {
  onShowBoot: () => void;
  onShowEncryption: () => void;
  /* A strip has no room for two terms and two values, and folding them into the
     menu beside them buries a value the reader is meant to be able to read. */
  isCompact?: boolean;
}) => {
  const config = useConfigModel();
  const mode = bootModeOf(config);
  const bootDevice = configModel.boot.findDevice(config);

  const boot = () => {
    if (mode === "off") return t("Not configured");
    if (mode === "auto") return t("Automatic");
    return bootDevice?.name ? baseName(bootDevice.name) : t("No disk selected");
  };

  /* The mark says what the value says, so the pair can be recognised before it
     is read: a lock that is open is not encrypted, and a decision the reader
     made by hand is not the automatic one. */
  const bootIcon: React.ComponentProps<typeof Icon>["name"] = (() => {
    if (mode === "off") return "block";
    if (mode === "auto") return "rotate_auto";
    /* The same turning arrow without the A: a decision of the same kind, made
       by hand rather than by the installer. */
    return "settings_backup_restore";
  })();
  const isEncrypted = config.encryption !== undefined;
  const encryption = t(installationEncryption(config));

  /* A mark, the term, and the value as the way in. Read far more often than
     they are changed, so they are set as values rather than as controls: a
     button's edge round each gives two settings nobody touches the presence of
     an action, which is what the row of buttons under the summary is for.

     At xs, since they sit on the page's own line rather than in what it
     reports, and that line is furniture. */
  const setting = (
    term: string,
    value: string,
    icon: React.ComponentProps<typeof Icon>["name"],
    onClick: () => void,
  ) => {
    if (isCompact) {
      /* In a strip the mark is all there is room for, so the pair it stands for
         is the button's name and its tooltip both: nothing is carried by the
         picture alone. */
      return (
        <Tooltip content={t(`${term}: ${value}`)}>
          <Button
            variant="plain"
            size="sm"
            aria-label={t(`${term}: ${value}`)}
            icon={<Icon name={icon} size="sm" />}
            onClick={onClick}
          />
        </Tooltip>
      );
    }

    return (
      <Flex
        alignItems={{ default: "alignItemsCenter" }}
        gap={{ default: "gapXs" }}
        flexWrap={{ default: "nowrap" }}
      >
        {/* The mark sits on the middle of the line rather than on its baseline:
            beside a word it is a picture of that word, not a letter of it. */}
        <FlexItem>
          <Icon name={icon} size="xs" verticalAlign="middle" />
        </FlexItem>
        <FlexItem>
          <Text textStyle="fontSizeXs">
            <span className="agm-plan-muted">{term}</span>{" "}
            <Button variant="link" isInline onClick={onClick}>
              {value}
            </Button>
          </Text>
        </FlexItem>
      </Flex>
    );
  };

  return (
    <Flex
      alignItems={{ default: "alignItemsCenter" }}
      gap={{ default: "gapMd" }}
      flexWrap={{ default: "nowrap" }}
    >
      <FlexItem>{setting(t("Boot"), boot(), bootIcon, onShowBoot)}</FlexItem>
      <FlexItem>
        {setting(t("Encryption"), encryption, isEncrypted ? "lock" : "lock_open", onShowEncryption)}
      </FlexItem>
    </Flex>
  );
};

/* ------------------------------------------------------------------ *
 * The page, when the plan is one entry
 *
 * State A of the main page: what is being installed and where, read as a
 * sentence, with what it costs under it and two ways on. The device sheet does
 * the work; this reports and routes.
 *
 * A plan of more than one entry falls back to the device list until the index
 * exists, so nothing about the list changes while this is being looked at.
 * ------------------------------------------------------------------ */

/**
 * A device named inside a sentence: what it is called, and how big it is.
 *
 * The name is set as a value and the size follows it in brackets, both smaller
 * and lighter than the sentence around them. At the heading's own weight a
 * monospaced name reads as something to press; smaller and at body weight it
 * reads as what it is, a value quoted inside the words about it, without a
 * border or a colour doing the work.
 *
 * One node rather than two placeholders, since the brackets are punctuation
 * around a value rather than part of the sentence, and a translator has no
 * decision to make about them.
 */
const DeviceValue = ({ name, size }: { name: string; size?: number }) => (
  <>
    <code className="agm-plan-headline-device">{name}</code>
    {size !== undefined && <span className="agm-plan-headline-size"> ({deviceSize(size)})</span>}
  </>
);

/** A name the page sets apart without a size beside it: a volume group's, say. */
const NameValue = ({ children }: React.PropsWithChildren) => (
  <code className="agm-plan-headline-device">{children}</code>
);

/**
 * The worst thing the plan does, named, and how much work it is part of.
 *
 * A count on its own answers "how much" and leaves the reader to open the sheet
 * to learn whether any of it matters. Naming the worst act in front of the count
 * answers the question they actually have, in one clause, without becoming the
 * paragraph of consequences this line replaced.
 *
 * Deliberately not a summary. Where a plan both deletes and shrinks, only the
 * deletion is named: the sheet holds the rest, and the list below reads both
 * per device. What this line promises is the worst of it and the size of it,
 * not all of it.
 *
 * The threshold is the page's own: two systems are named, three are counted,
 * and partitions are counted where the machine reports no system on them.
 */
const destructionOf = (manager: DevicesManager): { text: string; kind: CostKind } | null => {
  /* A name always survives, however many there are: "3 existing systems" tells
     a reader with Windows on the disk nothing they can recognise, and
     recognising it is the whole reason the line names anything. Past two, the
     first is named and the rest are counted. */
  const named = (systems: string[]): string => {
    if (systems.length === 1) return systems[0];
    if (systems.length === 2) return t(`${systems[0]} and ${systems[1]}`);

    const rest = systems.length - 1;
    return t(`${systems[0]} and ${rest} other ${rest === 1 ? "system" : "systems"}`);
  };

  const counted = (count: number): string =>
    t(`${count} ${count === 1 ? "partition" : "partitions"}`);

  const deletedSystems = unique(manager.deletedSystems());
  const deleted = manager.deletedDevices().length;
  if (deletedSystems.length)
    return { text: t(`Deleting ${named(deletedSystems)}`), kind: "destroys" };
  if (deleted) return { text: t(`Deleting ${counted(deleted)}`), kind: "destroys" };

  const resizedSystems = unique(manager.resizedSystems());
  const resized = manager.resizedDevices().length;
  if (resizedSystems.length)
    return { text: t(`Shrinking ${named(resizedSystems)}`), kind: "shrinks" };
  if (resized) return { text: t(`Shrinking ${counted(resized)}`), kind: "shrinks" };

  return null;
};

/**
 * What the plan costs, and the way to the whole of it: two statements, one line.
 *
 * These answer two different questions, and for a while they were one control.
 * "Deleting Windows 11 as part of the 5 needed actions" made the risk itself
 * the thing to press, which asked one element to serve two goals at once:
 * understanding what the installation destroys, and inspecting what it will do
 * step by step. A reader has the first question whether or not they ever have
 * the second.
 *
 * So the risk is a statement and the inspection is a link. The statement ends
 * with a full stop, carries the colour, and cannot be pressed. The link is
 * named after where it goes.
 *
 * Three things follow from the split, each of which was wrong before it:
 *
 *   - The colour belongs to the loss rather than to the control. A link that
 *     changes appearance with what the plan happens to do is a link the reader
 *     has to identify twice, and its danger was never its own: it opens a list.
 *   - The link has a name that stands alone. Listed among the page's links, it
 *     used to read as a report of what the plan destroys, which is not a name
 *     for anywhere to go.
 *   - Nothing depends on seeing red. The words say what is deleted, so the
 *     colour is reinforcement and the screen reader clause that stood in for it
 *     is no longer needed.
 *
 * One line either way: two sentences of running text, not two blocks.
 *
 * Subvolume actions are left out of the count, the way the list itself folds
 * them away: they are the file system's business rather than the machine's, and
 * counting them turns five into ninety.
 */
const PlanCount = ({ onShowResult }: { onShowResult: () => void }) => {
  const system = useFlattenDevices();
  const staging = useStagingDevices();
  const actions = useActions();
  const counted = actions.filter((action) => !action.subvol);

  if (!counted.length) return null;

  const manager = new DevicesManager(system, staging, actions);
  const destruction = destructionOf(manager);
  const total = counted.length;

  return (
    <>
      {/* The report, ended. It is a statement about the machine and nothing
          the reader can press, and the colour belongs to it alone: what is
          coloured is what is lost. */}
      {destruction && (
        <span className={COST_CLASS[destruction.kind]}>{t(`${destruction.text}.`)} </span>
      )}
      {/* The offer, always the same. A link that looks different depending on
          what the plan happens to do is a link the reader has to identify
          twice, and its danger was never its own: it opens a list. */}
      <Button variant="link" isInline aria-controls={PANEL_ID} onClick={onShowResult}>
        {t(`View all ${total} needed ${total === 1 ? "action" : "actions"}`)}
      </Button>
    </>
  );
};

/**
 * How every state of this page opens: a sentence, how much it costs, and the
 * way on.
 *
 * A plain centred column rather than PatternFly's `EmptyState`. The empty state
 * is an arrangement for a page with nothing on it, and it says so with
 * everything it does: a mark over the heading, the measure it bounds the body
 * to, the room it keeps around a page that has nothing to fill it. This page
 * has content, and borrowing that arrangement made it read as though it did
 * not.
 *
 * What is kept is what the arrangement was for: one column, centred, bounded to
 * a readable measure, with the sentence first and the actions last.
 */
const PlanHeadline = ({
  title,
  isNarrow = false,
  body,
  control,
  notice,
  isTight = false,
  count,
  primary,
  secondary,
}: {
  /** The sentence the page opens with, and whatever in it is a control. */
  title: React.ReactNode;
  /** Read in a strip beside the sheet rather than across the page. */
  isNarrow?: boolean;
  /** A line about what the reader does next, where the page has more to it. */
  body?: React.ReactNode;
  /** A decision offered where its consequence is read. */
  control?: React.ReactNode;
  /** What is wrong, where something is: it replaces what the page would have
      reported, since a page that cannot work out a layout has no cost to
      report and should not print one. */
  notice?: React.ReactNode;
  /** Closes against what follows it, where the page continues under it. */
  isTight?: boolean;
  /** How much the installer will do, and the way into the whole picture. */
  count?: React.ReactNode;
  /** The one action the page is for. */
  primary?: React.ReactNode;
  /** Everything else, read after it on the same row. */
  secondary?: React.ReactNode;
}) => {
  return (
    <Flex
      direction={{ default: "column" }}
      alignItems={{ default: isNarrow ? "alignItemsStretch" : "alignItemsCenter" }}
      gap={{ default: "gapMd" }}
      className={["agm-plan-headline", isTight ? "agm-plan-headline-tight" : ""]
        .filter(Boolean)
        .join(" ")}
    >
      {/* What the page reports, as one block, with the room kept for what
          follows it rather than spent inside it.

          How much room depends on what the block holds. Consecutive sentences
          about one plan are set close, or they read as three separate
          announcements. A control among them is not a sentence: at the spacing
          of prose it reads as a line of the prose, and the things above and
          below it crowd against its edges. */}
      <FlexItem>
        <Flex
          direction={{ default: "column" }}
          alignItems={{ default: isNarrow ? "alignItemsStretch" : "alignItemsCenter" }}
          gap={{ default: control ? "gapMd" : "gapXs" }}
        >
          <FlexItem className="agm-plan-headline-measure">
            <Title
              headingLevel="h2"
              size={isNarrow ? "lg" : "xl"}
              className="agm-plan-headline-title"
            >
              {title}
            </Title>
          </FlexItem>
          {/* Above the consequence it changes, so the reader sees what it did. */}
          {control && <FlexItem>{control}</FlexItem>}
          {notice && (
            <FlexItem className="agm-plan-summary-notice agm-plan-headline-measure">
              {notice}
            </FlexItem>
          )}
          {/* Under the sentence, and above the line explaining what to do next:
              what the plan costs is the second thing the reader wants, and an
              instruction about the list below is the last. */}
          {!notice && count && <FlexItem className="agm-plan-headline-measure">{count}</FlexItem>}
          {/* A line about what to do with what follows, not a second heading:
              smaller and lighter than everything above it, so the three are
              read in the order they matter. */}
          {body && (
            <FlexItem className="agm-plan-headline-measure">
              <Content component="p" className="agm-plan-headline-body">
                <Text textStyle={["fontSizeXs", "textColorSubtle"]}>{body}</Text>
              </Content>
            </FlexItem>
          )}
        </Flex>
      </FlexItem>
      {(primary || secondary) && (
        <>
          {/* A short rule, centred: what is above it is the page reporting,
              what is below it is what the reader can do about it. Run the
              width of the text it follows, it would divide the page rather
              than close a paragraph of it. */}
          <FlexItem className="agm-plan-headline-rule">
            <Divider />
          </FlexItem>
          <FlexItem>
            {/* Centred on the line rather than at its top: the three are
                buttons of different heights, and a menu toggle sitting a few
                pixels above the buttons beside it reads as a fourth row. */}
            <Flex
              gap={{ default: "gapSm" }}
              alignItems={{ default: "alignItemsCenter" }}
              justifyContent={{ default: "justifyContentCenter" }}
              flexWrap={{ default: "wrap" }}
            >
              {primary}
              {secondary}
            </Flex>
          </FlexItem>
        </>
      )}
    </Flex>
  );
};

/**
 * Why there is no plan, said about this device.
 *
 * The backend reports that it could not work one out and not why, so the page
 * says what it can see for itself: what the disk is, what the decision about
 * its content is, and which decision would change the answer. "No valid
 * layout" tells a reader nothing they can act on; "everything on vdd is being
 * kept, so there is nowhere to put the new system" tells them what to press.
 *
 * Anything it cannot explain falls back to what the page reports elsewhere.
 */
const DeviceNotice = ({
  device,
  systemDevice,
  fallback,
}: {
  device: Partitionable;
  systemDevice: Storage.Device | null;
  fallback: React.ReactNode;
}) => {
  const name = baseName(device.name);
  const policy = device.spacePolicy || "keep";
  const partitions = systemDevice?.partitions || [];
  const free = (systemDevice?.partitionTable?.unusedSlots || []).reduce(
    (total, slot) => total + slot.size,
    0,
  );

  /* The case the reader lands in most: a disk with something on it, and a plan
     that is not allowed to touch any of it. */
  if (policy === "keep" && partitions.length > 0) {
    return (
      <Alert
        variant="danger"
        isInline
        title={t(`There is not enough room on ${name} for the new system`)}
      >
        {t(
          `Everything on ${name} is being kept, and what is left over is not enough. Allow the installer to shrink or delete what is there, or install on another device.`,
        )}
      </Alert>
    );
  }

  if (partitions.length === 0 && free === 0) {
    return (
      <Alert variant="danger" isInline title={t(`${name} is too small for the new system`)}>
        {t("Install on another device, or add one to the plan.")}
      </Alert>
    );
  }

  return <>{fallback}</>;
};

/**
 * The one entry page.
 *
 * A sentence, what it costs, and two ways on: into the sheet, or onto another
 * device. Everything else about the plan is read in the bar under it.
 */
const PlanSummary = ({
  collection,
  index,
  isNarrow,
  onOpenTab,
  onShowResult,
}: {
  collection: PartitionableCollection;
  index: number;
  /** Read in a strip beside the sheet rather than across the page. */
  isNarrow: boolean;
  /** Opens the sheet, on the half the reader asked about. */
  onOpenTab: (tab: PanelTab) => void;
  /** Opens the whole picture: what the installer does, and what it leaves. */
  onShowResult: () => void;
}) => {
  const config = useConfigModel();
  const device = config[collection]?.[index] as Partitionable | undefined;
  const systemDevice = useDevice(device?.name || "");
  const { summarySpace, wayIn } = useVariants();
  const space = useSpacePolicy(collection, index, device?.spacePolicy || "keep");
  const notice = usePlanNotice();

  if (!device) return null;

  const name = baseName(device.name);
  /* What the device is for, rather than what is being done to it: a disk that
     also starts the machine is carrying two jobs, and which disk boots is a
     fact the reader would otherwise have to open the sheet to learn. */
  const boots = bootRoleOf(config, device.name) !== "none";

  /* What the device is and how big it is belong in the sentence about it, not
     on a second line under it. Everything else the reader might want, the
     by-path name and the partition table, is in the sheet's header, one click
     away and where a reader who wants it goes.

     What kind of device it is stays in the sentence rather than becoming a
     placeholder of its own: an article and a noun agree in most languages, and
     a slot that takes either "disk" or "RAID" leaves a translator with no way
     to make them. */
  const sentence = (() => {
    if (collection === "mdRaids") {
      return boots
        ? t("Use RAID %s as installation and boot device")
        : t("Use RAID %s as installation device");
    }
    return boots
      ? t("Use disk %s as installation and boot device")
      : t("Use disk %s as installation device");
  })();

  /* Two ways into the device sheet, one switch apart.

     As a button, the sentence is read and never pressed, and what the reader
     does about the device is offered under it with everything else. As the
     name, the page carries one button fewer and the way in is the thing the
     sheet is about, which is where a reader looks for it: the disk is what
     they came to open. Against it, a name that is also a control asks to be
     recognised as one, and nothing else in the sentence is pressable. */
  const openable = (named: React.ReactNode) =>
    wayIn === "name" ? (
      <Button variant="link" isInline aria-controls={PANEL_ID} onClick={() => onOpenTab("result")}>
        {named}
      </Button>
    ) : (
      named
    );

  return (
    <PlanHeadline
      isNarrow={isNarrow}
      title={
        <Interpolate sentence={sentence}>
          {() => openable(<DeviceValue name={name} size={systemDevice?.block?.size} />)}
        </Interpolate>
      }
      control={
        summarySpace === "shown" && (systemDevice?.partitions || []).length > 0 ? (
          <SummarySpaceDecision
            isNarrow={isNarrow}
            current={space.policy}
            onChoose={(policy) => {
              space.choose(policy);
              /* Custom is not a value, it is the rest of the decision: it says
                 that what happens to each partition is settled one by one, and
                 the place that is settled is the sheet. */
              if (policy === "custom") onOpenTab("current");
            }}
          />
        ) : undefined
      }
      count={<PlanCount onShowResult={onShowResult} />}
      notice={
        notice && <DeviceNotice device={device} systemDevice={systemDevice} fallback={notice} />
      }
      primary={
        wayIn === "button" ? (
          /* Named after the device it opens, and with the verb the rest of the
             interface already uses for reaching a working surface: Configure
             iSCSI, Configure zFCP, Configure DASD.

             Not "details": the count beside it opens details too, and the word
             says nothing about which of the two a reader is about to get. What
             tells them apart is scope, so the label carries the scope.

             Whether the button teaches the same gesture as a row in a plan of
             several entries is not something a caption can fix, and it is what
             the other arrangement is for: there the device named in the
             sentence is itself the way in, which is the row's act exactly. */
          <Button variant="primary" aria-controls={PANEL_ID} onClick={() => onOpenTab("result")}>
            {t(`Configure ${name}`)}
          </Button>
        ) : undefined
      }
      secondary={
        <>
          {/* First, and the heaviest thing on the row. The page has just named
              one disk and said what it will hold, so the question it raises is
              about that disk: whether it is the right one. Changing it is the
              act that answers the sentence above; adding another device is a
              different plan, offered beside it. */}
          <RetargetButton device={device} label={t("Use another device")} variant="primary" />
          {/* Plain beside it, and last, which is where a plan of several
              entries keeps the same offer: at the end of what it appends to. */}
          <ConfigureDeviceMenu
            label={t("Add more devices")}
            /* Aligned on the toggle's trailing edge, since the toggle now ends
               the row: the menu grows back over the page rather than off it. */
            popperProps={{ position: "right" }}
          />
        </>
      }
    />
  );
};

/* ------------------------------------------------------------------ *
 * The page, when the plan is more than one entry
 *
 * State D: the same summary, and under it an index of what the plan is made
 * of. The shape is added rather than swapped, so a reader who learned the page
 * with one disk recognises it with eight.
 * ------------------------------------------------------------------ */

/**
 * The simplest true thing the page can say about a whole plan.
 *
 * "Across multiple devices" is what the page said about every plan of more than
 * one entry, and it was wrong about the most common non-trivial installation
 * there is: one disk, one volume group on it. The machine holds one device, and
 * a sentence claiming several is a sentence the reader can see is false.
 *
 * Two rules decide how far it goes. A name is worth more than a count until
 * there are three of them, which is the threshold the rest of the page already
 * uses. And the sentence never lists two kinds of thing at once: the moment
 * groups sit over more than one disk, naming both halves produces a sentence
 * with two lists in it, and the list under it is a better list than any
 * sentence can be.
 *
 * Past what it can say in one line it stops trying and says what is being done
 * instead, leaving the naming to the entries below.
 */
const PlanTitle = () => {
  const config = useConfigModel();
  const system = useFlattenDevices();
  const drives = config.drives || [];
  const mdRaids = config.mdRaids || [];
  const groups = config.volumeGroups || [];
  const hosts = [...drives, ...mdRaids] as Partitionable[];

  const host = (device: Partitionable) => (
    <DeviceValue
      name={baseName(device.name)}
      size={system.find((candidate) => candidate.name === device.name)?.block?.size}
    />
  );

  /* One disk with groups over it: the shape the page was worst at, and the one
     most readers arrive with. */
  if (hosts.length === 1 && groups.length > 0) {
    const onDisk = drives.length === 1;
    const named = groups.map((group) => group.vgName).filter(Boolean);

    if (groups.length === 1 && named.length === 1) {
      return (
        <Interpolate
          sentence={
            onDisk
              ? t("Create LVM volume group %1$s on disk %2$s")
              : t("Create LVM volume group %1$s on RAID %2$s")
          }
        >
          {[() => <NameValue>{named[0]}</NameValue>, () => host(hosts[0])]}
        </Interpolate>
      );
    }

    if (groups.length === 2 && named.length === 2) {
      return (
        <Interpolate
          sentence={
            onDisk
              ? t("Create LVM volume groups %1$s and %2$s on disk %3$s")
              : t("Create LVM volume groups %1$s and %2$s on RAID %3$s")
          }
        >
          {[
            () => <NameValue>{named[0]}</NameValue>,
            () => <NameValue>{named[1]}</NameValue>,
            () => host(hosts[0]),
          ]}
        </Interpolate>
      );
    }

    return (
      <Interpolate
        sentence={
          onDisk
            ? t("Create %1$s LVM volume groups on disk %2$s")
            : t("Create %1$s LVM volume groups on RAID %2$s")
        }
      >
        {[() => <>{groups.length}</>, () => host(hosts[0])]}
      </Interpolate>
    );
  }

  /* Several disks, whatever is over them. Counting the disks is the one thing
     the sentence can add that the list below does not already say per row. */
  if (hosts.length > 1 && mdRaids.length === 0) {
    return (
      <Interpolate sentence={t("Set up the new system across %s disks")}>
        {() => <>{hosts.length}</>}
      </Interpolate>
    );
  }

  return <>{t("Set up the new system across multiple devices")}</>;
};

/**
 * The page a plan of more than one entry gets.
 *
 * The summary stays where it was and the list appears under it. What changes
 * with the second entry is what the summary is about: the plan rather than a
 * device, since no single device speaks for it any more.
 *
 * The list is the one the page already had, menus and all: a reader with five
 * devices wants to act on one of them without opening it first, and that list
 * is where those actions live.
 */
const PlanOverview = ({
  rows,
  isNarrow,
  selectedId,
  onOpen,
  onCrossToPanel,
  unconfigured,
  onShowResult,
}: {
  rows: Selection[];
  /** Read in a strip beside the sheet rather than across the page. */
  isNarrow: boolean;
  selectedId: string | null;
  onOpen: (selection: Selection) => void;
  onCrossToPanel: () => void;
  unconfigured: Storage.Device[];
  /** Opens the whole picture: what the installer does, and what it leaves. */
  onShowResult: () => void;
}) => {
  const notice = usePlanNotice();

  /* A flex column rather than a stack: PatternFly's Stack is full height, and
     a full height block in a scrolling page leaves the footer under a screen of
     nothing. */
  return (
    <Flex direction={{ default: "column" }} gap={{ default: "gapSm" }}>
      <FlexItem>
        <PlanHeadline
          isNarrow={isNarrow}
          /* Names what naming helps and counts the rest: the list under it
             names every entry, and a sentence is not a list. */
          title={<PlanTitle />}
          isTight
          /* What to do next, said where the reader is looking, rather than as a
             paragraph over the list explaining what a list of devices is. */
          /* Whole sentences, and the control after them rather than inside
             them: a phrase split around a button cannot be translated, since
             the order of its halves belongs to the language. */
          body={t(
            "Review and configure the entries below. You can change, remove, or add entries as needed.",
          )}

          /* The same way in as the one device page offers, in the same place
             and the same words: a page that shows the big picture on a full
             disk and hides it on a plan of eight is a page with two shapes. */
          count={<PlanCount onShowResult={onShowResult} />}
          notice={notice}
        />
      </FlexItem>
      <FlexItem>
        <DeviceList
          rows={rows}
          selectedId={selectedId}
          onSelect={onOpen}
          onCrossToPanel={onCrossToPanel}
          unconfigured={unconfigured}
          mountPaths={["/"]}
          showsAdd={false}
          withMenus
        />
      </FlexItem>
      {/* After the list, because it adds to the list: a control that appends
          belongs at the end of what it appends to, and above it the control
          stands between the sentence and the entries that sentence is about.

          At the foot of the page it opens upwards, since what is under it is
          the edge of the window, and from its leading edge, since the toggle
          sits at the start of the line and a menu aligned on its other edge
          grows off the page. */}
      <FlexItem>
        <ConfigureDeviceMenu
          label={t("Add more devices")}
          popperProps={{ position: "left", direction: "up" }}
        />
      </FlexItem>
    </Flex>
  );
};

/* ------------------------------------------------------------------ *
 * The switches, on screen
 *
 * Every variant this file offers, in one place, so a round can be walked
 * through without the console. The console keeps working: both write the same
 * state, and the panel shows what the console last set.
 * ------------------------------------------------------------------ */

type VariantControl<K extends keyof Variants = keyof Variants> = {
  key: K;
  label: string;
  options: Variants[K][];
};

const VARIANT_CONTROLS: VariantControl[] = [
  { key: "panelMode", label: "Drawer", options: ["aside", "over", "inline"] },
  {
    key: "data",
    label: "Machine",
    options: ["real", "one-disk-in-use", "alongside-windows", "empty-disk", "lvm-over-three-disks"],
  },
  { key: "page", label: "Page", options: ["summary", "list"] },
  { key: "summarySpace", label: "Space on summary", options: ["shown", "hidden"] },
  { key: "spaceShape", label: "Space shape", options: ["value", "toggles"] },
  { key: "wayIn", label: "Way into the sheet", options: ["name", "button"] },
  { key: "structure", label: "Panel structure", options: ["blocks", "flat"] },
  { key: "sections", label: "Panel halves", options: ["tabs", "stacked"] },
  { key: "settings", label: "Settings", options: ["beside", "above"] },
  { key: "tabLayout", label: "Tab strip", options: ["horizontal", "vertical"] },
  { key: "tabNote", label: "Tab explanation", options: ["statement", "dimmed"] },
  { key: "tabSummary", label: "Phrase under tab", options: [false, true] },
  { key: "tabBox", label: "Boxed tabs", options: [false, true] },
  { key: "tabFill", label: "Filled tabs", options: [false, true] },
  { key: "spacePlacement", label: "Space decision", options: ["content", "settings"] },
  { key: "spaceControl", label: "Space control", options: ["segmented", "menu"] },
  { key: "spaceLabel", label: "Space label", options: ["terse", "plain"] },
  { key: "explanations", label: "Explanations", options: ["always", "sparse"] },
  {
    key: "relationIcon",
    label: "Relationship mark",
    options: ["network_node", "device_hub", "graph_3", "graph_4", "apps"],
  },
  { key: "statementRule", label: "Statement rules", options: ["all", "between", "none"] },
  { key: "deviceRow", label: "Device row", options: ["hidden", "shown"] },
  { key: "rowNote", label: "Second lines", options: ["plain", "outlined"] },
  { key: "noteColor", label: "Second line colour", options: ["none", "status"] },
  { key: "cost", label: "Cost", options: ["text", "chips"] },
  { key: "density", label: "Rows", options: ["comfortable", "compact"] },
  { key: "rowActions", label: "Row actions", options: ["narrow", "panel", "always"] },
  { key: "mountPaths", label: "Mount paths", options: ["plain", "italic"] },
  { key: "typeScale", label: "Panel type", options: ["current", "quiet"] },
  { key: "gutter", label: "Gutter marks", options: [false, true] },
  { key: "offers", label: "Offers", options: [true, false] },
  { key: "scroll", label: "Scroll", options: ["sections", "body"] },
];

const optionLabel = (option: Variants[keyof Variants]): string => {
  if (option === true) return "on";
  if (option === false) return "off";
  return String(option);
};

/**
 * The switches as a panel of the page, minimised until it is wanted.
 *
 * It floats rather than taking a column: every variant it sets is about the
 * page under it, and a reader comparing two of them wants the page to stay
 * where it was between clicks.
 */
const PlanSettingsPanel = ({
  variants,
  onChange,
}: {
  variants: Variants;
  onChange: (next: Partial<Variants>) => void;
}) => {
  const [isOpen, setIsOpen] = useState(false);

  if (!isOpen) {
    return (
      <Button
        variant="secondary"
        className="agm-plan-switches-toggle"
        icon={<Icon name="settings_ethernet" size="xs" />}
        onClick={() => setIsOpen(true)}
      >
        {t("Variants")}
      </Button>
    );
  }

  return (
    <div className="agm-plan-switches" role="group" aria-label={t("Playground variants")}>
      <Flex
        alignItems={{ default: "alignItemsCenter" }}
        justifyContent={{ default: "justifyContentSpaceBetween" }}
        gap={{ default: "gapMd" }}
        className="agm-plan-switches-head"
      >
        <Text isBold>{t("Variants")}</Text>
        <Button
          variant="plain"
          aria-label={t("Hide the variants")}
          icon={<Icon name="close" size="xs" />}
          onClick={() => setIsOpen(false)}
        />
      </Flex>
      <div className="agm-plan-switches-body">
        {VARIANT_CONTROLS.map(({ key, label, options }) => (
          <Flex
            alignItems={{ default: "alignItemsCenter" }}
            justifyContent={{ default: "justifyContentSpaceBetween" }}
            gap={{ default: "gapMd" }}
            className="agm-plan-switch"
            key={key}
          >
            <span id={`agm-plan-switch-${key}`}>{t(label)}</span>
            <ToggleGroup aria-labelledby={`agm-plan-switch-${key}`}>
              {options.map((option) => (
                <ToggleGroupItem
                  key={optionLabel(option)}
                  text={t(optionLabel(option))}
                  isSelected={variants[key] === option}
                  onChange={() => onChange({ [key]: option } as Partial<Variants>)}
                />
              ))}
            </ToggleGroup>
          </Flex>
        ))}
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ *
 * The page
 * ------------------------------------------------------------------ */

/**
 * The page, reading whatever machine it has been pointed at.
 *
 * Split from the component that chooses one, since every read below has to run
 * inside the scenario rather than beside it.
 */
function StoragePlan({
  variants,
  patch,
}: {
  variants: Variants;
  patch: (next: Partial<Variants>) => void;
}): React.ReactNode {
  const config = useConfigModel();
  const actions = useActions();
  const availableDevices = useAvailableDevices();
  const announce = useAnnounce();
  const reset = useReset();
  const navigate = useNavigate();
  /* The panel comes over the list rather than sharing the width with it. At
     four fifths there is no share left to give: a list squeezed into the last
     fifth is neither readable nor worth keeping on screen, and the reader still
     has the row they picked behind the panel. */
  const isFloating = useMedia(LG);
  const panelRef = useRef<HTMLDivElement>(null);
  /* The page is measured through a callback ref rather than a plain one.
     Crossing the lg breakpoint moves the page between two parents, which builds
     it a new element; a ref object does not change when that happens, so the
     observer went on watching a node no longer in the document and reported the
     width it had when it left. Everything the page sizes by that width stayed
     small however wide the window went afterwards.

     Held as state, so the observer follows the element that exists. */
  const [pageNode, setPageNode] = useState<HTMLDivElement | null>(null);
  /* What the page can afford is a question about the page rather than about the
     window: an inline sheet takes its width out of the page, and the strip that
     is left is narrow however wide the screen is. */
  const isNarrow = useWidth(pageNode) < TIGHT;

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showsResult, setShowsResult] = useState(false);
  const [showsBoot, setShowsBoot] = useState(false);
  const [showsEncryption, setShowsEncryption] = useState(false);
  const [isPanelOpen, setIsPanelOpen] = useState(true);
  /* Which half of the sheet is open, held here so a line on the page can send
     the reader to the half it is talking about, and so that comparing two
     disks does not send them back to the other tab between them. */
  const [panelTab, setPanelTab] = useState<PanelTab>("result");
  /* Through a ref, so the console keeps working after a rerender without the
     whole api being rebuilt on every one of them. */
  const bootDebug = useBootDebug();
  const bootDebugRef = useRef(bootDebug);
  bootDebugRef.current = bootDebug;

  const hasPanelContent = showsResult || showsBoot || showsEncryption || selectedId !== null;
  /* Whatever is left of the page beside an open sheet is there to be read and
     not to be used: the sheet is what the reader is in. */
  const isCovered = variants.panelMode !== "inline" && isPanelOpen && hasPanelContent;

  /* Console driven, so the page itself stays screenshot clean. */
  useEffect(() => {
    const api: PlanApi = {
      help: () => {
        console.info(
          [
            "storagePlan",
            '  select("drives:0"|"boot"|"encryption"|null)  what the panel holds',
            "  panel(true | false)                open or close the panel",
            '  cost("text" | "chips")             text with a mark, or the old chips',
            '  sections("stacked" | "tabs")       how the panel arranges its halves',
            '  tabLayout("horizontal"|"vertical") the tab strip across the top, or down the side',
            '  tabNote("dimmed" | "statement")    the tab explanation on a tinted ground, or as one more statement',
            "  tabSummary(true | false)           a phrase under each tab name, or the name alone",
            "  tabBox(true | false)               each tab drawn as a box rather than as a label",
            "  tabFill(true | false)              the tabs share the width of the strip",
            '  scroll("body" | "sections")        one scroll container, or one per section',
            "  offers(true | false)               offers on a first visit",
            '  density("comfortable" | "compact") row height',
            '  rowActions("panel"|"narrow"|"always")  where the device menu lives',
            "  gutter(true | false)               small icons marking each setting",
            '  typeScale("current" | "quiet")     how much weight the panel type carries',
            '  mountPaths("plain" | "italic")     mount paths set apart, or not',
            '  spaceLabel("terse" | "plain")      "Allowed changes" or the longer phrase',
            '  spaceControl("menu" | "segmented") the space decision as one menu, or as four buttons',
            '  structure("blocks" | "flat")       the named blocks, or round ten\'s stack',
            '  spacePlacement("settings"|"content")  the space decision above its table, or in the settings',
            '  explanations("always" | "sparse")  a line under every setting, or only where it adds',
            '  settings("beside" | "above")       the settings in their own column, or over the content',
            '  relationIcon("network_node"|"device_hub"|"graph_3"|"graph_4"|"apps")  the mark on Uses and Used by',
            '  statementRule("between"|"all"|"none")  dashed rules between the statements above a tab',
            '  deviceRow("hidden" | "shown")      a row for the device itself at the top of the final layout',
            '  rowNote("plain" | "outlined")      the second line under a value as plain text, or boxed',
            '  noteColor("none" | "status")       those lines all subtle, or coloured by what they report',
            '  page("summary" | "list")           a one entry plan as a summary, or as the device list',
            '  summarySpace("shown" | "hidden")   the space decision on the one device page',
            '  spaceShape("value" | "toggles")    that decision as a term and its value, or as four buttons',
            '  wayIn("button" | "name")           the sheet opened by a button under the sentence, or by the device named in it',
            '  data("real"|"one-disk-in-use"|"alongside-windows"|"empty-disk"|"lvm-over-three-disks")  the machine the page reads',
            '  panelMode("aside"|"over"|"inline")  the page slides aside, stays put, or gives up its width',
            "  bootDebug()                        what the proposal reports about every partition",
          ].join("\n"),
        );
      },
      select: (id) => {
        setShowsResult(false);
        setShowsBoot(id === "boot");
        setShowsEncryption(id === "encryption");
        setSelectedId(id === "boot" || id === "encryption" ? null : id);
        if (id) setIsPanelOpen(true);
      },
      panel: (open) => setIsPanelOpen(open),
      cost: (cost) => patch({ cost }),
      sections: (sections) => patch({ sections }),
      tabLayout: (tabLayout) => patch({ tabLayout }),
      tabNote: (tabNote) => patch({ tabNote }),
      tabSummary: (tabSummary) => patch({ tabSummary }),
      tabBox: (tabBox) => patch({ tabBox }),
      tabFill: (tabFill) => patch({ tabFill }),
      scroll: (scroll) => patch({ scroll }),
      offers: (offers) => patch({ offers }),
      density: (density) => patch({ density }),
      rowActions: (rowActions) => patch({ rowActions }),
      gutter: (gutter) => patch({ gutter }),
      typeScale: (typeScale) => patch({ typeScale }),
      mountPaths: (mountPaths) => patch({ mountPaths }),
      spaceLabel: (spaceLabel) => patch({ spaceLabel }),
      spaceControl: (spaceControl) => patch({ spaceControl }),
      structure: (structure) => patch({ structure }),
      spacePlacement: (spacePlacement) => patch({ spacePlacement }),
      explanations: (explanations) => patch({ explanations }),
      settings: (settings) => patch({ settings }),
      relationIcon: (relationIcon) => patch({ relationIcon }),
      statementRule: (statementRule) => patch({ statementRule }),
      deviceRow: (deviceRow) => patch({ deviceRow }),
      rowNote: (rowNote) => patch({ rowNote }),
      noteColor: (noteColor) => patch({ noteColor }),
      page: (page) => patch({ page }),
      summarySpace: (summarySpace) => patch({ summarySpace }),
      spaceShape: (spaceShape) => patch({ spaceShape }),
      wayIn: (wayIn) => patch({ wayIn }),
      data: (data) => patch({ data }),
      panelMode: (panelMode) => patch({ panelMode }),
      bootDebug: () => bootDebugRef.current(),
    };

    window.storagePlan = api;
    api.help();

    return () => {
      delete window.storagePlan;
    };
  }, [patch]);

  const destructive = actions.filter((a) => a.delete && !a.subvol).length;

  /* Summarised, debounced, announced once. The result changing is the best
   * property this page has and it is silent today. Never a replay of the list. */
  useEffect(() => {
    const timer = window.setTimeout(() => {
      announce(
        destructive > 0
          ? t(`Plan updated. ${destructive} changes destroy data.`)
          : t("Plan updated. Nothing is destroyed."),
      );
    }, 600);
    return () => window.clearTimeout(timer);
  }, [destructive, announce]);

  if (!config) {
    return (
      <EmptyState titleText={t("No configuration model")} headingLevel="h3">
        <EmptyStateBody>
          {t("This layout needs the storage model, which the backend is not offering.")}
        </EmptyStateBody>
      </EmptyState>
    );
  }

  const rows: Selection[] = [
    ...(config.volumeGroups || []).map((_v, index) => ({
      collection: "volumeGroups" as const,
      index,
    })),
    ...(config.mdRaids || []).map((_m, index) => ({ collection: "mdRaids" as const, index })),
    ...(config.drives || []).map((_d, index) => ({ collection: "drives" as const, index })),
  ];

  const configuredNames = configModel.devices(config).map((device) => device.name);
  const unconfigured = availableDevices.filter((device) => !configuredNames.includes(device.name));

  const selection = selectedId ? parseId(selectedId) : null;

  const detail = () => {
    if (showsResult) return <ResultDetail actions={actions} />;
    if (showsBoot) return <BootDetail />;
    if (showsEncryption) return <EncryptionDetail />;
    if (!selection) return null;
    if (selection.collection === "volumeGroups")
      return <VolumeGroupDetail index={selection.index} tab={panelTab} onTab={setPanelTab} />;
    return (
      <PartitionableDetail
        collection={selection.collection}
        index={selection.index}
        tab={panelTab}
        onTab={setPanelTab}
      />
    );
  };

  const header = () => {
    if (showsResult) {
      return (
        <PanelHeader
          title={t("Result")}
          subtitle={t("What the installer will do, and what the machine will look like")}
          onClose={() => setShowsResult(false)}
        />
      );
    }
    if (showsBoot) {
      return (
        <PanelHeader
          title={t("Boot options")}
          subtitle={t("How the new system starts")}
          onClose={() => setShowsBoot(false)}
        />
      );
    }
    if (showsEncryption) {
      return (
        <PanelHeader
          title={t("Encryption")}
          subtitle={t("What protects the data the installation writes")}
          onClose={() => setShowsEncryption(false)}
        />
      );
    }
    if (!selection) return null;
    return <SelectionHeader selection={selection} onClose={() => setSelectedId(null)} />;
  };

  /* One panel body, used on its own below xl and inside the drawer above it, so
   * there is a single arrangement to look at and a single one to test. */
  const panelBody = (
    <div
      ref={panelRef}
      tabIndex={-1}
      role="region"
      aria-labelledby={hasPanelContent ? "agm-plan-panel-title" : undefined}
      aria-label={hasPanelContent ? undefined : t("Details")}
      className={[
        "agm-plan-panel",
        `agm-plan-panel-scroll-${variants.scroll}`,
        `agm-plan-type-${variants.typeScale}`,
        `agm-plan-mounts-${variants.mountPaths}`,
      ].join(" ")}
    >
      {hasPanelContent ? (
        <>
          {header()}
          <div className="agm-plan-panel-content">{detail()}</div>
        </>
      ) : (
        <EmptyState titleText={t("Nothing selected")} headingLevel="h2" variant="sm">
          <EmptyStateBody>
            {t("Pick a device in the list to see and change what happens to it.")}
          </EmptyStateBody>
        </EmptyState>
      )}
    </div>
  );

  const list = (
    <DeviceList
      rows={rows}
      selectedId={selectedId}
      onSelect={(next) => {
        setShowsResult(false);
        setShowsBoot(false);
        setShowsEncryption(false);
        setSelectedId(idOf(next));
        setIsPanelOpen(true);
      }}
      onCrossToPanel={() => panelRef.current?.focus()}
      unconfigured={unconfigured}
      mountPaths={["/"]}
    />
  );

  const goToDevice = (next: Selection, tab?: PanelTab) => {
    setShowsResult(false);
    setShowsBoot(false);
    setShowsEncryption(false);
    setSelectedId(idOf(next));
    if (tab) setPanelTab(tab);
    setIsPanelOpen(true);
  };

  /* A page rather than a sheet. The form behind it is due a rewrite onto the
     current form conventions, and a sheet holding a form nobody has rewritten
     is a form that gets rewritten twice.

     The sheet the earlier rounds built is still there, on `select("boot")`, so
     the two arrangements can be put side by side. */
  const goToBoot = () => navigate(PATHS.editBootDevice);

  const goToResult = () => {
    setShowsBoot(false);
    setShowsEncryption(false);
    setSelectedId(null);
    setShowsResult(true);
    setIsPanelOpen(true);
  };

  const goToEncryption = () => {
    setShowsResult(false);
    setShowsBoot(false);
    setSelectedId(null);
    setShowsEncryption(true);
    setIsPanelOpen(true);
  };

  /* One entry gets the summary of that device, and only where the entry is a
     device the summary can read: a lone volume group is a plan about disks it
     does not name. Anything longer gets the summary of the plan, with the
     index of its entries under it. */
  const single =
    rows.length === 1 && rows[0].collection !== "volumeGroups" ? (rows[0] as Selection) : null;
  const showsSummary = variants.page === "summary" && (single !== null || rows.length > 1);

  const bar = (
    <PlanBar
      destructive={destructive}
      onShowBoot={goToBoot}
      onShowEncryption={goToEncryption}
      onShowResult={goToResult}
    />
  );

  /* What the reader sees before opening anything: the summary of the plan, or
     the list of what it is made of. The bar closes the summary and heads the
     list, since one is read to the end and the other is scanned. */
  const summary = () => {
    if (single) {
      return (
        <PlanSummary
          collection={single.collection as PartitionableCollection}
          index={single.index}
          isNarrow={isNarrow}
          onOpenTab={(tab) => goToDevice(single, tab)}
          onShowResult={goToResult}
        />
      );
    }

    return (
      <PlanOverview
        rows={rows}
        isNarrow={isNarrow}
        selectedId={selectedId}
        onOpen={goToDevice}
        onCrossToPanel={() => panelRef.current?.focus()}
        unconfigured={unconfigured}
        onShowResult={goToResult}
      />
    );
  };

  const page = showsSummary ? (
    <div
      className={isNarrow ? "agm-plan-summary-page agm-plan-page-narrow" : "agm-plan-summary-page"}
      ref={setPageNode}
    >
      {/* One line above the page: what it is on the left, and on the right the
          two decisions about no device in particular and the one destructive
          thing this page can do. None of the three is about anything the
          summary names, so none of them belongs inside it. */}
      {/* One row where there is room for one. The sentence is the half that
          gives way: it shrinks and wraps inside its own column, while the three
          controls beside it keep theirs.

          In a strip there is no room to share, so the two stack: the sentence
          takes the width, and the controls take a line under it, still at the
          right where a control belongs. Wrapping them into the same row instead
          leaves the sentence with three or four words a line. */}
      <Flex
        direction={{ default: isNarrow ? "column" : "row" }}
        justifyContent={{ default: "justifyContentFlexEnd" }}
        alignItems={{ default: isNarrow ? "alignItemsFlexEnd" : "alignItemsCenter" }}
        gap={{ default: isNarrow ? "gapSm" : "gapMd" }}
        flexWrap={{ default: "nowrap" }}
        className="agm-plan-topline"
      >
        {/* Free to wrap where a translation runs longer: it stays on the same
            line and takes two of them, rather than pushing the controls off. */}
        <FlexItem
          grow={{ default: "grow" }}
          /* Stretched only where the two are stacked, so the sentence takes
             the width of the strip. On one row stretching it makes a box as
             tall as the controls and sets the text at the top of it, which is
             the misalignment this fixes. */
          alignSelf={{ default: isNarrow ? "alignSelfStretch" : "alignSelfCenter" }}
          className="agm-plan-topline-intro"
        >
          {/* Short enough to sit beside three controls, and short enough to
              take one line of a strip. It names no technology: LVM is one of
              the things a reader may structure their devices into and not the
              point of the page, and the list below names it where it is there.

              Smaller again in a strip, where it competes with the sentence the
              page opens with for the top of a screen that has little of it. */}
          <Text textStyle={[isNarrow ? "fontSizeXs" : "fontSizeSm", "textColorSubtle"]}>
            {t("Choose devices to use and how to structure them")}
          </Text>
        </FlexItem>
        <FlexItem className="agm-plan-topline-controls">
          <Flex
            alignItems={{ default: "alignItemsCenter" }}
            gap={{ default: "gapSm" }}
            flexWrap={{ default: "nowrap" }}
          >
            <FlexItem>
              <PlanSettings
                isCompact={isNarrow}
                onShowBoot={goToBoot}
                onShowEncryption={goToEncryption}
              />
            </FlexItem>
            <FlexItem>
              <ActionsMenu
                label={t("More actions for this installation")}
                position="end"
                items={[
                  /* Alone, and about this configuration rather than about the
                     machine: everything that manages what the machine has is
                     in the page header, where management belongs. */
                  {
                    title: t("Reset to defaults"),
                    description: t(
                      "Throw away every change and start from what the installer proposed",
                    ),
                    onClick: () => reset(),
                    isDanger: true,
                  },
                ]}
              />
            </FlexItem>
          </Flex>
        </FlexItem>
      </Flex>
      {/* What moves aside when the sheet opens. The line above it does not:
          it is the page's own furniture, and furniture that slides with the
          content it introduces reads as the whole window shifting. */}
      <div className="agm-plan-page-body">{summary()}</div>
    </div>
  ) : (
    <>
      {bar}
      <PlanNotices />
      {list}
    </>
  );

  /* Inline, the panel takes its width out of the page and the two share the
     window. Otherwise it comes over the page, which either keeps its width
     and is covered, or gives way to the sheet and uses what is left. */
  const isInlineDrawer = variants.panelMode === "inline";

  const drawer = (isStatic: boolean) => (
    <Drawer
      isExpanded={isStatic ? isPanelOpen : isPanelOpen && hasPanelContent}
      isStatic={isStatic}
      isInline={isInlineDrawer}
      className={variants.panelMode === "aside" ? "agm-plan-drawer-aside" : undefined}
      position="end"
    >
      <DrawerContent
        panelContent={
          <DrawerPanelContent
            id={PANEL_ID}
            /* The panel is where the work happens and the list beside it is
               being scanned rather than read. Set as a size rather than through
               the widths prop, whose steps jump from three quarters to the
               whole width. */
            defaultSize={isInlineDrawer ? "60%" : PANEL_WIDTH}
            className={isStatic || isInlineDrawer ? undefined : "agm-plan-panel-floating"}
          >
            <DrawerPanelBody hasNoPadding>{panelBody}</DrawerPanelBody>
          </DrawerPanelContent>
        }
      >
        {/* The bar belongs to the list, not above the pair, so the panel
            covers it the way it covers everything else on that side. It
            stays pinned by sticking to the top of the list's own scroll.

            While the sheet is over it, the page is inert: whatever is still on
            screen beside the panel, a clipped button included, is out of the
            tab order, out of the accessibility tree and not clickable. A
            drawer that covers the page does not do that on its own.

            As an empty string rather than as a boolean, which is what React 18
            passes through as the bare attribute the browser wants. */}
        <DrawerContentBody
          className={isCovered ? "agm-plan-covered" : undefined}
          {...(isCovered ? { inert: "" } : {})}
        >
          {page}
        </DrawerContentBody>
      </DrawerContent>
    </Drawer>
  );

  /* Two arrangements, one panel.
   *
   * From lg up the panel floats over the list, which stays behind it. Below lg
   * the two take turns in the same frame, because a panel over a list that
   * narrow covers all of it anyway.
   *
   * The bar belongs to the list in both, so the panel replaces the pair rather
   * than appearing under a bar that reports on what it is covering. */
  const inside = isFloating ? (
    drawer(false)
  ) : (
    <div id={PANEL_ID} className="agm-plan-narrow">
      {hasPanelContent ? panelBody : page}
    </div>
  );

  return (
    <PanelNavContext.Provider value={{ goToDevice, goToBoot }}>
      <PlanStyles />
      {inside}
    </PanelNavContext.Provider>
  );
}

/**
 * What the page is looked at with: the switches, and the machine behind them.
 *
 * Above the page rather than inside it, since choosing a scenario has to be
 * settled before anything reads a device.
 */
function StoragePlanShell(): React.ReactNode {
  const [variants, setVariants] = useState<Variants>(DEFAULT_VARIANTS);
  const patch = useCallback(
    (next: Partial<Variants>) => setVariants((current) => ({ ...current, ...next })),
    [],
  );
  const scenario = useScenarioState(variants.data);
  const [asked, setAsked] = useState<Record<string, ConfigModel.SpacePolicy>>({});
  const policies = useMemo(
    () => ({
      asked,
      remember: (key: string, policy: ConfigModel.SpacePolicy) =>
        setAsked((current) => ({ ...current, [key]: policy })),
    }),
    [asked],
  );

  return (
    <VariantsContext.Provider value={variants}>
      <ScenarioContext.Provider value={scenario}>
        <AskedPolicyContext.Provider value={policies}>
          <StoragePlan variants={variants} patch={patch} />
          <PlanSettingsPanel variants={variants} onChange={patch} />
        </AskedPolicyContext.Provider>
      </ScenarioContext.Provider>
    </VariantsContext.Provider>
  );
}

export default function StoragePlanPlayground(): React.ReactNode {
  return (
    <Page
      breadcrumbs={[{ label: t("Storage") }]}
      /* Management, not settings: rescanning and the technologies do not change
         the plan, they change what the machine has for a plan to use. That
         belongs to the page rather than to the configuration under it, which is
         where the proposal page has always kept it. */
      additionalContent={<ConnectedDevicesMenu />}
      /* What the real storage page does: every edit rewrites the whole model,
       * and this shields the interface until the proposal has caught up. */
      progress={{
        scope: "storage",
        awaitQueriesRefetch: [
          PROPOSAL_QUERY_KEY,
          EXTENDED_CONFIG_QUERY_KEY,
          STORAGE_MODEL_QUERY_KEY,
        ],
      }}
    >
      <Page.Content className="agm-plan-page">
        <StoragePlanShell />
      </Page.Content>
    </Page>
  );
}
