# frozen_string_literal: true

# Copyright (c) [2022] SUSE LLC
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

Yast.import "IscsiClientLib"

# Mocks a call done with the .target.bash_output agent
#
# Adapted from yast2-iscsi-client's test/mocking.rb (only the two helpers actually used by this
# spec are ported here; the rest of that file supports UI-only tests that are not vendored).
def mock_bash_out(command, result)
  path = Yast::Path.new(".target.bash_output")
  allow(Yast::SCR).to receive(:Execute).with(path, command).and_return result
end

# Mocks a call to "iscsiadm --mode node -P 1"
#
# @param ifaces [Array<String>] list of active iSCSI interfaces defined at /etc/iscsi/ifaces
def mock_iscsiadm_mode(ifaces)
  result = { "exit" => 0, "stdout" => +"", "stderr" => "" }

  if ifaces.empty?
    result["exit"] = 21
    result["stderr"] = "iscsiadm: No records found\n"
  end

  ifaces.each do |iface|
    result["stdout"] << "Target: iqn.2013-10.de.suse:test_file1\n"
    result["stdout"] << "\tPortal: 192.168.99.99:3260,1\n"
    result["stdout"] << "\t\tIface Name: #{iface}\n"
  end

  mock_bash_out(/iscsiadm -m node -P 1/, result)
end

