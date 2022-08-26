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
require "dinstaller_cli/commands/storage"
require "dinstaller/dbus/clients/storage"
require "dinstaller/dbus/clients/manager"
require "dinstaller/installation_phase"

describe DInstallerCli::Commands::Storage do
  subject { described_class.new }

  before do
    allow(subject).to receive(:say)
    allow(DInstaller::DBus::Clients::Storage).to receive(:new).and_return(storage_client)
    allow(DInstaller::DBus::Clients::Manager).to receive(:new).and_return(manager_client)
  end

  let(:storage_client) { instance_double(DInstaller::DBus::Clients::Storage) }
  let(:manager_client) { instance_double(DInstaller::DBus::Clients::Manager) }

  describe "#available_devices" do
    before do
      allow(storage_client).to receive(:available_devices).and_return(devices)
    end

    let(:devices) { ["/dev/sda", "/dev/sdb"] }

    it "shows the available devices" do
      expect(subject).to receive(:say).with("/dev/sda")
      expect(subject).to receive(:say).with("/dev/sdb")

      subject.available_devices
    end
  end

  describe "#selected_devices" do
    before do
      allow(storage_client).to receive(:candidate_devices).and_return(["/dev/sda"])
    end

    context "when no device is given" do
      it "shows the currently selected devices" do
        expect(subject).to receive(:say).once.with("/dev/sda")

        subject.selected_devices
      end

      it "does not calculate a proposal" do
        expect(storage_client).to_not receive(:calculate)

        subject.selected_devices
      end
    end

    context "when a device is given" do
      before do
        allow(manager_client).to receive(:current_installation_phase).and_return(current_phase)
        allow(manager_client).to receive(:probe)
        allow(storage_client).to receive(:calculate)
      end

      context "and the current installation phase is startup" do
        let(:current_phase) { DInstaller::InstallationPhase::STARTUP }

        it "executes the config phase" do
          expect(manager_client).to receive(:probe)

          subject.selected_devices("/dev/sdb")
        end

        it "calculates the proposal with the given device" do
          expect(storage_client).to receive(:calculate).with(["/dev/sdb"])

          subject.selected_devices("/dev/sdb")
        end
      end

      context "and the current installation phase is config" do
        let(:current_phase) { DInstaller::InstallationPhase::CONFIG }

        it "does not execute the config phase" do
          expect(manager_client).to_not receive(:probe)

          subject.selected_devices("/dev/sdb")
        end

        it "calculates the proposal with the given device" do
          expect(storage_client).to receive(:calculate).with(["/dev/sdb"])

          subject.selected_devices("/dev/sdb")
        end
      end

      context "and the current installation phase is install" do
        let(:current_phase) { DInstaller::InstallationPhase::INSTALL }

        it "executes the config phase" do
          expect(manager_client).to receive(:probe)

          subject.selected_devices("/dev/sdb")
        end

        it "calculates the proposal with the given device" do
          expect(storage_client).to receive(:calculate).with(["/dev/sdb"])

          subject.selected_devices("/dev/sdb")
        end
      end
    end
  end

  describe "#actions" do
    before do
      allow(storage_client).to receive(:actions).and_return(actions)
    end

    let(:actions) do
      [
        "Create GPT on /dev/vdc",
        "Create partition /dev/vdc1 (8.00 MiB) as BIOS Boot Partition",
        "Create partition /dev/vdc2 (27.99 GiB) for / with btrfs",
        "Create partition /dev/vdc3 (2.00 GiB) for swap"
      ]
    end

    it "shows the actions to perform" do
      actions.each { |a| expect(subject).to receive(:say).with(a) }

      subject.actions
    end
  end
end
