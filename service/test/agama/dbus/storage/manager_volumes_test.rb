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
require "agama/dbus/storage/manager"
require "agama/dbus/storage/proposal"
require "agama/storage/manager"
require "agama/storage/proposal"
require "agama/storage/proposal_settings"
require "agama/storage/volume"
require "y2storage"
require "dbus"

describe Agama::DBus::Storage::Manager do
  subject(:manager) { described_class.new(backend, logger) }

  let(:logger) { Logger.new($stdout, level: :warn) }

  let(:backend) do
    instance_double(Agama::Storage::Manager,
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

  let(:iscsi) do
    instance_double(Agama::Storage::ISCSI::Manager,
      on_activate:        nil,
      on_probe:           nil,
      on_sessions_change: nil)
  end

  let(:software) { instance_double(Agama::DBus::Clients::Software, on_product_selected: nil) }

  let(:config) { Agama::Config.new(config_data) }

  let(:config_data) do
    { "storage" => { "volumes" => cfg_volumes, "volume_templates" => cfg_templates } }
  end

  let(:cfg_volumes) { ["/", "/home", "swap"] }

  let(:cfg_templates) do
    [
      {
        "mount_path" => "/", "filesystem" => "btrfs", "size" => { "auto" => true },
        "mount_options" => ["whatever=foo"],
        "outline" => {
          "required"    => true,
          "filesystems" => ["btrfs"],
          "auto_size"   => {
            "base_min" => "5 GiB", "base_max" => "20 GiB", "min_fallback_for" => ["/home"]
          }
        }
      },
      {
        "mount_path" => "swap", "filesystem" => "swap",
        "size" => { "auto" => false, "min" => "1 GiB", "max" => "2 GiB" },
        "outline" => { "required" => true, "filesystems" => ["swap"] }
      },
      {
        "mount_path" => "/home", "filesystem" => "xfs",
        "size" => { "auto" => false, "min" => "10 GiB" },
        "outline" => { "required" => false, "filesystems" => ["xfs", "ext3", "ext4"] }
      },
      {
        "mount_path" => "/var", "filesystem" => "xfs",
        "size" => { "auto" => false, "min" => "5 GiB" },
        "outline" => { "required" => false }
      },
      {
        "filesystem" => "ext4",
        "size"       => { "auto" => false, "min" => "10 GiB" },
        "outline"    => { "filesystems" => ["ext3", "ext4", "xfs"] }
      }
    ]
  end

  let(:proposal) do
    instance_double(Agama::Storage::Proposal, on_calculate: nil, settings: settings)
  end

  let(:settings) { nil }

  before do
    allow(Yast::Arch).to receive(:s390).and_return false
  end

  describe "#calculate_proposal" do
    context "when the D-Bus settings do not include information about volumes" do
      let(:dbus_settings) { {} }

      it "calculates a proposal using the default volumes" do
        expect(proposal).to receive(:calculate) do |settings|
          expect(settings.volumes.map(&:mount_path)).to eq cfg_volumes
        end

        subject.calculate_proposal(dbus_settings)
      end

      it "calculates a proposal completely ignoring templates of non-default volumes" do
        expect(proposal).to receive(:calculate) do |settings|
          expect(settings.volumes.map(&:mount_path)).to_not include "/var"
        end

        subject.calculate_proposal(dbus_settings)
      end
    end

    context "when the D-Bus settings omit some mandatory volumes" do
      let(:dbus_settings) { { "Volumes" => dbus_volumes } }
      let(:dbus_volumes) { [dbus_root_vol, dbus_foo_vol] }
      let(:dbus_root_vol) do
        {
          "MountPath" => "/",
          "AutoSize"  => false,
          "MinSize"   => 1024,
          "MaxSize"   => 2048,
          "Snapshots" => true
        }
      end
      let(:dbus_foo_vol) { { "MountPath" => "/foo" } }

      it "calculates a proposal including all the mandatory volumes" do
        expect(proposal).to receive(:calculate) do |settings|
          expect(settings.volumes.map(&:mount_path)).to include("/", "swap")
        end

        subject.calculate_proposal(dbus_settings)
      end

      it "calculates a proposal including the extra volumes specified via D-Bus" do
        expect(proposal).to receive(:calculate) do |settings|
          expect(settings.volumes.map(&:mount_path)).to include("/foo")
        end

        subject.calculate_proposal(dbus_settings)
      end

      it "calculates a proposal ignoring ommitted default values that are not mandatory" do
        expect(proposal).to receive(:calculate) do |settings|
          expect(settings.volumes.map(&:mount_path)).to_not include("/home")
        end

        subject.calculate_proposal(dbus_settings)
      end

      it "calculates a proposal ignoring templates for excluded volumes" do
        expect(proposal).to receive(:calculate) do |settings|
          expect(settings.volumes.map(&:mount_path)).to_not include "/var"
        end

        subject.calculate_proposal(dbus_settings)
      end

      it "takes all volume attributes from the provided D-Bus settings" do
        expect(proposal).to receive(:calculate) do |settings|
          root = settings.volumes.find { |v| v.mount_path == "/" }

          expect(root.auto_size).to eq(false)
          expect(root.min_size.to_i).to eq(1024)
          expect(root.max_size.to_i).to eq(2048)
          expect(root.btrfs.snapshots).to eq(true)
        end

        subject.calculate_proposal(dbus_settings)
      end

      it "completes missing volume attributes with values from the configuration" do
        expect(proposal).to receive(:calculate) do |settings|
          root = settings.volumes.find { |v| v.mount_path == "/" }
          expect(root.fs_type).to eq Y2Storage::Filesystems::Type::BTRFS
          expect(root.mount_options).to eq ["whatever=foo"]

          swap = settings.volumes.find { |v| v.mount_path == "swap" }
          expect(swap.auto_size).to eq(false)
          expect(swap.min_size.to_i).to eq(1024**3)
          expect(swap.max_size.to_i).to eq(2 * (1024**3))

          foo = settings.volumes.find { |v| v.mount_path == "/foo" }
          expect(foo.auto_size).to eq(false)
          expect(foo.min_size.to_i).to eq(10 * (1024**3))
          expect(foo.max_size).to eq Y2Storage::DiskSize.unlimited
          expect(foo.fs_type).to eq Y2Storage::Filesystems::Type::EXT4
        end

        subject.calculate_proposal(dbus_settings)
      end
    end

    xcontext "when the D-Bus settings include changes in the volume outline" do
      # TODO
    end

    xcontext "when the D-Bus settings specify auto_size for an unsupported volume" do
      # TODO
    end

    xcontext "when the D-Bus settings specify a filesystem type not listed in the outline" do
      # NOTE: do we have some mechanism to specify that any type is allowed (for example,
      # empty or omitted #filesystems in an outline
    end

    xcontext "when the D-Bus settings specify a forbidden configuration for snapshots" do
      # TODO
    end
  end
end
