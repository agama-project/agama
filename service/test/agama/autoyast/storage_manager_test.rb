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
require "yast"
require "agama/autoyast/storage_manager"

describe Agama::AutoYaST::StorageManager do
  before do
    allow(Yast::Execute).to receive(:locally).and_return(lsblk)
  end

  let(:lsblk) do
    File.read(File.join(FIXTURES_PATH, "lsblk.json"))
  end

  describe "#probe" do
    it "reads the storage information" do
      subject.probe
      probed = subject.probed

      expect(probed.disks).to contain_exactly(
        an_object_having_attributes(name: "/dev/sda"),
        an_object_having_attributes(name: "/dev/vda"),
        an_object_having_attributes(name: "/dev/vdb")
      )
    end
  end

  describe "#probed_disk_analyzer" do
    before do
      subject.probe
    end

    it "return the disk analyzer" do
      analyzer = subject.probed_disk_analyzer
      expect(analyzer.linux_partitions).to contain_exactly(
        an_object_having_attributes(name: "/dev/vda1"),
        an_object_having_attributes(name: "/dev/vda2")
      )

      expect(analyzer.windows_partitions).to contain_exactly(
        an_object_having_attributes(name: "/dev/vda3")
      )
    end
  end
end
