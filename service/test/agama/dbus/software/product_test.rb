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

require_relative "../../../test_helper"
require "agama/dbus/software/product"
require "agama/config"
require "agama/registration"
require "agama/software/manager"
require "suse/connect"

describe Agama::DBus::Software::Product do
  subject { described_class.new(backend, logger) }

  let(:logger) { Logger.new($stdout, level: :warn) }

  let(:backend) { Agama::Software::Manager.new(config, logger) }

  let(:config) { Agama::Config.new }

  let(:target_dir) { Dir.mktmpdir }

  before do
    stub_const("Agama::Software::Manager::TARGET_DIR", target_dir)
    allow(config).to receive(:products).and_return(products)
    allow(subject).to receive(:dbus_properties_changed)
    allow(Agama::ProductReader).to receive(:new).and_call_original
  end

  after do
    FileUtils.rm_r(target_dir)
  end

  let(:products) do
    { "Tumbleweed" => {}, "ALP-Dolomite" => {} }
  end

  it "defines Product D-Bus interface" do
    expect(subject.intfs.keys).to include("org.opensuse.Agama.Software1.Product")
  end

  it "defines Registration D-Bus interface" do
    expect(subject.intfs.keys).to include("org.opensuse.Agama1.Registration")
  end

  it "defines Issues D-Bus interface" do
    expect(subject.intfs.keys).to include("org.opensuse.Agama1.Issues")
  end

  describe "select_product" do
    context "if the product is correctly selected" do
      it "returns result code 0 with empty description" do
        expect(subject.select_product("Tumbleweed")).to contain_exactly(0, "")
      end
    end

    context "if the given product is already selected" do
      before do
        subject.select_product("Tumbleweed")
      end

      it "returns result code 1 and description" do
        expect(subject.select_product("Tumbleweed")).to contain_exactly(1, /already selected/)
      end
    end

    context "if the current product is registered" do
      before do
        subject.select_product("Leap16")
        allow(backend.registration).to receive(:reg_code).and_return("123XX432")
      end

      it "returns result code 2 and description" do
        expect(subject.select_product("Tumbleweed")).to contain_exactly(2, /must be deregistered/)
      end
    end

    context "if the product is unknown" do
      it "returns result code 3 and description" do
        expect(subject.select_product("Unknown")).to contain_exactly(3, /unknown product/i)
      end
    end
  end

  describe "#reg_code" do
    before do
      allow(backend.registration).to receive(:reg_code).and_return(reg_code)
    end

    context "if there is no registered product yet" do
      let(:reg_code) { nil }

      it "returns an empty string" do
        expect(subject.reg_code).to eq("")
      end
    end

    context "if there is a registered product" do
      let(:reg_code) { "123XX432" }

      it "returns the registration code" do
        expect(subject.reg_code).to eq("123XX432")
      end
    end
  end

  describe "#email" do
    before do
      allow(backend.registration).to receive(:email).and_return(email)
    end

    context "if there is no registered email" do
      let(:email) { nil }

      it "returns an empty string" do
        expect(subject.email).to eq("")
      end
    end

    context "if there is a registered email" do
      let(:email) { "test@suse.com" }

      it "returns the registered email" do
        expect(subject.email).to eq("test@suse.com")
      end
    end
  end

  describe "#requirement" do
    before do
      allow(backend.registration).to receive(:requirement).and_return(requirement)
    end

    context "if the registration is not required" do
      let(:requirement) { Agama::Registration::Requirement::NOT_REQUIRED }

      it "returns 0" do
        expect(subject.requirement).to eq(0)
      end
    end

    context "if the registration is optional" do
      let(:requirement) { Agama::Registration::Requirement::OPTIONAL }

      it "returns 1" do
        expect(subject.requirement).to eq(1)
      end
    end

    context "if the registration is mandatory" do
      let(:requirement) { Agama::Registration::Requirement::MANDATORY }

      it "returns 2" do
        expect(subject.requirement).to eq(2)
      end
    end
  end

  describe "#register" do
    before do
      allow(backend.registration).to receive(:reg_code).and_return(nil)
    end

    context "if there is no product selected yet" do
      it "returns result code 1 and description" do
        expect(subject.register("123XX432")).to contain_exactly(1, /product not selected/i)
      end
    end

    context "if there is a selected product" do
      before do
        backend.select_product("Tumbleweed")

        allow(backend.product).to receive(:repositories).and_return(repositories)
      end

      let(:repositories) { [] }

      context "if the product is already registered" do
        before do
          allow(backend.registration).to receive(:reg_code).and_return("123XX432")
        end

        it "returns result code 2 and description" do
          expect(subject.register("123XX432")).to contain_exactly(2, /product already registered/i)
        end
      end

      context "if the product does not require registration" do
        let(:repositories) { ["https://repo"] }

        it "returns result code 3 and description" do
          expect(subject.register("123XX432")).to contain_exactly(3, /not require registration/i)
        end
      end

      context "if there is a network error" do
        before do
          allow(backend.registration).to receive(:register).and_raise(SocketError)
        end

        it "returns result code 4 and description" do
          expect(subject.register("123XX432")).to contain_exactly(4, /network error/)
        end
      end

      context "if there is a timeout" do
        before do
          allow(backend.registration).to receive(:register).and_raise(Timeout::Error)
        end

        it "returns result code 5 and description" do
          expect(subject.register("123XX432")).to contain_exactly(5, /timeout/)
        end
      end

      context "if there is an API error" do
        before do
          allow(backend.registration).to receive(:register).and_raise(SUSE::Connect::ApiError, "")
        end

        it "returns result code 6 and description" do
          expect(subject.register("123XX432")).to contain_exactly(6, /registration server failed/)
        end
      end

      context "if there is a missing credials error" do
        before do
          allow(backend.registration)
            .to receive(:register).and_raise(SUSE::Connect::MissingSccCredentialsFile)
        end

        it "returns result code 7 and description" do
          expect(subject.register("123XX432")).to contain_exactly(7, /missing credentials/)
        end
      end

      context "if there is an incorrect credials error" do
        before do
          allow(backend.registration)
            .to receive(:register).and_raise(SUSE::Connect::MalformedSccCredentialsFile)
        end

        it "returns result code 8 and description" do
          expect(subject.register("123XX432")).to contain_exactly(8, /incorrect credentials/)
        end
      end

      context "if there is an invalid certificate error" do
        before do
          allow(backend.registration).to receive(:register).and_raise(OpenSSL::SSL::SSLError)
        end

        it "returns result code 9 and description" do
          expect(subject.register("123XX432")).to contain_exactly(9, /invalid certificate/)
        end
      end

      context "if there is an internal error" do
        before do
          allow(backend.registration).to receive(:register).and_raise(JSON::ParserError)
        end

        it "returns result code 10 and description" do
          expect(subject.register("123XX432")).to contain_exactly(10, /registration server failed/)
        end
      end

      context "if the registration is correctly done" do
        before do
          allow(backend.registration).to receive(:register)
        end

        it "returns result code 0 with empty description" do
          expect(subject.register("123XX432")).to contain_exactly(0, "")
        end
      end
    end
  end

  describe "#deregister" do
    before do
      allow(backend.registration).to receive(:reg_code).and_return("123XX432")
    end

    context "if there is no product selected yet" do
      it "returns result code 1 and description" do
        expect(subject.deregister).to contain_exactly(1, /product not selected/i)
      end
    end

    context "if there is a selected product" do
      before do
        backend.select_product("Tumbleweed")
      end

      context "if the product is not registered yet" do
        before do
          allow(backend.registration).to receive(:reg_code).and_return(nil)
        end

        it "returns result code 2 and description" do
          expect(subject.deregister).to contain_exactly(2, /product not registered/i)
        end
      end

      context "if there is a network error" do
        before do
          allow(backend.registration).to receive(:deregister).and_raise(SocketError)
        end

        it "returns result code 3 and description" do
          expect(subject.deregister).to contain_exactly(3, /network error/)
        end
      end

      context "if there is a timeout" do
        before do
          allow(backend.registration).to receive(:deregister).and_raise(Timeout::Error)
        end

        it "returns result code 4 and description" do
          expect(subject.deregister).to contain_exactly(4, /timeout/)
        end
      end

      context "if there is an API error" do
        before do
          allow(backend.registration).to receive(:deregister).and_raise(SUSE::Connect::ApiError, "")
        end

        it "returns result code 5 and description" do
          expect(subject.deregister).to contain_exactly(5, /registration server failed/)
        end
      end

      context "if there is a missing credials error" do
        before do
          allow(backend.registration)
            .to receive(:deregister).and_raise(SUSE::Connect::MissingSccCredentialsFile)
        end

        it "returns result code 6 and description" do
          expect(subject.deregister).to contain_exactly(6, /missing credentials/)
        end
      end

      context "if there is an incorrect credials error" do
        before do
          allow(backend.registration)
            .to receive(:deregister).and_raise(SUSE::Connect::MalformedSccCredentialsFile)
        end

        it "returns result code 7 and description" do
          expect(subject.deregister).to contain_exactly(7, /incorrect credentials/)
        end
      end

      context "if there is an invalid certificate error" do
        before do
          allow(backend.registration).to receive(:deregister).and_raise(OpenSSL::SSL::SSLError)
        end

        it "returns result code 8 and description" do
          expect(subject.deregister).to contain_exactly(8, /invalid certificate/)
        end
      end

      context "if there is an internal error" do
        before do
          allow(backend.registration).to receive(:deregister).and_raise(JSON::ParserError)
        end

        it "returns result code 9 and description" do
          expect(subject.deregister).to contain_exactly(9, /registration server failed/)
        end
      end

      context "if the deregistration is correctly done" do
        before do
          allow(backend.registration).to receive(:deregister)
        end

        it "returns result code 0 with empty description" do
          expect(subject.deregister).to contain_exactly(0, "")
        end
      end
    end
  end
end
