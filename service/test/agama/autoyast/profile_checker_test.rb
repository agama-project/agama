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

require_relative "../../test_helper"
require "agama/autoyast/profile_checker"

describe Agama::AutoYaST::ProfileChecker do
  describe "#find_unsupported" do
    context "when no unsupported elements are included" do
      let(:profile) do
        { "software" => {} }
      end

      it "returns an empty array" do
        expect(subject.find_unsupported(profile)).to eq([])
      end
    end

    context "when an unsupported section is included" do
      let(:profile) do
        { "iscsi-client" => {} }
      end

      it "returns an array with the unsupported element" do
        expect(subject.find_unsupported(profile)).to contain_exactly(
          an_object_having_attributes(key: "iscsi-client")
        )
      end
    end

    context "when an unsupported element is included" do
      let(:profile) do
        { "networking" => { "backend" => "wicked" } }
      end

      it "returns an array with the unsupported element" do
        expect(subject.find_unsupported(profile)).to contain_exactly(
          an_object_having_attributes(key: "networking.backend")
        )
      end
    end

    context "when an unsupported nested element is included" do
      let(:profile) do
        {
          "scripts" => {
            "pre-scripts" => [
              { "location" => "http://example.net/pre-script.sh",
                "rerun"    => true }
            ]
          }
        }
      end

      it "returns an array with the unsupported element" do
        expect(subject.find_unsupported(profile)).to contain_exactly(
          an_object_having_attributes(key: "scripts.pre-scripts[].rerun")
        )
      end
    end
  end
end
