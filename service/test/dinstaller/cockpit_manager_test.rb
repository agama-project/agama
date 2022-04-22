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

require_relative "../test_helper"
require "tmpdir"
require "fileutils"
require "dinstaller/cockpit_manager"

describe DInstaller::CockpitManager do
  subject(:cockpit) { described_class.new(logger) }

  let(:logger) { Logger.new($stdout) }

  before do
    # Avoid problems with FileFromUrl side effects.
    allow(Yast::Installation).to receive(:sourcedir).and_return("/")
  end

  describe "#setup" do
    subject(:cockpit) { described_class.new(logger, prefix: tmpdir) }

    let(:tmpdir) { Dir.mktmpdir }
    let(:cockpit_certs) { File.join(tmpdir, "etc", "cockpit", "ws-certs.d") }
    let(:cockpit_conf) { File.join(tmpdir, "etc", "cockpit", "cockpit.conf") }

    let(:systemd_service) do
      instance_double(Yast2::Systemd::Service, restart: nil)
    end

    before do
      allow(Yast2::Systemd::Service).to receive(:find).with("cockpit")
        .and_return(systemd_service)
    end

    around do |example|
      FileUtils.mkdir_p(cockpit_certs)
      FileUtils.touch(cockpit_conf)
      example.run
      FileUtils.remove_entry(tmpdir)
    end

    context "when TLS/SSL is disabled" do
      let(:options) { { "ssl" => false } }

      it "sets AllowUnencrypted to true" do
        subject.setup(options)
        content = File.read(cockpit_conf)
        expect(content).to include("AllowUnencrypted=true")
      end

      it "restarts cockpit" do
        expect(systemd_service).to receive(:restart)
        subject.setup(options)
      end
    end

    context "when TLS/SSL is enabled" do
      let(:options) { { "ssl" => true } }

      it "sets AllowUnencrypted to false" do
        subject.setup(options)
        content = File.read(cockpit_conf)
        expect(content).to include("AllowUnencrypted=false")
      end

      it "restarts cockpit" do
        expect(systemd_service).to receive(:restart)
        subject.setup(options)
      end
    end

    context "when TLS/SSL is not explictly enabled/disabled" do
      let(:options) { {} }

      it "does not change the Cockpit's encryption configuration" do
        subject.setup(options)
        content = File.read(cockpit_conf)
        expect(content).to_not include("AllowUnencrypted")
      end

      it "does not restart cockpit" do
        expect(systemd_service).to_not receive(:restart)
        subject.setup(options)
      end
    end

    context "when a TLS/SSL certificate URL is given" do
      let(:options) do
        { "ssl_cert" => "file://" + File.join(FIXTURES_PATH, "d-installer.cert") }
      end

      it "downloads the certificate to Cockpit's certificates directory" do
        subject.setup(options)
        expect(File).to exist(File.join(cockpit_certs, "0-d-installer.cert"))
      end

      it "restarts cockpit" do
        expect(systemd_service).to receive(:restart)
        subject.setup(options)
      end
    end

    context "when a TLS/SSL certificate key URL is given" do
      let(:options) do
        { "ssl_key" => "file://" + File.join(FIXTURES_PATH, "d-installer.key") }
      end

      it "downloads the key to Cockpit's certificates directory" do
        subject.setup(options)
        expect(File).to exist(File.join(cockpit_certs, "0-d-installer.key"))
      end

      it "restarts cockpit" do
        expect(systemd_service).to receive(:restart)
        subject.setup(options)
      end
    end

    context "when an empty configuration is given" do
      it "does not restart cockpit" do
        expect(systemd_service).to_not receive(:restart)
        subject.setup({})
      end
    end
  end
end
