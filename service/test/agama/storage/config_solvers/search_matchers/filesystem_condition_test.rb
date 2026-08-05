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

require_relative "../../storage_helpers"
require_relative "examples"
require "agama/storage/config_solvers/search_matchers/filesystem_condition"
require "agama/storage/configs/search_conditions"
require "y2storage"

describe Agama::Storage::ConfigSolvers::SearchMatchers::FilesystemCondition do
  include Agama::RSpec::StorageHelpers
  include Agama::RSpec::SearchMatcherHelpers

  subject { described_class.new }

  before do
    mock_storage(devicegraph: "disks.yaml")
  end

  let(:devicegraph) { Y2Storage::StorageManager.instance.probed }

  describe "#match?" do
    # Formatted (btrfs with label).
    let(:formatted_device) { devicegraph.find_by_name("/dev/vda2") }
    # Unformatted.
    let(:unformatted_device) { devicegraph.find_by_name("/dev/vda1") }
    let(:filesystem_type) { "btrfs" }
    let(:other_filesystem_type) { "xfs" }

    include_examples "a matcher supporting the filesystem condition"

    # Nested conditions that cannot be built from their JSON representation.
    context "with a nested condition built by hand" do
      def filesystem_condition(nested)
        Agama::Storage::Configs::SearchConditions::Filesystem.new(condition: nested)
      end

      it "matches a formatted device if the nested condition has no type" do
        nested = Agama::Storage::Configs::SearchConditions::FilesystemType.new
        expect(subject.match?(filesystem_condition(nested), formatted_device)).to eq(true)
      end

      it "matches a formatted device if the nested condition has no label" do
        nested = Agama::Storage::Configs::SearchConditions::FilesystemLabel.new
        expect(subject.match?(filesystem_condition(nested), formatted_device)).to eq(true)
      end

      it "does not match if the nested condition does not apply to a filesystem" do
        nested = Agama::Storage::Configs::SearchConditions::Name.new(formatted_device.name)
        expect(subject.match?(filesystem_condition(nested), formatted_device)).to eq(false)
      end

      it "does not match an unformatted device, no matter the nested condition" do
        nested = Agama::Storage::Configs::SearchConditions::FilesystemType.new
        expect(subject.match?(filesystem_condition(nested), unformatted_device)).to eq(false)
      end
    end
  end
end
