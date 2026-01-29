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

require_relative "../config_context"
require_relative "./examples"
require "agama/storage/config_checkers/logical_volume"

describe Agama::Storage::ConfigCheckers::LogicalVolume do
  include_context "config"

  subject { described_class.new(lv_config, config, product_config) }

  let(:config_json) do
    {
      volumeGroups: [
        {
          logicalVolumes: [
            {
              filesystem: filesystem,
              encryption: encryption,
              usedPool:   pool
            },
            {
              alias: "pool",
              pool:  true
            }
          ]
        }
      ]
    }
  end

  let(:filesystem) { nil }
  let(:encryption) { nil }
  let(:pool) { nil }

  let(:lv_config) { config.volume_groups.first.logical_volumes.first }

  describe "#issues" do
    include_examples "filesystem issues"
    include_examples "encryption issues"

    context "if the logical volume has an unknown pool" do
      let(:pool) { "unknown" }

      it "includes the expected issue" do
        issues = subject.issues
        expect(issues).to include an_object_having_attributes(
          kind:        Agama::Storage::IssueClasses::Config::NO_SUCH_ALIAS,
          description: /no LVM thin pool/
        )
      end
    end

    context "if the logical volume has a known pool" do
      let(:pool) { "pool" }

      it "does not include an issue" do
        issues = subject.issues
        expect(issues).to_not include an_object_having_attributes(
          kind:        Agama::Storage::IssueClasses::Config::NO_SUCH_ALIAS,
          description: /no LVM thin pool/
        )
      end
    end

    context "if the logical volume is valid" do
      let(:filesystem) { { path: "/" } }

      before { solve_config }

      it "does not report issues" do
        expect(subject.issues).to eq([])
      end
    end
  end
end
