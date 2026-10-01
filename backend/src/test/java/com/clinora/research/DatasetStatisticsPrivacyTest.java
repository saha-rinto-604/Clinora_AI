package com.clinora.research;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import com.clinora.research.domain.DatasetVersion;
import com.clinora.research.exception.ResearchApiException;
import com.clinora.research.repository.DatasetVersionRepository;
import com.clinora.research.service.*;
import com.clinora.research.storage.ResearchDatasetStoragePort;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Instant;
import java.util.*;
import org.junit.jupiter.api.*;

class DatasetStatisticsPrivacyTest {
    final UUID dataset = UUID.randomUUID(), user = UUID.randomUUID();
    DatasetStatisticsService service;
    ResearchDatasetStoragePort storage;
    DatasetGenerationService generation;
    ObjectMapper json = new ObjectMapper();

    @BeforeEach void setup() {
        var versions = mock(DatasetVersionRepository.class);
        storage = mock(ResearchDatasetStoragePort.class);
        generation = mock(DatasetGenerationService.class);
        when(versions.findByDatasetIdAndVersionNumber(dataset,1)).thenReturn(Optional.of(
            new DatasetVersion(UUID.randomUUID(),dataset,1,"1",10,"synthetic","test","JSON","1",Instant.now())));
        service = new DatasetStatisticsService(versions,storage,generation,json);
    }
    Map<String,Object> row(String subject, String sex, String period, String variable, double value) {
        return Map.of("subjectId",subject,"sex",sex,"ageBand","30-39","observationPeriod",period,"variableCode",variable,"value",value,"unit","unit");
    }
    void payload(List<Map<String,Object>> rows) throws Exception {
        when(storage.get("synthetic")).thenReturn(new ResearchDatasetStoragePort.StoredDataset(json.writeValueAsBytes(rows),"application/json"));
    }
    @Test void repeatedObservationsDoNotBecomeDistinctPatients() throws Exception {
        payload(Collections.nCopies(50,row("one","F","2026-Q1","HBA1C",6.5)));
        assertThrows(ResearchApiException.class, () -> service.getSummary(dataset,1,user));
        assertThrows(ResearchApiException.class, () -> service.getDistribution(dataset,1,"HBA1C",user));
    }
    @Test void smallSexGroupsAndTheirComplementsAreNotExposed() throws Exception {
        var rows = java.util.stream.IntStream.range(0,6).mapToObj(i -> row("p"+i,i==0?"M":"F","2026-Q1","HBA1C",6+i)).toList();
        payload(rows);
        assertThrows(ResearchApiException.class, () -> service.getGroupComparison(dataset,1,"HBA1C","SEX",user));
    }
    @Test void smallPeriodsAndVariableSubsetsAreNotExposed() throws Exception {
        payload(java.util.stream.IntStream.range(0,6).mapToObj(i -> row("p"+i,"F",i==0?"2026-Q2":"2026-Q1","HBA1C",6+i)).toList());
        assertThrows(ResearchApiException.class, () -> service.getTrend(dataset,1,"HBA1C",user));
        payload(java.util.stream.IntStream.range(0,6).mapToObj(i -> row("p"+i,"F","2026-Q1",i==0?"GLUCOSE":"HBA1C",6+i)).toList());
        assertThrows(ResearchApiException.class, () -> service.getSummary(dataset,1,user));
    }
    @Test void safeHistogramCoarsensAndUsesUnsortedActualValues() throws Exception {
        payload(List.of(row("p1","F","2026-Q1","HBA1C",9),row("p2","F","2026-Q1","HBA1C",5),
            row("p3","F","2026-Q1","HBA1C",8),row("p4","F","2026-Q1","HBA1C",6),row("p5","F","2026-Q1","HBA1C",7)));
        var bins = service.getDistribution(dataset,1,"HBA1C",user);
        assertEquals(1,bins.size()); assertEquals(5,bins.getFirst().count());
        assertEquals(5,bins.getFirst().lowerBound()); assertEquals(9,bins.getFirst().upperBound());
        assertEquals(7,service.getSummary(dataset,1,user).variables().getFirst().mean());
    }
    @Test void deniedOrSuspendedDatasetNeverLoadsStoredBytes() {
        doThrow(new ResearchApiException(org.springframework.http.HttpStatus.FORBIDDEN,"SUSPENDED","Suspended"))
            .when(generation).getDataset(dataset,user);
        assertThrows(ResearchApiException.class, () -> service.getSummary(dataset,1,user));
        verifyNoInteractions(storage);
    }
}
