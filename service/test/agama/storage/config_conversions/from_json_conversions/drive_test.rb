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
require "agama/storage/configs/drive"
require "agama/storage/configs/search"

describe Agama::Storage::ConfigConversions::FromJSONConversions::Drive do
  subject do
    described_class.new(drive_json)
  end

  describe "#convert" do
    let(:drive_json) do
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

    it "returns a drive config" do
      drive = subject.convert
      expect(drive).to be_a(Agama::Storage::Configs::Drive)
    end

    context "if 'search' is not specified" do
      let(:search) { nil }

      it "sets #search to the expected value" do
        drive = subject.convert
        expect(drive.search).to be_a(Agama::Storage::Configs::Search)
        expect(drive.search.name).to be_nil
        expect(drive.search.if_not_found).to eq(:error)
      end
    end

    include_examples "without alias"
    include_examples "without encryption"
    include_examples "without filesystem"
    include_examples "without ptableType"
    include_examples "without partitions"
    include_examples "with search"
    include_examples "with alias"
    include_examples "with encryption"
    include_examples "with filesystem"
    include_examples "with ptableType"
    include_examples "with partitions"
  end
end
