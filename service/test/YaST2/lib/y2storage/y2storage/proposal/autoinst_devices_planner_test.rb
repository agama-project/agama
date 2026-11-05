#!/usr/bin/env rspec
# frozen_string_literal: true

# Copyright (c) [2017-2019] SUSE LLC
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

require_relative "../../../../../test_helper"
require_relative "../../support/shared_setup"

require "y2storage/proposal/autoinst_devices_planner"
require "y2storage/volume_specification"
require "installation/autoinst_issues/list"
Yast.import "Arch"

describe Y2Storage::Proposal::AutoinstDevicesPlanner do
  include_context "yast2-storage-ng test setup"

  using Y2Storage::Refinements::SizeCasts

  subject(:planner) { described_class.new(fake_devicegraph, issues_list) }

  let(:scenario) { "windows-linux-free-pc" }
  let(:drives_map) do
    Y2Storage::Proposal::AutoinstDrivesMap.new(fake_devicegraph, partitioning, issues_list)
  end
  let(:boot_checker) { instance_double(Y2Storage::BootRequirementsChecker, needed_partitions: []) }
  let(:architecture) { :x86_64 }
  let(:issues_list) { ::Installation::AutoinstIssues::List.new }

  let(:partitioning) do
    Y2Storage::AutoinstProfile::PartitioningSection.new_from_hashes(partitioning_array)
  end

  before do
    allow(Y2Storage::BootRequirementsChecker).to receive(:new).and_return(boot_checker)

    fake_scenario(scenario)

    # Do not read from running system
    allow(Yast::ProductFeatures).to receive(:GetSection).with("partitioning").and_return(nil)
    allow(Yast::ProductFeatures).to receive(:GetSection).with("globals").and_return(nil)

    Y2Storage::VolumeSpecification.clear_cache
  end

  describe "#planned_devices" do
    context "using CT_DISK as type" do
      let(:partitioning_array) do
        [{
          "type" => :CT_DISK, "partitions" => [{ "mount" => "/" }]
        }]
      end

      it "plans a disk device" do
        devices = planner.planned_devices(drives_map)
        expect(devices.disks).to_not be_empty
      end
    end

    context "using CT_DMMULTIPATH as type" do
      let(:partitioning_array) do
        [{
          "type" => :CT_DMMULTIPATH, "partitions" => [{ "mount" => "/" }]
        }]
      end

      it "plans a disk device" do
        devices = planner.planned_devices(drives_map)
        expect(devices.disks).to_not be_empty
      end
    end

    context "using NFS with the old format" do
      let(:partitioning_array) do
        [{
          "device" => "/dev/nfs", "partitions" => [{ "mount" => "/", "device" => "server:path" }]
        }]
      end

      it "plans NFS filesystems" do
        devices = planner.planned_devices(drives_map)

        expect(devices.nfs_filesystems).to_not be_empty
        expect(devices.nfs_filesystems.first.root?).to eq(true)
      end
    end

    context "using NFS with the new format" do
      let(:partitioning_array) do
        [{
          "device" => "192.168.56.1:/root_fs", "type" => :CT_NFS, "partitions" => [{ "mount" => "/" }]
        }]
      end

      it "plans NFS filesystems" do
        devices = planner.planned_devices(drives_map)

        expect(devices.nfs_filesystems).to include(
          an_object_having_attributes(
            mount_point: "/",
            server:      "192.168.56.1",
            path:        "/root_fs"
          )
        )
      end
    end

    context "using multi-device Btrfs" do
      let(:partitioning_array) do
        [
          {
            "device"     => "root_fs",
            "type"       => :CT_BTRFS,
            "partitions" => [{ "mount" => "/" }]
          }
        ]
      end

      it "plans a multi-device Btrfs filesystems" do
        devices = planner.planned_devices(drives_map)

        expect(devices.btrfs_filesystems).to include(
          an_object_having_attributes(
            name:        "root_fs",
            mount_point: "/"
          )
        )
      end
    end

    context "using Btrfs" do
      let(:partitioning_array) do
        [{
          "device" => "/dev/sda", "use" => "all",
          "enable_snapshots" => snapshots, "partitions" => partitions
        }]
      end
      let(:home_spec) { { "mount" => "/home", "filesystem" => "btrfs" } }
      let(:root_spec) { { "mount" => "/", "filesystem" => "btrfs", "subvolumes" => subvolumes } }
      let(:partitions) { [root_spec, home_spec] }
      let(:snapshots) { false }

      let(:devices) { planner.planned_devices(drives_map) }
      let(:disk) { devices.disks.first }
      let(:root) { disk.partitions.find { |d| d.mount_point == "/" } }
      let(:home) { disk.partitions.find { |d| d.mount_point == "/home" } }

      let(:subvolumes) { nil }
      let(:root_volume_spec) do
        Y2Storage::VolumeSpecification.new(
          "mount_point" => "/", "subvolumes" => subvolumes, "btrfs_default_subvolume" => "@"
        )
      end

      before do
        allow(Y2Storage::VolumeSpecification).to receive(:for).with("/")
          .and_return(root_volume_spec)
        allow(Y2Storage::VolumeSpecification).to receive(:for).with("/home")
          .and_return(nil)
      end

      context "when the profile contains a list of subvolumes" do
        let(:subvolumes) { ["var", { "path" => "srv", "copy_on_write" => false }, "home"] }

        it "plans a list of SubvolSpecification for root" do
          expect(root.subvolumes).to be_an Array
          expect(root.subvolumes).to all(be_a(Y2Storage::SubvolSpecification))
        end

        it "includes all the non-shadowed subvolumes" do
          expect(root.subvolumes).to contain_exactly(
            an_object_having_attributes(path: "var", copy_on_write: true),
            an_object_having_attributes(path: "srv", copy_on_write: false)
          )
        end

        # TODO: check that the user is warned, as soon as we introduce error
        # reporting
        it "excludes shadowed subvolumes" do
          expect(root.subvolumes.map(&:path)).to_not include "home"
        end
      end

      context "when there is no subvolumes list in the profile" do
        let(:subvolumes) { nil }
        let(:x86_subvolumes) { ["boot/grub2/i386-pc", "boot/grub2/x86_64-efi"] }
        let(:s390_subvolumes) { ["boot/grub2/s390x-emu"] }

        it "plans a list of SubvolSpecification for root" do
          expect(root.subvolumes).to be_an Array
          expect(root.subvolumes).to all(be_a(Y2Storage::SubvolSpecification))
        end

        it "plans the default subvolumes" do
          expect(root.subvolumes).to include(
            an_object_having_attributes(path: "srv",     copy_on_write: true),
            an_object_having_attributes(path: "tmp",     copy_on_write: true),
            an_object_having_attributes(path: "var/log", copy_on_write: true),
            an_object_having_attributes(path: "var/lib/libvirt/images", copy_on_write: false)
          )
        end

        it "excludes default subvolumes that are shadowed" do
          expect(root.subvolumes.map(&:path)).to_not include "home"
        end

        context "when architecture is x86" do
          let(:architecture) { :x86_64 }

          it "plans default x86 specific subvolumes" do
            expect(root.subvolumes.map(&:path)).to include(*x86_subvolumes)
          end
        end

        context "when architecture is s390" do
          let(:architecture) { :s390 }

          it "plans default s390 specific subvolumes" do
            expect(root.subvolumes.map(&:path)).to include(*s390_subvolumes)
          end
        end
      end

      context "when there is an empty subvolumes list in the profile" do
        let(:subvolumes) { [] }

        it "does not plan any subvolume" do
          expect(root.subvolumes).to eq([])
        end
      end

      context "when a subvolume prefix is specified" do
        let(:root_spec) { { "mount" => "/", "filesystem" => "btrfs", "subvolumes_prefix" => "#" } }

        it "sets the default_subvolume name" do
          expect(root.default_subvolume).to eq("#")
        end
      end

      context "when subvolume prefix is not specified" do
        let(:root_spec) { { "mount" => "/", "filesystem" => "btrfs" } }

        it "sets the default_subvolume to the default" do
          expect(root.default_subvolume).to eq("@")
        end

        context "and there is no default" do
          it "sets the default_subvolume to nil" do
            expect(home.default_subvolume).to be_nil
          end
        end
      end

      context "when the usage of snapshots is not specified" do
        let(:snapshots) { nil }

        it "enables snapshots for '/'" do
          expect(root.snapshots?).to eq true
        end

        it "does not enable snapshots for other filesystems in the drive" do
          expect(home.snapshots?).to eq false
        end
      end

      context "when snapshots are disabled" do
        let(:snapshots) { false }

        it "does not enable snapshots for '/'" do
          expect(root.snapshots?).to eq false
        end

        it "does not enable snapshots for other filesystems in the drive" do
          expect(home.snapshots?).to eq false
        end
      end

      context "when snapshots are enabled" do
        let(:snapshots) { true }

        it "enables snapshots for '/'" do
          expect(root.snapshots?).to eq true
        end

        it "does not enable snapshots for other filesystems in the drive" do
          expect(home.snapshots?).to eq false
        end
      end

      context "when root volume is supposed to be read-only" do
        let(:root_volume_spec) do
          Y2Storage::VolumeSpecification.new("mount_point" => "/", "btrfs_read_only" => true)
        end

        it "sets root partition as read-only" do
          expect(root.read_only).to eq(true)
        end
      end

      context "when subvolumes are disabled" do
        let(:root_spec) do
          { "mount" => "/", "filesystem" => "btrfs", "create_subvolumes" => false,
            "subvolumes" => subvolumes }
        end

        it "does not plan any subvolume" do
          expect(root.subvolumes).to eq([])
        end
      end

      context "when no mount point is defined" do
        let(:partitions) { [root_spec, not_mounted_spec] }
        let(:not_mounted_spec) { { "mount" => nil, "filesystem" => "btrfs" } }
        let(:not_mounted) { devices.find { |d| d.mount_point.nil? } }

        it "does not plan any subvolume" do
          expect(not_mounted.subvolumes).to eq([])
        end
      end
    end

    context "using CT_TMPFS as type" do
      let(:partitioning_array) do
        [{
          "type" => :CT_TMPFS, "partitions" => [{ "mount" => "/srv" }, { "mount" => "/var/tmp" }]
        }]
      end

      it "plans a tmpfs file system for each partition section" do
        devices = planner.planned_devices(drives_map)
        expect(devices.tmpfs_filesystems).to contain_exactly(
          an_object_having_attributes(mount_point: "/srv"),
          an_object_having_attributes(mount_point: "/var/tmp")
        )
      end
    end
  end
end
