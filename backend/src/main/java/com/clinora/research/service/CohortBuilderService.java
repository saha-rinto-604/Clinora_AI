package com.clinora.research.service;

import com.clinora.research.api.CohortQueryModels.*;

public interface CohortBuilderService {

    CatalogResponse getCatalog();

    CohortPreviewResponse previewCohort(CohortFilterCriteria criteria);
}
