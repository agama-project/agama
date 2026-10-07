#!/usr/bin/env rspec
# Copyright (c) [2018] SUSE LLC
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

require_relative "../test_helper"
require "yast2/systemd/socket_finder"

describe Yast2::Systemd::SocketFinder do
  subject(:finder) { described_class.new }

  let(:systemctl_result) do
    OpenStruct.new(
      exit:   0,
      stdout: "Id=cups.socket\nTriggers=cups.service\n\nId=sckt1.socket\nTriggers=srvc1.service\n"
    )
  end

  before do
    allow(Yast2::Systemctl).to receive(:execute)
      .with("show --property Id,Triggers cups.socket sckt1.socket")
      .and_return(systemctl_result)
    allow(Yast::Execute).to receive(:on_target).and_return(
      "UNIT FILE                       STATE   \n" \
      "cups.socket                     enabled \n" \
      "sckt1.socket                    disabled\n"
    )
  end

  describe "#for_service" do
    let(:socket) { double("socket") }

    it "returns the related socket" do
      expect(Yast2::Systemd::Socket).to receive(:find).with("sckt1").and_return(socket)
      expect(finder.for_service("srvc1")).to eq(socket)
    end

    context "when there is no related socket" do
      it "returns nil" do
        expect(finder.for_service("httpd")).to be_nil
      end

      it "does not try to read the socket" do
        expect(Yast2::Systemd::Socket).to_not receive(:find)
        expect(finder.for_service("httpd")).to be_nil
      end
    end

    context "on 1st stage" do
      before do
        allow(Yast::Stage).to receive(:initial).and_return(true)
      end

      it "returns a socket named after the service" do
        expect(Yast2::Systemd::Socket).to receive(:find).with("cups").and_return(socket)
        expect(finder.for_service("cups")).to eq(socket)
      end

      context "when there is no related socket" do
        before do
          allow(Yast2::Systemd::Socket).to receive(:find).with("httpd").and_return(nil)
        end

        it "returns nil" do
          expect(finder.for_service("httpd")).to be_nil
        end
      end
    end
  end
end
