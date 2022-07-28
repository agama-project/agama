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
require "dinstaller_cli/commands/config"
require "dinstaller_cli/install_config"
require "dinstaller_cli/install_config_reader"
require "dinstaller_cli/clients/storage"
require "dinstaller/dbus/clients/language"
require "dinstaller/dbus/clients/users"
require "dinstaller/dbus/clients/software"

describe DInstallerCli::Commands::Config do
  before do
    allow(DInstaller::DBus::Clients::Software).to receive(:new).and_return(software_client)
    allow(DInstaller::DBus::Clients::Language).to receive(:new).and_return(language_client)
    allow(DInstallerCli::Clients::Storage).to receive(:new).and_return(storage_client)
    allow(DInstaller::DBus::Clients::Users).to receive(:new).and_return(users_client)
  end

  let(:language_client) { instance_double(DInstaller::DBus::Clients::Language) }
  let(:software_client) { instance_double(DInstaller::DBus::Clients::Software) }
  let(:storage_client) { instance_double(DInstallerCli::Clients::Storage) }
  let(:users_client) { instance_double(DInstaller::DBus::Clients::Users) }

  subject { described_class.new }

  describe "#load" do
    before do
      allow(DInstallerCli::InstallConfigReader).to receive(:new).with(config_source)
        .and_return(reader)
    end

    let(:config_source) { "config.yaml" }

    let(:reader) { instance_double(DInstallerCli::InstallConfigReader) }

    context "when the config cannot be loaded" do
      before do
        allow(reader).to receive(:read).and_raise(DInstallerCli::InstallConfigReader::Error)
      end

      it "informs about wrong config" do
        expect(subject).to receive(:say_error).with(/invalid configuration/)

        subject.load(config_source)
      end
    end

    context "when the config can be loaded" do
      before do
        allow(reader).to receive(:read).and_return(config)
      end

      let(:config) { DInstallerCli::InstallConfig.new }

      context "and the config specifies a product" do
        before do
          config.product = "Tumbleweed"
        end

        it "configures the product" do
          expect(software_client).to receive(:select_product).with("Tumbleweed")

          subject.load(config_source)
        end
      end

      context "and the config does not specify a product" do
        it "does not configure a product" do
          expect(software_client).to_not receive(:select_product)

          subject.load(config_source)
        end
      end

      context "and the config specifies a language" do
        before do
          config.languages = ["es_ES"]
        end

        it "configures the language" do
          expect(language_client).to receive(:select_languages).with(["es_ES"])

          subject.load(config_source)
        end
      end

      context "and the config does not specify a language" do
        it "does not configure a language" do
          expect(language_client).to_not receive(:select_languages)

          subject.load(config_source)
        end
      end

      context "and the config specifies disks" do
        before do
          config.disks = ["/dev/vda", "/dev/vdb"]
        end

        it "calculates the proposal with the target disks" do
          expect(storage_client).to receive(:calculate).with(["/dev/vda", "/dev/vdb"])

          subject.load(config_source)
        end
      end

      context "and the config does not specify disks" do
        it "does not calculate the proposal" do
          expect(storage_client).to_not receive(:calculate)

          subject.load(config_source)
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

            subject.load(config_source)
          end
        end

        context "and the user config has a name" do
          let(:name) { "test" }

          it "configures the user" do
            expect(users_client).to receive(:create_first_user).with("test", anything)

            subject.load(config_source)
          end
        end
      end

      context "and the config does not specify user config" do
        it "does not configure the user" do
          expect(users_client).to_not receive(:create_first_user)

          subject.load(config_source)
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

          subject.load(config_source)
        end
      end

      context "and the config does not specify root config" do
        it "does not configure the root user" do
          expect(users_client).to_not receive(:root_password=)
          expect(users_client).to_not receive(:root_ssh_key=)

          subject.load(config_source)
        end
      end
    end
  end

  describe "#dump" do
    before do
      allow(software_client).to receive(:selected_product).and_return("Tumbleweed")
      allow(language_client).to receive(:selected_languages).and_return(["es_ES"])
      allow(storage_client).to receive(:candidate_devices).and_return(["/dev/vda"])
      allow(users_client).to receive(:first_user).and_return(["Test User", "user", true])
      allow(users_client).to receive(:root_ssh_key).and_return("1234abcd")
    end

    it "dumps the current config" do
      expect(subject).to receive(:say).with(
        "---\n" \
        "product: Tumbleweed\n" \
        "languages:\n" \
        "- es_ES\n" \
        "disks:\n" \
        "- \"\/dev\/vda\"\n" \
        "user:\n" \
        "  name: user\n" \
        "  fullname: Test User\n" \
        "  autologin: true\n" \
        "  password:\n" \
        "root:\n" \
        "  ssh_key: 1234abcd\n" \
        "  password:\n"
      )

      subject.dump
    end
  end
end
