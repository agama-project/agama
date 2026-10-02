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
require "y2iscsi_client/config"
require "y2iscsi_client/authentication"
require "tmpdir"
require "fileutils"

# NOTE: this class has no upstream test at all (not even an incidental reference), so this spec
# was written from scratch while vendoring, based on reading the real source and its only caller,
# IscsiClientLib#getConfig/#saveConfig/#discover (see service/YaST2/README.md).
describe Y2IscsiClient::Config do
  subject(:config) { described_class.new }

  let(:etc_iscsid_all) { Yast::Path.new(".etc.iscsid.all") }
  let(:etc_iscsid) { Yast::Path.new(".etc.iscsid") }

  describe "#empty?" do
    it "returns true for a freshly created config" do
      expect(config.empty?).to eq(true)
    end

    context "after reading data from the system" do
      before do
        allow(Yast::SCR).to receive(:Read).with(etc_iscsid_all)
          .and_return("value" => [])
        config.read
      end

      it "returns false" do
        expect(config.empty?).to eq(false)
      end
    end
  end

  describe "#entries and #entries=" do
    it "returns an empty array by default" do
      expect(config.entries).to eq([])
    end

    it "returns whatever was explicitly set" do
      entries = [{ "name" => "node.startup", "value" => "manual" }]
      config.entries = entries

      expect(config.entries).to eq(entries)
    end
  end

  describe "#read" do
    it "loads the entries from .etc.iscsid.all" do
      data = { "value" => [{ "name" => "node.startup", "value" => "manual" }] }
      allow(Yast::SCR).to receive(:Read).with(etc_iscsid_all).and_return(data)

      config.read

      expect(config.entries).to eq(data["value"])
    end
  end

  describe "#save" do
    it "writes .etc.iscsid.all and then commits with .etc.iscsid" do
      entries = [{ "name" => "node.startup", "value" => "manual" }]
      config.entries = entries
      writes = []

      allow(Yast::SCR).to receive(:Write) { |path, data| writes << [path, data] }

      config.save

      expect(writes.size).to eq(2)
      expect(writes[0]).to eq([etc_iscsid_all, { "value" => entries }])
      expect(writes[1]).to eq([etc_iscsid, nil])
    end
  end

  describe "#set_discovery_auth" do
    let(:auth) { Y2IscsiClient::Authentication.new }

    def entry(name)
      config.entries.find { |e| e["name"] == name }
    end

    context "when the given authentication is not CHAP" do
      it "removes any discovery authentication entry" do
        config.entries = [
          { "name" => "discovery.sendtargets.auth.authmethod", "value" => "CHAP" },
          { "name" => "discovery.sendtargets.auth.username", "value" => "noone" },
          { "name" => "discovery.sendtargets.auth.password", "value" => "secret" }
        ]

        config.set_discovery_auth(auth)

        expect(entry("discovery.sendtargets.auth.authmethod")).to be_nil
        expect(entry("discovery.sendtargets.auth.username")).to be_nil
        expect(entry("discovery.sendtargets.auth.password")).to be_nil
      end
    end

    context "when the given authentication is CHAP (by target only)" do
      before do
        auth.username = "noone"
        auth.password = "secret"
      end

      it "sets the target authmethod/username/password entries" do
        config.set_discovery_auth(auth)

        expect(entry("discovery.sendtargets.auth.authmethod")["value"]).to eq("CHAP")
        expect(entry("discovery.sendtargets.auth.username")["value"]).to eq("noone")
        expect(entry("discovery.sendtargets.auth.password")["value"]).to eq("secret")
      end

      it "does not set any initiator (by_initiator) entry" do
        config.set_discovery_auth(auth)

        expect(entry("discovery.sendtargets.auth.username_in")).to be_nil
        expect(entry("discovery.sendtargets.auth.password_in")).to be_nil
      end
    end

    context "when the given authentication is bi-directional CHAP" do
      before do
        auth.username = "noone"
        auth.password = "secret"
        auth.username_in = "someone"
        auth.password_in = "shared secret"
      end

      it "sets both target and initiator entries" do
        config.set_discovery_auth(auth)

        expect(entry("discovery.sendtargets.auth.username")["value"]).to eq("noone")
        expect(entry("discovery.sendtargets.auth.password")["value"]).to eq("secret")
        expect(entry("discovery.sendtargets.auth.username_in")["value"]).to eq("someone")
        expect(entry("discovery.sendtargets.auth.password_in")["value"]).to eq("shared secret")
      end
    end

    context "when an entry already exists" do
      before do
        auth.username = "noone"
        auth.password = "secret"

        config.entries = [
          { "name" => "discovery.sendtargets.auth.username", "value" => "previous" }
        ]
      end

      it "updates the existing entry in place instead of duplicating it" do
        config.set_discovery_auth(auth)

        matches = config.entries.select { |e| e["name"] == "discovery.sendtargets.auth.username" }
        expect(matches.size).to eq(1)
        expect(matches.first["value"]).to eq("noone")
      end
    end
  end

  describe "#set_isns" do
    context "when both address and port are given" do
      it "sets the isns.address and isns.port entries" do
        config.set_isns("192.168.1.1", "3205")

        address = config.entries.find { |e| e["name"] == "isns.address" }
        port = config.entries.find { |e| e["name"] == "isns.port" }
        expect(address["value"]).to eq("192.168.1.1")
        expect(port["value"]).to eq("3205")
      end
    end

    context "when the address is empty" do
      it "removes the isns.address and isns.port entries" do
        config.entries = [
          { "name" => "isns.address", "value" => "192.168.1.1" },
          { "name" => "isns.port", "value" => "3205" }
        ]

        config.set_isns("", "3205")

        expect(config.entries).to be_empty
      end
    end

    context "when the port is empty" do
      it "removes the isns.address and isns.port entries" do
        config.entries = [
          { "name" => "isns.address", "value" => "192.168.1.1" },
          { "name" => "isns.port", "value" => "3205" }
        ]

        config.set_isns("192.168.1.1", "")

        expect(config.entries).to be_empty
      end
    end
  end

  # All the tests above stub Yast::SCR directly, so they never actually exercise the real
  # ".etc.iscsid"/".etc.iscsid.all" SCR path - that path is registered by the vendored
  # service/YaST2/scrconf/iscsid.scr, a non-Ruby asset easy to miss when enumerating a package's
  # require/Yast.import graph alone. A first version of this vendoring omitted that file, which
  # worked fine in a git checkout (the real yast2-iscsi-client RPM registered the path anyway) but
  # silently returned nil from Yast::SCR.Read once that RPM was fully uninstalled. These tests
  # exercise the real SCR agent (via a chroot, see Yast::RSpec::SCR) to catch that class of
  # regression; do not replace them with mocked-SCR equivalents.
  describe "end-to-end with the real SCR agent (no Yast::SCR mocking)" do
    # NOTE: change_scr_root raises if called while another chroot is still open, so each describe
    # below opens/closes its own chroot independently instead of sharing one top-level `around`.

    describe "#read" do
      around do |example|
        change_scr_root(File.join(FIXTURES_PATH, "yast2", "y2iscsi_client", "chroot1"), &example)
      end

      it "parses the real /etc/iscsi/iscsid.conf through the vendored SCR agent" do
        config.read

        values = config.entries.each_with_object({}) { |e, h| h[e["name"]] = e["value"] }
        expect(values["node.startup"]).to eq("manual")
        expect(values["discovery.sendtargets.auth.authmethod"]).to eq("CHAP")
        expect(values["discovery.sendtargets.auth.username"]).to eq("noone")
      end
    end

    describe "#save" do
      around do |example|
        Dir.mktmpdir do |dir|
          FileUtils.mkdir_p(File.join(dir, "etc", "iscsi"))
          FileUtils.touch(File.join(dir, "etc", "iscsi", "iscsid.conf"))
          change_scr_root(dir, &example)
        end
      end

      it "writes entries that can be read back through the real SCR agent" do
        # Like IscsiClientLib#getConfig/#setConfig, #read first to get the full structure the
        # underlying ag_ini agent expects. Entries are set through the real public API
        # (#set_isns, which internally builds properly-shaped entry maps via #create_map) rather
        # than a bare `entries = [{"name" => ..., "value" => ...}]` assignment: the real ag_ini
        # agent silently ignores entries missing the "kind"/"type"/"comment" keys that
        # #create_map always fills in, so a bare hash would pass with mocked Yast::SCR but
        # silently write nothing for real.
        config.read
        config.set_isns("192.168.1.1", "3205")

        config.save

        reader = described_class.new
        reader.read
        values = reader.entries.each_with_object({}) { |e, h| h[e["name"]] = e["value"] }
        expect(values["isns.address"]).to eq("192.168.1.1")
        expect(values["isns.port"]).to eq("3205")
      end
    end
  end
end
