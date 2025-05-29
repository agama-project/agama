# frozen_string_literal: true

require "agama/ssl/fingerprint"

module Agama
  module SSL
    # class handling SSL certificate details
    class CertificateDetails
      include Yast::I18n

      # indent size used in summary text
      INDENT = " " * 3

      def initialize(certificate)
        textdomain "agama"
        @certificate = certificate
      end

      def subject
        identity_details(certificate.subject_name, certificate.subject_organization,
          certificate.subject_organization_unit)
      end

      def issuer
        identity_details(certificate.issuer_name, certificate.issuer_organization,
          certificate.issuer_organization_unit)
      end

      def summary
        # TRANSLATORS: SSL certificate details
        summary = _("Certificate:") + "\n" + _("Issued To") + "\n" + subject +
          "\n" + _("Issued By") + "\n" + issuer + "\n" + _("SHA1 Fingerprint: ") +
          "\n" + INDENT + certificate.fingerprint(Fingerprint::SHA1).value + "\n" +
          _("SHA256 Fingerprint: ") + "\n"

        sha256 = certificate.fingerprint(Fingerprint::SHA256).value
        summary += INDENT + sha256
      end

    private

      attr_reader :certificate

      def identity_details(cname, org, orgu)
        # label followed by the SSL certificate identification
        _("Common Name (CN): ") + (cname || "") + "\n" +
          # label followed by the SSL certificate identification
          _("Organization (O): ") + (org || "") + "\n" +
          # label followed by the SSL certificate identification
          _("Organization Unit (OU): ") + (orgu || "") + "\n"
      end
    end
  end
end
