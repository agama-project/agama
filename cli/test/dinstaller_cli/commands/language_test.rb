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
require "dinstaller_cli/commands/language"
require "dinstaller_cli/clients/language"

describe DInstallerCli::Commands::Language do
  subject { described_class.new }

  before do
    allow(subject).to receive(:say)
    allow(DInstallerCli::Clients::Language).to receive(:new).and_return(client)
  end

  let(:client) { instance_double(DInstallerCli::Clients::Language) }

  describe "available" do
    before do
      allow(client).to receive(:available_languages).and_return(languages)
    end

    let(:languages) { [["en_GB", "English (UK)"], ["en_US", "English (US)"], ["es_ES", "Español"]] }

    it "shows the available languages" do
      expect(subject).to receive(:say).with("en_GB - English (UK)")
      expect(subject).to receive(:say).with("en_US - English (US)")
      expect(subject).to receive(:say).with("es_ES - Español")

      subject.available
    end
  end

  describe "#selected" do
    before do
      allow(client).to receive(:selected_languages).and_return(languages)
    end

    let(:languages) { ["en_GB"] }

    context "when no language ids are given" do
      it "shows the currently selected languages" do
        expect(subject).to receive(:say).once.with("en_GB")

        subject.selected
      end
    end

    context "when a language id is given" do
      it "selects the given language" do
        expect(client).to receive(:select_languages).with(["es_ES"])

        subject.selected("es_ES")
      end
    end
  end
end