describe Yast::IscsiClientLib do
  subject { described_class }

  before do
    subject.main
    stub_const("Yast::Service", double)
    allow(Yast::Service).to receive(:Start).with(anything)
  end

  describe "#getServiceStatus" do
    before do
      # getServiceStatus branches on Yast::Stage.initial; these tests target the "installed
      # system" (not initial) branch, so pin it explicitly instead of relying on whatever real,
      # process-wide Yast::Stage state some other spec file left behind.
      allow(Yast::Stage).to receive(:initial).and_return(false)
      allow(Yast::Service).to receive(:Stop).with(anything)
      allow(Yast::Service).to receive(:active?).with(anything)
      allow(Yast2::Systemd::Socket).to receive(:find!).with(anything)
      allow(subject).to receive(:socketActive?)
      allow(subject.log).to receive(:error)
    end

    context "for iscsid.socket" do
      let(:iscsid_socket) { double("iscsid.socket", start: true) }

      before do
        allow(Yast2::Systemd::Socket).to receive(:find!).with("iscsid").and_return(iscsid_socket)
        allow(subject).to receive(:socketActive?).with(iscsid_socket).and_return(socket_status)
      end

      context "when iscsid.socket and iscsid.service are active" do
        let(:socket_status) { true }

        before do
          allow(Yast::Service).to receive(:active?).with("iscsid").and_return(true)
        end

        it "does not start the socket nor the service" do
          expect(iscsid_socket).to_not receive(:start)
          expect(Yast::Service).to_not receive(:Stop).with("iscsid")

          subject.getServiceStatus
        end
      end

      context "when iscsid.socket is not active" do
        let(:socket_status) { false }

        context "and socket is availbale" do
          it "starts iscsid.socket" do
            expect(iscsid_socket).to receive(:start)

            subject.getServiceStatus
          end

          context "but iscsid.service is active" do
            before do
              allow(Yast::Service).to receive(:active?).with("iscsid").and_return(true)
            end

            it "stops iscsid.service" do
              expect(Yast::Service).to receive(:Stop).with("iscsid")

              subject.getServiceStatus
            end
          end
        end

        context "but socket is not availbale" do
          let(:iscsid_socket) { nil }

          it "logs an error" do
            expect(subject.log).to receive(:error).with("Cannot start iscsid.socket")

            subject.getServiceStatus
          end
        end
      end
    end
  end

  describe ".autoyastWrite" do
    it "calls iscsiadm discovery" do
      subject.ay_settings = {
        "targets" => [
          { "iface" => "eth0", "portal" => "magic" },
          { "iface" => "eth1", "portal" => "portal 1" }
        ]
      }

      allow(Yast::SCR).to receive(:Execute).with(Yast::Path.new(".target.bash_output"), anything)
        .and_return("exit" => 0, "stdout" => "", "stderr" => "")

      expect(Yast::SCR).to receive(:Execute).with(
        Yast::Path.new(".target.bash"),
        "LC_ALL=POSIX iscsiadm -m discovery -I eth0 -I eth1 -t st -p magic"
      )
      expect(Yast::SCR).to receive(:Execute).with(
        Yast::Path.new(".target.bash"),
        "LC_ALL=POSIX iscsiadm -m discovery -I eth0 -I eth1 -t st -p portal\\ 1"
      )

      subject.autoyastWrite
    end
  end

  describe "#ipEqual" do
    context "with IPv4 arguments not matching" do
      it "returns false" do
        expect(subject.ipEqual?("213:23:", "...")).to eq(false)
      end
    end
    context "with equal IPv4 addresses (without port)" do
      it "returns true" do
        expect(subject.ipEqual?("10.10.10.1", "10.10.10.1")).to eq(true)
      end
    end
    context "with equal IPv4 addresses and equal port" do
      it "returns true" do
        expect(subject.ipEqual?("10.10.10.1:345", "10.10.10.1:345")).to eq(true)
      end
    end
    context "with equal IPv4 addresses and different ports" do
      it "returns false" do
        expect(subject.ipEqual?("10.10.10.1:345", "10.10.10.1:500")).to eq(false)
      end
    end
    context "with invalid IPv6 arguments" do
      it "returns false" do
        expect(subject.ipEqual?("[213:23:]", "...")).to eq(false)
      end
    end
    context "with invalid IPv6 arguments not matching" do
      it "returns false" do
        expect(subject.ipEqual?("[???]", "[***]")).to eq(false)
      end
    end
    context "with 2 empty arguments" do
      it "returns false" do
        expect(subject.ipEqual?("", "")).to eq(false)
      end
    end
    context "with empty argument session IP" do
      it "returns false" do
        expect(subject.ipEqual?("", "10.10.10.1:500")).to eq(false)
      end
    end
    context "with empty argument current IP" do
      it "returns false" do
        expect(subject.ipEqual?("[2620:0113:1c0:8080:4ec:544a:000d:3d62]", "")).to eq(false)
      end
    end
    context "with nil arguments" do
      it "returns false" do
        expect(subject.ipEqual?(nil, nil)).to eq(false)
      end
    end
    context "with one nil argument" do
      it "returns false" do
        expect(subject.ipEqual?(nil, "10.10.10.1:500")).to eq(false)
      end
    end
    context "with equal (but different string) and valid IPv6 arguments (without port)" do
      it "returns true" do
        expect(subject.ipEqual?("[2620:0113:1c0:8080:4ec:544a:000d:3d62]",
          "[2620:113:1c0:8080:4ec:544a:d:3d62]")).to eq(true)
      end
    end
    context "with equal (same string) and valid IPv6 arguments (without port)" do
      it "returns true" do
        expect(subject.ipEqual?("[2620:113:1c0:8080:4ec:544a:000d:3d62]",
          "[2620:113:1c0:8080:4ec:544a:d:3d62]")).to eq(true)
      end
    end
    context "with equal (but different string) and valid IPv6 arguments and equal ports" do
      it "returns true" do
        expect(subject.ipEqual?("[0020:0113:80c0:8080:0:544a:3b9d:3d62]:456",
          "[20:113:80c0:8080::544a:3b9d:3d62]:456")).to eq(true)
      end
    end
    context "with equal (different string, one abbreviated) valid IPv6 arguments" do
      it "returns true" do
        expect(subject.ipEqual?("[::1]", "[0:0:0:0:0:0:0:1]")).to eq(true)
      end
    end
    context "with equal (but different string) IPv6 arguments and different ports" do
      it "returns false" do
        expect(subject.ipEqual?("[2620:0113:80c0:8080:54ec:004a:3b9d:3d62]:456",
          "[2620:113:80c0:8080:54ec:4a:3b9d:3d62]:4")).to eq(false)
      end
    end
    context "with equal (same string) IPv6 arguments and different ports" do
      it "returns false" do
        expect(subject.ipEqual?("[2620:113:80c0:8080:54ec:544a:3b9d:3d62]:456",
          "[2620:113:80c0:8080:54ec:544a:3b9d:3d62]:4")).to eq(false)
      end
    end
  end

  describe "#getConfig,#saveConfig,#oldConfig" do
    let(:etc_iscsid_all) { Yast::Path.new ".etc.iscsid.all" }
    let(:etc_iscsid)     { Yast::Path.new ".etc.iscsid" }
    let(:read_data) do
      {
        "comment" => "",
        "file"    => -1,
        "kind"    => "section",
        "name"    => "",
        "type"    => -1,
        "value"   => [
          {
            "comment" => "#\n" \
                         "# Open-iSCSI default configuration.\n" \
                         "# Could be located at /etc/iscsid.conf or ~/.iscsid.conf\n" \
                         "#\n",
            "kind"    => "value",
            "name"    => "node.active_cnx",
            "type"    => 1,
            "value"   => "1"
          },
          {
            "comment" => "",
            "kind"    => "value",
            "name"    => "node.startup",
            "type"    => 1,
            "value"   => "manual"
          },
          {
            "comment" => "#node.session.auth.username = dima\n" \
                         "#node.session.auth.password = aloha\n",
            "kind"    => "value",
            "name"    => "node.session.timeo.replacement_timeout",
            "type"    => 1,
            "value"   => "120"
          },
          {
            "comment" => "",
            "kind"    => "value",
            "name"    => "node.session.err_timeo.abort_timeout",
            "type"    => 1,
            "value"   => "10"
          },
          {
            "comment" => "",
            "kind"    => "value",
            "name"    => "node.session.err_timeo.reset_timeout",
            "type"    => 1,
            "value"   => "30"
          },
          {
            "comment" => "",
            "kind"    => "value",
            "name"    => "node.session.iscsi.InitialR2T",
            "type"    => 1,
            "value"   => "No"
          },
          {
            "comment" => "",
            "kind"    => "value",
            "name"    => "node.session.iscsi.ImmediateData",
            "type"    => 1,
            "value"   => "Yes"
          },
          {
            "comment" => "",
            "kind"    => "value",
            "name"    => "node.session.iscsi.FirstBurstLength",
            "type"    => 1,
            "value"   => "262144"
          },
          {
            "comment" => "",
            "kind"    => "value",
            "name"    => "node.session.iscsi.MaxBurstLength",
            "type"    => 1,
            "value"   => "16776192"
          },
          {
            "comment" => "",
            "kind"    => "value",
            "name"    => "node.session.iscsi.DefaultTime2Wait",
            "type"    => 1,
            "value"   => "0"
          },
          {
            "comment" => "",
            "kind"    => "value",
            "name"    => "node.session.iscsi.DefaultTime2Retain",
            "type"    => 1,
            "value"   => "0"
          },
          {
            "comment" => "",
            "kind"    => "value",
            "name"    => "node.session.iscsi.MaxConnections",
            "type"    => 1,
            "value"   => "0"
          },
          {
            "comment" => "",
            "kind"    => "value",
            "name"    => "node.cnx[0].iscsi.HeaderDigest",
            "type"    => 1,
            "value"   => "None"
          },
          {
            "comment" => "",
            "kind"    => "value",
            "name"    => "node.cnx[0].iscsi.DataDigest",
            "type"    => 1,
            "value"   => "None"
          },
          {
            "comment" => "",
            "kind"    => "value",
            "name"    => "node.cnx[0].iscsi.MaxRecvDataSegmentLength",
            "type"    => 1,
            "value"   => "65536"
          }
        ]
      }
    end

    let(:written_data) do
      {
        "comment" => "",
        "file"    => -1,
        "kind"    => "section",
        "name"    => "",
        "type"    => -1,
        "value"   => [
          {
            "comment" => "#\n# Open-iSCSI default configuration.\n" \
                         "# Could be located at /etc/iscsid.conf or ~/.iscsid.conf\n#\n",
            "kind"    => "value",
            "name"    => "node.active_cnx",
            "type"    => 1,
            "value"   => "1"
          },
          {
            "comment" => "",
            "kind"    => "value",
            "name"    => "node.startup",
            "type"    => 1,
            "value"   => "manual"
          },
          {
            "comment" => "#node.session.auth.username = dima\n" \
                         "#node.session.auth.password = aloha\n",
            "kind"    => "value",
            "name"    => "node.session.timeo.replacement_timeout",
            "type"    => 1,
            "value"   => "120"
          },
          {
            "comment" => "",
            "kind"    => "value",
            "name"    => "node.session.err_timeo.abort_timeout",
            "type"    => 1,
            "value"   => "10"
          },
          {
            "comment" => "",
            "kind"    => "value",
            "name"    => "node.session.err_timeo.reset_timeout",
            "type"    => 1,
            "value"   => "30"
          },
          {
            "comment" => "",
            "kind"    => "value",
            "name"    => "node.session.iscsi.InitialR2T",
            "type"    => 1,
            "value"   => "No"
          },
          {
            "comment" => "",
            "kind"    => "value",
            "name"    => "node.session.iscsi.ImmediateData",
            "type"    => 1,
            "value"   => "Yes"
          },
          {
            "comment" => "",
            "kind"    => "value",
            "name"    => "node.session.iscsi.FirstBurstLength",
            "type"    => 1,
            "value"   => "262144"
          },
          {
            "comment" => "",
            "kind"    => "value",
            "name"    => "node.session.iscsi.MaxBurstLength",
            "type"    => 1,
            "value"   => "16776192"
          },
          {
            "comment" => "",
            "kind"    => "value",
            "name"    => "node.session.iscsi.DefaultTime2Wait",
            "type"    => 1,
            "value"   => "0"
          },
          {
            "comment" => "",
            "kind"    => "value",
            "name"    => "node.session.iscsi.DefaultTime2Retain",
            "type"    => 1,
            "value"   => "0"
          },
          {
            "comment" => "",
            "kind"    => "value",
            "name"    => "node.session.iscsi.MaxConnections",
            "type"    => 1,
            "value"   => "0"
          },
          {
            "comment" => "",
            "kind"    => "value",
            "name"    => "node.cnx[0].iscsi.HeaderDigest",
            "type"    => 1,
            "value"   => "None"
          },
          {
            "comment" => "",
            "kind"    => "value",
            "name"    => "node.cnx[0].iscsi.DataDigest",
            "type"    => 1,
            "value"   => "None"
          },
          {
            "comment" => "",
            "kind"    => "value",
            "name"    => "node.cnx[0].iscsi.MaxRecvDataSegmentLength",
            "type"    => 1,
            "value"   => "65536"
          },
          {
            "comment" => "",
            "kind"    => "value",
            "name"    => "discovery.sendtargets.auth.authmethod",
            "type"    => 1,
            "value"   => "CHAP"
          },
          {
            "comment" => "",
            "kind"    => "value",
            "name"    => "discovery.sendtargets.auth.username",
            "type"    => 1,
            "value"   => "outuser"
          },
          {
            "comment" => "",
            "kind"    => "value",
            "name"    => "discovery.sendtargets.auth.password",
            "type"    => 1,
            "value"   => "outpass"
          },
          {
            "comment" => "",
            "kind"    => "value",
            "name"    => "discovery.sendtargets.auth.username_in",
            "type"    => 1,
            "value"   => "incuser"
          },
          {
            "comment" => "",
            "kind"    => "value",
            "name"    => "discovery.sendtargets.auth.password_in",
            "type"    => 1,
            "value"   => "incpass"
          }
        ]
      }
    end

    it "mimics a legacy test" do
      allow(Yast::SCR).to receive(:Read)
        .with(etc_iscsid_all).and_return(read_data)
      expect(subject.getConfig).to eq(read_data.fetch("value"))

      expect(Yast::SCR).to receive(:Write)
        .with(etc_iscsid_all, written_data).and_return(true)
      expect(Yast::SCR).to receive(:Write)
        .with(etc_iscsid, nil).and_return(true)
      expect(subject.saveConfig("incuser", "incpass", "outuser", "outpass"))
        .to eq(nil)

      expect(Yast::SCR).to receive(:Write)
        .with(etc_iscsid_all, read_data).and_return(true)
      expect(Yast::SCR).to receive(:Write)
        .with(etc_iscsid, nil).and_return(true)
      expect(subject.oldConfig).to eq(nil)
    end
  end

  describe "#discover" do
    let(:etc_iscsid_all) { Yast::Path.new ".etc.iscsid.all" }
    let(:etc_iscsid)     { Yast::Path.new ".etc.iscsid" }
    let(:host)           { "192.168.1.1" }
    let(:port)           { "4321" }
    let(:auth)           { Y2IscsiClient::Authentication.new }
    let(:initial_config) do
      {
        "comment" => "",
        "file"    => -1,
        "kind"    => "section",
        "name"    => "",
        "type"    => -1,
        "value"   => [
          {
            "kind"  => "value",
            "name"  => "node.active_cnx",
            "type"  => 1,
            "value" => "1"
          },
          {
            "kind"  => "value",
            "name"  => "discovery.sendtargets.auth.authmethod",
            "type"  => 1,
            "value" => "CHAP"
          }
        ]
      }
    end

    before do
      allow(Yast::ModuleLoading).to receive(:Load)

      allow(Yast::SCR).to receive(:Read).with(etc_iscsid_all).and_return(initial_config)
      subject.getConfig

      allow(Yast::SCR).to receive(:Write)
      allow(Yast::SCR).to receive(:Write)
      allow(Y2IscsiClient::TimeoutProcess).to receive(:run).and_return [true, []]
    end

    # Auxiliary function to make sense of the format used by .etc.iscsid.all
    # @return [Hash]
    def config_values(data)
      data.values.last.map { |i| [i["name"], i["value"]] }.to_h
    end

    it "calls iscsiadm to perform discovery" do
      expect(Y2IscsiClient::TimeoutProcess).to receive(:run) do |command|
        expect(command).to start_with(["iscsiadm", "-m", "discovery", "-P", "1"])
        expect(command).to include "#{host}:#{port}"
      end.and_return [true, []]

      Yast::IscsiClientLib.discover(host, port, auth)
    end

    it "passes :silent to TimeoutProcess if silent mode is requested" do
      expect(Y2IscsiClient::TimeoutProcess).to receive(:run) do |_command, keyword_args|
        expect(keyword_args[:silent]).to eq true
      end.and_return [true, []]

      Yast::IscsiClientLib.discover(host, port, auth, silent: true)
    end

    context "with no discovery authentication" do
      it "first disables discovery authentication and later restores the initial config" do
        expect(Yast::SCR).to receive(:Write) do |path, content|
          expect(path).to eq etc_iscsid_all
          config_keys = config_values(content).keys
          expect(config_keys).to_not include("discovery.sendtargets.auth.authmethod")
          expect(config_keys).to_not include("discovery.sendtargets.auth.username")
          expect(config_keys).to_not include("discovery.sendtargets.auth.username_in")
        end.ordered
        expect(Yast::SCR).to receive(:Write).with(etc_iscsid, nil).ordered

        expect(Yast::SCR).to receive(:Write).with(etc_iscsid_all, initial_config).ordered
        expect(Yast::SCR).to receive(:Write).with(etc_iscsid, nil).ordered

        Yast::IscsiClientLib.discover(host, port, auth)
      end
    end

    context "with discovery authentication by the target" do
      before do
        auth.username = "noone"
        auth.password = "secret"
      end

      it "first sets discovery authentication and later restores the initial config" do
        expect(Yast::SCR).to receive(:Write) do |path, content|
          expect(path).to eq etc_iscsid_all
          config = config_values(content)
          expect(config["discovery.sendtargets.auth.authmethod"]).to eq "CHAP"
          expect(config["discovery.sendtargets.auth.username"]).to eq "noone"
          expect(config["discovery.sendtargets.auth.password"]).to eq "secret"
          expect(config.keys).to_not include("discovery.sendtargets.auth.username_in")
        end.ordered
        expect(Yast::SCR).to receive(:Write).with(etc_iscsid, nil).ordered

        expect(Yast::SCR).to receive(:Write).with(etc_iscsid_all, initial_config).ordered
        expect(Yast::SCR).to receive(:Write).with(etc_iscsid, nil).ordered

        Yast::IscsiClientLib.discover(host, port, auth)
      end
    end

    context "with bi-directional discovery authentication" do
      before do
        auth.username = "noone"
        auth.password = "secret"
        auth.username_in = "someone"
        auth.password_in = "shared secret"
      end

      it "sets bi-directional discovery authentication and later restores the initial config" do
        expect(Yast::SCR).to receive(:Write) do |path, content|
          expect(path).to eq etc_iscsid_all
          config = config_values(content)
          expect(config["discovery.sendtargets.auth.authmethod"]).to eq "CHAP"
          expect(config["discovery.sendtargets.auth.username"]).to eq "noone"
          expect(config["discovery.sendtargets.auth.password"]).to eq "secret"
          expect(config["discovery.sendtargets.auth.username_in"]).to eq "someone"
          expect(config["discovery.sendtargets.auth.password_in"]).to eq "shared secret"
        end.ordered
        expect(Yast::SCR).to receive(:Write).with(etc_iscsid, nil).ordered

        expect(Yast::SCR).to receive(:Write).with(etc_iscsid_all, initial_config).ordered
        expect(Yast::SCR).to receive(:Write).with(etc_iscsid, nil).ordered

        Yast::IscsiClientLib.discover(host, port, auth)
      end
    end
  end

  describe "#ScanDiscovered for iscsiadm -m session -P 1" do
    context "with Current Portal: and Persistent Portal: differ" do
      it "returns list of connected targets with IPs of Persistent Portal" do
        expect(subject.ScanDiscovered(
                 ["Target: iqn.2013-10.de.suse:test_file1",
                  "\tCurrent Portal: 10.13.67.182:3260,1",
                  "\tPersistent Portal: 10.120.66.182:3260,1",
                  "\t\t**********",
                  "\t\tInterface:",
                  "\t\t**********",
                  "\t\tIface Name: default",
                  "\t\tIface Transport: tcp",
                  "\t\tIface Initiatorname: iqn.1996-04.de.suse:01:19eacab02a1d",
                  "\t\tIface IPaddress: <empty>",
                  "\t\tIface HWaddress: <empty>",
                  "\t\tIface Netdev: <empty>",
                  "\t\tSID: 1",
                  "\t\tiSCSI Connection State: TRANSPORT WAIT",
                  "\t\tiSCSI Session State: FREE",
                  "\t\tInternal iscsid Session State: REOPEN", "",
                  "Target: iqn.2013-10.de.suse:test_file2",
                  "\tCurrent Portal: [2620:113:80c0:890:e051:56:73c7:9171]:3260,1",
                  "\tPersistent Portal: [2620:113:80c0:8080:e051:f9ea:73c7:9171]:3260,1",
                  "\t\t**********",
                  "\t\tInterface:",
                  "\t\t**********",
                  "\t\tIface Name: default",
                  "\t\tIface Transport: tcp",
                  "\t\tIface Initiatorname: iqn.1996-04.de.suse:01:19eacab02a1d",
                  "\t\tIface IPaddress: <empty>",
                  "\t\tIface HWaddress: <empty>",
                  "\t\tIface Netdev: <empty>",
                  "\t\tSID: 1",
                  "\t\tiSCSI Connection State: TRANSPORT WAIT",
                  "\t\tiSCSI Session State: FREE",
                  "\t\tInternal iscsid Session State: REOPEN", ""]
               )).to eq(
          ["10.120.66.182:3260 iqn.2013-10.de.suse:test_file1 default",
           "[2620:113:80c0:8080:e051:f9ea:73c7:9171]:3260 iqn.2013-10.de.suse:test_file2 default"]
        )
      end
    end
  end

  describe "#ScanDiscovered for iscsiadm -m node -P 1" do
    context "with Portal:" do
      it "returns list of discovered targets with IPs of Portal" do
        expect(subject.ScanDiscovered(
                 ["Target: iqn.2013-10.de.suse:test_file2",
                  "\tPortal: [fe80::a00:27ff:fe1b:a7fe]:3260,1",
                  "\t\tIface Name: default",
                  "Target: iqn.2013-10.de.suse:test_file2",
                  "\tPortal: [2620:113:80c0:8080:e051:f9ea:73c7:9171]:3260,1",
                  "\t\tIface Name: default",
                  "Target: iqn.2013-10.de.suse:test_file2",
                  "\tPortal: 10.120.66.182:3260,1",
                  "Target: iqn.2013-10.de.suse:test_file2",
                  "\tPortal: [2620:113:80c0:8080:a00:27ff:fe1b:a7fe]:3260,1",
                  "Target: iqn.2018-06.de.suse.zeus:01",
                  "\tPortal: 192.168.20.20:3260,2",
                  "\t\tIface Name: default",
                  "\tPortal: 192.168.10.20:3260,1",
                  "\t\tIface Name: bnx2i.9c:dc:71:df:cf:29.ipv4.0"]
               )).to eq(
          [
            "[2620:113:80c0:8080:e051:f9ea:73c7:9171]:3260 iqn.2013-10.de.suse:test_file2 default",
            "10.120.66.182:3260 iqn.2013-10.de.suse:test_file2 default",
            "[2620:113:80c0:8080:a00:27ff:fe1b:a7fe]:3260 iqn.2013-10.de.suse:test_file2 default",
            "192.168.20.20:3260 iqn.2018-06.de.suse.zeus:01 default",
            "192.168.10.20:3260 iqn.2018-06.de.suse.zeus:01 bnx2i.9c:dc:71:df:cf:29.ipv4.0"
          ]
        )
      end
    end
  end

  describe "#getiBFT" do
    context "when filtering output of 'iscsiadm -m fw'" do
      it "returns data in form of a map " do
        allow(Yast::Arch).to receive(:architecture).and_return("x86_64")
        allow(subject).to receive(:getFirmwareInfo)
          .and_return("# BEGIN RECORD 2.0-872\n" \
                      "iface.bootproto = STATIC\n" \
                      "iface.transport_name = tcp\n" \
                      "iface.hwaddress = 00:00:c9:b1:bc:7f\n" \
                      "iface.initiatorname = iqn.2011-05.com.emulex:eraptorrfshoneport1\n" \
                      "iface.ipaddress = 2620:0113:80c0:8000:000c:0000:0000:04dc\n" \
                      "node.conn[0].address = 172.0.21.6\n" \
                      "node.conn[0].port = 3260\n" \
                      "node.name = iqn.1986-03.com.ibm:sn.135061874\n" \
                      "# END RECORD\n")

        ibft_data = subject.getiBFT

        expect(ibft_data).to eq(
          "iface.bootproto"      => "STATIC",
          "iface.hwaddress"      => "00:00:c9:b1:bc:7f",
          "iface.initiatorname"  => "iqn.2011-05.com.emulex:eraptorrfshoneport1",
          "iface.transport_name" => "tcp",
          "iface.ipaddress"      => "2620:0113:80c0:8000:000c:0000:0000:04dc",
          "node.conn[0].address" => "172.0.21.6",
          "node.conn[0].port"    => "3260",
          "node.name"            => "iqn.1986-03.com.ibm:sn.135061874"
        )
      end
    end

    context "when could not get list of targets from firmware" do
      it "returns an empty map " do
        allow(Yast::Arch).to receive(:architecture).and_return("x86_64")
        allow(subject).to receive(:getFirmwareInfo).and_return("")

        ibft_data = subject.getiBFT

        expect(ibft_data).to eq({})
      end
    end

    context "when not on x86 hardware" do
      it "returns an empty map " do
        allow(Yast::Arch).to receive(:architecture).and_return("s390_64")

        ibft_data = subject.getiBFT

        expect(ibft_data).to eq({})
      end
    end
  end

  describe "#iscsiuio_relevant?" do
    before do
      allow(subject).to receive(:GetOffloadModules).and_return modules
    end

    context "there are no cards in the system supporting offloading" do
      let(:modules) { [] }

      it "returns false" do
        expect(subject.iscsiuio_relevant?).to eq false
      end
    end

    context "there are cards in the system supporting offloading" do
      context "but none of them use the bnx2i or qedi modules" do
        let(:modules) { ["fnic", "cxgb3i"] }

        it "returns false" do
          expect(subject.iscsiuio_relevant?).to eq false
        end
      end

      context "and one of them uses de bnx2i module" do
        let(:modules) { ["fnic", "cxgb3i", "bnx2i"] }

        it "returns true" do
          expect(subject.iscsiuio_relevant?).to eq true
        end
      end

      context "and one of them uses de qedi module" do
        let(:modules) { ["qedi"] }

        it "returns true" do
          expect(subject.iscsiuio_relevant?).to eq true
        end
      end

      context "and there are cards using both bnx2i and qedi modules" do
        let(:modules) { ["qedi", "cxgb3i", "bnx2i"] }

        it "returns true" do
          expect(subject.iscsiuio_relevant?).to eq true
        end
      end
    end
  end

  describe ".InitIfaceFile" do
    around(:each) do |example|
      # The directory /etc/iscsi/ifaces/ is always scanned to look for interface definitions,
      # let's chroot the YaST agents so we can use an /etc directory with mocked content
      root = File.join(FIXTURES_PATH, "yast2", "y2iscsi_client", "chroot1")
      change_scr_root(root, &example)
    end

    it "reads the existent iface files" do
      expect(Yast::SCR).to receive(:Read).with(Yast.path(".target.dir"), "/etc/iscsi/ifaces").twice
      subject.send(:InitIfaceFile)
    end

    context "there is no iface files" do
      it "tries to generate them calling iscsiadm -m iface" do
        expect(Yast::SCR).to receive(:Read).with(Yast.path(".target.dir"),
          "/etc/iscsi/ifaces").and_return([])
        path = Yast::Path.new(".target.bash_output")
        cmd = "LC_ALL=POSIX iscsiadm -m iface"
        expect(Yast::SCR).to receive(:Execute).with(path, cmd)
        allow(Yast::SCR).to receive(:Read).with(Yast.path(".target.dir"),
          "/etc/iscsi/ifaces").and_return([])
        subject.send(:InitIfaceFile)
      end
    end

    context "there are iface files" do
      it "does not call iscsiadm -m iface" do
        path = Yast::Path.new(".target.bash_output")
        cmd = "LC_ALL=POSIX iscsiadm -m iface"
        expect(Yast::SCR).to_not receive(:Execute).with(path, cmd)
        subject.send(:InitIfaceFile)
      end

      it "populates the ifaces_file variable with the read data" do
        iface_file = subject.instance_variable_get(:@iface_file)
        expect(iface_file).to be_nil
        subject.send(:InitIfaceFile)
        iface_file = subject.instance_variable_get(:@iface_file)
        iface, data = iface_file.first
        expect(iface).to eq("bnx2i.ab:cd:de:fa:cf:29.ipv4.0")
        expect(data[:name]).to eq("bnx2i.ab:cd:de:fa:cf:29.ipv4.0")
        expect(data[:hwaddress]).to eq("ab:cd:de:fa:cf:29")
        expect(data[:ip]).to eq("192.168.100.29")
        expect(data[:transport]).to eq("bnx2i")
      end
    end
  end

  describe ".iface_items" do
    around(:each) do |example|
      # The directory /etc/iscsi/ifaces/ is always scanned to look for interface definitions,
      # let's chroot the YaST agents so we can use an /etc directory with mocked content
      root = File.join(FIXTURES_PATH, "yast2", "y2iscsi_client", "chroot1")
      change_scr_root(root, &example)
    end

    before do
      # iscsiadm is always called, mock it to find no active ISCSI interfaces by default
      mock_iscsiadm_mode([])
    end

    # The structure of the YaST UI terms is quite tricky, so let's define a couple of functions
    # to inspect their content in a readable way.

    # Id for the given combo-box entry
    #
    # @param item [Yast::Term] term used to represent an Item for a ComboBox
    def ui_item_id(item)
      item.params.first.params.first
    end

    # @see #ui_term_id
    def ui_item_label(item)
      item.params[1]
    end

    # Define some simple checks to be reused in several scenarios

    RSpec.shared_examples "returns UI items" do
      it "returns an array of UI items" do
        items = subject.iface_items
        expect(items).to be_an(Array)
        expect(items).to all be_a(Yast::Term)
        expect(items.map(&:value)).to all eq(:item)
      end
    end

    RSpec.shared_examples "only default" do
      it "provides 'default' as the only item" do
        items = subject.iface_items
        expect(items.size).to eq 1
        expect(ui_item_label(items.first)).to eq "default (Software)"
        expect(ui_item_id(items.first)).to eq "default"
      end
    end

    context "with no iscsi ifaces in the system" do
      before do
        allow(Yast::SCR).to receive(:Read).with(Yast.path(".target.dir"), "/etc/iscsi/ifaces")
        mock_bash_out(/iscsiadm -m iface/, { "exit" => 0, "stdout" => "", "stderr" => "" })
      end

      include_examples "returns UI items"
      include_examples "only default"
    end

    context "with iscsi ifaces in the system" do
      include_examples "returns UI items"

      it "includes 'default', 'all' and an entry for each offload card" do
        items = subject.iface_items

        labels = items.map { |i| ui_item_label(i) }
        expect(labels).to contain_exactly(
          "default (Software)", "all", "bnx2i.ab:cd:de:fa:cf:29.ipv4.0 - 192.168.100.29"
        )

        ids = items.map { |i| ui_item_id(i) }
        expect(ids).to contain_exactly("default", "all", "bnx2i.ab:cd:de:fa:cf:29.ipv4.0")
      end
    end

    context "and no iscsi iface is reported by iscsiadm " do
      before { mock_iscsiadm_mode([]) }

      it "pre-selects the item 'default'" do
        selected = subject.iface_items.find { |i| i.params[2] }
        expect(ui_item_id(selected)).to eq "default"
      end
    end

    context "and one card is already associated to the first target" do
      before { mock_iscsiadm_mode(["bnx2i.ab:cd:de:fa:cf:29.ipv4.0"]) }

      it "selects by default the current iface" do
        selected = subject.iface_items.find { |i| i.params[2] }
        expect(ui_item_id(selected)).to eq "bnx2i.ab:cd:de:fa:cf:29.ipv4.0"
      end
    end
  end

  describe ".connected" do
    before do
      Yast::IscsiClientLib.sessions = [
        "192.168.1.10:3260 iqn.2022-12.com.example:2b0b2b2b default",
        "192.168.1.11:3260 iqn.2023-12.com.example:2a0a2a3a default"
      ]
    end

    context "if check_ip is true" do
      let(:check_ip) { true }

      it "returns true if address, port, target name and interface match with a session" do
        Yast::IscsiClientLib.currentRecord = [
          "192.168.1.10:3260", "iqn.2022-12.com.example:2b0b2b2b", "default"
        ]
        expect(Yast::IscsiClientLib.connected(check_ip)).to eq true
      end

      it "returns false if only address, target name and interface match with a session" do
        Yast::IscsiClientLib.currentRecord = [
          "192.168.1.10:6666", "iqn.2022-12.com.example:2b0b2b2b", "default"
        ]
        expect(Yast::IscsiClientLib.connected(check_ip)).to eq false
      end

      it "returns false if only port, target name and interface match with a session" do
        Yast::IscsiClientLib.currentRecord = [
          "192.168.1.20:3260", "iqn.2022-12.com.example:2b0b2b2b", "default"
        ]
        expect(Yast::IscsiClientLib.connected(check_ip)).to eq false
      end

      it "returns false if only address, port and interface match with a session" do
        Yast::IscsiClientLib.currentRecord = [
          "192.168.1.10:3260", "iqn.2021-11.com.example:1b0b1b2b", "default"
        ]
        expect(Yast::IscsiClientLib.connected(check_ip)).to eq false
      end

      it "returns false if only address, port and target name match with a session" do
        Yast::IscsiClientLib.currentRecord = [
          "192.168.1.10:3260", "iqn.2022-12.com.example:2b0b2b2b", "eth0"
        ]
        expect(Yast::IscsiClientLib.connected(check_ip)).to eq false
      end
    end

    context "if check_ip is false" do
      let(:check_ip) { false }

      it "returns true if address, port, target name and interface match with a session" do
        Yast::IscsiClientLib.currentRecord = [
          "192.168.1.10:3260", "iqn.2022-12.com.example:2b0b2b2b", "default"
        ]
        expect(Yast::IscsiClientLib.connected(check_ip)).to eq true
      end

      # If check_ip is false, the port is not checked
      it "returns true if only address, target name and interface match with a session" do
        Yast::IscsiClientLib.currentRecord = [
          "192.168.1.10:6666", "iqn.2022-12.com.example:2b0b2b2b", "default"
        ]
        expect(Yast::IscsiClientLib.connected(check_ip)).to eq true
      end

      # If check_ip is false, the address is not checked
      it "returns true if only port, target name and interface match with a session" do
        Yast::IscsiClientLib.currentRecord = [
          "192.168.1.20:3260", "iqn.2022-12.com.example:2b0b2b2b", "default"
        ]
        expect(Yast::IscsiClientLib.connected(check_ip)).to eq true
      end

      it "returns false if only address, port and interface match with a session" do
        Yast::IscsiClientLib.currentRecord = [
          "192.168.1.10:3260", "iqn.2021-11.com.example:1b0b1b2b", "default"
        ]
        expect(Yast::IscsiClientLib.connected(check_ip)).to eq false
      end

      it "returns false if only address, port and target name match with a session" do
        Yast::IscsiClientLib.currentRecord = [
          "192.168.1.10:3260", "iqn.2022-12.com.example:2b0b2b2b", "eth0"
        ]
        expect(Yast::IscsiClientLib.connected(check_ip)).to eq false
      end
    end
  end

  describe ".removeRecord" do
    before do
      Yast::IscsiClientLib.currentRecord = [
        "192.168.1.20:3260", "iqn.2022-12.com.example:2b0b2b2b", "default"
      ]

      allow(Yast::SCR).to receive(:Execute).with(Yast::Path.new(".target.bash_output"), anything)
        .and_return("exit" => exit_code, "stdout" => "", "stderr" => "")
    end

    context "if iscsiadm exit code is 0" do
      let(:exit_code) { 0 }

      it "returns true" do
        expect(Yast::IscsiClientLib.removeRecord).to eq true
      end
    end

    context "if iscsiadm exit code is different from 0" do
      let(:exit_code) { 1 }

      it "returns true" do
        expect(Yast::IscsiClientLib.removeRecord).to eq false
      end
    end
  end

  describe "#hidePassword" do
    let(:orig) do
      {
        "node.name"     => "my.node",
        "harm.less"     => "harmless",
        "auth.password" => "s3cr3t",
        "auth.PASSWORD" => "s3cr3t"
      }
    end

    it "hides passwords and only passwords" do
      hidden = Yast::IscsiClientLib.hidePassword(orig)

      expect(hidden["harm.less"]).to eq("harmless")
      expect(hidden["auth.PASSWORD"]).not_to include("s3cr3t")
      expect(hidden["auth.password"]).not_to include("s3cr3t")
    end
  end
end
