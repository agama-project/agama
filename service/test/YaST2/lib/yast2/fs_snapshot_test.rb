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

require_relative "../../../test_helper"

require "yast2/fs_snapshot"

describe Yast2::FsSnapshot do
  describe ".configure_on_install?" do
    # This test assumes #configure_on_install= has not been called in the
    # testsuite
    it "returns false unless explicitly set to true" do
      expect(described_class.configure_on_install?).to eq false
    end
  end

  describe ".configure_snapper" do
    before do
      Yast.import "Mode"
      Yast.import "Stage"

      allow(Yast::Stage).to receive(:initial).and_return true
      allow(Yast::Mode).to receive(:installation).and_return(mode == :installation)
      allow(Yast::WFM).to receive(:scr_chrooted?).and_return chrooted
    end

    context "in normal mode (no installation)" do
      let(:mode) { :normal }
      let(:chrooted) { false }

      it "raises a SnapperNotConfigurable error" do
        expect { described_class.configure_snapper }.to raise_error(Yast2::SnapperNotConfigurable)
      end
    end

    context "during installation" do
      let(:mode) { :installation }

      context "before the chroot switch to the target system" do
        let(:chrooted) { false }

        it "raises a SnapperNotConfigurable error" do
          expect { described_class.configure_snapper }.to raise_error(Yast2::SnapperNotConfigurable)
        end
      end

      context "after chrooting to the target system" do
        let(:chrooted) { true }

        before do
          allow(Yast::Execute).to receive(:on_target)
          allow(Yast::SCR).to receive(:Write)
        end

        it "executes the fourth step of Snapper's installation helper" do
          expect(Yast::Execute).to receive(:on_target).with(/snapper\/installation-helper/,
            "--step", "4")
          described_class.configure_snapper
        end

        it "sets Snapper config" do
          expect(Yast::Execute).to receive(:on_target).with(/snapper$/, "--no-dbus", "set-config",
            any_args)
          described_class.configure_snapper
        end

        it "configures YaST to use snapper" do
          expect(Yast::SCR).to receive(:Write).with(path(".sysconfig.yast2.USE_SNAPPER"), "yes")
          described_class.configure_snapper
        end

        it "sets Snapper quota" do
          expect(Yast::Execute).to receive(:on_target).with(/snapper$/, "--no-dbus", "setup-quota")
          described_class.configure_snapper
        end
      end
    end
  end
end
