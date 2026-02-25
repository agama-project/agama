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
require "agama/storage/config_checkers/filesystem"

describe Agama::Storage::ConfigCheckers::Filesystem do
  include_context "config"

  subject { described_class.new(drive_config, product_config) }

  let(:config_json) do
    {
      drives: [
        { filesystem: filesystem }
      ]
    }
  end

  let(:drive_config) { config.drives.first }

  describe "#issues" do
    context "with invalid type" do
      let(:filesystem) do
        {
          path:            "/",
          type:            "vfat",
          reuseIfPossible: reuse
        }
      end

      context "and without reusing the filesystem" do
        let(:reuse) { false }

        it "includes the expected issue" do
          issues = subject.issues
          expect(issues).to include an_object_having_attributes(
            kind:        Agama::Storage::IssueClasses::Config::WRONG_FILESYSTEM_TYPE,
            description: /type 'FAT' is not suitable for '\/'/
          )
        end
      end

      context "and reusing the filesystem" do
        let(:reuse) { true }

        it "does not include an issue" do
          expect(subject.issues.size).to eq(0)
        end
      end
    end

    context "with valid type" do
      let(:filesystem) do
        {
          path: "/",
          type: "btrfs"
        }
      end

      it "does not include an issue" do
        expect(subject.issues.size).to eq(0)
      end
    end

    context "without a filesystem type" do
      let(:filesystem) do
        {
          path:            "/",
          reuseIfPossible: reuse
        }
      end

      context "and without reusing the filesystem" do
        let(:reuse) { false }

        it "includes the expected issue" do
          issues = subject.issues
          expect(issues).to include an_object_having_attributes(
            kind:        Agama::Storage::IssueClasses::Config::NO_FILESYSTEM_TYPE,
            description: /Missing file system type for '\/'/
          )
        end
      end

      context "and reusing the filesystem" do
        let(:reuse) { true }

        it "does not include an issue" do
          expect(subject.issues.size).to eq(0)
        end
      end
    end
  end
end
