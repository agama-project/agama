# frozen_string_literal: true

# Copyright (c) [2026] SUSE LLC
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

require_relative "../../test_helper"
require "agama/storage/config"
require "agama/storage/configs/partition"
require "agama/storage/configs/search"
require "agama/storage/configs/size"
require "agama/storage/device_shrinking"
require "y2storage"
require "y2storage/proposal/space_settings_builder"

using Y2Storage::Refinements::SizeCasts

describe Y2Storage::Proposal::SpaceSettingsBuilder do
  subject(:builder) { described_class.new(config) }

  let(:config) do
    instance_double(Agama::Storage::Config, partitions: partitions, logical_volumes: [])
  end

  let(:partitions) { [partition] }

  let(:partition) do
    Agama::Storage::Configs::Partition.new.tap do |config|
      config.search = Agama::Storage::Configs::Search.new.tap { |s| s.solve(device) }
      config.size = size
      config.delete = delete
    end
  end

  let(:device) { instance_double(Y2Storage::Partition, name: "/dev/vda1", size: 10.GiB) }

  let(:size) do
    Agama::Storage::Configs::Size.new.tap do |config|
      config.default = false
      config.min = 0.KiB
      config.max = 6.GiB
    end
  end

  let(:delete) { false }

  let(:shrinking) do
    instance_double(
      Agama::Storage::DeviceShrinking, supported?: supported, unsupported_reasons: reasons
    )
  end

  let(:supported) { true }

  let(:reasons) { [:NO_CONTENT] }

  let(:logger) { instance_double(Logger, info: nil) }

  before do
    allow(Agama::Storage::DeviceShrinking).to receive(:new).with(device).and_return(shrinking)
    allow(builder).to receive(:log).and_return(logger)
  end

  describe "#space_settings" do
    subject(:settings) { builder.space_settings }

    context "if the config shrinks a device that supports shrinking" do
      it "generates a resize action for the device" do
        expect(settings.resize_actions).to contain_exactly(
          an_object_having_attributes(device: "/dev/vda1", min_size: 0.KiB, max_size: 6.GiB)
        )
      end

      it "does not log anything" do
        expect(logger).to_not receive(:info)
        settings
      end
    end

    context "if the config shrinks a device that does not support shrinking" do
      let(:supported) { false }

      it "does not generate a resize action for the device" do
        expect(settings.resize_actions).to be_empty
      end

      it "logs the reasons for skipping the resize" do
        expect(logger).to receive(:info).with("Skip resizing /dev/vda1: NO_CONTENT")
        settings
      end

      context "and the device has several reasons" do
        let(:reasons) { [:RB_FILESYSTEM_FULL, :RB_MIN_SIZE_FOR_PARTITION] }

        it "logs all the reasons" do
          expect(logger).to receive(:info)
            .with("Skip resizing /dev/vda1: RB_FILESYSTEM_FULL, RB_MIN_SIZE_FOR_PARTITION")
          settings
        end
      end
    end

    context "if the config does not change the size of the device" do
      let(:size) do
        Agama::Storage::Configs::Size.new.tap do |config|
          config.default = false
          config.min = 10.GiB
          config.max = 10.GiB
        end
      end

      it "does not generate a resize action" do
        expect(settings.resize_actions).to be_empty
      end

      it "does not check whether the device can be shrunk" do
        expect(Agama::Storage::DeviceShrinking).to_not receive(:new)
        settings
      end
    end

    context "if the config only grows the device" do
      let(:size) do
        Agama::Storage::Configs::Size.new.tap do |config|
          config.default = false
          config.min = 10.GiB
          config.max = 20.GiB
        end
      end

      context "and the device does not support shrinking" do
        let(:supported) { false }

        it "does not generate a resize action" do
          expect(settings.resize_actions).to be_empty
        end
      end
    end

    context "if the config deletes a device that does not support shrinking" do
      let(:supported) { false }
      let(:delete) { true }

      it "generates a delete action for the device" do
        expect(settings.delete_actions).to contain_exactly(
          an_object_having_attributes(device: "/dev/vda1", mandatory: true)
        )
      end
    end
  end
end
