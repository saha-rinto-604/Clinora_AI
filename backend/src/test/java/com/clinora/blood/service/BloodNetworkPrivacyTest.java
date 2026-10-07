package com.clinora.blood.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.clinora.notifications.service.PatientNotificationService;
import com.clinora.patients.api.PatientApiException;
import java.sql.ResultSet;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

class BloodNetworkPrivacyTest {
    @ParameterizedTest
    @ValueSource(strings = {"FULFILLED", "CANCELLED", "EXPIRED"})
    void closedRequestsRedactAcceptedDonorsAndRequesterContact(String status) throws Exception {
        Fixture fixture = new Fixture(status);
        assertPrivate(fixture);
        assertThatThrownBy(() -> fixture.service.route(fixture.owner, fixture.request, fixture.donor))
            .isInstanceOf(PatientApiException.class);
        assertThatThrownBy(() -> fixture.service.route(fixture.donor, fixture.request, null))
            .isInstanceOf(PatientApiException.class);
        verifyNoInteractions(fixture.routes);
    }

    @ParameterizedTest
    @EnumSource(BloodNetworkService.RequestStatusAction.class)
    void statusMutationImmediatelyReturnsRedactedData(BloodNetworkService.RequestStatusAction action) throws Exception {
        Fixture fixture = new Fixture("ACTIVE");
        var result = fixture.service.updateRequestStatus(fixture.owner, fixture.request, action);
        assertThat(result.status()).isEqualTo(action == BloodNetworkService.RequestStatusAction.FULFILL ? "FULFILLED" : "CANCELLED");
        assertThat(result.matches().getFirst().phone()).isNull();
        assertThat(result.matches().getFirst().displayName()).isEqualTo("Dina D.");
        assertPrivate(fixture);
    }

    @Test
    void activeAcceptedRequestStillSharesDonorDetails() throws Exception {
        Fixture fixture = new Fixture("ACTIVE");
        var person = fixture.service.requestDetail(fixture.owner, fixture.request).matches().getFirst();
        assertThat(person.phone()).isEqualTo("01822222222");
        assertThat(person.displayName()).isEqualTo("Dina Donor");
        assertThat(person.latitude()).isEqualTo(23.80091);
        assertThat(person.longitude()).isEqualTo(90.38612);
    }

    private void assertPrivate(Fixture fixture) {
        var result = fixture.service.requestDetail(fixture.owner, fixture.request);
        var person = result.matches().getFirst();
        assertThat(person.responseStatus()).isEqualTo("ACCEPTED");
        assertThat(person.phone()).isNull();
        assertThat(person.displayName()).isEqualTo("Dina D.");
        assertThat(person.latitude()).isEqualTo(23.801);
        assertThat(person.longitude()).isEqualTo(90.386);
        assertThat(fixture.service.requestDetail(fixture.donor, fixture.request).requesterContact()).isNull();
    }

    private static class Fixture {
        final UUID owner = UUID.randomUUID();
        final UUID donor = UUID.randomUUID();
        final UUID request = UUID.randomUUID();
        final GoogleRoutesService routes = mock(GoogleRoutesService.class);
        final BloodNetworkService service;

        Fixture(String status) throws Exception {
            JdbcTemplate jdbc = mock(JdbcTemplate.class);
            AtomicReference<String> currentStatus = new AtomicReference<>(status);
            Timestamp now = Timestamp.from(Instant.parse("2026-10-04T08:00:00Z"));
            ResultSet requestRow = mock(ResultSet.class);
            when(requestRow.getObject("id", UUID.class)).thenReturn(request);
            when(requestRow.getObject("requester_user_id", UUID.class)).thenReturn(owner);
            when(requestRow.getString("blood_group")).thenReturn("O_POSITIVE");
            when(requestRow.getString("status")).thenAnswer(invocation -> currentStatus.get());
            when(requestRow.getTimestamp("created_at")).thenReturn(now);
            ResultSet match = mock(ResultSet.class);
            when(match.getObject("user_id", UUID.class)).thenReturn(donor);
            when(match.getString("first_name")).thenReturn("Dina");
            when(match.getString("last_name")).thenReturn("Donor");
            when(match.getString("email")).thenReturn("donor@clinora.test");
            when(match.getString("phone")).thenReturn("01822222222");
            when(match.getString("blood_group")).thenReturn("O_POSITIVE");
            when(match.getString("status")).thenReturn("ACCEPTED");
            when(match.getTimestamp("contact_shared_at")).thenReturn(now);
            when(match.getDouble("latitude")).thenReturn(23.80091);
            when(match.getDouble("longitude")).thenReturn(90.38612);
            when(jdbc.queryForObject(anyString(), eq(Integer.class), any(UUID.class))).thenReturn(1);
            doAnswer(invocation -> {
                String sql = invocation.getArgument(0);
                RowMapper<?> mapper = invocation.getArgument(1);
                return List.of(mapper.mapRow(sql.contains("FROM blood_requests WHERE") ? requestRow : match, 0));
            }).when(jdbc).query(anyString(), any(RowMapper.class), any(Object[].class));
            doAnswer(invocation -> {
                currentStatus.set(invocation.getArgument(1));
                return 1;
            }).when(jdbc).update(anyString(), any(Object[].class));
            service = new BloodNetworkService(jdbc, mock(GoogleGeocodingService.class), routes,
                mock(PatientNotificationService.class), Clock.systemUTC());
        }
    }
}
