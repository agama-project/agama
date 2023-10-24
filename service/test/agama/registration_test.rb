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
require "agama/config"
require "agama/registration"
require "agama/software/manager"
require "suse/connect"
require "yast"
require "y2packager/new_repository_setup"

Yast.import("Arch")

describe Agama::Registration do
  subject { described_class.new(manager, logger) }

  let(:manager) { instance_double(Agama::Software::Manager) }

  let(:logger) { Logger.new($stdout, level: :warn) }

  before do
    allow(Yast::Arch).to receive(:rpm_arch).and_return("x86_64")

    allow(manager).to receive(:product).and_return(product)
    allow(manager).to receive(:add_service)
    allow(manager).to receive(:remove_service)

    allow(SUSE::Connect::YaST).to receive(:announce_system).and_return(["test-user", "12345"])
    allow(SUSE::Connect::YaST).to receive(:deactivate_system)
    allow(SUSE::Connect::YaST).to receive(:create_credentials_file)
    allow(SUSE::Connect::YaST).to receive(:activate_product).and_return(service)
    allow(Y2Packager::NewRepositorySetup.instance).to receive(:add_service)
  end

  let(:service) { OpenStruct.new(name: "test-service", url: nil) }

  describe "#register" do
    context "if there is no product selected yet" do
      let(:product) { nil }

      it "does not try to register" do
        expect(SUSE::Connect::YaST).to_not receive(:announce_system)

        subject.register("11112222", email: "test@test.com")
      end
    end

    context "if there is a selected product" do
      let(:product) { Agama::Software::Product.new("test").tap { |p| p.version = "5.0" } }

      context "and the product is already registered" do
        before do
          subject.register("11112222", email: "test@test.com")
        end

        it "does not try to register" do
          expect(SUSE::Connect::YaST).to_not receive(:announce_system)

          subject.register("11112222", email: "test@test.com")
        end
      end

      context "and the product is not registered yet" do
        it "announces the system" do
          expect(SUSE::Connect::YaST).to receive(:announce_system).with(
            { token: "11112222", email: "test@test.com" },
            "test-5-x86_64"
          )

          subject.register("11112222", email: "test@test.com")
        end

        it "creates credentials file" do
          expect(SUSE::Connect::YaST).to receive(:create_credentials_file)
            .with("test-user", "12345")

          subject.register("11112222", email: "test@test.com")
        end

        it "activates the selected product" do
          expect(SUSE::Connect::YaST).to receive(:activate_product).with(
            an_object_having_attributes(
              arch: "x86_64", identifier: "test", version: "5.0"
            ), {}, "test@test.com"
          )

          subject.register("11112222", email: "test@test.com")
        end

        it "adds the service to software manager" do
          expect(Y2Packager::NewRepositorySetup.instance)
            .to receive(:add_service).with("test-service")

          subject.register("11112222", email: "test@test.com")
        end

        context "if the service requires a creadentials file" do
          let(:service) { OpenStruct.new(name: "test-service", url: "https://credentials/file") }

          before do
            allow(subject).to receive(:credentials_from_url)
              .with("https://credentials/file").and_return("credentials")
          end

          it "creates the credentials file" do
            expect(SUSE::Connect::YaST).to receive(:create_credentials_file)
            expect(SUSE::Connect::YaST).to receive(:create_credentials_file)
              .with("test-user", "12345", "credentials")

            subject.register("11112222", email: "test@test.com")
          end
        end

        context "if the service does not require a creadentials file" do
          let(:service) { OpenStruct.new(name: "test-service", url: nil) }

          it "does not create the credentials file" do
            expect(SUSE::Connect::YaST).to receive(:create_credentials_file)
            expect(SUSE::Connect::YaST).to_not receive(:create_credentials_file)
              .with("test-user", "12345", anything)

            subject.register("11112222", email: "test@test.com")
          end
        end

        context "if the product was correctly registered" do
          before do
            subject.on_change(&callback)
          end

          let(:callback) { proc {} }

          it "runs the callbacks" do
            expect(callback).to receive(:call)

            subject.register("11112222", email: "test@test.com")
          end

          it "sets the registration code" do
            subject.register("11112222", email: "test@test.com")

            expect(subject.reg_code).to eq("11112222")
          end

          it "sets the email" do
            subject.register("11112222", email: "test@test.com")

            expect(subject.email).to eq("test@test.com")
          end
        end

        context "if the product was not correctly registered" do
          before do
            allow(SUSE::Connect::YaST).to receive(:activate_product).and_raise(Timeout::Error)
            subject.on_change(&callback)
          end

          let(:callback) { proc {} }

          it "raises an error" do
            expect { subject.register("11112222", email: "test@test.com") }
              .to raise_error(Timeout::Error)
          end

          it "does not run the callbacks" do
            expect(callback).to_not receive(:call)

            expect { subject.register("11112222", email: "test@test.com") }
              .to raise_error(Timeout::Error)
          end

          it "does not set the registration code" do
            expect { subject.register("11112222", email: "test@test.com") }
              .to raise_error(Timeout::Error)

            expect(subject.reg_code).to be_nil
          end

          it "does not set the email" do
            expect { subject.register("11112222", email: "test@test.com") }
              .to raise_error(Timeout::Error)

            expect(subject.email).to be_nil
          end
        end
      end
    end
  end

  describe "#deregister" do
    before do
      allow(FileUtils).to receive(:rm)
    end

    context "if there is no product selected yet" do
      let(:product) { nil }

      it "does not try to deregister" do
        expect(SUSE::Connect::YaST).to_not receive(:deactivate_system)

        subject.deregister
      end
    end

    context "if there is a selected product" do
      let(:product) { Agama::Software::Product.new("test").tap { |p| p.version = "5.0" } }

      context "and the product is not registered yet" do
        it "does not try to deregister" do
          expect(SUSE::Connect::YaST).to_not receive(:deactivate_system)

          subject.deregister
        end
      end

      context "and the product is registered" do
        before do
          allow(subject).to receive(:credentials_from_url)
          allow(subject).to receive(:credentials_from_url)
            .with("https://credentials/file").and_return("credentials")

          subject.register("11112222", email: "test@test.com")
        end

        it "deletes the service from the software config" do
          expect(manager).to receive(:remove_service).with(service)

          subject.deregister
        end

        it "deactivates the system" do
          expect(SUSE::Connect::YaST).to receive(:deactivate_system).with(
            { token: "11112222", email: "test@test.com" }
          )

          subject.deregister
        end

        it "removes the credentials file" do
          expect(FileUtils).to receive(:rm).with(/SCCcredentials/)

          subject.deregister
        end

        context "if the service has a credentials files" do
          let(:service) { OpenStruct.new(name: "test-service", url: "https://credentials/file") }

          it "removes the credentials file" do
            expect(FileUtils).to receive(:rm)
            expect(FileUtils).to receive(:rm).with(/\/credentials$/)

            subject.deregister
          end
        end

        context "if the product has no credentials file" do
          let(:service) { OpenStruct.new(name: "test-service", url: nil) }

          it "does not try to remove the credentials file" do
            expect(FileUtils).to_not receive(:rm).with(/\/credentials$/)

            subject.deregister
          end
        end

        context "if the product was correctly deregistered" do
          before do
            subject.on_change(&callback)
          end

          let(:callback) { proc {} }

          it "runs the callbacks" do
            expect(callback).to receive(:call)

            subject.deregister
          end

          it "removes the registration code" do
            subject.deregister

            expect(subject.reg_code).to be_nil
          end

          it "removes the email" do
            subject.deregister

            expect(subject.email).to be_nil
          end
        end

        context "if the product was not correctly deregistered" do
          before do
            allow(SUSE::Connect::YaST).to receive(:deactivate_system).and_raise(Timeout::Error)
            subject.on_change(&callback)
          end

          let(:callback) { proc {} }

          it "raises an error" do
            expect { subject.deregister }.to raise_error(Timeout::Error)
          end

          it "does not run the callbacks" do
            expect(callback).to_not receive(:call)

            expect { subject.deregister }.to raise_error(Timeout::Error)
          end

          it "does not remove the registration code" do
            expect { subject.deregister }.to raise_error(Timeout::Error)

            expect(subject.reg_code).to eq("11112222")
          end

          it "does not remove the email" do
            expect { subject.deregister }.to raise_error(Timeout::Error)

            expect(subject.email).to eq("test@test.com")
          end
        end
      end
    end
  end

  describe "#requirement" do
    context "if there is not product selected yet" do
      let(:product) { nil }

      it "returns not required" do
        expect(subject.requirement).to eq(Agama::Registration::Requirement::NOT_REQUIRED)
      end
    end

    context "if there is a selected product" do
      let(:product) do
        Agama::Software::Product.new("test").tap { |p| p.repositories = repositories }
      end

      context "and the product has repositories" do
        let(:repositories) { ["https://repo"] }

        it "returns not required" do
          expect(subject.requirement).to eq(Agama::Registration::Requirement::NOT_REQUIRED)
        end
      end

      context "and the product has no repositories" do
        let(:repositories) { [] }

        it "returns mandatory" do
          expect(subject.requirement).to eq(Agama::Registration::Requirement::MANDATORY)
        end
      end
    end
  end
end
