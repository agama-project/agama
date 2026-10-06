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

require_relative "../../test_helper"
require_relative "../lib/yast2/systemd/support/stubs"

module Yast
  import "Service"

  describe Service do
    include SystemdServiceStubs

    def stub_service_with(method, result)
      allow_any_instance_of(Yast2::Systemd::Service).to receive(method)
        .and_return(result)
    end

    before do
      # Defined in systemd/test/test_helper.rb
      # The service 'sshd' is mocked for active/loaded service
      # The service 'unknown' is mocked for non-existing service
      stub_services
    end

    describe ".call" do
      it "executes the command for the specified service" do
        expect(Service.call("reload", "sshd")).to eq(true)
      end

      it "returns false if the service has not been found" do
        stub_services(service: "unknown")
        expect(Service.call("restart", "unknown")).to eq(false)
      end

      it "raises error if the command is not recognized" do
        expect { Service.call("make-coffee", "sshd") }.to raise_error
      end

      it "returns the result of the original result of the command call" do
        expect(Service.call("status", "sshd")).to be_kind_of(::String)

        stub_service_with(:try_restart, false)
        expect(Service.call("try-restart", "sshd")).to eq(false)
      end
    end

    describe ".Active" do
      it "returns true if a service is active" do
        expect(Service.Active("sshd")).to eq(true)
      end

      it "returns false if a service is inactive" do
        stub_service_with(:active?, false)
        expect(Service.Active("sshd")).to eq(false)
      end

      it "returns false if a service does not exist" do
        stub_services(service: "unknown")
        expect(Service.Active("unknown")).to eq(false)
      end
    end

    describe ".Enabled" do
      it "returns true if a service is enabled" do
        expect(Service.Enabled("sshd")).to eq(true)
      end

      it "returns false if a service in not enabled" do
        stub_service_with(:enabled?, false)
        expect(Service.Enabled("sshd")).to eq(false)
      end

      it "returns false if a service does not exists" do
        stub_services(service: "unknown")
        expect(Service.Enabled("unknown")).to eq(false)
      end
    end

    describe ".Enable" do
      it "returns true if a service has been enabled successfully" do
        expect(Service.Enable("sshd")).to eq(true)
      end

      it "returns false if a service has not been enabled" do
        stub_service_with(:enable, false)
        stub_service_with(:error, +"error")
        expect(Service.Enable("sshd")).to eq(false)
        expect(Service.Error).not_to be_empty
      end

      it "returns false if a service has not been found" do
        stub_services(service: "unknown")
        expect(Service.Enable("unknown")).to eq(false)
        expect(Service.Error).not_to be_empty
      end
    end

    describe ".Disable" do
      it "returns true if a service has been disabled" do
        expect(Service.Disable("sshd")).to eq(true)
      end

      it "returns false if a service has not been disabled" do
        stub_service_with(:disable, false)
        stub_service_with(:error, +"error")
        expect(Service.Disable("sshd")).to eq(false)
        expect(Service.Error).not_to be_empty
      end

      it "returns false if a service does not exist" do
        stub_services(service: "unknown")
        expect(Service.Disable("unknown")).to eq(false)
        expect(Service.Error).not_to be_empty
      end
    end

    describe ".Start" do
      it "returns true if a service has been started successfully" do
        expect(Service.Start("sshd")).to eq(true)
      end

      it "returns false if a service has not been started" do
        stub_service_with(:start, false)
        stub_service_with(:error, +"error")
        expect(Service.Start("sshd")).to eq(false)
        expect(Service.Error).not_to be_empty
      end

      it "returns false if a service has not been found" do
        stub_services(service: "unknown")
        expect(Service.Start("unknown")).to eq(false)
        expect(Service.Error).not_to be_empty
      end
    end

    describe ".Restart" do
      it "returns true if a service has been restarted successfully" do
        expect(Service.Restart("sshd")).to eq(true)
      end

      it "returns false if a service has not been restarted" do
        stub_service_with(:restart, false)
        stub_service_with(:error, +"error")
        expect(Service.Restart("sshd")).to eq(false)
        expect(Service.Error).not_to be_empty
      end

      it "returns false if a service has not been found" do
        stub_services(service: "unknown")
        expect(Service.Restart("unknown")).to eq(false)
        expect(Service.Error).not_to be_empty
      end
    end

    describe ".Reload" do
      it "returns true if a service has been reloaded successfully" do
        expect(Service.Reload("sshd")).to eq(true)
      end

      it "returns false if a service has not been reloaded" do
        stub_service_with(:reload, false)
        stub_service_with(:error, +"error")
        expect(Service.Reload("sshd")).to eq(false)
        expect(Service.Error).not_to be_empty
      end

      it "returns false if a service has not been found" do
        stub_services(service: "unknown")
        expect(Service.Reload("unknown")).to eq(false)
        expect(Service.Error).not_to be_empty
      end
    end

    describe ".Stop" do
      it "returns true if a service has been stopped successfully" do
        expect(Service.Stop("sshd")).to eq(true)
      end

      it "returns false if a service has not been stopped" do
        stub_service_with(:stop, false)
        stub_service_with(:error, +"error")
        expect(Service.Stop("sshd")).to eq(false)
        expect(Service.Error).not_to be_empty
      end

      it "returns false if a service has not been found" do
        stub_services(service: "unknown")
        expect(Service.Stop("unknown")).to eq(false)
        expect(Service.Error).not_to be_empty
      end
    end
  end
end
