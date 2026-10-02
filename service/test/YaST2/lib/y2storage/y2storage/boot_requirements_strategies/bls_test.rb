# frozen_string_literal: true

# Copyright (c) [2025] SUSE LLC
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

describe Y2Storage::BootRequirementsStrategies::BLS do
  include_context "yast2-storage-ng test setup"

  subject { described_class.new(fake_devicegraph, [], "/dev/sda1") }

  before do
    fake_scenario("empty_disks")
    allow(Y2Storage::BootRequirementsStrategies::Analyzer).to receive(:new).and_return(analyzer)
    allow(analyzer).to receive(:free_mountpoint?).and_return(false)
  end

  let(:analyzer) do
    Y2Storage::BootRequirementsStrategies::Analyzer.new(fake_devicegraph, [], "/dev/sda1")
  end

  describe ".needed_partitions" do
    let(:target) { :desired }
    it "does not return own /boot partition" do
      ret = subject.needed_partitions(target)
      expect(ret.any? { |p| p.mount_point == "/boot" }).to eq(false)
    end
  end
end
