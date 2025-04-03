# frozen_string_literal: true

# Copyright (c) [2023-2025] SUSE LLC
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
require "agama/storage/iscsi/adapter"
require "agama/storage/iscsi/initiator"
require "agama/storage/iscsi/node"
require "agama/storage/iscsi/manager"

describe Agama::Storage::ISCSI::Manager do
  subject { described_class.new(logger: logger) }

  let(:logger) { Logger.new($stdout, level: :warn) }

  # Mocks YaST calls done by the iSCSI adapter, see {Agama::Storage::ISCSI::Adapter}.
  #
  # These tests should be agnostic to the adapter. In this case, directly mocking the adapter code
  # is not that bad because having more iSCSI adapters is not expected at all.
  #
  # If any other adapter is added at some point, then these tests have to be refactored and each
  # adapter should have its own tests.
  before do
    allow(Yast::IscsiClientLib).to receive(:initiatorname).and_return(initiator_name)
    allow(Yast::IscsiClientLib).to receive(:GetOffloadCard).and_return(offload_card)
    allow(Yast::IscsiClientLib).to receive(:getiBFT).and_return(ibft)
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
    allow(subject).to receive(:adapter).and_return(adapter)
    allow(subject).to receive(:sleep)
  end

  let(:initiator_name) { "iqn.1996-04.de.suse:01:351e6d6249" }

  let(:offload_card) { "test-card" }

  let(:ibft) { { "iSCSI_INITIATOR_NAME" => "test-name" } }

  let(:yast_nodes) { [] }

  let(:adapter) { Agama::Storage::ISCSI::Adapter.new }

  describe "#activate" do
    it "activates iSCSI" do
      expect(adapter).to receive(:activate).and_call_original

      subject.activate
    end

    it "runs the callbacks" do
      callback = proc {}
      subject.on_activate(&callback)

      expect(callback).to receive(:call)

      subject.activate
    end
  end

  describe "#probe" do
    let(:yast_nodes) do
      [
        "192.168.100.101:3264 iqn.2023-01.com.example:12ac588 default",
        "192.168.100.102:3264 iqn.2023-01.com.example:12ac588"
      ]
    end

    it "reads the initiator" do
      subject.probe

      expect(subject.initiator).to be_a(Agama::Storage::ISCSI::Initiator)
      expect(subject.initiator.name).to eq("iqn.1996-04.de.suse:01:351e6d6249")
      expect(subject.initiator.offload_card).to eq("test-card")
      expect(subject.initiator.ibft_name?).to eq(true)
    end

    it "reads the discoverd nodes" do
      subject.probe

      nodes = subject.nodes
      expect(nodes).to all(be_a(Agama::Storage::ISCSI::Node))

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

    it "runs the callbacks" do
      callback = proc {}
      subject.on_probe(&callback)

      expect(callback).to receive(:call)

      subject.probe
    end
  end

  describe "#update_initiator" do
    context "if iSCSI is not probed yet" do
      it "does not set the initiator name" do
        expect(Yast::IscsiClientLib).to_not receive(:writeInitiatorName)

        subject.update_initiator(name: "test-name", offload_card: "test-card")
      end

      it "does not set the offload card" do
        expect(Yast::IscsiClientLib).to_not receive(:setOffloadCard)

        subject.update_initiator(name: "test-name", offload_card: "test-card")
      end
    end

    context "if the iSCSI is probed" do
      before do
        subject.probe
      end

      context "and the given name is the same" do
        let(:name) { initiator_name }

        it "does not set the initiator name" do
          expect(Yast::IscsiClientLib).to_not receive(:writeInitiatorName)

          subject.update_initiator(name: name)
        end
      end

      context "and the given name is not the same" do
        let(:name) { "test-name" }

        it "sets the initiator name" do
          expect(Yast::IscsiClientLib).to receive(:writeInitiatorName).with("test-name")

          subject.update_initiator(name: name)
        end
      end

      context "and the given offload card is the same" do
        let(:card) { offload_card }

        it "does not set the offload card" do
          expect(Yast::IscsiClientLib).to_not receive(:SetOffloadCard)

          subject.update_initiator(offload_card: card)
        end
      end

      context "and the given offload card is not the same" do
        let(:card) { "test-card" }

        it "sets the offload card" do
          expect(Yast::IscsiClientLib).to_not receive(:SetOffloadCard).with("test-card")

          subject.update_initiator(offload_card: card)
        end
      end
    end
  end

  describe "#discover" do
    before do
      allow(Yast::IscsiClientLib).to receive(:discover)
    end

    it "performs iSCSI discovery without credentials" do
      expect(Yast::IscsiClientLib).to receive(:discover) do |host, port, auth, _|
        expect(host).to eq("192.168.100.101")
        expect(port).to eq(3264)
        expect(auth).to be_a(Y2IscsiClient::Authentication)
        expect(auth.username).to be_nil
        expect(auth.password).to be_nil
        expect(auth.username_in).to be_nil
        expect(auth.password_in).to be_nil
      end

      subject.discover("192.168.100.101", 3264)
    end

    it "performs iSCSI discovery with credentials" do
      credentials = {
        username:           "target",
        password:           "12345",
        initiator_username: "initiator",
        initiator_password: "54321"
      }

      expect(Yast::IscsiClientLib).to receive(:discover) do |host, port, auth, _|
        expect(host).to eq("192.168.100.101")
        expect(port).to eq(3264)
        expect(auth).to be_a(Y2IscsiClient::Authentication)
        expect(auth.username).to eq("target")
        expect(auth.password).to eq("12345")
        expect(auth.username_in).to eq("initiator")
        expect(auth.password_in).to eq("54321")
      end

      subject.discover("192.168.100.101", 3264, credentials: credentials)
    end

    it "probes iSCSI" do
      expect(subject).to receive(:probe)

      subject.discover("192.168.100.101", 3264)
    end

    context "if iSCSI activation is not performed yet" do
      it "activates iSCSI" do
        expect(subject).to receive(:activate)

        subject.discover("192.168.100.101", 3264)
      end
    end

    context "if iSCSI activation was already performed" do
      before do
        subject.activate
      end

      it "does not activate iSCSI again" do
        expect(subject).to_not receive(:activate)

        subject.discover("192.168.100.101", 3264)
      end
    end
  end

  describe "#login" do
    let(:node) { Agama::Storage::ISCSI::Node.new }

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

    it "tries to login without credentials" do
      expect(Yast::IscsiClientLib).to receive(:login_into_current) do |auth, _|
        expect(auth).to be_a(Y2IscsiClient::Authentication)
        expect(auth.username).to be_nil
        expect(auth.password).to be_nil
        expect(auth.username_in).to be_nil
        expect(auth.password_in).to be_nil
      end.and_return(true)

      expect(Yast::IscsiClientLib).to receive(:setStartupStatus).with("automatic")

      subject.login(node, startup: startup)
    end

    it "tries to login with credentials" do
      credentials = {
        username:           "target",
        password:           "12345",
        initiator_username: "initiator",
        initiator_password: "54321"
      }

      expect(Yast::IscsiClientLib).to receive(:login_into_current) do |auth, _|
        expect(auth).to be_a(Y2IscsiClient::Authentication)
        expect(auth.username).to eq("target")
        expect(auth.password).to eq("12345")
        expect(auth.username_in).to eq("initiator")
        expect(auth.password_in).to eq("54321")
      end.and_return(true)

      expect(Yast::IscsiClientLib).to receive(:setStartupStatus).with("automatic")

      subject.login(node, credentials: credentials, startup: startup)
    end

    context "if iSCSI activation is not performed yet" do
      it "activates iSCSI" do
        expect(subject).to receive(:activate)

        subject.login(node)
      end
    end

    context "if iSCSI activation was already performed" do
      before do
        subject.activate
      end

      it "does not activate iSCSI again" do
        expect(subject).to_not receive(:activate)

        subject.login(node)
      end
    end

    context "and the session is created" do
      let(:login_success) { true }

      context "and the startup status is correctly set" do
        let(:startup_success) { true }

        it "probes iSCSI" do
          expect(subject).to receive(:probe)

          subject.login(node)
        end

        it "returns true" do
          result = subject.login(node)

          expect(result).to eq(true)
        end
      end

      context "and the startup status cannot be set" do
        let(:startup_success) { false }

        it "probes iSCSI" do
          expect(subject).to receive(:probe)

          subject.login(node)
        end

        it "returns false" do
          result = subject.login(node)

          expect(result).to eq(false)
        end
      end
    end
  end

  describe "#logout" do
    before do
      allow(Yast::IscsiClientLib).to receive(:deleteRecord)
    end

    let(:node) { Agama::Storage::ISCSI::Node.new }

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

    let(:node) { Agama::Storage::ISCSI::Node.new }

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

    let(:node) { Agama::Storage::ISCSI::Node.new }

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
