#!/usr/bin/env rspec
# frozen_string_literal: true

# Copyright (c) [2022] SUSE LLC
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
require_relative "../support/shared_setup"
require "storage"
require "y2storage"
require_relative "#{TEST_PATH}/support/proposal_examples"
require_relative "#{TEST_PATH}/support/proposal_context"
require_relative "#{TEST_PATH}/support/candidate_devices_context"

describe Y2Storage::MinGuidedProposal do
  include_context "yast2-storage-ng test setup"

  using Y2Storage::Refinements::SizeCasts
  let(:architecture) { :x86 }

  include_context "proposal"

  let(:settings_format) { :ng }
  let(:separate_home) { true }

  let(:control_file_content) do
    { "partitioning" => { "proposal" => {}, "volumes" => volumes } }
  end

  let(:volumes) do
    [
      {
        "mount_point" => "/", "fs_type" => "xfs",
        "weight" => 0, "desired_size" => "15GiB", "min_size" => "10GiB"
      },
      {
        "mount_point" => "/home", "fs_type" => "xfs",
        "weight" => 100, "desired_size" => "10GiB", "min_size" => "10GiB"
      }
    ]
  end

  before do
    settings.candidate_devices = ["/dev/sda"]
  end

  subject(:proposal) { described_class.new(settings: settings) }

  describe "#propose" do
    context "when there is space even for the desired sizes" do
      let(:scenario) { "empty_hard_disk_50GiB" }

      it "makes a proposal using the min sizes" do
        proposal.propose

        sda2 = proposal.devices.find_by_name("/dev/sda2")
        expect(sda2).to have_attributes(
          filesystem_mountpoint: "/",
          size:                  10.GiB
        )
      end
    end

    context "when there is no space for the min sizes" do
      let(:scenario) { "empty_hard_disk_15GiB" }

      it "fails to make a proposal without raising any exception" do
        proposal.propose
        expect(proposal.failed?).to eq true
      end
    end
  end
end
