# frozen_string_literal: true

# Copyright (c) [2018] SUSE LLC
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

require "y2storage/planned/devices_collection"

RSpec.shared_examples "handles Btrfs snapshots" do
  def planned_root(devices)
    collection = Y2Storage::Planned::DevicesCollection.new(devices)
    collection.mountable_devices.find { |d| d.mount_point == "/" }
  end

  let(:devices) { subject.planned_devices(drive) }

  it "plans for snapshots by default" do
    expect(planned_root(devices).snapshots?).to eq(true)
  end

  context "when snapshots are enabled" do
    before do
      drive.enable_snapshots = true
    end

    it "plans for snapshots" do
      expect(planned_root(devices).snapshots?).to eq(true)
    end
  end

  context "when snapshots are disabled" do
    before do
      drive.enable_snapshots = false
    end

    it "does not plan for snapshots" do
      expect(planned_root(devices).snapshots?).to eq(false)
    end
  end
end
