# frozen_string_literal: true

# Copyright (c) [2024] SUSE LLC
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
require "agama/storage/proposal_settings"

describe Agama::Storage::ProposalSettings do
  describe "#use_lvm?" do
    context "if LVM is enabled" do
      before do
        subject.lvm.enabled = true
      end

      it "returns true" do
        expect(subject.use_lvm?).to eq(true)
      end
    end

    context "if LVM is not enabled" do
      before do
        subject.lvm.enabled = false
      end

      context "and a VG is reused" do
        before do
          subject.lvm.reused_vg = "/dev/vg0"
        end

        it "returns true" do
          expect(subject.use_lvm?).to eq(true)
        end
      end

      context "and no VG is reused" do
        before do
          subject.lvm.reused_vg = nil
        end

        it "returns false" do
          expect(subject.use_lvm?).to eq(false)
        end
      end
    end
  end
end
