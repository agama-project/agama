#!/usr/bin/env rspec
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

RSpec.shared_context "candidate devices" do
  let(:scenario) { "empty_disks" }

  before do
    allow(sda).to receive(:usb?).and_return(sda_usb)
    allow(sdb).to receive(:usb?).and_return(sdb_usb)
    allow(sdc).to receive(:usb?).and_return(sdc_usb)

    allow(disk_analyzer).to receive(:candidate_disks).and_return([sda, sdb, sdc])

    settings.candidate_devices = candidate_devices
    settings.root_device = root_device
  end

  let(:candidate_devices) { nil }

  let(:root_device) { nil }

  let(:sda) { fake_devicegraph.find_by_name("/dev/sda") }
  let(:sdb) { fake_devicegraph.find_by_name("/dev/sdb") }
  let(:sdc) { fake_devicegraph.find_by_name("/dev/sdc") }

  let(:sda_usb) { false }
  let(:sdb_usb) { false }
  let(:sdc_usb) { false }

  def used_devices
    sids_before = fake_devicegraph.partitions.map(&:sid)

    new_partitions = proposal.devices.partitions.reject { |p| sids_before.include?(p.sid) }
    devices = new_partitions.map(&:partitionable).uniq

    devices.map(&:name)
  end
end
