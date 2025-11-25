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
require "agama/storage/config_checkers/search"
require "y2storage/disk"

describe Agama::Storage::ConfigCheckers::Search do
  subject { described_class.new(config) }

  let(:config) { Agama::Storage::Configs::Drive.new }

  describe "#issues" do
    context "if the device is not found" do
      before do
        config.search.solve
      end

      context "and the device can be skipped" do
        before do
          config.search.if_not_found = :skip
        end

        it "does not include any issue" do
          expect(subject.issues).to be_empty
        end
      end

      context "and the device cannot be skipped" do
        before do
          config.search.if_not_found = :error
        end

        it "includes the expected issue" do
          issues = subject.issues
          expect(issues).to include an_object_having_attributes(
            kind:        Agama::Storage::IssueClasses::Config::SEARCH,
            description: "Mandatory drive not found"
          )
        end
      end
    end

    context "if the device is found" do
      before do
        config.search.solve(disk)
      end

      let(:disk) { instance_double(Y2Storage::Disk) }

      it "does not include an issue" do
        expect(subject.issues.size).to eq(0)
      end
    end
  end
end
