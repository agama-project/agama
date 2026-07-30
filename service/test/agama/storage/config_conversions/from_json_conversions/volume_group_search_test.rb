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
require "agama/storage/config_conversions/from_json_conversions/volume_group_search"

describe Agama::Storage::ConfigConversions::FromJSONConversions::VolumeGroupSearch do
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
    include_examples "a search converter supporting operators"
    include_examples "a search converter supporting the common sort criteria"
    include_examples "a search converter rejecting the partition number sort criterion"

    context "with conditions of other kinds of devices" do
      let(:unsupported_conditions) do
        [
          { driver: "ahci" },
          { transport: "usb" },
          { number: 1 },
          { id: "esp" },
          { filesystem: "any" },
          { partitions: "any" }
        ]
      end

      include_examples "a search converter rejecting conditions of other devices"
    end
  end
end
