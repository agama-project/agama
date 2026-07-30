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

require_relative "../../../../test_helper"
require_relative "search_examples"
require "agama/storage/config_conversions/from_json_conversions/drive_search"

describe Agama::Storage::ConfigConversions::FromJSONConversions::DriveSearch do
  subject { described_class.new(config_json) }

  let(:config_json) do
    {
      condition:  condition,
      sort:       sort,
      max:        max,
      ifNotFound: if_not_found
    }
  end

  let(:condition) { nil }
  let(:sort) { nil }
  let(:max) { nil }
  let(:if_not_found) { nil }

  describe "#convert" do
    include_examples "a search converter"
    include_examples "a search converter supporting the name condition"
    include_examples "a search converter supporting the size condition"
    include_examples "a search converter supporting the driver condition"
    include_examples "a search converter supporting the transport condition"
    include_examples "a search converter supporting the filesystem condition"
    include_examples "a search converter supporting the partitions condition"
    include_examples "a search converter supporting operators"
    include_examples "a search converter supporting the common sort criteria"
    include_examples "a search converter rejecting the partition number sort criterion"

    context "with conditions of other kinds of devices" do
      let(:unsupported_conditions) { [{ number: 1 }, { id: "esp" }] }

      include_examples "a search converter rejecting conditions of other devices"
    end

    context "if an operator over 'driver' and 'transport' is specified" do
      let(:condition) do
        {
          and: [
            { not: { transport: "usb" } },
            { driver: "sd" }
          ]
        }
      end

      it "sets #condition to the expected value" do
        config = subject.convert
        expect(config.condition).to be_a(Agama::Storage::Configs::SearchConditions::And)

        conditions = config.condition.conditions
        expect(conditions.size).to eq(2)

        expect(conditions[0]).to be_a(Agama::Storage::Configs::SearchConditions::Not)
        inner = conditions[0].condition
        expect(inner).to be_a(Agama::Storage::Configs::SearchConditions::Transport)
        expect(inner.transport).to eq(Y2Storage::DataTransport::USB)

        expect(conditions[1]).to be_a(Agama::Storage::Configs::SearchConditions::Driver)
        expect(conditions[1].driver).to eq("sd")
      end
    end
  end
end
