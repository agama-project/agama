<?xml version='1.0'?>
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
  <xsl:output method="xml" indent="yes" encoding="UTF-8"/>

  <!-- identity transformation -->
  <xsl:template match="node()|@*">
    <xsl:copy>
      <xsl:apply-templates select="node()|@*"/>
    </xsl:copy>
  </xsl:template>

  <!-- but do sort /node/interface by @name -->
  <xsl:template match="/node">
    <xsl:copy>
      <xsl:apply-templates select="node()|@*">
        <xsl:sort select="@name"/>
      </xsl:apply-templates>
    </xsl:copy>
  </xsl:template>

  <!-- omit the detailed introspection of _child_ nodes,
       just mention them with their @name -->
  <xsl:template match="/node/node">
    <xsl:copy>
      <xsl:apply-templates select="@*"/>
    </xsl:copy>
  </xsl:template>
</xsl:stylesheet>
