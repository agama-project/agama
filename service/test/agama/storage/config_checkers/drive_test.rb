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
require "agama/storage/config_checkers/drive"

describe Agama::Storage::ConfigCheckers::Drive do
  include_context "checker"

  subject { described_class.new(drive_config, product_config) }

  let(:config_json) do
    {
      drives: [
        {
          search:     search,
          filesystem: filesystem,
          encryption: encryption,
          partitions: partitions
        }
      ]
    }
  end

  let(:search) { nil }
  let(:filesystem) { nil }
  let(:encryption) { nil }
  let(:partitions) { nil }

  let(:drive_config) { config.drives.first }

  describe "#issues" do
    include_examples "search issues"
    include_examples "filesystem issues"
    include_examples "encryption issues"
    include_examples "partitions issues"

    context "if the drive is valid" do
      let(:search) { "/dev/vda" }
      let(:filesystem) { { path: "/" } }

      before { solve_config }

      it "does not report issues" do
        expect(subject.issues).to eq([])
      end
    end
  end
end
