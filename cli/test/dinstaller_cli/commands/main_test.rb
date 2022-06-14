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
require "dinstaller_cli/clients/manager"

describe DInstallerCli::Commands::Main do
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
    allow(DInstallerCli::Clients::Manager).to receive(:new).and_return(manager_client)
  end

  let(:manager_client) { instance_double(DInstallerCli::Clients::Manager) }

  subject { described_class.new }

  describe "#install" do
    before do
      allow(subject).to receive(:ask).and_return(answer)
      allow(manager_client).to receive(:commit)
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

      it "performs the installation" do
        expect(manager_client).to receive(:commit)

        subject.install
      end
    end
  end

  describe "#status" do
    before do
      allow(manager_client).to receive(:status).and_return(status)
    end

    context "when the service status is 0" do
      let(:status) { 0 }

      it "reports 'error'" do

        expect(subject).to receive(:say).with("error")

        subject.status
      end
    end

    context "when the service status is 1" do
      let(:status) { 1 }

      it "reports 'probing'" do

        expect(subject).to receive(:say).with("probing")

        subject.status
      end
    end

    context "when the service status is 2" do
      let(:status) { 2 }

      it "reports 'probed'" do

        expect(subject).to receive(:say).with("probed")

        subject.status
      end
    end

    context "when the service status is 3" do
      let(:status) { 3 }

      it "reports 'installing'" do

        expect(subject).to receive(:say).with("installing")

        subject.status
      end
    end

    context "when the service status is 4" do
      let(:status) { 4 }

      it "reports 'installed'" do

        expect(subject).to receive(:say).with("installed")

        subject.status
      end
    end

    context "when the service status is 5" do
      let(:status) { 5 }

      it "reports 'unknown'" do

        expect(subject).to receive(:say).with("unknown")

        subject.status
      end
    end
  end
end
