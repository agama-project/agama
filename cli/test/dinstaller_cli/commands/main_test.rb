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
require "dinstaller_cli/commands/main"
require "dinstaller_cli/install_config"
require "dinstaller_cli/install_config_reader"
require "dinstaller/dbus/clients/manager"
require "dinstaller/dbus/clients/software"
require "dinstaller/installation_phase"

describe DInstallerCli::Commands::Main do
  it "includes a 'config' command" do
    expect(described_class.subcommands).to include("config")
  end

  it "includes a 'language' command" do
    expect(described_class.subcommands).to include("language")
  end

  it "includes a 'software' command" do
    expect(described_class.subcommands).to include("software")
  end

  it "includes a 'storage' command" do
    expect(described_class.subcommands).to include("storage")
  end

  it "includes a 'rootuser' command" do
    expect(described_class.subcommands).to include("rootuser")
  end

  it "includes a 'user' command" do
    expect(described_class.subcommands).to include("user")
  end

  before do
    allow(DInstaller::DBus::Clients::Manager).to receive(:new).and_return(manager_client)
    allow(DInstaller::DBus::Clients::Software).to receive(:new).and_return(software_client)
  end

  let(:manager_client) { instance_double(DInstaller::DBus::Clients::Manager) }
  let(:software_client) { instance_double(DInstaller::DBus::Clients::Software) }

  subject { described_class.new }

  describe "#install" do
    before do
      allow(subject).to receive(:ask).and_return(answer)
      allow(manager_client).to receive(:probe)
      allow(manager_client).to receive(:commit)
      allow(manager_client).to receive(:on_progress_change)
      allow(software_client).to receive(:on_progress_change)
    end

    let(:answer) { "n" }

    it "asks for confirmation" do
      expect(subject).to receive(:ask).with(/start the installation/, anything)

      subject.install
    end

    context "if the user does not confirm" do
      let(:answer) { "n" }

      it "does not perform the installation" do
        expect(manager_client).to_not receive(:commit)

        subject.install
      end
    end

    context "if the user confirms" do
      let(:answer) { "y" }

      before do
        allow(manager_client).to receive(:current_installation_phase).and_return(current_phase)
      end

      context "and the current installation phase is startup" do
        let(:current_phase) { DInstaller::InstallationPhase::STARTUP }

        it "executes the config phase" do
          expect(manager_client).to receive(:probe)

          subject.install
        end

        it "executes the install phase" do
          expect(manager_client).to receive(:commit)

          subject.install
        end
      end

      context "and the current installation phase is config" do
        let(:current_phase) { DInstaller::InstallationPhase::CONFIG }

        it "does not execute the config phase" do
          expect(manager_client).to_not receive(:probe)

          subject.install
        end

        it "executes the install phase" do
          expect(manager_client).to receive(:commit)

          subject.install
        end
      end

      context "and the current installation phase is install" do
        let(:current_phase) { DInstaller::InstallationPhase::INSTALL }

        it "executes the config phase" do
          expect(manager_client).to receive(:probe)

          subject.install
        end

        it "executes the install phase" do
          expect(manager_client).to receive(:commit)

          subject.install
        end
      end
    end
  end
end
