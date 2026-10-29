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

require_relative "../../../../test_helper"
require_relative "support/stubs"

module Yast2
  describe Systemd::Socket do
    include SystemdSocketStubs

    subject(:systemd_socket) { described_class }

    before do
      stub_sockets
    end

    describe ".find" do
      it "returns the unit object specified in parameter" do
        socket = systemd_socket.find "iscsid"
        expect(socket).to be_a(Systemd::Unit)
        expect(socket.unit_type).to eq("socket")
        expect(socket.unit_name).to eq("iscsid")
      end
    end

    describe ".find!" do
      it "returns the unit object specified in parameter" do
        socket = systemd_socket.find "iscsid"
        expect(socket).to be_a(Systemd::Unit)
        expect(socket.unit_type).to eq("socket")
        expect(socket.unit_name).to eq("iscsid")
      end

      it "raises Systemd::SocketNotFound error if unit does not exist" do
        stub_sockets(socket: "unknown")
        expect { systemd_socket.find!("unknown") }.to raise_error(Systemd::SocketNotFound)
      end
    end

    describe ".all" do
      it "returns all supported sockets found" do
        sockets = systemd_socket.all
        expect(sockets).to be_a(Array)
        expect(sockets).not_to be_empty
        sockets.each { |s| expect(s.unit_type).to eq("socket") }
      end

      describe ".for_service" do
        let(:finder) { instance_double(Yast2::Systemd::SocketFinder, for_service: socket) }
        let(:socket) { instance_double(Systemd::Socket) }

        before do
          subject.reset
          allow(Yast2::Systemd::SocketFinder).to receive(:new).and_return(finder)
        end

        it "returns the socket for the given service" do
          expect(subject.for_service("cups")).to eq(socket)
        end

        context "when there is no associated socket" do
          let(:socket) { nil }

          it "returns nil" do
            expect(subject.for_service("cups")).to be_nil
          end
        end
      end
    end

    describe "#listening?" do
      it "returns true if the socket is accepting connections" do
        socket = systemd_socket.find "iscsid"

        expect(socket.listening?).to eq(true)
      end

      it "returns false if the socket is dead" do
        socket = systemd_socket.find "iscsid"
        socket.properties.sub_state = "dead"

        expect(socket.listening?).to eq(false)
      end
    end
  end
end
