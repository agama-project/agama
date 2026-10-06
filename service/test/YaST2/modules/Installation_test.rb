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

require_relative "../../test_helper"

Yast.import "Installation"

describe Yast::Installation do
  subject { Yast::Installation }

  describe ".sourcedir" do
    before do
      allow(::File).to receive(:exist?).and_return(true)
    end

    it "returns string" do
      expect(subject.sourcedir).to eq "/run/YaST2/mount"
    end

    it "ensures that directory exists" do
      expect(::File).to receive(:exist?).and_return(false)
      expect(::FileUtils).to receive(:mkdir_p)

      subject.sourcedir
    end
  end

  # test the module constructor
  describe "#Installation (module constructor)" do
    after(:each) do
      # reset the value after each run
      subject.destdir = "/"
    end

    context "in a running system" do
      before do
        # mock a running system
        allow(Yast::Stage).to receive(:cont).and_return(false)
        allow(Yast::Stage).to receive(:initial).and_return(false)

        allow(Yast::WFM).to receive(:scr_root).and_return(scr_chroot)
        allow(Yast::WFM).to receive(:scr_chrooted?).and_return(scr_chroot != "/")
      end

      context "SCR runs in a chroot" do
        let(:scr_chroot) { "/mnt" }

        it "sets the 'destdir' to the chroot" do
          subject.Installation
          expect(subject.destdir).to eq(scr_chroot)
        end
      end

      context "SCR runs in the root" do
        let(:scr_chroot) { "/" }

        it "leaves the 'destdir' at the default root" do
          subject.Installation
          expect(subject.destdir).to eq(scr_chroot)
        end
      end
    end
  end
end
