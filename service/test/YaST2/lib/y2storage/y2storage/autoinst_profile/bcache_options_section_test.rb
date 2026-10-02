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

require_relative "../../../../../test_helper"
require_relative "../../support/shared_setup"
require_relative "#{TEST_PATH}/support/autoinst_profile_sections_examples"
require "y2storage"

describe Y2Storage::AutoinstProfile::BcacheOptionsSection do
  include_context "yast2-storage-ng test setup"

  include_examples "autoinst section"

  describe "#section_path" do
    let(:partitioning) do
      Y2Storage::AutoinstProfile::PartitioningSection.new_from_hashes(
        [{ "device" => "/dev/vda", "bcache_options" => { "cache_mode" => "writethrough" } }]
      )
    end

    let(:drive) { partitioning.drives.first }

    subject(:section) { drive.bcache_options }

    it "returns the section path" do
      expect(section.section_path.to_s).to eq("partitioning,0,bcache_options")
    end
  end
end
