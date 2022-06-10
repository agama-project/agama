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
require "dinstaller_cli/commands/software"
require "dinstaller/clients/dbus/software"

describe DInstallerCli::Commands::Software do
  subject { described_class.new }

  before do
    allow(subject).to receive(:say)
    allow(DInstallerCli::Clients::Software).to receive(:new).and_return(client)
  end

  let(:client) { instance_double(DInstallerCli::Clients::Software) }

  describe "#available_products" do
    before do
      allow(client).to receive(:available_products).and_return(products)
    end

    let(:products) { [["Tumbleweed", "openSUSE Tumbleweed"], ["Leap15.4", "openSUSE Leap 15.4"]] }

    it "shows the available products" do
      expect(subject).to receive(:say).with("Tumbleweed - openSUSE Tumbleweed")
      expect(subject).to receive(:say).with("Leap15.4 - openSUSE Leap 15.4")

      subject.available_products
    end
  end

  describe "#selected_product" do
    before do
      allow(client).to receive(:selected_product).and_return("Tumbleweed")
    end

    context "when no product is given" do
      it "shows the currently selected product" do
        expect(subject).to receive(:say).once.with("Tumbleweed")

        subject.selected_product
      end
    end

    context "when a product is given" do
      it "selects the given product" do
        expect(client).to receive(:select_product).with("Leap15.4")

        subject.selected_product("Leap15.4")
      end
    end
  end
end
