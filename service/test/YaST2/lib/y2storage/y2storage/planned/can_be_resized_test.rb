#!/usr/bin/env rspec
# frozen_string_literal: true

# Copyright (c) [2017] SUSE LLC
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
require "y2storage"

describe Y2Storage::Planned::CanBeResized do
  include_context "yast2-storage-ng test setup"

  using Y2Storage::Refinements::SizeCasts

  # Dummy class to test the mixing
  class ResizableDevice < Y2Storage::Planned::Device
    include Y2Storage::Planned::HasSize
    include Y2Storage::Planned::CanBeResized
  end

  subject(:planned) { ResizableDevice.new }

  let(:real_device) { instance_double(Y2Storage::Partition, size: 50.GiB) }
  let(:devicegraph) { instance_double(Y2Storage::Devicegraph) }
  let(:resize_ok) { true }

  let(:resize_info) do
    instance_double(Y2Storage::ResizeInfo, min_size: 5.GiB, max_size: 9.GiB, resize_ok?: resize_ok,
      reasons: 0, reason_texts: [])
  end

  before do
    allow(planned).to receive(:device_to_reuse).with(devicegraph)
      .and_return(real_device)
    allow(real_device).to receive(:detect_resize_info).and_return(resize_info)
  end

  describe "#reuse_device!" do
    let(:max_size) { 7.GiB }
    let(:resize) { true }

    before do
      allow(real_device).to receive(:size=)
      planned.max_size = max_size
      planned.resize = resize
    end

    it "sets device size" do
      expect(real_device).to receive(:size=).with(planned.max_size)
      planned.reuse!(devicegraph)
    end

    it "does not log any warning regarding resizing" do
      allow(real_device).to receive(:size).and_return(planned.max_size)
      expect(planned.log).to_not receive(:warn).with(/Resizing/)
      planned.reuse!(devicegraph)
    end

    context "when expected size is smaller than minimal allowed size" do
      let(:max_size) { 1.GiB }

      it "uses the minimal size" do
        expect(real_device).to receive(:size=).with(resize_info.min_size)
        planned.reuse!(devicegraph)
      end

      it "logs a warning" do
        expect(planned.log).to receive(:warn).with(/Resizing/)
        planned.reuse!(devicegraph)
      end
    end

    context "when expected size is greater than maximal allowed size" do
      let(:max_size) { 15.GiB }

      it "uses the maximal size" do
        expect(real_device).to receive(:size=).with(resize_info.max_size)
        planned.reuse!(devicegraph)
      end

      it "logs a warning" do
        expect(planned.log).to receive(:warn).with(/Resizing/)
        planned.reuse!(devicegraph)
      end
    end

    context "when expected size is unlimited" do
      let(:max_size) { Y2Storage::DiskSize.unlimited }

      it "uses the maximal size" do
        expect(real_device).to receive(:size=).with(resize_info.max_size)
        planned.reuse!(devicegraph)
      end

      it "does not log any warning regarding resizing" do
        expect(planned.log).to_not receive(:warn).with(/Resizing/)
        planned.reuse!(devicegraph)
      end
    end

    context "when device is not meant to be resized" do
      let(:resize) { false }

      it "does not modify device size" do
        expect(real_device).to_not receive(:size=)
        planned.reuse!(devicegraph)
      end
    end

    context "when device cannot be resized" do
      let(:resize_ok) { false }

      it "does not modify device size" do
        expect(real_device).to_not receive(:size=)
        planned.reuse!(devicegraph)
      end
    end
  end

  describe "#resize?" do
    before do
      planned.resize = resize
    end

    context "when the device is meant to be resized" do
      let(:resize) { true }

      it "returns true" do
        expect(planned.resize?).to eq(true)
      end
    end

    context "when the device is meant to not be resized" do
      let(:resize) { false }

      it "returns false" do
        expect(planned.resize?).to eq(false)
      end
    end
  end

  describe "#shrink?" do
    before do
      planned.max_size = size
    end

    context "when the device is going to be resized to a smaller size" do
      let(:size) { 49.GiB }

      it "returns true" do
        expect(planned.shrink?(devicegraph)).to eq(true)
      end
    end

    context "when the device is going to be resized to a greater size" do
      let(:size) { 51.GiB }

      it "returns false" do
        expect(planned.shrink?(devicegraph)).to eq(false)
      end
    end
  end

  describe "#limit_grow" do
    before { planned.max_size = 70.GiB }

    it "limits the max size if the sum of the new limit and the original size is smaller" do
      planned.limit_grow(5.GiB, devicegraph)
      expect(planned.max_size).to eq 55.GiB
    end

    it "leaves the max size untouched if the sum of original size and limit is bigger" do
      planned.limit_grow(50.GiB, devicegraph)
      expect(planned.max_size).to eq 70.GiB
    end
  end
end
