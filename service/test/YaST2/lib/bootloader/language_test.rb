# frozen_string_literal: true

# Vendored from yast2-bootloader's test/language_test.rb.
# This is a permanent fork (see service/YaST2/README.md): the `yast2-bootloader` RPM
# is no longer a runtime dependency of Agama.

require_relative "../../../test_helper"
require_relative "support/shared_setup"

require "bootloader/language"
require "cfa/memory_file"

describe Bootloader::Language do
  include_context "yast2-bootloader test setup"

  describe "rc_lang" do
    it "returns value from parsed tree" do
      path = File.expand_path("data/language", __dir__)
      file = CFA::MemoryFile.new(File.read(path))

      language = described_class.new(file_handler: file)
      language.load

      expect(language.rc_lang).to eq "en_US.UTF-8"
    end

    it "returns nil if value missing in parsed tree" do
      file = CFA::MemoryFile.new("")

      language = described_class.new(file_handler: file)
      language.load

      expect(language.rc_lang).to eq nil
    end
  end
end
