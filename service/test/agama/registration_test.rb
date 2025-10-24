# frozen_string_literal: true

# Copyright (c) [2023-2025] SUSE LLC
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
  let(:product) { Agama::Software::Product.new("test").tap { |p| p.version = "5.0" } }

  let(:logger) { Logger.new($stdout, level: :warn) }

  before do
    allow(Yast::Arch).to receive(:rpm_arch).and_return("x86_64")

    allow(manager).to receive(:product).and_return(product)
    allow(manager).to receive(:add_service)
    allow(manager).to receive(:remove_service)
    allow(manager).to receive(:addon_products)

    allow(SUSE::Connect::YaST).to receive(:announce_system).and_return(["test-user", "12345"])
    allow(SUSE::Connect::YaST).to receive(:deactivate_system)
    allow(SUSE::Connect::YaST).to receive(:create_credentials_file)
    allow(SUSE::Connect::YaST).to receive(:activate_product).and_return(service)
    allow(Y2Packager::NewRepositorySetup.instance).to receive(:add_service)
    allow(Agama::CmdlineArgs).to receive(:read).and_return(cmdline_args)
  end

  let(:service) { OpenStruct.new(name: "test-service", url: nil) }
  let(:cmdline_args) { Agama::CmdlineArgs.new({}) }

  describe "#verify_callback" do
    it "stores to SSL::Error ssl error details" do
      error = double(error: 20, error_string: "Error", current_cert: nil)

      subject.send(:verify_callback).call(false, error)
      expect(Agama::SSL::Errors.instance.ssl_error_code).to eq 20
      expect(Agama::SSL::Errors.instance.ssl_error_msg).to eq "Error"
    end
  end

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
            {
              language:        anything,
              url:             "https://scc.suse.com",
              token:           "11112222",
              email:           "test@test.com",
              verify_callback: anything
            },
            "test-5-x86_64"
          )

          subject.register("11112222", email: "test@test.com")
        end

        it "sets the current language in the request" do
          expect(SUSE::Connect::YaST).to receive(:announce_system).with(
            {
              language:        "de-de",
              url:             anything,
              token:           "11112222",
              email:           "test@test.com",
              verify_callback: anything
            },
            "test-5-x86_64"
          )

          allow(Yast::WFM).to receive(:GetLanguage).and_return("de_DE")

          subject.register("11112222", email: "test@test.com")
        end

        context "when a registration URL is set through the cmdline" do
          let(:cmdline_args) do
            Agama::CmdlineArgs.new("register_url" => "http://scc.example.net")
          end

          it "registers using the given URL" do
            expect(SUSE::Connect::YaST).to receive(:announce_system).with(
              { token: "11112222", email: "test@test.com", url: "http://scc.example.net",
                verify_callback: anything, language: anything },
              "test-5-x86_64"
            )

            subject.register("11112222", email: "test@test.com")
          end
        end

        it "creates credentials file" do
          expect(SUSE::Connect::YaST).to receive(:create_credentials_file)
            .with("test-user", "12345", "/etc/zypp/credentials.d/SCCcredentials")
          # TODO: when fixing suse-connect read of fsroot
          # .with("test-user", "12345", "/run/agama/zypp/etc/zypp/credentials.d/SCCcredentials")

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
              .with("https://credentials/file")
              .and_return("productA")
          end

          it "creates the credentials file" do
            expect(SUSE::Connect::YaST).to receive(:create_credentials_file)
            expect(SUSE::Connect::YaST).to receive(:create_credentials_file)
              .with("test-user", "12345", "/run/agama/zypp/etc/zypp/credentials.d/productA")

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

          it "sets the registration code" do
            expect { subject.register("11112222", email: "test@test.com") }
              .to raise_error(Timeout::Error)

            expect(subject.reg_code).to eq("11112222")
          end

          it "sets the email" do
            expect { subject.register("11112222", email: "test@test.com") }
              .to raise_error(Timeout::Error)

            expect(subject.email).to eq("test@test.com")
          end

          it "runs the callbacks" do
            expect(callback).to receive(:call)

            expect { subject.register("11112222", email: "test@test.com") }
              .to raise_error(Timeout::Error)
          end
        end

        context "if the registration server has self-signed certificate" do
          let(:certificate) do
            Agama::SSL::Certificate.load(File.read(File.join(FIXTURES_PATH, "test.pem")))
          end
          before do
            Agama::SSL::Errors.instance.ssl_error_code = Agama::SSL::ErrorCodes::SELF_SIGNED_CERT
            Agama::SSL::Errors.instance.ssl_error_msg = "test error"
            Agama::SSL::Errors.instance.ssl_failed_cert = certificate
            # mock reset to avoid deleting of previous setup
            allow(Agama::SSL::Errors.instance).to receive(:reset)

            @called = 0
            allow(SUSE::Connect::YaST).to receive(:activate_product) do
              @called += 1
              raise OpenSSL::SSL::SSLError, "test" if @called == 1

              service
            end
          end

          context "and certificate fingerprint is in storage" do
            before do
              Agama::SSL::Storage.instance.fingerprints
                .replace([certificate.send(:sha256_fingerprint)])
            end

            it "tries to import certificate" do
              expect(certificate).to receive(:import)

              subject.register("11112222", email: "test@test.com")
            end

            after do
              Agama::SSL::Storage.instance.fingerprints.clear
            end
          end

          it "opens question" do
            expect(Agama::Question).to receive(:new)
            q_client = double
            expect(q_client).to receive(:ask).and_yield(q_client)
            expect(q_client).to receive(:answer).and_return(:Abort)
            expect(Agama::DBus::Clients::Questions).to receive(:new)
              .and_return(q_client)

            expect { subject.register("11112222", email: "test@test.com") }.to(
              raise_error(OpenSSL::SSL::SSLError)
            )
          end
        end
      end
    end
  end

  describe "#register_addon" do
    context "if there is no product selected yet" do
      let(:addon) do
        OpenStruct.new(
          arch:       Yast::Arch.rpm_arch,
          identifier: "sle-ha",
          version:    "16.0"
        )
      end

      let(:code) { "867136984314" }

      let(:ha_extension) do
        OpenStruct.new(
          id:                2937,
          identifier:        "sle-ha",
          version:           "16.0",
          arch:              "x86_64",
          isbase:            false,
          friendly_name:     "SUSE Linux Enterprise High Availability Extension 16.0 x86_64 (BETA)",
          ProductLine:       "",
          available:         true,
          free:              false,
          recommended:       false,
          description:       "SUSE Linux High Availability Extension provides...",
          former_identifier: "sle-ha",
          product_type:      "extension",
          shortname:         "SLEHA16",
          name:              "SUSE Linux Enterprise High Availability Extension",
          release_stage:     "beta"
        )
      end

      it "registers addon" do
        expect(SUSE::Connect::YaST).to receive(:activate_product).with(
          addon, { token: code }, anything
        )

        subject.register_addon(addon.identifier, addon.version, code)
      end

      it "registers addon only once" do
        expect(SUSE::Connect::YaST).to receive(:activate_product).with(
          addon, { token: code }, anything
        ).once

        subject.register_addon(addon.identifier, addon.version, code)
        subject.register_addon(addon.identifier, addon.version, code)
      end

      context "the requested addon version is not specified" do
        it "finds the version automatically" do
          expect(SUSE::Connect::YaST).to receive(:activate_product).with(
            addon, { token: code }, anything
          )

          expect(SUSE::Connect::YaST).to receive(:show_product).and_return(
            OpenStruct.new(
              extensions: [ha_extension]
            )
          )

          subject.register_addon(addon.identifier, "", code)
        end

        it "raises exception when the requested addon is not found" do
          expect(SUSE::Connect::YaST).to receive(:show_product).and_return(
            OpenStruct.new(extensions: [])
          )

          expect do
            subject.register_addon(addon.identifier, "", code)
          end.to raise_error(Agama::Errors::Registration::ExtensionNotFound)
        end

        it "raises exception when multiple addon versions are found" do
          ha1 = ha_extension
          ha2 = ha1.dup
          ha2.version = "42"

          expect(SUSE::Connect::YaST).to receive(:show_product).and_return(
            OpenStruct.new(extensions: [ha1, ha2])
          )

          expect do
            subject.register_addon(addon.identifier, "", code)
          end.to raise_error(Agama::Errors::Registration::MultipleExtensionsFound)
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
            {
              url:             anything,
              token:           "11112222",
              email:           "test@test.com",
              verify_callback: anything,
              language:        anything
            }
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

  describe "#finish" do
    context "system is not registered" do
      before do
        subject.instance_variable_set(:@registered, false)
      end

      it "do nothing" do
        expect(::FileUtils).to_not receive(:cp)

        subject.finish
      end
    end

    context "system is registered" do
      before do
        subject.instance_variable_set(:@registered, true)
        subject.instance_variable_set(:@reg_code, "test")
        subject.instance_variable_set(:@credentials_files, ["test"])
        Yast::Installation.destdir = "/mnt"
        allow(::FileUtils).to receive(:cp)
      end

      it "copies global credentials file" do
        expect(::FileUtils).to receive(:cp).with("/etc/zypp/credentials.d/SCCcredentials",
          "/mnt/etc/zypp/credentials.d/SCCcredentials")

        subject.finish
      end

      it "copies product credentials file" do
        expect(::FileUtils).to receive(:cp).with("/run/agama/zypp/etc/zypp/credentials.d/test",
          "/mnt/etc/zypp/credentials.d/test")

        subject.finish
      end

      context "and a registration URL was given" do
        before do
          allow(subject).to receive(:registration_url).and_return("http://reg-server.lan")
        end

        it "generates and copies the SUSEConnect configuration" do
          expect(::FileUtils).to receive(:cp).with("/etc/SUSEConnect", "/mnt/etc/SUSEConnect")
          expect(SUSE::Connect::YaST).to receive(:write_config).with("url" => "http://reg-server.lan")

          subject.finish
        end
      end
    end
  end
end
