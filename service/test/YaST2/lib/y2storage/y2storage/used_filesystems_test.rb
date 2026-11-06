#!/usr/bin/env rspec
# frozen_string_literal: true

# Copyright (c) [2020] SUSE LLC
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
require_relative "../support/shared_setup"

require "y2storage"
require "y2storage/used_filesystems"

describe Y2Storage::UsedFilesystems do
  include_context "yast2-storage-ng test setup"

  describe "#write" do
    before do
      fake_scenario("btrfs2-devicegraph.xml")
    end

    let(:devicegraph) { Y2Storage::StorageManager.instance.staging }

    it "writes USED_FS_LIST with correct filesystem list" do
      expect(Y2Storage::SysconfigStorage.instance).to receive("used_fs_list=").with("btrfs swap")
      Y2Storage::UsedFilesystems.new(devicegraph).write
    end
  end
end
