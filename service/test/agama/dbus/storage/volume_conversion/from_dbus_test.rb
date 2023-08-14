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

require_relative "../../../../test_helper"
require "agama/config"
require "agama/storage/volume"
require "agama/storage/volume_templates_builder"
require "agama/dbus/storage/volume_conversion/from_dbus"

# TODO: Move to a better place. It would be useful in other test files.
RSpec::Matchers.define(:eq_outline) do |expected|
  match do |received|
    methods = [
      :required?, :filesystems, :base_min_size, :base_max_size, :adjust_by_ram?,
      :min_size_fallback_for, :max_size_fallback_for, :snapshots_configurable?, :snapshots_size,
      :snapshots_percentage
    ]

    methods.all? { |m| received.public_send(m) == expected.public_send(m) }
  end

  failure_message do |received|
    "Volume outline does not match.\n" \
      "Expected: #{expected.inspect}\n" \
      "Received: #{received.inspect}"
  end
end

describe Agama::DBus::Storage::VolumeConversion::FromDBus do
  subject { described_class.new(dbus_volume, config: config) }

  let(:config) { Agama::Config.new(config_data) }

  let(:config_data) do
    {
      "storage" => {
        "volume_templates" => [
          {
            "mount_path" => "/test",
            "outline"    => { "required" => true }
          }
        ]
      }
    }
  end

  describe "#convert" do
    let(:dbus_volume) do
      {
        "MountPath"    => "/test",
        "MountOptions" => ["rw", "default"],
        "TargetDevice" => "/dev/sda",
        "TargetVG"     => "/dev/system",
        "FsType"       => "Ext4",
        "MinSize"      => 1024,
        "MaxSize"      => 2048,
        "AutoSize"     => true,
        "Snapshots"    => true
      }
    end

    it "generates a volume from D-Bus values" do
      volume = subject.convert

      expect(volume).to be_a(Agama::Storage::Volume)
      expect(volume.mount_path).to eq("/test")
      expect(volume.mount_options).to contain_exactly("rw", "default")
      expect(volume.device).to eq("/dev/sda")
      expect(volume.separate_vg_name).to eq("/dev/system")
      expect(volume.fs_type).to eq(Y2Storage::Filesystems::Type::EXT4)
      expect(volume.min_size.to_i).to eq(1024)
      expect(volume.max_size.to_i).to eq(2048)
      expect(volume.auto_size?).to eq(true)
      expect(volume.btrfs.snapshots).to eq(true)

      default_volume = Agama::Storage::VolumeTemplatesBuilder.new_from_config(config).for("/test")

      expect(volume.outline).to eq_outline(default_volume.outline)
    end

    context "when a value is not provided from D-Bus" do
      let(:dbus_settings) { {} }

      xit "generates a volume with default values from config" do
        # TODO
      end
    end
  end
end
