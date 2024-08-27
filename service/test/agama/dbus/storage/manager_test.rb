# frozen_string_literal: true

# Copyright (c) [2023-2024] SUSE LLC
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
require "agama/dbus/storage/proposal"
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

describe Agama::DBus::Storage::Manager do
  include Agama::RSpec::StorageHelpers

  subject(:manager) { described_class.new(backend, logger) }

  let(:logger) { Logger.new($stdout, level: :warn) }

  let(:backend) do
    instance_double(Agama::Storage::Manager,
      actions:                     [],
      proposal:                    proposal,
      iscsi:                       iscsi,
      software:                    software,
      config:                      config,
      on_probe:                    nil,
      on_progress_change:          nil,
      on_progress_finish:          nil,
      on_issues_change:            nil,
      on_deprecated_system_change: nil)
  end

  let(:config) { Agama::Config.new(config_data) }
  let(:config_data) { {} }

  let(:proposal) { Agama::Storage::Proposal.new(config) }

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
    allow(proposal).to receive(:on_calculate)
    mock_storage(devicegraph: "empty-hd-50GiB.yaml")
  end

  describe "#deprecated_system" do
    before do
      allow(backend).to receive(:deprecated_system?).and_return(deprecated)
    end

    context "if the system is set as deprecated" do
      let(:deprecated) { true }

      it "returns true" do
        expect(subject.deprecated_system).to eq(true)
      end
    end

    context "if the system is not set as deprecated" do
      let(:deprecated) { false }

      it "returns false" do
        expect(subject.deprecated_system).to eq(false)
      end
    end
  end

  describe "#read_actions" do
    before do
      allow(backend).to receive(:actions).and_return(actions)
    end

    context "if there are no actions" do
      let(:actions) { [] }

      it "returns an empty list" do
        expect(subject.actions).to eq([])
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
        expect(subject.actions.size).to eq(4)
        expect(subject.actions).to all(be_a(Hash))

        action1, action2, action3, action4 = subject.actions

        expect(action1).to eq({
          "Device" => 1,
          "Text"   => "test1",
          "Subvol" => false,
          "Delete" => false,
          "Resize" => false
        })

        expect(action2).to eq({
          "Device" => 2,
          "Text"   => "test2",
          "Subvol" => false,
          "Delete" => true,
          "Resize" => false
        })

        expect(action3).to eq({
          "Device" => 3,
          "Text"   => "test3",
          "Subvol" => false,
          "Delete" => false,
          "Resize" => true
        })
        expect(action4).to eq({
          "Device" => 4,
          "Text"   => "test4",
          "Subvol" => true,
          "Delete" => false,
          "Resize" => false
        })
      end
    end
  end

  describe "#available_devices" do
    before do
      allow(proposal).to receive(:available_devices).and_return(devices)
    end

    context "if there is no available devices" do
      let(:devices) { [] }

      it "returns an empty list" do
        expect(subject.available_devices).to eq([])
      end
    end

    context "if there are available devices" do
      let(:devices) { [device1, device2] }

      let(:device1) { instance_double(Y2Storage::Disk, name: "/dev/vda", sid: 95) }
      let(:device2) { instance_double(Y2Storage::Disk, name: "/dev/vdb", sid: 96) }

      it "retuns the path of each device" do
        result = subject.available_devices

        expect(result).to contain_exactly(
          /system\/95/,
          /system\/96/
        )
      end
    end
  end

  describe "#product_mount_points" do
    let(:config_data) do
      { "storage" => { "volumes" => [], "volume_templates" => cfg_templates } }
    end

    context "with no storage section in the configuration" do
      let(:cfg_templates) { [] }

      it "returns an empty list" do
        expect(subject.product_mount_points).to eq([])
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

      it "returns the mount points of each volume template" do
        expect(subject.product_mount_points).to contain_exactly("/", "swap", "/home")
      end
    end
  end

  describe "#default_volume" do
    let(:config_data) do
      { "storage" => { "volumes" => [], "volume_templates" => cfg_templates } }
    end

    context "with no storage section in the configuration" do
      let(:cfg_templates) { [] }

      it "returns the same generic default volume for any path" do
        generic = {
          "FsType" => "Ext4", "MountOptions" => [],
          "MinSize" => 0, "AutoSize" => false
        }
        generic_outline = { "Required" => false, "FsTypes" => [], "SupportAutoSize" => false }

        expect(subject.default_volume("/")).to include(generic)
        expect(subject.default_volume("/")["Outline"]).to include(generic_outline)

        expect(subject.default_volume("swap")).to include(generic)
        expect(subject.default_volume("swap")["Outline"]).to include(generic_outline)

        expect(subject.default_volume("/foo")).to include(generic)
        expect(subject.default_volume("/foo")["Outline"]).to include(generic_outline)
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

      it "returns the appropriate volume if there is a corresponding template" do
        expect(subject.default_volume("/")).to include("FsType" => "Btrfs", "AutoSize" => true)
        expect(subject.default_volume("/")["Outline"]).to include(
          "Required" => true, "FsTypes" => ["Btrfs"],
          "SupportAutoSize" => true, "SizeRelevantVolumes" => ["/home"]
        )

        expect(subject.default_volume("swap")).to include(
          "FsType" => "Swap", "AutoSize" => false, "MinSize" => 1024**3, "MaxSize" => 2 * (1024**3)
        )
        expect(subject.default_volume("swap")["Outline"]).to include(
          "Required" => false, "FsTypes" => ["Swap"], "SupportAutoSize" => false
        )
      end

      it "returns the default volume for any path without a template" do
        default = { "FsType" => "Ext4", "AutoSize" => false, "MinSize" => 10 * (1024**3) }
        default_outline = { "FsTypes" => ["Ext3", "Ext4", "XFS"], "SupportAutoSize" => false }

        expect(subject.default_volume("/foo")).to include(default)
        expect(subject.default_volume("/foo")["Outline"]).to include(default_outline)
      end
    end
  end

  describe "#apply_config" do
    let(:serialized_config) { config_json.to_json }

    context "if the serialized config contains guided proposal settings" do
      let(:config_json) do
        {
          storage: {
            guided: {
              target:     {
                disk: "/dev/vda"
              },
              boot:       {
                device: "/dev/vdb"
              },
              encryption: {
                password: "notsecret"
              },
              volumes:    volumes_settings
            }
          }
        }
      end

      let(:volumes_settings) do
        [
          {
            mount: {
              path: "/"
            }
          },
          {
            mount: {
              path: "swap"
            }
          }
        ]
      end

      it "calculates a guided proposal with the given settings" do
        expect(proposal).to receive(:calculate_guided) do |settings|
          expect(settings).to be_a(Agama::Storage::ProposalSettings)
          expect(settings.device).to be_a(Agama::Storage::DeviceSettings::Disk)
          expect(settings.device.name).to eq "/dev/vda"
          expect(settings.boot.device).to eq "/dev/vdb"
          expect(settings.encryption).to be_a(Agama::Storage::EncryptionSettings)
          expect(settings.encryption.password).to eq("notsecret")
          expect(settings.volumes).to contain_exactly(
            an_object_having_attributes(mount_path: "/"),
            an_object_having_attributes(mount_path: "swap")
          )
        end

        subject.apply_config(serialized_config)
      end

      context "when the serialized config omits some settings" do
        let(:config_json) do
          {
            storage: {
              guided: {}
            }
          }
        end

        it "calculates a proposal with default values for the missing settings" do
          expect(proposal).to receive(:calculate_guided) do |settings|
            expect(settings).to be_a(Agama::Storage::ProposalSettings)
            expect(settings.device).to be_a(Agama::Storage::DeviceSettings::Disk)
            expect(settings.device.name).to be_nil
            expect(settings.boot.device).to be_nil
            expect(settings.encryption).to be_a(Agama::Storage::EncryptionSettings)
            expect(settings.encryption.password).to be_nil
            expect(settings.volumes).to eq([])
          end

          subject.apply_config(serialized_config)
        end
      end

      context "when the serialized config includes a volume" do
        let(:volumes_settings) { [volume1_settings] }

        let(:volume1_settings) do
          {
            mount:      {
              path: "/"
            },
            size:       {
              min: 1024,
              max: 2048
            },
            filesystem: {
              btrfs: {
                snapshots: true
              }
            }
          }
        end

        let(:config_data) do
          { "storage" => { "volumes" => [], "volume_templates" => cfg_templates } }
        end

        let(:cfg_templates) do
          [
            {
              "mount_path" => "/",
              "outline"    => {
                "snapshots_configurable" => true
              }
            }
          ]
        end

        it "calculates a proposal with the given volume settings" do
          expect(proposal).to receive(:calculate_guided) do |settings|
            volume = settings.volumes.first

            expect(volume.mount_path).to eq("/")
            expect(volume.auto_size).to eq(false)
            expect(volume.min_size.to_i).to eq(1024)
            expect(volume.max_size.to_i).to eq(2048)
            expect(volume.btrfs.snapshots).to eq(true)
          end

          subject.apply_config(serialized_config)
        end

        context "and the volume settings omits some values" do
          let(:volume1_settings) do
            {
              mount: {
                path: "/"
              }
            }
          end

          let(:cfg_templates) do
            [
              {
                "mount_path" => "/", "filesystem" => "btrfs",
                "size" => { "auto" => false, "min" => "5 GiB", "max" => "20 GiB" },
                "outline" => {
                  "filesystems" => ["btrfs"]
                }
              }
            ]
          end

          it "calculates a proposal with default settings for the missing volume settings" do
            expect(proposal).to receive(:calculate_guided) do |settings|
              volume = settings.volumes.first

              expect(volume.mount_path).to eq("/")
              expect(volume.auto_size).to eq(false)
              expect(volume.min_size.to_i).to eq(5 * (1024**3))
              expect(volume.max_size.to_i).to eq(20 * (1024**3))
              expect(volume.btrfs.snapshots).to eq(false)
            end

            subject.apply_config(serialized_config)
          end
        end
      end
    end

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

        subject.apply_config(serialized_config)
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

        subject.apply_config(serialized_config)
      end
    end
  end

  describe "#recover_config" do
    def serialize(value)
      JSON.pretty_generate(value)
    end

    context "if a proposal has not been calculated" do
      it "returns serialized empty storage config" do
        expect(subject.recover_config).to eq(serialize({}))
      end
    end

    context "if a guided proposal has been calculated" do
      before do
        proposal.calculate_guided(settings)
      end

      let(:settings) do
        Agama::Storage::ProposalSettings.new.tap do |settings|
          settings.device = Agama::Storage::DeviceSettings::Disk.new("/dev/vda")
        end
      end

      it "returns serialized guided storage config" do
        expected_config = {
          storage: {
            guided: settings.to_json_settings
          }
        }

        expect(subject.recover_config).to eq(serialize(expected_config))
      end
    end

    context "if an agama proposal has been calculated" do
      before do
        proposal.calculate_agama(config)
      end

      let(:config) do
        fs_type = Agama::Storage::Configs::FilesystemType.new.tap do |t|
          t.fs_type = Y2Storage::Filesystems::Type::BTRFS
        end

        filesystem = Agama::Storage::Configs::Filesystem.new.tap do |f|
          f.type = fs_type
        end

        drive = Agama::Storage::Configs::Drive.new.tap do |d|
          d.filesystem = filesystem
        end

        Agama::Storage::Config.new.tap do |config|
          config.drives = [drive]
        end
      end

      it "returns serialized storage config" do
        skip "Missing conversion from Agama::Storage::Config to JSON"

        expected_config = {
          storage: {
            drives: [
              {
                filesystem: {
                  type: "btrfs"
                }
              }
            ]
          }
        }

        expect(subject.recover_config).to eq(serialize(expected_config))
      end
    end

    context "if a proposal was calculated from storage json" do
      before do
        proposal.calculate_from_json(config_json)
      end

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

      it "returns the serialized storage config" do
        expect(subject.recover_config).to eq(serialize(config_json))
      end
    end

    context "if a proposal was calculated from AutoYaST json" do
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

  describe "#iscsi_discover" do
    it "performs an iSCSI discovery" do
      expect(iscsi).to receive(:discover_send_targets) do |address, port, auth|
        expect(address).to eq("192.168.100.90")
        expect(port).to eq(3260)
        expect(auth).to be_a(Y2IscsiClient::Authentication)
      end

      subject.iscsi_discover("192.168.100.90", 3260, {})
    end

    context "when no authentication options are given" do
      let(:auth_options) { {} }

      it "uses an empty authentication" do
        expect(iscsi).to receive(:discover_send_targets) do |_, _, auth|
          expect(auth.by_target?).to eq(false)
          expect(auth.by_initiator?).to eq(false)
        end

        subject.iscsi_discover("192.168.100.90", 3260, auth_options)
      end
    end

    context "when authentication options are given" do
      let(:auth_options) do
        {
          "Username"        => "testi",
          "Password"        => "testi",
          "ReverseUsername" => "testt",
          "ReversePassword" => "testt"
        }
      end

      it "uses the expected authentication" do
        expect(iscsi).to receive(:discover_send_targets) do |_, _, auth|
          expect(auth.username).to eq("testi")
          expect(auth.password).to eq("testi")
          expect(auth.username_in).to eq("testt")
          expect(auth.password_in).to eq("testt")
        end

        subject.iscsi_discover("192.168.100.90", 3260, auth_options)
      end
    end

    context "when the action successes" do
      before do
        allow(iscsi).to receive(:discover_send_targets).and_return(true)
      end

      it "returns 0" do
        result = subject.iscsi_discover("192.168.100.90", 3260, {})

        expect(result).to eq(0)
      end
    end

    context "when the action fails" do
      before do
        allow(iscsi).to receive(:discover_send_targets).and_return(false)
      end

      it "returns 1" do
        result = subject.iscsi_discover("192.168.100.90", 3260, {})

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
