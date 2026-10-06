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


require "installation/finish_client"

class TestFinish < ::Installation::FinishClient
  def info
    "info"
  end

  def write
    "write"
  end
end

describe ::Installation::FinishClient do
  subject { ::TestFinish }
  describe ".run" do
    it "raise ArgumentError exception if unknown first argument is passed" do
      allow(Yast::WFM).to receive(:Args).and_return(["Unknown", {}])
      expect { ::Installation::FinishClient.run }.to raise_error(ArgumentError)
    end

    context "first client argument is Info" do
      before do
        allow(Yast::WFM).to receive(:Args).and_return(["Info"])
      end

      it "dispatch call to abstract method info" do
        expect(subject.run).to eq "info"
      end

      it "raise NotImplementedError exception if abstract method not defined" do
        expect { ::Installation::FinishClient.run }.to raise_error(NotImplementedError)
      end
    end

    context "first client argument is Write" do
      before do
        allow(Yast::WFM).to receive(:Args).and_return(["Write"])
      end

      it "dispatch call to abstract method write" do
        expect(subject.run).to eq "write"
      end

      it "raise NotImplementedError exception if abstract method not defined" do
        expect { ::Installation::FinishClient.run }.to raise_error(NotImplementedError)
      end
    end
  end
end
