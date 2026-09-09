package com.clinora.blood.service;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class GoogleRoutesServiceTest {

    @Test
    void parsesGoogleDurationSeconds() {
        assertThat(GoogleRoutesService.durationSeconds("542s")).isEqualTo(542);
        assertThat(GoogleRoutesService.durationSeconds("542.4s")).isEqualTo(542);
    }

    @Test
    void malformedDurationFailsClosedToZero() {
        assertThat(GoogleRoutesService.durationSeconds("unknown")).isZero();
        assertThat(GoogleRoutesService.durationSeconds(null)).isZero();
    }
}
