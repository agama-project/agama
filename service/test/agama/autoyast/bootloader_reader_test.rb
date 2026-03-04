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
require "yast"
require "agama/autoyast/bootloader_reader"

Yast.import "Profile"

describe Agama::AutoYaST::BootloaderReader do
  let(:profile) do
    { "bootloader" => { "global" => global } }
  end
  let(:global) { {} }

  subject do
    described_class.new(Yast::ProfileHash.new(profile))
  end

  describe "#read" do
    context "when there is no 'bootloader' section" do
      it "returns an empty hash" do
        expect(subject.read).to be_empty
      end
    end

    context "when kernel parameters are defined" do
      let(:global) do
        { "append" => "param0 param1" }
      end

      it "returns a hash including the 'extraKernelParams'" do
        expect(subject.read["bootloader"]).to include(
          "extraKernelParams" => "param0 param1"
        )
      end
    end

    context "when a timeout is given" do
      let(:global) do
        { "timeout" => 5 }
      end

      it "returns a hash containing the 'timeout' " do
        expect(subject.read["bootloader"]).to include(
          "timeout" => 5
        )
      end

      context "and it is a negative number" do
        let(:global) do
          { "timeout" => -1 }
        end

        it "sets the 'stopOnBootMenu' to 'true'" do
          expect(subject.read["bootloader"]).to include(
            "stopOnBootMenu" => true
          )
        end
      end
    end

    context "when update_nvram is defined" do
      let(:global) do
        { "update_nvram" => true }
      end

      it "returns a hash including the 'updateNvram'" do
        expect(subject.read["bootloader"]).to include(
          "updateNvram" => true
        )
      end
    end
  end
end
