# frozen_string_literal: true

# Copyright (c) [2023] SUSE LLC
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
require "agama/dbus/storage/iscsi_node"
require "agama/storage/iscsi/manager"
require "agama/storage/iscsi/node"

describe Agama::DBus::Storage::ISCSINode do
  subject { described_class.new(iscsi_manager, iscsi_node, path, logger: logger) }

  let(:iscsi_manager) { Agama::Storage::ISCSI::Manager.new }

  let(:iscsi_node) { Agama::Storage::ISCSI::Node.new }

  let(:path) { "/org/opensuse/DInstaller/Storage1/iscsi_nodes/1" }

  let(:logger) { Logger.new($stdout, level: :warn) }

  before do
    allow(subject).to receive(:dbus_properties_changed)
  end

  describe "#startup=" do
    context "when the given startup status is not valid" do
      let(:startup) { "invalid" }

      it "raises a D-Bus error" do
        expect(iscsi_manager).to_not receive(:update)

        expect { subject.startup = startup }.to raise_error(::DBus::Error, /Invalid startup/)
      end
    end

    context "when the given startup status is valid" do
      let(:startup) { "automatic" }

      it "updates the iSCSI node" do
        expect(iscsi_manager).to receive(:update).with(iscsi_node, startup: startup)

        subject.startup = startup
      end
    end
  end

  describe "#iscsi_node=" do
    it "sets the iSCSI node value" do
      node = Agama::Storage::ISCSI::Node.new
      expect(subject.iscsi_node).to_not eq(node)

      subject.iscsi_node = node
      expect(subject.iscsi_node).to eq(node)
    end

    it "emits properties changed signal" do
      expect(subject).to receive(:dbus_properties_changed)

      subject.iscsi_node = Agama::Storage::ISCSI::Node.new
    end
  end

  describe "#login" do
    it "creates an iSCSI session" do
      expect(iscsi_manager).to receive(:login) do |node, auth, startup:|
        expect(node).to eq(iscsi_node)
        expect(auth).to be_a(Y2IscsiClient::Authentication)
        expect(startup).to be_nil
      end

      subject.login
    end

    it "uses the given startup status" do
      expect(iscsi_manager).to receive(:login).with(anything, anything, startup: "automatic")

      subject.login({ "Startup" => "automatic" })
    end

    context "when no authentication options are given" do
      it "uses an empty authentication" do
        expect(iscsi_manager).to receive(:login) do |_, auth|
          expect(auth.by_target?).to eq(false)
          expect(auth.by_initiator?).to eq(false)
        end

        subject.login
      end
    end

    context "when authentication options are given" do
      let(:auth_options) do
        {
          "Username"        => "testi",
          "Password"        => "testi",
          "ReverseUsername" => "testt",
          "ReversePassword" => "testt"
        }
      end

      it "uses the expected authentication" do
        expect(iscsi_manager).to receive(:login) do |_, auth|
          expect(auth.username).to eq("testi")
          expect(auth.password).to eq("testi")
          expect(auth.username_in).to eq("testt")
          expect(auth.password_in).to eq("testt")
        end

        subject.login(auth_options)
      end
    end

    context "when the action successes" do
      before do
        allow(iscsi_manager).to receive(:login).and_return(true)
      end

      it "returns 0" do
        expect(subject.login).to eq(0)
      end
    end

    context "when the given startup value is not valid" do
      let(:startup) { "invalid" }

      it "returns 1" do
        expect(subject.login({ "Startup" => startup })).to eq(1)
      end
    end

    context "when the action fails" do
      before do
        allow(iscsi_manager).to receive(:login).and_return(false)
      end

      it "returns 2" do
        expect(subject.login).to eq(2)
      end
    end
  end

  describe "#logout" do
    it "closes an iSCSI session" do
      expect(iscsi_manager).to receive(:logout).with(iscsi_node)

      subject.logout
    end

    context "when the action successes" do
      before do
        allow(iscsi_manager).to receive(:logout).and_return(true)
      end

      it "returns 0" do
        expect(subject.logout).to eq(0)
      end
    end

    context "when the action fails" do
      before do
        allow(iscsi_manager).to receive(:logout).and_return(false)
      end

      it "returns 1" do
        expect(subject.logout).to eq(1)
      end
    end
  end
end
