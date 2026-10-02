# frozen_string_literal: true

# Copyright (c) [2019] SUSE LLC
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

RSpec.shared_examples "handles bcache configuration" do
  def planned_device(disk)
    if disk.partitions.empty?
      disk
    else
      disk.partitions.first
    end
  end

  let(:disk) { subject.planned_devices(drive).first }
  let(:device_from_profile) { drive.partitions.first }

  context "when a bcache is specified (as backing)" do

    before do
      device_from_profile.bcache_backing_for = "/dev/bcache0"
      device_from_profile.mount = nil
    end

    it "sets the device to be used as backing device for the given bcache" do
      expect(planned_device(disk).bcache_backing_for).to eq("/dev/bcache0")
    end
  end

  context "when a bcache is specified (as caching)" do
    before do
      device_from_profile.bcache_caching_for = ["/dev/bcache0"]
      device_from_profile.mount = nil
    end

    it "sets the device to be used as caching device for the given bcache" do
      expect(planned_device(disk).bcache_caching_for).to eq(["/dev/bcache0"])
    end
  end
end
