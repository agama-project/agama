require "singleton"

module Agama
  module SSL
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
