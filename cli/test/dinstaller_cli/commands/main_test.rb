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
require "dinstaller_cli/clients"

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
    allow(DInstallerCli::Clients::Software).to receive(:new).and_return(software_client)
    allow(DInstallerCli::Clients::Language).to receive(:new).and_return(language_client)
    allow(DInstallerCli::Clients::Storage).to receive(:new).and_return(storage_client)
    allow(DInstallerCli::Clients::Users).to receive(:new).and_return(users_client)
  end

  let(:manager_client) { instance_double(DInstallerCli::Clients::Manager) }
  let(:software_client) { instance_double(DInstallerCli::Clients::Software) }
  let(:language_client) { instance_double(DInstallerCli::Clients::Language) }
  let(:storage_client) { instance_double(DInstallerCli::Clients::Storage) }
  let(:users_client) { instance_double(DInstallerCli::Clients::Users) }

  subject { described_class.new }

  describe "#install" do
    before do
      allow(subject).to receive(:ask).and_return(answer)
      allow(subject).to receive(:say)
      allow(subject).to receive(:say_error)
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

      context "and a config file was given" do
        let(:config_source) { "config.yaml" }

        context "and the config cannot be loaded" do
          before do
            allow_any_instance_of(DInstallerCli::InstallConfigReader).to receive(:read)
              .and_raise(DInstallerCli::InstallConfigReader::Error)
          end

          it "informs about wrong config" do
            expect(subject).to receive(:say_error).with(/invalid configuration/)

            subject.install(config_source)
          end

          it "does not perform the installation" do
            expect(manager_client).to_not receive(:commit)

            subject.install(config_source)
          end
        end

        context "and the config can be loaded" do
          before do
            allow(DInstallerCli::InstallConfigReader).to receive(:new).with(config_source)
              .and_return(config_reader)
          end

          let(:config_reader) { instance_double(DInstallerCli::InstallConfigReader, read: config) }

          let(:config) { DInstallerCli::InstallConfig.new }

          it "performs the installation" do
            expect(manager_client).to receive(:commit)

            subject.install(config_source)
          end

          context "and the config specifies a product" do
            before do
              config.product = "Tumbleweed"
            end

            it "configures the product" do
              expect(software_client).to receive(:select_product).with("Tumbleweed")

              subject.install(config_source)
            end
          end

          context "and the config does not specify a product" do
            it "does not configure a product" do
              expect(software_client).to_not receive(:select_product)

              subject.install(config_source)
            end
          end

          context "and the config specifies a language" do
            before do
              config.languages = ["es_ES"]
            end

            it "configures the language" do
              expect(language_client).to receive(:select_languages).with(["es_ES"])

              subject.install(config_source)
            end
          end

          context "and the config does not specify a language" do
            it "does not configure a language" do
              expect(language_client).to_not receive(:select_languages)

              subject.install(config_source)
            end
          end

          context "and the config specifies disks" do
            before do
              config.disks = ["/dev/vda", "/dev/vdb"]
            end

            it "calculates the proposal with the target disks" do
              expect(storage_client).to receive(:calculate).with(["/dev/vda", "/dev/vdb"])

              subject.install(config_source)
            end
          end

          context "and the config does not specify disks" do
            it "does not calculate the proposal" do
              expect(storage_client).to_not receive(:calculate)

              subject.install(config_source)
            end
          end

          context "and the config specifies user config" do
            before do
              config.user = DInstallerCli::InstallConfig::User.new(name: name)
            end

            context "and the user config has no name" do
              let(:name) { "" }

              it "does not configure the user" do
                expect(users_client).to_not receive(:create_first_user)

                subject.install(config_source)
              end
            end

            context "and the user config has a name" do
              let(:name) { "test" }

              it "configures the user" do
                expect(users_client).to receive(:create_first_user).with("test", anything)

                subject.install(config_source)
              end
            end
          end

          context "and the config does not specify user config" do
            it "does not configure the user" do
              expect(users_client).to_not receive(:create_first_user)

              subject.install(config_source)
            end
          end

          context "and the config specifies root config" do
            before do
              config.root = DInstallerCli::InstallConfig::Root.new(
                password: "n0ts3cr3t",
                ssh_key:  "1234abcd"
              )
            end

            it "configures the root user" do
              expect(users_client).to receive(:root_password=).with("n0ts3cr3t")
              expect(users_client).to receive(:root_ssh_key=).with("1234abcd")

              subject.install(config_source)
            end
          end

          context "and the config does not specify root config" do
            it "does not configure the root user" do
              expect(users_client).to_not receive(:root_password=)
              expect(users_client).to_not receive(:root_ssh_key=)

              subject.install(config_source)
            end
          end
        end
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

        expect(subject).to receive(:puts).with("error")

        subject.status
      end
    end

    context "when the service status is 1" do
      let(:status) { 1 }

      it "reports 'probing'" do

        expect(subject).to receive(:puts).with("probing")

        subject.status
      end
    end

    context "when the service status is 2" do
      let(:status) { 2 }

      it "reports 'probed'" do

        expect(subject).to receive(:puts).with("probed")

        subject.status
      end
    end

    context "when the service status is 3" do
      let(:status) { 3 }

      it "reports 'installing'" do

        expect(subject).to receive(:puts).with("installing")

        subject.status
      end
    end

    context "when the service status is 4" do
      let(:status) { 4 }

      it "reports 'installed'" do

        expect(subject).to receive(:puts).with("installed")

        subject.status
      end
    end

    context "when the service status is 5" do
      let(:status) { 5 }

      it "reports 'unknown'" do

        expect(subject).to receive(:puts).with("unknown")

        subject.status
      end
    end
  end
end
