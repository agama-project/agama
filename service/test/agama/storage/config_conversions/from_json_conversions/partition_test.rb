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
require "agama/storage/config_conversions/from_json_conversions/partition"
require "agama/storage/configs/partition"
require "y2storage/partition_id"

describe Agama::Storage::ConfigConversions::FromJSONConversions::Partition do
  subject do
    described_class.new(partition_json)
  end

  describe "#convert" do
    let(:partition_json) do
      {
        id:             id,
        search:         search,
        alias:          device_alias,
        size:           size,
        encryption:     encryption,
        filesystem:     filesystem,
        delete:         delete,
        deleteIfNeeded: delete_if_needed
      }
    end

    let(:id) { nil }
    let(:search) { nil }
    let(:device_alias) { nil }
    let(:size) { nil }
    let(:encryption) { nil }
    let(:filesystem) { nil }
    let(:delete) { nil }
    let(:delete_if_needed) { nil }

    it "returns a partition config" do
      partition = subject.convert
      expect(partition).to be_a(Agama::Storage::Configs::Partition)
    end

    context "if 'id' is not specified" do
      let(:id) { nil }

      it "does not set #id" do
        partition = subject.convert
        expect(partition.id).to be_nil
      end
    end

    include_examples "without search"
    include_examples "without alias"
    include_examples "without size"
    include_examples "without encryption"
    include_examples "without filesystem"
    include_examples "without delete"
    include_examples "without deleteIfNeeded"

    context "if 'id' is specified" do
      let(:id) { "esp" }

      it "sets #id to the expected value" do
        partition = subject.convert
        expect(partition.id).to eq(Y2Storage::PartitionId::ESP)
      end
    end

    include_examples "with search"
    include_examples "with alias"
    include_examples "with size"
    include_examples "with encryption"
    include_examples "with filesystem"
    include_examples "with delete"
    include_examples "with deleteIfNeeded"
  end
end
