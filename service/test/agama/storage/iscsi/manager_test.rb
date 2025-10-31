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
    allow(Yast::IscsiClientLib).to receive(:getiBFT).and_return(ibft)
    allow(Yast::IscsiClientLib).to receive(:checkInitiatorName).and_return true
    allow(Yast::IscsiClientLib).to receive(:getConfig)
    allow(Yast::IscsiClientLib).to receive(:autoLogOn)
    allow(Yast::IscsiClientLib).to receive(:readSessions)
    allow(Yast::IscsiClientLib).to receive(:getDiscovered).and_return(yast_nodes)
    allow(Yast::IscsiClientLib).to receive(:currentRecord=)
    allow(Yast::IscsiClientLib).to receive(:getCurrentNodeValues)
    allow(Yast::IscsiClientLib).to receive(:iBFT?)
    allow(Yast::IscsiClientLib).to receive(:find_session)
    allow(Yast::IscsiClientLib).to receive(:getStartupStatus)
    allow(Yast::IscsiClientLib).to receive(:discover_from_portal)
    allow(Yast::Service).to receive(:restart)
    allow(subject).to receive(:adapter).and_return(adapter)
    allow(subject).to receive(:sleep)
  end

  let(:initiator_name) { "iqn.1996-04.de.suse:01:351e6d6249" }

  let(:ibft) { { "iface.initiatorname" => "test-name" } }

  let(:yast_nodes) { [] }

  let(:adapter) { Agama::Storage::ISCSI::Adapter.new }

  describe "#activate" do
    it "activates iSCSI" do
      expect(adapter).to receive(:activate).and_call_original

      subject.activate
    end

    it "restarts the iSCSI services" do
      expect(Yast::Service).to receive(:restart).with("iscsi").ordered
      expect(Yast::Service).to receive(:restart).with("iscsid").ordered
      expect(Yast::Service).to receive(:restart).with("iscsiuio").ordered

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

        subject.update_initiator(name: "test-name")
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
    before do
      allow(Yast::IscsiClientLib).to receive(:default_startup_status).and_return("onboot")
      allow(Yast::IscsiClientLib).to receive(:login_into_current).and_return(login_success)
      allow(Yast::IscsiClientLib).to receive(:setStartupStatus).and_return(startup_success)
    end

    let(:node) { Agama::Storage::ISCSI::Node.new }

    let(:login_success) { nil }

    let(:startup_success) { nil }

    let(:startup) { "automatic" }

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

  describe "#apply_config_json" do
    context "if iSCSI activation is not performed yet" do
      it "activates iSCSI" do
        expect(subject).to receive(:activate)

        subject.apply_config_json({})
      end
    end

    context "if iSCSI activation was already performed" do
      before do
        subject.activate
      end

      it "does not activate iSCSI again" do
        expect(subject).to_not receive(:activate)

        subject.apply_config_json({})
      end
    end

    context "if the config does not specify the initiator name" do
      it "does not update the initiator" do
        expect(adapter).to_not receive(:update_initiator)

        subject.apply_config_json({})
      end

      it "returns true" do
        result = subject.apply_config_json({})

        expect(result).to eq(true)
      end
    end

    context "if the config specifies the initiator name" do
      let(:config_json) { { initiator: initiator } }

      context "and the name is equal to the current inititator name" do
        let(:initiator_name) { "iqn.1996-04.de.suse:01:351e6d6249" }

        let(:initiator) { initiator_name }

        it "does not update the initiator" do
          expect(adapter).to_not receive(:update_initiator)

          subject.apply_config_json(config_json)
        end

        it "returns true" do
          result = subject.apply_config_json(config_json)

          expect(result).to eq(true)
        end
      end

      context "and the name is not equal to the current inititator name" do
        let(:initiator_name) { "iqn.1996-04.de.suse:01:351e6d6249" }

        let(:initiator) { "iqn.1996-04.de.suse:01:351e6d6250" }

        it "updates the initiator" do
          expect(adapter).to receive(:update_initiator).with(anything, name: initiator)

          subject.apply_config_json(config_json)
        end

        it "returns true" do
          result = subject.apply_config_json(config_json)

          expect(result).to eq(true)
        end
      end
    end

    context "if the config does not specify targets" do
      let(:config_json) { {} }

      it "does not modify the sessions" do
        expect(adapter).to_not receive(:logout)
        expect(adapter).to_not receive(:login)

        subject.apply_config_json(config_json)
      end

      it "does not run the callbacks" do
        callback = proc {}
        subject.on_sessions_change(&callback)

        expect(callback).to_not receive(:call)

        subject.apply_config_json(config_json)
      end

      it "returns true" do
        result = subject.apply_config_json(config_json)

        expect(result).to eq(true)
      end
    end

    context "if the config specifies targets" do
      let(:config_json) { { targets: targets } }

      let(:yast_nodes) do
        [
          "192.168.100.101:3264 iqn.2023-01.com.example:12ac588 default",
          "192.168.100.102:3264 iqn.2023-01.com.example:12ac589"
        ]
      end

      before do
        allow(adapter).to receive(:find_session_for).and_call_original
        # Mock session (connected target).
        allow(adapter).to receive(:find_session_for).with([
                                                            "192.168.100.101:3264",
                                                            "iqn.2023-01.com.example:12ac588",
                                                            "default"
                                                          ]).and_return([])
      end

      shared_examples "callbacks" do
        it "runs the callbacks" do
          callback = proc {}
          subject.on_sessions_change(&callback)

          expect(callback).to receive(:call)

          subject.apply_config_json(config_json)
        end
      end

      context "and the list is empty" do
        let(:targets) { [] }

        it "performs logout of all connected targets" do
          expect(adapter).to receive(:logout)
            .with(an_object_having_attributes(target: "iqn.2023-01.com.example:12ac588"))

          expect(adapter).to_not receive(:logout)
            .with(an_object_having_attributes(target: "iqn.2023-01.com.example:12ac589"))

          subject.apply_config_json(config_json)
        end

        it "does not login to any target" do
          expect(adapter).to_not receive(:login)

          subject.apply_config_json(config_json)
        end

        include_examples "callbacks"

        it "returns true" do
          result = subject.apply_config_json(config_json)

          expect(result).to eq(true)
        end
      end

      context "and the list is not empty" do
        let(:targets) do
          [
            {
              address:         "192.168.100.151",
              port:            3260,
              name:            "iqn.2025-01.com.example:becda24e8804c6580bd0",
              interface:       "default",
              startup:         "onboot",
              authByTarget:    {
                username: "test1",
                password: "12345"
              },
              authByInitiator: {
                username: "test2",
                password: "54321"
              }
            },
            {
              address:   "192.168.100.152",
              port:      3260,
              name:      "iqn.2025-01.com.example:becda24e8804c6580bd1",
              interface: "default"
            }
          ]
        end

        before do
          allow(adapter).to receive(:login).and_return(true)
        end

        it "performs a discovery for each portal" do
          expect(adapter).to receive(:discover_from_portal)
            .with("192.168.100.151:3260", interfaces: ["default"])

          expect(adapter).to receive(:discover_from_portal)
            .with("192.168.100.152:3260", interfaces: ["default"])

          subject.apply_config_json(config_json)
        end

        it "tries to login to each target" do
          expect(adapter).to receive(:login) do |node, options|
            expect(node.address).to eq("192.168.100.151")
            expect(node.port).to eq(3260)
            expect(node.target).to eq("iqn.2025-01.com.example:becda24e8804c6580bd0")
            expect(node.interface).to eq("default")

            startup = options[:startup]
            expect(startup).to eq("onboot")

            credentials = options[:credentials]
            expect(credentials[:username]).to eq("test1")
            expect(credentials[:password]).to eq("12345")
            expect(credentials[:initiator_username]).to eq("test2")
            expect(credentials[:initiator_password]).to eq("54321")
          end

          expect(adapter).to receive(:login) do |node, options|
            expect(node.address).to eq("192.168.100.152")
            expect(node.port).to eq(3260)
            expect(node.target).to eq("iqn.2025-01.com.example:becda24e8804c6580bd1")
            expect(node.interface).to eq("default")

            startup = options[:startup]
            expect(startup).to be_nil

            credentials = options[:credentials]
            expect(credentials[:username]).to be_nil
            expect(credentials[:password]).to be_nil
            expect(credentials[:initiator_username]).to be_nil
            expect(credentials[:initiator_password]).to be_nil
          end

          subject.apply_config_json(config_json)
        end

        include_examples "callbacks"

        it "returns true" do
          result = subject.apply_config_json(config_json)

          expect(result).to eq(true)
        end

        context "and fails to login" do
          before do
            allow(adapter).to receive(:login).and_return(false)
          end

          it "does not try to login the rest of targets" do
            expect(adapter).to receive(:login).once

            subject.apply_config_json(config_json)
          end

          it "reports an issue" do
            subject.apply_config_json(config_json)

            expect(subject.issues.size).to eq(1)
            expect(subject.issues.first.description).to match(/Cannot login .*0bd0/)
          end

          include_examples "callbacks"

          it "returns false" do
            result = subject.apply_config_json(config_json)

            expect(result).to eq(false)
          end
        end
      end
    end
  end

  describe "#configured?" do
    context "if no session has been configured yet" do
      it "returns false" do
        expect(subject.configured?).to eq(false)
      end
    end

    context "if a session was configured by loading a config" do
      let(:config_json) do
        {
          targets: [
            {
              address:   "192.168.100.152",
              port:      3260,
              name:      "iqn.2025-01.com.example:becda24e8804c6580bd1",
              interface: "default"
            }
          ]
        }
      end

      before do
        allow(adapter).to receive(:login).and_return(true)
        subject.apply_config_json(config_json)
      end

      it "returns true" do
        expect(subject.configured?).to eq(true)
      end
    end

    context "if a session was manually configured" do
      before do
        allow(Yast::IscsiClientLib).to receive(:default_startup_status).and_return("onboot")
        allow(Yast::IscsiClientLib).to receive(:login_into_current).and_return(true)
        allow(Yast::IscsiClientLib).to receive(:setStartupStatus).and_return(true)
        node = Agama::Storage::ISCSI::Node.new
        subject.login(node)
      end

      it "returns true" do
        expect(subject.configured?).to eq(true)
      end
    end
  end
end
