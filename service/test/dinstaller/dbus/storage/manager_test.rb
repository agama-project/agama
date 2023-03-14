# frozen_string_literal: true

# Copyright (c) [2023] SUSE LLC
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
require "dinstaller/dbus/storage/manager"
require "dinstaller/dbus/storage/proposal"
require "dinstaller/storage/manager"
require "dinstaller/storage/proposal"
require "dinstaller/storage/proposal_settings"
require "dinstaller/storage/volume"
require "dinstaller/storage/iscsi/manager"
require "dinstaller/storage/dasd/manager"
require "y2storage"
require "dbus"

describe DInstaller::DBus::Storage::Manager do
  subject { described_class.new(backend, logger) }

  let(:logger) { Logger.new($stdout, level: :warn) }

  let(:backend) do
    instance_double(DInstaller::Storage::Manager,
      proposal:           proposal,
      iscsi:              iscsi,
      on_progress_change: nil,
      on_progress_finish: nil)
  end

  let(:proposal) do
    instance_double(DInstaller::Storage::Proposal, on_calculate: nil, calculated_settings: settings)
  end

  let(:settings) { nil }

  let(:iscsi) { instance_double(DInstaller::Storage::ISCSI::Manager, on_probe: nil) }

  before do
    allow(Yast::Arch).to receive(:s390).and_return false
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
      before do
        allow(proposal).to receive(:device_label).with(device1).and_return("Device 1")
        allow(proposal).to receive(:device_label).with(device2).and_return("Device 2")
      end

      let(:devices) { [device1, device2] }

      let(:device1) { instance_double(Y2Storage::Disk, name: "/dev/vda") }
      let(:device2) { instance_double(Y2Storage::Disk, name: "/dev/vdb") }

      it "retuns the device name and label for each device" do
        result = subject.available_devices

        expect(result).to contain_exactly(
          ["/dev/vda", "Device 1", {}],
          ["/dev/vdb", "Device 2", {}]
        )
      end
    end
  end

  describe "#volume_templates" do
    before do
      allow(proposal).to receive(:volume_templates).and_return(templates)
    end

    context "if there are no volume templates" do
      let(:templates) { [] }

      it "returns an empty list" do
        expect(subject.volume_templates).to eq([])
      end
    end

    context "if there are volume templates" do
      let(:templates) { [volume1_template, volume2_template] }

      let(:volume1_template) do
        DInstaller::Storage::Volume.new(Y2Storage::VolumeSpecification.new({})).tap do |volume|
          volume.mount_point = "/test"
          volume.device_type = :partition
          volume.encrypted = true
          volume.fs_type = Y2Storage::Filesystems::Type::EXT3
          volume.min_size = Y2Storage::DiskSize.new(1024)
          volume.max_size = Y2Storage::DiskSize.new(2048)
          volume.fixed_size_limits = true
          volume.snapshots = true
        end
      end

      let(:volume2_template) { DInstaller::Storage::Volume.new }

      before do
        allow(volume1_template).to receive(:size_relevant_volumes).and_return(["/home"])
        allow(volume1_template).to receive(:fs_types)
          .and_return([Y2Storage::Filesystems::Type::EXT3])
      end

      it "returns a list with a hash for each volume template" do
        expect(subject.volume_templates.size).to eq(2)
        expect(subject.volume_templates).to all(be_a(Hash))

        template1, template2 = subject.volume_templates

        expect(template1).to eq({
          "MountPoint"            => "/test",
          "Optional"              => false,
          "DeviceType"            => "partition",
          "Encrypted"             => true,
          "FsTypes"               => ["Ext3"],
          "FsType"                => "Ext3",
          "MinSize"               => 1024,
          "MaxSize"               => 2048,
          "FixedSizeLimits"       => true,
          "AdaptiveSizes"         => true,
          "Snapshots"             => true,
          "SnapshotsConfigurable" => false,
          "SnapshotsAffectSizes"  => false,
          "SizeRelevantVolumes"   => ["/home"]
        })

        expect(template2).to eq({
          "Optional"              => true,
          "AdaptiveSizes"         => false,
          "SnapshotsConfigurable" => false,
          "SnapshotsAffectSizes"  => false
        })
      end
    end
  end

  describe "#result" do
    before do
      allow(subject).to receive(:dbus_proposal).and_return(dbus_proposal)
    end

    context "when there is no exported proposal object yet" do
      let(:dbus_proposal) { nil }

      it "returns root path" do
        expect(subject.result.to_s).to eq("/")
      end
    end

    context "when there is an exported proposal object" do
      let(:dbus_proposal) do
        instance_double(DInstaller::DBus::Storage::Proposal, path: ::DBus::ObjectPath.new("/test"))
      end

      it "returns the proposal object path" do
        expect(subject.result.to_s).to eq("/test")
      end
    end
  end

  describe "#calculate_proposal" do
    let(:dbus_settings) do
      {
        "CandidateDevices"   => ["/dev/vda"],
        "LVM"                => true,
        "EncryptionPassword" => "n0ts3cr3t",
        "Volumes"            => dbus_volumes
      }
    end

    let(:dbus_volumes) do
      [
        { "MountPoint" => "/" },
        { "MountPoint" => "swap" }
      ]
    end

    it "calculates a proposal with settings having values from D-Bus" do
      expect(proposal).to receive(:calculate) do |settings|
        expect(settings).to be_a(DInstaller::Storage::ProposalSettings)
        expect(settings.candidate_devices).to contain_exactly("/dev/vda")
        expect(settings.lvm).to eq(true)
        expect(settings.encryption_password).to eq("n0ts3cr3t")
        expect(settings.volumes).to contain_exactly(
          an_object_having_attributes(mount_point: "/"),
          an_object_having_attributes(mount_point: "swap")
        )
      end

      subject.calculate_proposal(dbus_settings)
    end

    context "when the D-Bus settings does not include some values" do
      let(:dbus_settings) { {} }

      it "calculates a proposal with settings having default values for the missing settings" do
        expect(proposal).to receive(:calculate) do |settings|
          expect(settings).to be_a(DInstaller::Storage::ProposalSettings)
          expect(settings.candidate_devices).to eq([])
          expect(settings.lvm).to be_nil
          expect(settings.encryption_password).to be_nil
          expect(settings.volumes).to eq([])
        end

        subject.calculate_proposal(dbus_settings)
      end
    end

    context "when the D-Bus settings includes a volume" do
      let(:dbus_volumes) { [dbus_volume1] }

      let(:dbus_volume1) do
        {
          "DeviceType"      => "lvm_lv",
          "Encrypted"       => true,
          "MountPoint"      => "/",
          "FixedSizeLimits" => true,
          "MinSize"         => 1024,
          "MaxSize"         => 2048,
          "FsType"          => "Ext3",
          "Snapshots"       => true
        }
      end

      it "calculates a proposal with settings having a volume with values from D-Bus" do
        expect(proposal).to receive(:calculate) do |settings|
          volume = settings.volumes.first

          expect(volume.device_type).to eq(:lvm_lv)
          expect(volume.encrypted).to eq(true)
          expect(volume.mount_point).to eq("/")
          expect(volume.fixed_size_limits).to eq(true)
          expect(volume.min_size.to_i).to eq(1024)
          expect(volume.max_size.to_i).to eq(2048)
          expect(volume.snapshots).to eq(true)
        end

        subject.calculate_proposal(dbus_settings)
      end

      context "and the D-Bus volume does not include some values" do
        let(:dbus_volume1) { { "MountPoint" => "/" } }

        it "calculates a proposal with settings having a volume with missing values" do
          expect(proposal).to receive(:calculate) do |settings|
            volume = settings.volumes.first

            expect(volume.device_type).to be_nil
            expect(volume.encrypted).to be_nil
            expect(volume.mount_point).to eq("/")
            expect(volume.fixed_size_limits).to be_nil
            expect(volume.min_size).to be_nil
            expect(volume.max_size).to be_nil
            expect(volume.snapshots).to be_nil
          end

          subject.calculate_proposal(dbus_settings)
        end
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
      allow(DInstaller::DBus::Storage::ISCSINodesTree)
        .to receive(:new).and_return(iscsi_nodes_tree)
    end

    let(:iscsi_nodes_tree) { instance_double(DInstaller::DBus::Storage::ISCSINodesTree) }

    let(:path) { "/org/opensuse/DInstaller/Storage1/iscsi_nodes/1" }

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

      let(:dbus_node) { DInstaller::DBus::Storage::ISCSINode.new(iscsi, node, path) }

      let(:node) { DInstaller::Storage::ISCSI::Node.new }

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
      allow(DInstaller::Storage::DASD::Manager).to receive(:new).and_return(dasd_backend)
    end

    let(:dasd_backend) do
      instance_double(DInstaller::Storage::DASD::Manager,
        on_probe:   nil,
        on_refresh: nil)
    end

    describe "#dasd_enable" do
      before do
        allow(DInstaller::DBus::Storage::DasdsTree).to receive(:new).and_return(dasds_tree)
        allow(dasds_tree).to receive(:find_paths).and_return [dbus_dasd1, dbus_dasd2]
      end

      let(:dasds_tree) { instance_double(DInstaller::DBus::Storage::DasdsTree) }

      let(:dasd1) { instance_double("Y2S390::Dasd") }
      let(:path1) { "/org/opensuse/DInstaller/Storage1/dasds/1" }
      let(:dbus_dasd1) { DInstaller::DBus::Storage::Dasd.new(dasd1, path1) }

      let(:dasd2) { instance_double("Y2S390::Dasd") }
      let(:path2) { "/org/opensuse/DInstaller/Storage1/dasds/2" }
      let(:dbus_dasd2) { DInstaller::DBus::Storage::Dasd.new(dasd2, path2) }

      let(:path3) { "/org/opensuse/DInstaller/Storage1/dasds/3" }

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
  end

  context "in a system that is not s390" do
    before do
      allow(Yast::Arch).to receive(:s390).and_return false
    end

    it "does not respond to #dasd_enable" do
      expect { subject.dasd_enable }.to raise_error NoMethodError
    end
  end
end
