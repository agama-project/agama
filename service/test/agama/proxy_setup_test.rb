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

require_relative "../test_helper"
require "agama/proxy_setup"

describe Agama::ProxySetup do
  subject(:proxy) { described_class.instance }
  before do
    proxy.proxy = nil
  end

  before do
    allow(Yast::Proxy).to receive(:Read)
    allow(Yast::Proxy).to receive(:Write)
  end

  describe "#run" do
    let(:file_content) { "proxy=#{proxy_url}" }
    let(:proxy_url) { "https://yast:1234@192.168.122.1:3128" }

    context "when some configuration is given through the kernel command line" do
      before do
        allow(proxy).to receive(:proxy_from_cmdline).and_return(URI(proxy_url))
        allow(proxy).to receive(:write)
      end

      it "reads the given proxy configuraion" do
        expect(proxy.proxy).to be_nil
        proxy.run
        expect(proxy.proxy).to be_a(URI)
      end

      it "writes the proxy configuration to /etc/sysconfig/proxy" do
        allow(proxy).to receive(:write).and_call_original
        expect(Yast::Proxy).to receive(:Write)
        proxy.run
        config = Yast::Proxy.Export
        expect(config).to include("https_proxy" => "https://192.168.122.1:3128",
          "proxy_password" => "1234",
          "proxy_user" => "yast",
          "enabled" => true)
      end

      context "when an http url is given" do
        let(:proxy_url) { "http://192.168.122.1:3128" }

        it "sets also the https and ftp with the same url" do
          allow(proxy).to receive(:write).and_call_original
          proxy.run
          config = Yast::Proxy.Export
          expect(config).to include("http_proxy" => "http://192.168.122.1:3128",
            "https_proxy" => "http://192.168.122.1:3128",
            "ftp_proxy" => "http://192.168.122.1:3128",
            "enabled" => true)
        end
      end
    end
  end

  describe "#propose" do
    let(:config) do
      {
        "enabled" => false
      }
    end

    before do
      Yast::Proxy.Import(config)
      allow(Yast::Installation).to receive(:destdir).and_return("/mnt")
    end

    context "when the use of proxy is enabled" do
      let(:config) do
        {
          "enabled"    => true,
          "http_proxy" => "http://192.168.122.1:3128"
        }
      end

      it "adds microos-tools package to the set of resolvables" do
        expect(Yast::PackagesProposal).to receive(:SetResolvables) do |_, _, packages|
          expect(packages).to contain_exactly("microos-tools")
        end

        proxy.propose
      end
    end
  end

  describe "#install" do
    let(:config) do
      {
        "enabled" => false
      }
    end

    before do
      Yast::Proxy.Import(config)
      allow(Yast::Installation).to receive(:destdir).and_return("/mnt")
    end

    context "when the use of proxy is disabled" do
      it "does not copy the configuration to the target system" do
        expect(FileUtils).to_not receive(:cp)
        proxy.install
      end
    end

    context "when the use of proxy is enabled" do
      let(:config) do
        {
          "enabled"    => true,
          "http_proxy" => "http://192.168.122.1:3128"
        }
      end

      it "copies the configuration to the target system" do
        expect(FileUtils).to receive(:cp).with(described_class::CONFIG_PATH,
          File.join("/mnt", described_class::CONFIG_PATH))
        proxy.install
      end
    end
  end
end
