# frozen_string_literal: true

# Copyright (c) [2023-2025] SUSE LLC
#
# All Rights Reserved.
#
# This program is free software; you can redistribute it and/or modify it
# under the terms of version 2 of the GNU General Public License as published
# by the Free Software Foundation.
#
# This program is distributed in the hope that it will be useful, but WITHOUT
# ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
# FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General Public License for
# more details.
#
# You should have received a copy of the GNU General Public License along
# with this program; if not, contact SUSE LLC.
#
# To contact SUSE LLC about this file by physical or electronic mail, you may
# find current contact information at www.suse.com.

require_relative "../../../test_helper"
require_relative "../../storage/storage_helpers"
require "agama/dbus/storage/manager"
require "agama/storage/config"
require "agama/storage/device_settings"
require "agama/storage/manager"
require "agama/storage/proposal"
require "agama/storage/proposal_settings"
require "agama/storage/volume"
require "agama/storage/iscsi/manager"
require "agama/storage/dasd/manager"
require "agama/dbus/storage/dasds_tree"
require "agama/dbus/clients/software"
require "y2storage"
require "dbus"

def serialize(value)
  JSON.pretty_generate(value)
end

def parse(string)
  JSON.parse(string, symbolize_names: true)
end

describe Agama::DBus::Storage::Manager do
  include Agama::RSpec::StorageHelpers

  subject(:manager) { described_class.new(backend, logger: logger) }

  let(:logger) { Logger.new($stdout, level: :warn) }

  let(:backend) { Agama::Storage::Manager.new(product_config) }

  let(:product_config) { Agama::Config.new(config_data) }

  let(:config_data) { {} }

  let(:proposal) { Agama::Storage::Proposal.new(product_config) }

  let(:iscsi) do
    instance_double(Agama::Storage::ISCSI::Manager,
      on_activate:        nil,
      on_probe:           nil,
      on_sessions_change: nil)
  end

  let(:software) do
    instance_double(Agama::DBus::Clients::Software, on_probe_finished: nil)
  end

  before do
    # Speed up tests by avoding real check of TPM presence.
    allow(Y2Storage::EncryptionMethod::TPM_FDE).to receive(:possible?).and_return(true)
    allow(Yast::Arch).to receive(:s390).and_return false
    allow(backend).to receive(:on_configure)
    allow(backend).to receive(:on_issues_change)
    allow(backend).to receive(:actions).and_return([])
    allow(backend).to receive(:iscsi).and_return(iscsi)
    allow(backend).to receive(:software).and_return(software)
    allow(backend).to receive(:proposal).and_return(proposal)
    mock_storage(devicegraph: "empty-hd-50GiB.yaml")
  end

  describe "#recover_proposal" do
    context "if no proposal has been successfully calculated" do
      before do
        allow(proposal).to receive(:success?).and_return false
      end

      it "returns 'null'" do
        expect(subject.recover_proposal).to eq("null")
      end
    end

    context "if a proposal was successfully calculated" do
      before do
        allow(proposal).to receive(:success?).and_return true
      end

      describe "recover_proposal[:actions]" do
        before do
          allow(backend).to receive(:actions).and_return(actions)
        end

        context "if there are no actions" do
          let(:actions) { [] }

          it "returns an empty list" do
            expect(parse(subject.recover_proposal)[:actions]).to eq([])
          end
        end

        context "if there are actions" do
          let(:actions) { [action1, action2, action3, action4] }

          let(:action1) do
            instance_double(Agama::Storage::Action,
              text:                "test1",
              device_sid:          1,
              on_btrfs_subvolume?: false,
              delete?:             false,
              resize?:             false)
          end

          let(:action2) do
            instance_double(Agama::Storage::Action,
              text:                "test2",
              device_sid:          2,
              on_btrfs_subvolume?: false,
              delete?:             true,
              resize?:             false)
          end

          let(:action3) do
            instance_double(Agama::Storage::Action,
              text:                "test3",
              device_sid:          3,
              on_btrfs_subvolume?: false,
              delete?:             false,
              resize?:             true)
          end

          let(:action4) do
            instance_double(Agama::Storage::Action,
              text:                "test4",
              device_sid:          4,
              on_btrfs_subvolume?: true,
              delete?:             false,
              resize?:             false)
          end

          it "returns a list with a hash for each action" do
            all_actions = parse(subject.recover_proposal)[:actions]
            expect(all_actions.size).to eq(4)
            expect(all_actions).to all(be_a(Hash))

            action1, action2, action3, action4 = all_actions

            expect(action1).to eq({
              device: 1,
              text:   "test1",
              subvol: false,
              delete: false,
              resize: false
            })

            expect(action2).to eq({
              device: 2,
              text:   "test2",
              subvol: false,
              delete: true,
              resize: false
            })

            expect(action3).to eq({
              device: 3,
              text:   "test3",
              subvol: false,
              delete: false,
              resize: true
            })
            expect(action4).to eq({
              device: 4,
              text:   "test4",
              subvol: true,
              delete: false,
              resize: false
            })
          end
        end
      end
    end
  end

  describe "#recover_system" do
    context "if the system has not been probed yet" do
      before do
        allow(Y2Storage::StorageManager.instance).to receive(:probed?).and_return(false)
      end

      it "returns 'null'" do
        expect(subject.recover_system).to eq("null")
      end
    end

    before do
      allow(Y2Storage::StorageManager.instance).to receive(:probed?).and_return(true)
      allow(proposal.storage_system).to receive(:available_drives).and_return(available_drives)
      allow(proposal.storage_system).to receive(:candidate_drives).and_return(candidate_drives)
      allow(proposal.storage_system).to receive(:available_md_raids).and_return(available_raids)
      allow(proposal.storage_system).to receive(:candidate_md_raids).and_return(candidate_raids)
      allow(proposal.storage_system).to receive(:candidate_devices)
        .and_return(candidate_drives + candidate_raids)
    end

    let(:available_drives) { [] }
    let(:candidate_drives) { [] }
    let(:available_raids) { [] }
    let(:candidate_raids) { [] }

    describe "recover_system[:availableDrives]" do
      context "if there is no available drives" do
        let(:available_drives) { [] }

        it "returns an empty list" do
          expect(parse(subject.recover_system)[:availableDrives]).to eq([])
        end
      end

      context "if there are available drives" do
        let(:available_drives) { [drive1, drive2, drive3] }

        let(:drive1) { instance_double(Y2Storage::Disk, name: "/dev/vda", sid: 95) }
        let(:drive2) { instance_double(Y2Storage::Disk, name: "/dev/vdb", sid: 96) }
        let(:drive3) { instance_double(Y2Storage::Disk, name: "/dev/vdb", sid: 97) }

        it "retuns the id of each drive" do
          result = parse(subject.recover_system)[:availableDrives]
          expect(result).to contain_exactly(95, 96, 97)
        end
      end
    end

    describe "recover_system[:candidateDrives]" do
      context "if there is no candidate drives" do
        let(:candidate_drives) { [] }

        it "returns an empty list" do
          expect(parse(subject.recover_system)[:candidateDrives]).to eq([])
        end
      end

      context "if there are candidate drives" do
        let(:candidate_drives) { [drive1, drive2] }

        let(:drive1) { instance_double(Y2Storage::Disk, name: "/dev/vda", sid: 95) }
        let(:drive2) { instance_double(Y2Storage::Disk, name: "/dev/vdb", sid: 96) }

        it "retuns the id of each drive" do
          result = parse(subject.recover_system)[:candidateDrives]
          expect(result).to contain_exactly(95, 96)
        end
      end
    end

    describe "recover_system[:availableMdRaids]" do
      context "if there is no available MD RAIDs" do
        let(:available_raids) { [] }

        it "returns an empty list" do
          expect(parse(subject.recover_system)[:availableMdRaids]).to eq([])
        end
      end

      context "if there are available MD RAIDs" do
        let(:available_raids) { [md_raid1, md_raid2, md_raid3] }

        let(:md_raid1) { instance_double(Y2Storage::Md, name: "/dev/md0", sid: 100) }
        let(:md_raid2) { instance_double(Y2Storage::Md, name: "/dev/md1", sid: 101) }
        let(:md_raid3) { instance_double(Y2Storage::Md, name: "/dev/md2", sid: 102) }

        it "returns the id of each MD RAID" do
          result = parse(subject.recover_system)[:availableMdRaids]
          expect(result).to contain_exactly(100, 101, 102)
        end
      end
    end

    describe "recover_system[:candidateMdRaids]" do
      context "if there is no candidate MD RAIDs" do
        let(:candidate_raids) { [] }

        it "returns an empty list" do
          expect(parse(subject.recover_system)[:candidateMdRaids]).to eq([])
        end
      end

      context "if there are candidate MD RAIDs" do
        let(:candidate_raids) { [md_raid1, md_raid2] }

        let(:md_raid1) { instance_double(Y2Storage::Md, name: "/dev/md0", sid: 100) }
        let(:md_raid2) { instance_double(Y2Storage::Md, name: "/dev/md1", sid: 101) }

        it "retuns the path of each MD RAID" do
          result = parse(subject.recover_system)[:candidateMdRaids]
          expect(result).to contain_exactly(100, 101)
        end
      end
    end

    describe "recover_system[:issues]" do
      context "if there is no candidate drives" do
        let(:candidate_drives) { [] }

        it "contains a issue about the absence of disks" do
          result = parse(subject.recover_system)[:issues]
          expect(result).to contain_exactly(
            a_hash_including(description: /no suitable device for installation/i)
          )
        end
      end

      context "if there are candidate drives" do
        let(:candidate_drives) { [drive] }

        let(:drive) { instance_double(Y2Storage::Disk, name: "/dev/vda", sid: 95) }

        it "retuns an empty array" do
          result = parse(subject.recover_system)[:issues]
          expect(result).to eq []
        end
      end
    end

    describe "recover_system[:productMountPoints]" do
      let(:config_data) do
        { "storage" => { "volumes" => [], "volume_templates" => cfg_templates } }
      end

      context "with no storage section in the configuration" do
        let(:cfg_templates) { [] }

        it "contains an empty list" do
          expect(parse(subject.recover_system)[:productMountPoints]).to eq([])
        end
      end

      context "with a set of volume templates in the configuration" do
        let(:cfg_templates) do
          [
            { "mount_path" => "/" },
            { "mount_path" => "swap" },
            { "mount_path" => "/home" },
            { "filesystem" => "ext4" }
          ]
        end

        it "contains the mount points of each volume template" do
          result = parse(subject.recover_system)
          expect(result[:productMountPoints]).to contain_exactly("/", "swap", "/home")
        end
      end
    end

    describe "recover_system[:volumeTemplates]" do
      let(:config_data) do
        { "storage" => { "volumes" => [], "volume_templates" => cfg_templates } }
      end

      context "with no storage section in the configuration" do
        let(:cfg_templates) { [] }

        it "contains only a generic default template with empty path" do
          generic = { fsType: "ext4", mountOptions: [], minSize: 0, autoSize: false }
          generic_outline = { required: false, fsTypes: [], supportAutoSize: false }

          templates = parse(subject.recover_system)[:volumeTemplates]
          expect(templates.size).to eq 1

          expect(templates.first).to include(generic)
          expect(templates.first[:outline]).to include(generic_outline)
        end
      end

      context "with a set of volume templates in the configuration" do
        let(:cfg_templates) do
          [
            {
              "mount_path" => "/", "filesystem" => "btrfs", "size" => { "auto" => true },
              "outline" => {
                "required"    => true,
                "filesystems" => ["btrfs"],
                "auto_size"   => {
                  "base_min" => "5 GiB", "base_max" => "20 GiB", "min_fallback_for" => "/home"
                }
              }
            },
            {
              "mount_path" => "swap", "filesystem" => "swap",
              "size" => { "auto" => false, "min" => "1 GiB", "max" => "2 GiB" },
              "outline" => { "required" => false, "filesystems" => ["swap"] }
            },
            {
              "mount_path" => "/home", "filesystem" => "xfs",
              "size" => { "auto" => false, "min" => "10 GiB" },
              "outline" => { "required" => false, "filesystems" => ["xfs", "ext2"] }
            },
            {
              "filesystem" => "ext4", "size" => { "auto" => false, "min" => "10 GiB" },
              "outline" => { "filesystems" => ["ext3", "ext4", "xfs"] }
            }
          ]
        end

        it "contains a template for every relevant mount path" do
          templates = parse(subject.recover_system)[:volumeTemplates]

          root = templates.find { |v| v[:mountPath] == "/" }
          expect(root).to include(fsType: "btrfs", autoSize: true)
          expect(root[:outline]).to include(
            required: true, fsTypes: ["btrfs"],
            supportAutoSize: true, sizeRelevantVolumes: ["/home"]
          )

          swap = templates.find { |v| v[:mountPath] == "swap" }
          expect(swap).to include(
            fsType: "swap", autoSize: false, minSize: 1024**3, maxSize: 2 * (1024**3)
          )
          expect(swap[:outline]).to include(
            required: false, fsTypes: ["swap"], supportAutoSize: false
          )
        end

        it "constains the expected default template" do
          default = { fsType: "ext4", autoSize: false, minSize: 10 * (1024**3) }
          default_outline = { fsTypes: ["ext3", "ext4", "xfs"], supportAutoSize: false }

          templates = parse(subject.recover_system)[:volumeTemplates]
          template = templates.find { |v| v[:mountPath] == "" }
          expect(template).to include(default)
          expect(template[:outline]).to include(default_outline)
        end
      end
    end
  end

  describe "#configure" do
    before do
      allow(subject).to receive(:ProposalChanged)
      allow(subject).to receive(:ProgressChanged)
      allow(subject).to receive(:ProgressFinished)
    end

    let(:serialized_config) { config_json.to_json }

    context "if the serialized config contains storage settings" do
      let(:config_json) do
        {
          storage: {
            drives: [
              ptableType: "gpt",
              partitions: [
                {
                  filesystem: {
                    type: "btrfs",
                    path: "/"
                  }
                }
              ]
            ]
          }
        }
      end

      it "calculates an agama proposal with the given config" do
        expect(proposal).to receive(:calculate_agama) do |config|
          expect(config).to be_a(Agama::Storage::Config)
          expect(config.drives.size).to eq(1)

          drive = config.drives.first
          expect(drive.ptable_type).to eq(Y2Storage::PartitionTables::Type::GPT)
          expect(drive.partitions.size).to eq(1)

          partition = drive.partitions.first
          expect(partition.filesystem.type.fs_type).to eq(Y2Storage::Filesystems::Type::BTRFS)
          expect(partition.filesystem.path).to eq("/")
        end

        subject.configure(serialized_config)
      end

      it "emits signals for ProposalChanged, ProgressChanged and ProgressFinished" do
        allow(proposal).to receive(:calculate_agama)

        expect(subject).to receive(:ProposalChanged)
        expect(subject).to receive(:ProgressChanged).with(/storage configuration/i)
        expect(subject).to receive(:ProgressFinished)

        subject.configure(serialized_config)
      end
    end

    context "if the serialized config contains legacy AutoYaST settings" do
      let(:config_json) do
        {
          legacyAutoyastStorage: [
            { device: "/dev/vda" }
          ]
        }
      end

      it "calculates an AutoYaST proposal with the given settings" do
        expect(proposal).to receive(:calculate_autoyast) do |settings|
          expect(settings).to eq(config_json[:legacyAutoyastStorage])
        end

        subject.configure(serialized_config)
      end

      it "emits signals for ProposalChanged, ProgressChanged and ProgressFinished" do
        allow(proposal).to receive(:calculate_autoyast)

        expect(subject).to receive(:ProposalChanged)
        expect(subject).to receive(:ProgressChanged).with(/storage configuration/i)
        expect(subject).to receive(:ProgressFinished)

        subject.configure(serialized_config)
      end
    end
  end

  describe "#configure_with_model" do
    before do
      allow(subject).to receive(:ProposalChanged)
      allow(subject).to receive(:ProgressChanged)
      allow(subject).to receive(:ProgressFinished)
    end

    let(:serialized_model) { model_json.to_json }

    let(:model_json) do
      {
        drives: [
          name:       "/dev/vda",
          partitions: [
            { mountPath: "/" }
          ]
        ]
      }
    end

    it "calculates an agama proposal with the given config" do
      expect(proposal).to receive(:calculate_agama) do |config|
        expect(config).to be_a(Agama::Storage::Config)
        expect(config.drives.size).to eq(1)

        drive = config.drives.first
        expect(drive.search.name).to eq("/dev/vda")
        expect(drive.partitions.size).to eq(1)

        partition = drive.partitions.first
        expect(partition.filesystem.path).to eq("/")
      end

      subject.configure_with_model(serialized_model)
    end

    it "emits signals for ProposalChanged, ProgressChanged and ProgressFinished" do
      allow(proposal).to receive(:calculate_agama)

      expect(subject).to receive(:ProposalChanged)
      expect(subject).to receive(:ProgressChanged).with(/storage configuration/i)
      expect(subject).to receive(:ProgressFinished)

      subject.configure_with_model(serialized_model)
    end
  end

  describe "#recover_config" do
    context "if a proposal has not been calculated" do
      it "returns 'null'" do
        expect(subject.recover_config).to eq("null")
      end
    end

    context "if an agama proposal has been calculated" do
      before do
        proposal.calculate_from_json(config_json)
      end

      let(:config_json) do
        {
          storage: {
            drives: [
              {
                partitions: [
                  {
                    filesystem: { path: "/" }
                  }
                ]
              }
            ]
          }
        }
      end

      it "returns serialized storage config" do
        expect(subject.recover_config).to eq(serialize(config_json))
      end
    end

    context "if an AutoYaST proposal has been calculated" do
      before do
        proposal.calculate_from_json(autoyast_json)
      end

      let(:autoyast_json) do
        {
          legacyAutoyastStorage: [
            { device: "/dev/vda" }
          ]
        }
      end

      it "returns the serialized AutoYaST config" do
        expect(subject.recover_config).to eq(serialize(autoyast_json))
      end
    end
  end

  describe "#recover_config_model" do
    context "if a proposal has not been calculated" do
      it "returns 'null'" do
        expect(subject.recover_config_model).to eq("null")
      end
    end

    context "if an agama proposal has been calculated" do
      before do
        proposal.calculate_from_json(config_json)
      end

      let(:config_json) do
        {
          storage: {
            drives: [
              {
                alias:      "root",
                partitions: [
                  {
                    filesystem: { path: "/" }
                  }
                ]
              }
            ]
          }
        }
      end

      it "returns the serialized config model" do
        expect(subject.recover_config_model).to eq(
          serialize({
            boot:         {
              configure: true,
              device:    {
                default: true,
                name:    "/dev/sda"
              }
            },
            drives:       [
              {
                name:        "/dev/sda",
                spacePolicy: "keep",
                partitions:  [
                  {
                    mountPath:      "/",
                    filesystem:     {
                      reuse:   false,
                      default: true,
                      type:    "ext4"
                    },
                    size:           {
                      default: true,
                      min:     0
                    },
                    delete:         false,
                    deleteIfNeeded: false,
                    resize:         false,
                    resizeIfNeeded: false
                  }
                ]
              }
            ],
            mdRaids:      [],
            volumeGroups: []
          })
        )
      end
    end

    context "if an AutoYaST proposal has been calculated" do
      before do
        proposal.calculate_from_json(autoyast_json)
      end

      let(:autoyast_json) do
        {
          legacyAutoyastStorage: [
            { device: "/dev/vda" }
          ]
        }
      end

      it "returns 'null'" do
        expect(subject.recover_config_model).to eq("null")
      end
    end
  end

  describe "#solve_config_model" do
    let(:model) do
      {
        drives: [
          {
            name:       "/dev/sda",
            partitions: [
              { mountPath: "/" }
            ]
          }
        ]
      }
    end

    it "returns the serialized solved model" do
      result = subject.solve_config_model(model.to_json)

      expect(result).to eq(
        serialize({
          boot:         {
            configure: true,
            device:    {
              default: true,
              name:    "/dev/sda"
            }
          },
          drives:       [
            {
              name:        "/dev/sda",
              spacePolicy: "keep",
              partitions:  [
                {
                  mountPath:      "/",
                  filesystem:     {
                    reuse:   false,
                    default: true,
                    type:    "ext4"
                  },
                  size:           {
                    default: true,
                    min:     0
                  },
                  delete:         false,
                  deleteIfNeeded: false,
                  resize:         false,
                  resizeIfNeeded: false
                }
              ]
            }
          ],
          mdRaids:      [],
          volumeGroups: []
        })
      )
    end

    context "if the system has not been probed yet" do
      before do
        allow(Y2Storage::StorageManager.instance).to receive(:probed?).and_return(false)
      end

      it "returns 'null'" do
        result = subject.solve_config_model(model.to_json)
        expect(result).to eq("null")
      end
    end
  end

  describe "#recover_issues" do
    context "if no proposal has been calculated" do
      it "returns an empty array" do
        expect(subject.recover_issues).to eq "[]"
      end
    end

    context "if an agama proposal has been succesfully calculated" do
      before do
        backend.configure(config_json)
      end

      let(:config_json) do
        {
          storage: {
            drives: [
              {
                partitions: [
                  { size: "10 GiB", filesystem: { path: "/" } }
                ]
              }
            ]
          }
        }
      end

      it "returns an empty array" do
        expect(subject.recover_issues).to eq "[]"
      end
    end

    context "if an agama proposal failed to be calculated" do
      before do
        backend.configure(config_json)
      end

      let(:config_json) do
        {
          storage: {
            drives: [
              {
                partitions: [
                  { size: "60 TiB", filesystem: { path: "/home" } }
                ]
              }
            ]
          }
        }
      end

      it "returns the list of proposal issues" do
        result = parse(subject.recover_issues)
        expect(result).to include(
          a_hash_including(
            description: /cannot calculate a valid storage setup/i, severity: "error"
          ),
          a_hash_including(
            description: /boot device cannot be automatically/i, severity: "error"
          )
        )
      end
    end
  end

  describe "#iscsi_discover" do
    it "performs an iSCSI discovery" do
      expect(iscsi).to receive(:discover).with("192.168.100.90", 3260, anything)

      subject.iscsi_discover("192.168.100.90", 3260)
    end

    context "when no authentication options are given" do
      it "uses empty credentials" do
        expect(iscsi).to receive(:discover) do |_, _, discover_options|
          expect(discover_options[:credentials]).to eq({
            username:           nil,
            password:           nil,
            initiator_username: nil,
            initiator_password: nil
          })
        end

        subject.iscsi_discover("192.168.100.90", 3260)
      end
    end

    context "when authentication options are given" do
      let(:options) do
        {
          "Username"        => "target",
          "Password"        => "12345",
          "ReverseUsername" => "initiator",
          "ReversePassword" => "54321"
        }
      end

      it "uses the expected crendentials" do
        expect(iscsi).to receive(:discover) do |_, _, discover_options|
          expect(discover_options[:credentials]).to eq({
            username:           "target",
            password:           "12345",
            initiator_username: "initiator",
            initiator_password: "54321"
          })
        end

        subject.iscsi_discover("192.168.100.90", 3260, options)
      end
    end

    context "when the action successes" do
      before do
        allow(iscsi).to receive(:discover).and_return(true)
      end

      it "returns 0" do
        result = subject.iscsi_discover("192.168.100.90", 3260)

        expect(result).to eq(0)
      end
    end

    context "when the action fails" do
      before do
        allow(iscsi).to receive(:discover).and_return(false)
      end

      it "returns 1" do
        result = subject.iscsi_discover("192.168.100.90", 3260)

        expect(result).to eq(1)
      end
    end
  end

  describe "#iscsi_delete" do
    before do
      allow(Agama::DBus::Storage::ISCSINodesTree)
        .to receive(:new).and_return(iscsi_nodes_tree)
    end

    let(:iscsi_nodes_tree) { instance_double(Agama::DBus::Storage::ISCSINodesTree) }

    let(:path) { "/org/opensuse/Agama/Storage1/iscsi_nodes/1" }

    context "when the requested path for deleting is not exported yet" do
      before do
        allow(iscsi_nodes_tree).to receive(:find).with(path).and_return(nil)
      end

      it "does not delete the iSCSI node" do
        expect(iscsi).to_not receive(:delete)

        subject.iscsi_delete(path)
      end

      it "returns 1" do
        result = subject.iscsi_delete(path)

        expect(result).to eq(1)
      end
    end

    context "when the requested path for deleting is exported" do
      before do
        allow(iscsi_nodes_tree).to receive(:find).with(path).and_return(dbus_node)
      end

      let(:dbus_node) { Agama::DBus::Storage::ISCSINode.new(iscsi, node, path) }

      let(:node) { Agama::Storage::ISCSI::Node.new }

      it "deletes the iSCSI node" do
        expect(iscsi).to receive(:delete).with(node)

        subject.iscsi_delete(path)
      end

      context "and the action successes" do
        before do
          allow(iscsi).to receive(:delete).with(node).and_return(true)
        end

        it "returns 0" do
          result = subject.iscsi_delete(path)

          expect(result).to eq(0)
        end
      end

      context "and the action fails" do
        before do
          allow(iscsi).to receive(:delete).with(node).and_return(false)
        end

        it "returns 2" do
          result = subject.iscsi_delete(path)

          expect(result).to eq(2)
        end
      end
    end
  end

  context "in an s390 system" do
    before do
      allow(Yast::Arch).to receive(:s390).and_return true
      allow(Agama::Storage::DASD::Manager).to receive(:new).and_return(dasd_backend)
    end

    let(:dasd_backend) do
      instance_double(Agama::Storage::DASD::Manager,
        on_probe:   nil,
        on_refresh: nil)
    end

    it "includes interface for managing DASD devices" do
      expect(subject.intfs.keys).to include("org.opensuse.Agama.Storage1.DASD.Manager")
    end

    it "includes interface for managing zFCP devices" do
      expect(subject.intfs.keys).to include("org.opensuse.Agama.Storage1.ZFCP.Manager")
    end

    describe "#dasd_enable" do
      before do
        allow(Agama::DBus::Storage::DasdsTree).to receive(:new).and_return(dasds_tree)
        allow(dasds_tree).to receive(:find_paths).and_return [dbus_dasd1, dbus_dasd2]
      end

      let(:dasds_tree) { instance_double(Agama::DBus::Storage::DasdsTree) }

      let(:dasd1) { instance_double("Y2S390::Dasd") }
      let(:path1) { "/org/opensuse/Agama/Storage1/dasds/1" }
      let(:dbus_dasd1) { Agama::DBus::Storage::Dasd.new(dasd1, path1) }

      let(:dasd2) { instance_double("Y2S390::Dasd") }
      let(:path2) { "/org/opensuse/Agama/Storage1/dasds/2" }
      let(:dbus_dasd2) { Agama::DBus::Storage::Dasd.new(dasd2, path2) }

      let(:path3) { "/org/opensuse/Agama/Storage1/dasds/3" }

      context "when some of the paths do not correspond to an exported DASD" do
        let(:paths) { [path1, path2, path3] }

        it "does not try enable any DASD" do
          expect(dasd_backend).to_not receive(:enable)
          subject.dasd_enable(paths)
        end

        it "returns 1" do
          result = subject.dasd_enable(paths)
          expect(result).to eq(1)
        end
      end

      context "when all the paths correspond to exported DASDs" do
        let(:paths) { [path1, path2] }

        it "tries to enable all the DASDs" do
          expect(dasd_backend).to receive(:enable).with([dasd1, dasd2])
          subject.dasd_enable(paths)
        end

        context "and the action successes" do
          before do
            allow(dasd_backend).to receive(:enable).with([dasd1, dasd2]).and_return true
          end

          it "returns 0" do
            result = subject.dasd_enable(paths)
            expect(result).to eq 0
          end
        end

        context "and the action fails" do
          before do
            allow(dasd_backend).to receive(:enable).with([dasd1, dasd2]).and_return false
          end

          it "returns 2" do
            result = subject.dasd_enable(paths)
            expect(result).to eq 2
          end
        end
      end
    end

    describe "#dasd_format" do
      before do
        allow(Agama::DBus::Storage::DasdsTree).to receive(:new).and_return(dasds_tree)
        allow(dasds_tree).to receive(:find_paths).and_return [dbus_dasd1, dbus_dasd2]
      end

      let(:dasds_tree) { instance_double(Agama::DBus::Storage::DasdsTree) }

      let(:dasd1) { instance_double("Y2S390::Dasd") }
      let(:path1) { "/org/opensuse/Agama/Storage1/dasds/1" }
      let(:dbus_dasd1) { Agama::DBus::Storage::Dasd.new(dasd1, path1) }

      let(:dasd2) { instance_double("Y2S390::Dasd") }
      let(:path2) { "/org/opensuse/Agama/Storage1/dasds/2" }
      let(:dbus_dasd2) { Agama::DBus::Storage::Dasd.new(dasd2, path2) }

      let(:path3) { "/org/opensuse/Agama/Storage1/dasds/3" }

      context "when some of the paths do not correspond to an exported DASD" do
        let(:paths) { [path1, path2, path3] }

        it "does not try to format" do
          expect(dasd_backend).to_not receive(:format)
          subject.dasd_format(paths)
        end

        it "returns 1 as code and '/' as path" do
          result = subject.dasd_format(paths)
          expect(result).to eq [1, "/"]
        end
      end

      context "when all the paths correspond to exported DASDs" do
        let(:paths) { [path1, path2] }

        it "tries to format all the DASDs" do
          expect(dasd_backend).to receive(:format).with([dasd1, dasd2], any_args)
          subject.dasd_format(paths)
        end

        context "and the action successes" do
          before do
            allow(dasd_backend).to receive(:format).and_return initial_status

            allow(Agama::DBus::Storage::JobsTree).to receive(:new).and_return(jobs_tree)
            allow(jobs_tree).to receive(:add_dasds_format).and_return format_job
          end

          let(:initial_status) { [double("FormatStatus"), double("FormatStatus")] }
          let(:jobs_tree) { instance_double(Agama::DBus::Storage::JobsTree) }
          let(:format_job) do
            instance_double(Agama::DBus::Storage::DasdsFormatJob, path: job_path)
          end
          let(:job_path) { "/some/path" }

          it "returns 0 and the path to the new Job object" do
            result = subject.dasd_format(paths)
            expect(result).to eq [0, job_path]
          end
        end

        context "and the action fails" do
          before do
            allow(dasd_backend).to receive(:format).and_return nil
          end

          it "returns 2 as code and '/' as path" do
            result = subject.dasd_format(paths)
            expect(result).to eq [2, "/"]
          end
        end
      end
    end
  end

  context "in a system that is not s390" do
    before do
      allow(Yast::Arch).to receive(:s390).and_return false
    end

    it "does not respond to #dasd_enable" do
      expect { subject.dasd_enable }.to raise_error NoMethodError
    end

    it "does not respond to #dasd_format" do
      expect { subject.dasd_format }.to raise_error NoMethodError
    end
  end
end
