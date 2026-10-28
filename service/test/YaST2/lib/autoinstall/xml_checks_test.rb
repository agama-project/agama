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

require_relative "../../../test_helper"
require "autoinstall/xml_checks"
require "tmpdir"

# Resets a Singleton class so a fresh instance is built on the next #instance call.
# Vendored here (rather than in the shared test_helper.rb) since it is only needed by
# this file; the upstream autoyast2-installation test suite defines it globally.
def reset_singleton(klass)
  Singleton.__init__(klass)
end

describe Y2Autoinstallation::XmlChecks do
  subject { described_class.instance }

  let(:tmp_dir) { Dir.mktmpdir }
  let(:errors_path) { File.join(tmp_dir, "xml_checks_errors") }

  before do
    stub_const("Y2Autoinstallation::XmlChecks::ERRORS_PATH", errors_path)
    # mock the popup to avoid accidentally displaying a popup in tests
    allow(Yast2::Popup).to receive(:show)
  end

  after do
    FileUtils.rm_rf(tmp_dir)
  end

  describe ".valid_profile?" do
    let(:valid) { true }

    before do
      allow(subject).to receive(:check).and_return(valid)
    end

    it "checks whether a given profile is valid or not" do
      expect(subject).to receive(:check)

      subject.valid_profile?
    end

    context "when a valid profile is used" do
      it "returns true" do
        expect(subject.valid_profile?).to eql(true)
      end
    end

    context "when an invalid profile is used" do
      let(:valid) { false }

      it "returns false" do
        expect(subject.valid_profile?).to eql(false)
      end
    end
  end

  describe ".check" do
    let(:xml_name) { "foo.xml" }
    let(:schema_name) { "bar.rng" }
    let(:xml) { Pathname.new(xml_name) }
    let(:schema) { Pathname.new(schema_name) }
    let(:valid) { true }
    let(:errors) { ["ERROR"] }
    let(:validator) do
      instance_double(Y2Autoinstallation::XmlValidator, valid?: valid, errors: errors)
    end

    after do
      FileUtils.rm_f(errors_path)
    end

    before do
      allow(Y2Autoinstallation::XmlValidator).to receive(:new).and_return(validator)
      reset_singleton(Y2Autoinstallation::XmlChecks)
    end

    context "when the profile is a valid one" do
      it "returns true" do
        expect(subject.check(xml, schema, "title")).to eq(true)
      end
    end

    context "when the profile is an invalid one" do
      let(:valid) { false }
      let(:popup_selection) { :continue }

      before do
        allow(Yast2::Popup).to receive(:show).and_return(popup_selection)
      end

      context "and it is the first time that the errors have been reported" do
        it "returns true if the user skipped the validation" do
          allow(ENV).to receive(:[]).with("YAST_SKIP_XML_VALIDATION").and_return("1")

          expect(Yast2::Popup).to_not receive(:show)
          expect(subject.check(xml, schema, "title")).to eql(true)
        end

        it "shows a popup" do
          expect(Yast2::Popup).to receive(:show)

          subject.check(xml, schema, "title")
        end

        context "if the user continues with the errors reported" do
          it "stores the errors reported" do
            expect { subject.check(xml, schema, "title") }
              .to change { File.exist?(errors_path) }.from(false).to(true)
          end

          it "returns true" do
            expect(subject.check(xml, schema, "title")).to eql(true)
          end
        end

        context "if the user cancels" do
          let(:popup_selection) { :cancel }

          it "does not stores them" do
            expect(subject).to_not receive(:store_errors)

            subject.check(xml, schema, "title")
          end

          it "returns false" do
            expect(subject.check(xml, schema, "title")).to eql(false)
          end
        end
      end

      context "and the same errors were already reported" do
        before do
          subject.check(xml, schema, "title")
        end

        it "does not show any popup" do
          expect(Yast2::Popup).to_not receive(:show)

          subject.check(xml, schema, "title")
        end

        it "returns true" do
          expect(subject.check(xml, schema, "title")).to eql(true)
        end
      end
    end
  end
end
