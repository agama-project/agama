# frozen_string_literal: true

require "singleton"

module Agama
  module SSL
    # Holds SSL related configuration
    class Storage
      include Singleton

      # @return [Array<Agama::SSL::fingerprint>]
      attr_reader :fingerprints

      def initialize
        @fingerprints = []
      end
    end
  end
end
