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
require "dinstaller/storage/iscsi/manager"
require "dinstaller/storage/iscsi/node"

describe DInstaller::Storage::ISCSI::Manager do
  subject { described_class.new(logger: logger) }

  let(:logger) { Logger.new($stdout, level: :warn) }

  before do
    allow(Yast::IscsiClientLib).to receive(:getiBFT)
    allow(Yast::IscsiClientLib).to receive(:checkInitiatorName)
    allow(Yast::IscsiClientLib).to receive(:getConfig)
    allow(Yast::IscsiClientLib).to receive(:autoLogOn)
    allow(Yast::IscsiClientLib).to receive(:readSessions)
    allow(Yast::IscsiClientLib).to receive(:getDiscovered).and_return(yast_nodes)
    allow(Yast::IscsiClientLib).to receive(:currentRecord=)
    allow(Yast::IscsiClientLib).to receive(:getCurrentNodeValues)
    allow(Yast::IscsiClientLib).to receive(:iBFT?)
    allow(Yast::IscsiClientLib).to receive(:find_session)
    allow(Yast::IscsiClientLib).to receive(:getStartupStatus)
    allow(subject).to receive(:sleep)
  end

  let(:yast_nodes) { [] }

  describe "#probe" do
    let(:yast_nodes) do
      [
        "192.168.100.101:3264 iqn.2023-01.com.example:12ac588 default",
        "192.168.100.102:3264 iqn.2023-01.com.example:12ac588"
      ]
    end

    it "reads the discoverd nodes" do
      subject.probe

      nodes = subject.nodes
      expect(nodes).to all(be_a(DInstaller::Storage::ISCSI::Node))

      expect(nodes).to include(an_object_having_attributes(
        address:   "192.168.100.101",
        port:      3264,
        target:    "iqn.2023-01.com.example:12ac588",
        interface: "default"
      ))

      expect(nodes).to include(an_object_having_attributes(
        address:   "192.168.100.102",
        port:      3264,
        target:    "iqn.2023-01.com.example:12ac588",
        interface: "default"
      ))
    end

    let(:callback) { proc {} }

    it "runs the callbacks" do
      subject.on_probe(&callback)

      expect(callback).to receive(:call)

      subject.probe
    end
  end

  describe "#discover_send_targets" do
    before do
      allow(Yast::IscsiClientLib).to receive(:discover)
    end

    let(:auth) { Y2IscsiClient::Authentication.new }

    it "performs iSCSI discovery" do
      expect(Yast::IscsiClientLib).to receive(:discover)

      subject.discover_send_targets("192.168.100.101", 3264, auth)
    end

    it "probes iSCSI" do
      expect(subject).to receive(:probe)

      subject.discover_send_targets("192.168.100.101", 3264, auth)
    end

    context "if iSCSI activation is not performed yet" do
      it "activates iSCSI" do
        expect(subject).to receive(:activate)

        subject.discover_send_targets("192.168.100.101", 3264, auth)
      end
    end

    context "if iSCSI activation was already performed" do
      before do
        subject.activate
      end

      it "does not activate iSCSI again" do
        expect(subject).to_not receive(:activate)

        subject.discover_send_targets("192.168.100.101", 3264, auth)
      end
    end
  end

  describe "#login" do
    let(:node) { DInstaller::Storage::ISCSI::Node.new }

    let(:auth) { Y2IscsiClient::Authentication.new }

    before do
      allow(Yast::IscsiClientLib).to receive(:default_startup_status).and_return("onboot")
      allow(Yast::IscsiClientLib).to receive(:login_into_current)
      allow(Yast::IscsiClientLib).to receive(:setStartupStatus)
    end

    let(:startup) { "automatic" }

    before do
      allow(Yast::IscsiClientLib).to receive(:login_into_current).and_return(login_success)
      allow(Yast::IscsiClientLib).to receive(:setStartupStatus).and_return(startup_success)
    end

    let(:login_success) { nil }

    let(:startup_success) { nil }

    it "tries to login" do
      expect(Yast::IscsiClientLib).to receive(:login_into_current)

      subject.login(node, auth, startup: startup)
    end

    context "if iSCSI activation is not performed yet" do
      it "activates iSCSI" do
        expect(subject).to receive(:activate)

        subject.login(node, auth, startup: startup)
      end
    end

    context "if iSCSI activation was already performed" do
      before do
        subject.activate
      end

      it "does not activate iSCSI again" do
        expect(subject).to_not receive(:activate)

        subject.login(node, auth, startup: startup)
      end
    end

    context "and the session is created" do
      let(:login_success) { true }

      context "and the startup status is correctly set" do
        let(:startup_success) { true }

        it "probes iSCSI" do
          expect(subject).to receive(:probe)

          subject.login(node, auth, startup: startup)
        end

        it "returns true" do
          result = subject.login(node, auth, startup: startup)

          expect(result).to eq(true)
        end
      end

      context "and the startup status cannot be set" do
        let(:startup_success) { false }

        it "probes iSCSI" do
          expect(subject).to receive(:probe)

          subject.login(node, auth, startup: startup)
        end

        it "returns false" do
          result = subject.login(node, auth, startup: startup)

          expect(result).to eq(false)
        end
      end
    end
  end

  describe "#logout" do
    before do
      allow(Yast::IscsiClientLib).to receive(:deleteRecord)
    end

    let(:node) { DInstaller::Storage::ISCSI::Node.new }

    it "closes the iSCSI session" do
      expect(Yast::IscsiClientLib).to receive(:deleteRecord)

      subject.logout(node)
    end

    it "probes iSCSI" do
      expect(subject).to receive(:probe)

      subject.logout(node)
    end

    context "if iSCSI activation is not performed yet" do
      it "activates iSCSI" do
        expect(subject).to receive(:activate)

        subject.logout(node)
      end
    end

    context "if iSCSI activation was already performed" do
      before do
        subject.activate
      end

      it "does not activate iSCSI again" do
        expect(subject).to_not receive(:activate)

        subject.logout(node)
      end
    end
  end

  describe "#delete" do
    before do
      allow(Yast::IscsiClientLib).to receive(:removeRecord)
    end

    let(:node) { DInstaller::Storage::ISCSI::Node.new }

    it "deletes the iSCSI node" do
      expect(Yast::IscsiClientLib).to receive(:removeRecord)

      subject.delete(node)
    end

    it "probes iSCSI" do
      expect(subject).to receive(:probe)

      subject.delete(node)
    end
  end

  describe "#update" do
    before do
      allow(Yast::IscsiClientLib).to receive(:setStartupStatus)
    end

    let(:node) { DInstaller::Storage::ISCSI::Node.new }

    it "updates the iSCSI node" do
      expect(Yast::IscsiClientLib).to receive(:setStartupStatus).with("manual")

      subject.update(node, startup: "manual")
    end

    it "probes iSCSI" do
      expect(subject).to receive(:probe)

      subject.update(node, startup: "manual")
    end
  end
end
