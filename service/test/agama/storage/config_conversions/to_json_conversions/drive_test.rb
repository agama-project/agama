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

require_relative "../../../../test_helper"
require_relative "./examples"
require "agama/storage/config_conversions/from_json_conversions/drive"
require "agama/storage/config_conversions/to_json_conversions/drive"

describe Agama::Storage::ConfigConversions::ToJSONConversions::Drive do
  subject { described_class.new(config) }

  let(:config) do
    Agama::Storage::ConfigConversions::FromJSONConversions::Drive
      .new(config_json)
      .convert
  end

  let(:config_json) do
    {
      search:     search,
      alias:      device_alias,
      encryption: encryption,
      filesystem: filesystem,
      ptableType: ptable_type,
      partitions: partitions
    }
  end

  let(:search) { nil }
  let(:device_alias) { nil }
  let(:encryption) { nil }
  let(:filesystem) { nil }
  let(:ptable_type) { nil }
  let(:partitions) { nil }

  describe "#convert" do
    it "returns a Hash" do
      expect(subject.convert).to be_a(Hash)
    end

    context "if #search is not configured" do
      let(:search) { nil }

      it "generates the expected JSON" do
        config_json = subject.convert
        search_json = config_json[:search]

        expect(search_json).to eq(
          { ifNotFound: "error", max: 1 }
        )
      end
    end

    include_examples "without alias"
    include_examples "without encryption"
    include_examples "without filesystem"
    include_examples "without ptable_type"
    include_examples "without partitions"
    include_examples "with search"
    include_examples "with alias"
    include_examples "with encryption"
    include_examples "with filesystem"
    include_examples "with ptable_type"
    include_examples "with partitions"
  end
end
