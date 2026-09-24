package com.clinora.doctors.service;

import static org.junit.jupiter.api.Assertions.*;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.Test;

class WeeklyAvailabilityServiceTest {
    @Test void localRoutineRepeatsForTwelveWeeksAcrossDst() {
        var rule = new WeeklyAvailabilityService.Rule(UUID.randomUUID(), 1, LocalTime.of(9,0), LocalTime.of(10,0), "IN_PERSON", 30, "America/New_York");
        var windows = WeeklyAvailabilityService.windows(rule, Instant.parse("2026-03-01T00:00:00Z"));
        assertEquals(24, windows.size());
        assertEquals(Instant.parse("2026-03-02T14:00:00Z"), windows.getFirst().start());
        assertEquals(Instant.parse("2026-03-09T13:00:00Z"), windows.get(2).start());
        assertTrue(windows.stream().allMatch(w -> Duration.between(w.start(), w.end()).toMinutes() == 30));
    }
    @Test void nonexistentDstTimesAreSkippedAndRepeatedTimesAreNotDuplicated() {
        var rule = new WeeklyAvailabilityService.Rule(UUID.randomUUID(), 7, LocalTime.of(1,0), LocalTime.of(4,0), "IN_PERSON", 30, "America/New_York");
        var spring = WeeklyAvailabilityService.windows(rule, Instant.parse("2026-03-08T00:00:00Z"));
        assertTrue(spring.stream().filter(w -> w.start().isBefore(Instant.parse("2026-03-09T00:00:00Z"))).noneMatch(w -> w.start().atZone(ZoneId.of(rule.timezone())).getHour() == 2));
        var fall = WeeklyAvailabilityService.windows(rule, Instant.parse("2026-11-01T00:00:00Z"));
        assertEquals(fall.size(), fall.stream().map(w -> w.start().atZone(ZoneId.of(rule.timezone())).toLocalDateTime()).distinct().count());
    }
    @Test void multipleBlocksAreAllowedButOverlapsAndInvalidZonesAreRejected() {
        var a = new WeeklyAvailabilityService.Block(1, LocalTime.of(9,0), LocalTime.of(12,0), "IN_PERSON", true);
        var b = new WeeklyAvailabilityService.Block(1, LocalTime.of(17,0), LocalTime.of(20,0), "BOTH", true);
        assertDoesNotThrow(() -> WeeklyAvailabilityService.validate(new WeeklyAvailabilityService.RoutineRequest(0,30,"Asia/Dhaka",List.of(a,b))));
        assertThrows(RuntimeException.class, () -> WeeklyAvailabilityService.validate(new WeeklyAvailabilityService.RoutineRequest(0,30,"Asia/Dhaka",List.of(a,a))));
        assertThrows(RuntimeException.class, () -> WeeklyAvailabilityService.validate(new WeeklyAvailabilityService.RoutineRequest(0,30,"Not/AZone",List.of(a))));
    }
}
