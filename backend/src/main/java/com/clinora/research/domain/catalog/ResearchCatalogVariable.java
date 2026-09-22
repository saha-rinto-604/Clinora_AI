package com.clinora.research.domain.catalog;

import java.util.List;

public record ResearchCatalogVariable(
        String code,
        String displayName,
        String category,
        String dataType,
        String preferredUnit,
        String description,
        List<String> supportedOperators,
        List<String> labelAliases
) {
    public ResearchCatalogVariable {
        if (code == null || code.isBlank()) {
            throw new IllegalArgumentException("Variable code is required");
        }
        if (displayName == null || displayName.isBlank()) {
            throw new IllegalArgumentException("Display name is required");
        }
        if (category == null || category.isBlank()) {
            throw new IllegalArgumentException("Category is required");
        }
        if (dataType == null || dataType.isBlank()) {
            throw new IllegalArgumentException("Data type is required");
        }
        supportedOperators = supportedOperators == null ? List.of() : List.copyOf(supportedOperators);
        labelAliases = labelAliases == null ? List.of() : List.copyOf(labelAliases);
    }
}
