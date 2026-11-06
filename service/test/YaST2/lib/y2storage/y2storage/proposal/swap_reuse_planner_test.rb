#!/usr/bin/env rspec
# frozen_string_literal: true

# Copyright (c) [2024] SUSE LLC
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

require_relative "#{TEST_PATH}/support/devices_planner_context"

require "storage"
require "y2storage"

describe Y2Storage::Proposal::SwapReusePlanner do
  include_context "yast2-storage-ng test setup"

  describe "#adjust_devices" do
    using Y2Storage::Refinements::SizeCasts

    include_context "devices planner"

    subject { described_class.new(settings, devicegraph) }

    let(:settings) { Y2Storage::ProposalSettings.new_for_current_product }
    let(:password) { nil }
    let(:target) { :desired }
    let(:control_file_content) do
      {
        "proposal" => {
          "lvm" => lvm
        },
        "volumes"  => [volume]
      }
    end
    let(:volume) do
      {
        "mount_point"  => "swap",
        "fs_type"      => :swap,
        "desired_size" => "2 GiB",
        "min_size"     => "1 GiB",
        "max_size"     => "10 GiB"
      }
    end
    let(:planned_devices) { devices_planner.volumes_planned_devices(target, fake_devicegraph) }
    let(:devices_planner) { Y2Storage::Proposal::DevicesPlanner.new(settings) }

    before do
      settings.encryption_password = password
      allow(devicegraph).to receive(:blk_devices).and_return([disk])
      allow(disk).to receive(:swap_partitions).and_return(swap_partitions)
    end

    let(:disk) { instance_double("Y2Storage::Disk", name: "/dev/sda", partitions: partitions) }

    let(:planned_swap) { planned_devices.select { |d| d.mount_point == "swap" } }

    context "when there is a swap partition big enough" do
      let(:swap_partitions) { [swap_double("/dev/sdaX", 3.GiB)] }

      context "if proposing an LVM setup" do
        let(:lvm) { true }

        context "without encryption" do
          let(:password) { nil }

          it "does not set any swap reusing" do
            subject.adjust_devices(planned_devices)
            expect(planned_swap).to contain_exactly(
              an_object_having_attributes(reuse_name: nil)
            )
          end
        end

        context "with encryption" do
          let(:password) { "12345678" }

          it "does not set any swap reusing" do
            subject.adjust_devices(planned_devices)
            expect(planned_swap).to contain_exactly(
              an_object_having_attributes(reuse_name: nil)
            )
          end
        end
      end

      context "if proposing a partition-based setup" do
        let(:lvm) { false }

        context "without encryption" do
          let(:password) { nil }

          it "adjust the volume to reuse the existing swap" do
            subject.adjust_devices(planned_devices)
            expect(planned_swap).to contain_exactly(
              an_object_having_attributes(reuse_name: "/dev/sdaX")
            )
          end
        end

        context "with encryption" do
          let(:password) { "12345678" }

          it "does not set any swap reusing" do
            subject.adjust_devices(planned_devices)
            expect(planned_swap).to contain_exactly(
              an_object_having_attributes(reuse_name: nil)
            )
          end
        end
      end
    end

    context "and there is no a swap partition big enough" do
      let(:swap_partitions) { [swap_double("/dev/sdaX", 1.GiB)] }
      let(:lvm) { false }

      it "does not set any swap reusing" do
        subject.adjust_devices(planned_devices)
        expect(planned_swap).to contain_exactly(
          an_object_having_attributes(reuse_name: nil)
        )
      end
    end

    context "and there is no previous swap partition" do
      let(:swap_partitions) { [] }
      let(:lvm) { false }

      it "does not set any swap reusing" do
        subject.adjust_devices(planned_devices)
        expect(planned_swap).to contain_exactly(
          an_object_having_attributes(reuse_name: nil)
        )
      end
    end
  end
end
