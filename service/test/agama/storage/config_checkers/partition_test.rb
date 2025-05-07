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

require_relative "../storage_helpers"
require_relative "./examples"
require_relative "./context"
require "agama/storage/config_checkers/partition"

describe Agama::Storage::ConfigCheckers::Partition do
  include_context "checker"

  subject { described_class.new(partition_config, config, product_config) }

  let(:config_json) do
    {
      drives:       [
        {
          partitions: [
            {
              alias:      device_alias,
              search:     search,
              filesystem: filesystem,
              encryption: encryption
            }
          ]
        }
      ],
      volumeGroups: volume_groups
    }
  end

  let(:device_alias) { nil }
  let(:search) { nil }
  let(:filesystem) { nil }
  let(:encryption) { nil }
  let(:volume_groups) { nil }

  let(:partition_config) { config.drives.first.partitions.first }

  describe "#issues" do
    include_examples "alias issues"
    include_examples "search issues"
    include_examples "filesystem issues"
    include_examples "encryption issues"

    context "if the partition is valid" do
      let(:filesystem) { { path: "/" } }

      before { solve_config }

      it "does not report issues" do
        expect(subject.issues).to eq([])
      end
    end
  end
end
