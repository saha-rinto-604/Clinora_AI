package com.clinora.blood.service;

import com.clinora.notifications.service.PatientNotificationService;
import com.clinora.notifications.service.PatientNotificationService.NotificationCategory;
import com.clinora.patients.api.PatientApiException;
import com.clinora.patients.domain.BloodGroup;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class BloodNetworkService {

    private static final int DEFAULT_RADIUS_METERS = 5_000;
    private static final int MAX_NEARBY_RESULTS = 50;
    private static final double EARTH_RADIUS_METERS = 6_371_000.0;

    private final JdbcTemplate jdbc;
    private final GoogleGeocodingService geocoding;
    private final GoogleRoutesService routes;
    private final PatientNotificationService notifications;
    private final Clock clock;

    public BloodNetworkService(
        JdbcTemplate jdbc,
        GoogleGeocodingService geocoding,
        GoogleRoutesService routes,
        PatientNotificationService notifications,
        Clock clock
    ) {
        this.jdbc = jdbc;
        this.geocoding = geocoding;
        this.routes = routes;
        this.notifications = notifications;
        this.clock = clock;
    }

    @Transactional
    public BloodNetworkOverview overview(UUID userId, BloodGroup requestedBloodGroup) {
        requireActivePatient(userId);
        ProfileRow profile = ensureCurrentLocation(userId);
        BloodGroup selectedGroup = requestedBloodGroup != null ? requestedBloodGroup : profile.bloodGroup();
        List<NearbyPersonView> nearbyPeople = selectedGroup == null || profile.latitude() == null
            ? List.of()
            : nearbyPeople(profile.latitude(), profile.longitude(), selectedGroup, userId, false);
        List<BloodRequestSummaryView> nearbyRequests = profile.latitude() == null || profile.bloodGroup() == null
            ? List.of()
            : nearbyRequests(userId, profile);
        return new BloodNetworkOverview(
            toCurrentUser(profile),
            selectedGroup,
            DEFAULT_RADIUS_METERS,
            geocoding.configured(),
            nearbyPeople,
            nearbyRequests,
            myRequests(userId)
        );
    }

    @Transactional
    public CurrentUserView updatePreferences(UUID userId, boolean enabled, boolean available) {
        requireActivePatient(userId);
        ProfileRow profile = ensureCurrentLocation(userId);
        boolean effectiveAvailable = enabled && available;
        if (effectiveAvailable && profile.latitude() == null) {
            throw new PatientApiException(
                HttpStatus.UNPROCESSABLE_ENTITY,
                "BLOOD_NETWORK_LOCATION_REQUIRED",
                geocoding.configured()
                    ? "Add a valid address to your Health Profile before becoming available nearby."
                    : "Google Maps geocoding is not configured on this environment."
            );
        }
        jdbc.update(
            "UPDATE patient_profiles SET blood_network_enabled = ?, blood_network_available = ?, updated_at = ? WHERE user_id = ?",
            enabled,
            effectiveAvailable,
            Timestamp.from(clock.instant()),
            userId
        );
        return toCurrentUser(profileRow(userId));
    }

    @Transactional
    public BloodRequestDetailView createRequest(UUID userId, CreateBloodRequestCommand command) {
        requireActivePatient(userId);
        requireProfile(userId);
        GeoSelection requestLocation = resolveRequestLocation(command);
        Instant now = clock.instant();
        UUID requestId = UUID.randomUUID();
        jdbc.update(
            """
            INSERT INTO blood_requests
                (id, requester_user_id, blood_group, units_needed, hospital_name, hospital_address,
                 latitude, longitude, note, needed_by, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?)
            """,
            requestId,
            userId,
            command.bloodGroup().name(),
            command.unitsNeeded(),
            cleanRequired(command.hospitalName()),
            cleanRequired(command.hospitalAddress()),
            requestLocation.latitude(),
            requestLocation.longitude(),
            cleanOptional(command.note()),
            timestamp(command.neededBy()),
            Timestamp.from(now),
            Timestamp.from(now)
        );

        List<PersonCandidate> matches = nearbyCandidates(
            requestLocation.latitude(),
            requestLocation.longitude(),
            command.bloodGroup(),
            userId
        );
        for (PersonCandidate candidate : matches) {
            createPendingMatch(requestId, candidate.userId(), candidate.distanceMeters(), now);
            notifications.create(
                candidate.userId(),
                "BLOOD_REQUEST_NEARBY",
                NotificationCategory.SYSTEM,
                command.bloodGroup().getDisplayName() + " blood needed nearby",
                cleanRequired(command.hospitalName()) + " is about " + formatDistance(candidate.distanceMeters())
                    + " from your saved donor area. Open Blood Network to respond.",
                "BLOOD_REQUEST",
                requestId,
                "blood-request:" + requestId + ":" + candidate.userId()
            );
        }
        return requestDetail(userId, requestId);
    }

    void createPendingMatch(UUID requestId, UUID matchedUserId, double distanceMeters, Instant notifiedAt) {
        jdbc.update(
            """
            INSERT INTO blood_request_matches
                (id, request_id, matched_user_id, distance_meters, status, notified_at, responded_at, contact_shared_at)
            VALUES (?, ?, ?, ?, 'PENDING', ?, NULL, NULL)
            ON CONFLICT (request_id, matched_user_id) DO NOTHING
            """,
            UUID.randomUUID(),
            requestId,
            matchedUserId,
            (int) Math.round(distanceMeters),
            Timestamp.from(notifiedAt)
        );
    }

    @Transactional(readOnly = true)
    public BloodRequestDetailView requestDetail(UUID userId, UUID requestId) {
        requireActivePatient(userId);
        RequestRow request = requestRow(requestId);
        boolean owner = request.requesterUserId().equals(userId);
        MatchRow myMatch = owner ? null : matchRow(requestId, userId);
        if (!owner && myMatch == null) {
            throw new PatientApiException(HttpStatus.FORBIDDEN, "BLOOD_REQUEST_ACCESS_DENIED", "This blood request is not available to your account.");
        }

        List<NearbyPersonView> matches = owner ? requestMatches(requestId, request.requesterUserId()) : List.of();
        ContactView requesterContact = !owner && myMatch != null && myMatch.contactShared()
            ? contactForUser(counterpartyUserId(userId, request.requesterUserId(), userId))
            : null;
        return new BloodRequestDetailView(
            request.id(),
            owner,
            request.bloodGroup(),
            request.unitsNeeded(),
            request.hospitalName(),
            request.hospitalAddress(),
            request.latitude(),
            request.longitude(),
            request.note(),
            request.neededBy(),
            request.status(),
            request.createdAt(),
            myMatch == null ? null : myMatch.status(),
            myMatch == null ? null : (double) myMatch.distanceMeters(),
            matches,
            requesterContact
        );
    }

    @Transactional
    public BloodRequestDetailView respond(UUID userId, UUID requestId, ResponseAction action) {
        requireActivePatient(userId);
        RequestRow request = requestRow(requestId);
        if (!"ACTIVE".equals(request.status())) {
            throw new PatientApiException(HttpStatus.CONFLICT, "BLOOD_REQUEST_NOT_ACTIVE", "This blood request is no longer active.");
        }
        MatchRow match = matchRow(requestId, userId);
        if (match == null) {
            throw new PatientApiException(HttpStatus.FORBIDDEN, "BLOOD_REQUEST_MATCH_REQUIRED", "This request was not matched to your account.");
        }
        Instant now = clock.instant();
        String nextStatus = action == ResponseAction.ACCEPT ? "ACCEPTED" : "DECLINED";
        jdbc.update(
            """
            UPDATE blood_request_matches
            SET status = ?, responded_at = ?, contact_shared_at = ?
            WHERE request_id = ? AND matched_user_id = ?
            """,
            nextStatus,
            Timestamp.from(now),
            action == ResponseAction.ACCEPT ? Timestamp.from(now) : null,
            requestId,
            userId
        );
        if (action == ResponseAction.ACCEPT) {
            ProfileRow responder = profileRow(userId);
            notifications.create(
                request.requesterUserId(),
                "BLOOD_REQUEST_ACCEPTED",
                NotificationCategory.SYSTEM,
                "A nearby patient can help",
                responder.firstName() + " accepted your blood request. Open Blood Network to coordinate.",
                "BLOOD_REQUEST",
                requestId,
                "blood-request-accepted:" + requestId + ":" + userId
            );
        }
        return requestDetail(userId, requestId);
    }

    @Transactional(readOnly = true)
    public RouteView route(UUID userId, UUID requestId, UUID matchedUserId) {
        requireActivePatient(userId);
        RequestRow request = requestRow(requestId);
        if (!"ACTIVE".equals(request.status())) {
            throw new PatientApiException(
                HttpStatus.CONFLICT,
                "BLOOD_REQUEST_ROUTE_INACTIVE",
                "Driving coordination is available only while the blood request is active."
            );
        }

        UUID routeUserId;
        if (request.requesterUserId().equals(userId)) {
            if (matchedUserId == null) {
                throw new PatientApiException(
                    HttpStatus.BAD_REQUEST,
                    "BLOOD_REQUEST_ROUTE_MATCH_REQUIRED",
                    "Choose an accepted nearby person before requesting a driving route."
                );
            }
            MatchRow accepted = matchRow(requestId, matchedUserId);
            if (accepted == null || !accepted.contactShared()) {
                throw new PatientApiException(
                    HttpStatus.FORBIDDEN,
                    "BLOOD_REQUEST_ROUTE_NOT_ACCEPTED",
                    "A driving route is available only after that person accepts the request."
                );
            }
            routeUserId = matchedUserId;
        } else {
            MatchRow accepted = matchRow(requestId, userId);
            if (accepted == null || !accepted.contactShared()) {
                throw new PatientApiException(
                    HttpStatus.FORBIDDEN,
                    "BLOOD_REQUEST_ROUTE_NOT_ACCEPTED",
                    "Accept this request before opening precise driving coordination."
                );
            }
            if (matchedUserId != null && !matchedUserId.equals(userId)) {
                throw new PatientApiException(
                    HttpStatus.FORBIDDEN,
                    "BLOOD_REQUEST_ROUTE_ACCESS_DENIED",
                    "You can open only your own accepted route for this request."
                );
            }
            routeUserId = userId;
        }

        ProfileRow donor = profileRow(routeUserId);
        if (donor.latitude() == null || donor.longitude() == null) {
            throw new PatientApiException(
                HttpStatus.UNPROCESSABLE_ENTITY,
                "BLOOD_REQUEST_ROUTE_LOCATION_REQUIRED",
                "A verified map location is required before Clinora can calculate the driving route."
            );
        }
        RouteEndpoints endpoints = routeEndpoints(
            request.requesterUserId().equals(userId),
            request.latitude(),
            request.longitude(),
            donor.latitude(),
            donor.longitude()
        );
        GoogleRoutesService.RouteResult route = routes.drivingRoute(
            endpoints.originLatitude(),
            endpoints.originLongitude(),
            endpoints.destinationLatitude(),
            endpoints.destinationLongitude()
        ).orElseThrow(() -> new PatientApiException(
            HttpStatus.SERVICE_UNAVAILABLE,
            "BLOOD_REQUEST_ROUTE_UNAVAILABLE",
            routes.configured()
                ? "Google Routes could not calculate this trip right now."
                : "Enable the Google Routes API for GOOGLE_MAPS_API_KEY to calculate road distance and ETA."
        ));
        return new RouteView(
            requestId,
            routeUserId,
            route.distanceMeters(),
            route.durationSeconds(),
            route.encodedPolyline()
        );
    }

    @Transactional
    public BloodRequestDetailView updateRequestStatus(UUID userId, UUID requestId, RequestStatusAction action) {
        requireActivePatient(userId);
        RequestRow request = requestRow(requestId);
        if (!request.requesterUserId().equals(userId)) {
            throw new PatientApiException(HttpStatus.FORBIDDEN, "BLOOD_REQUEST_OWNER_REQUIRED", "Only the requester can update this request.");
        }
        String next = action == RequestStatusAction.FULFILL ? "FULFILLED" : "CANCELLED";
        jdbc.update(
            "UPDATE blood_requests SET status = ?, updated_at = ? WHERE id = ?",
            next,
            Timestamp.from(clock.instant()),
            requestId
        );
        return requestDetail(userId, requestId);
    }

    private ProfileRow ensureCurrentLocation(UUID userId) {
        ProfileRow profile = profileRow(userId);
        if (!hasText(profile.address())) {
            return profile;
        }
        boolean stale = profile.latitude() == null
            || profile.longitude() == null
            || !normalize(profile.address()).equals(normalize(profile.geocodedSourceAddress()));
        if (!stale || !geocoding.configured()) {
            return profile;
        }
        geocoding.geocode(profile.address()).ifPresent(point -> jdbc.update(
            """
            UPDATE patient_profiles
            SET latitude = ?, longitude = ?, geocoded_address = ?, geocoded_source_address = ?, geocoded_at = ?, updated_at = ?
            WHERE user_id = ?
            """,
            point.latitude(),
            point.longitude(),
            point.formattedAddress(),
            profile.address().trim(),
            Timestamp.from(clock.instant()),
            Timestamp.from(clock.instant()),
            userId
        ));
        return profileRow(userId);
    }

    private GeoSelection resolveRequestLocation(CreateBloodRequestCommand command) {
        if (command.latitude() != null && command.longitude() != null) {
            validateCoordinates(command.latitude(), command.longitude());
            return new GeoSelection(command.latitude(), command.longitude());
        }
        if (!geocoding.configured()) {
            throw new PatientApiException(
                HttpStatus.SERVICE_UNAVAILABLE,
                "GOOGLE_MAPS_NOT_CONFIGURED",
                "Google Maps geocoding is not configured. Add GOOGLE_MAPS_API_KEY to the environment."
            );
        }
        return geocoding.geocode(command.hospitalAddress())
            .map(point -> new GeoSelection(point.latitude(), point.longitude()))
            .orElseThrow(() -> new PatientApiException(
                HttpStatus.UNPROCESSABLE_ENTITY,
                "BLOOD_REQUEST_LOCATION_NOT_FOUND",
                "Clinora could not locate that hospital address. Choose a point on the map or enter a more specific address."
            ));
    }

    private List<BloodRequestSummaryView> nearbyRequests(UUID userId, ProfileRow profile) {
        List<RequestRow> rows = jdbc.query(
            """
            SELECT br.*
            FROM blood_requests br
            JOIN blood_request_matches bm ON bm.request_id = br.id AND bm.matched_user_id = ?
            WHERE br.status = 'ACTIVE' AND br.blood_group = ? AND br.requester_user_id <> ?
            ORDER BY br.created_at DESC
            LIMIT 30
            """,
            (rs, rowNum) -> requestRow(rs),
            userId,
            profile.bloodGroup().name(),
            userId
        );
        return rows.stream()
            .map(row -> new BloodRequestSummaryView(
                row.id(),
                row.bloodGroup(),
                row.unitsNeeded(),
                row.hospitalName(),
                row.hospitalAddress(),
                row.latitude(),
                row.longitude(),
                distanceMeters(profile.latitude(), profile.longitude(), row.latitude(), row.longitude()),
                row.neededBy(),
                row.status(),
                row.createdAt()
            ))
            .filter(view -> view.distanceMeters() <= DEFAULT_RADIUS_METERS)
            .sorted(Comparator.comparingDouble(BloodRequestSummaryView::distanceMeters))
            .toList();
    }

    private List<BloodRequestSummaryView> myRequests(UUID userId) {
        return jdbc.query(
            """
            SELECT * FROM blood_requests
            WHERE requester_user_id = ?
            ORDER BY created_at DESC
            LIMIT 8
            """,
            (rs, rowNum) -> {
                RequestRow row = requestRow(rs);
                return new BloodRequestSummaryView(
                    row.id(), row.bloodGroup(), row.unitsNeeded(), row.hospitalName(), row.hospitalAddress(),
                    row.latitude(), row.longitude(), 0, row.neededBy(), row.status(), row.createdAt()
                );
            },
            userId
        );
    }

    private List<NearbyPersonView> nearbyPeople(double latitude, double longitude, BloodGroup bloodGroup, UUID excludeUserId, boolean revealContact) {
        return nearbyCandidates(latitude, longitude, bloodGroup, excludeUserId).stream()
            .map(candidate -> toNearbyPerson(candidate, revealContact, "PENDING"))
            .toList();
    }

    private List<PersonCandidate> nearbyCandidates(double latitude, double longitude, BloodGroup bloodGroup, UUID excludeUserId) {
        double latitudeDelta = DEFAULT_RADIUS_METERS / 111_320.0;
        double cosine = Math.max(0.2, Math.cos(Math.toRadians(latitude)));
        double longitudeDelta = DEFAULT_RADIUS_METERS / (111_320.0 * cosine);
        List<PersonCandidate> candidates = jdbc.query(
            """
            SELECT u.id AS user_id, u.first_name, u.last_name, u.email,
                   p.phone, p.blood_group, p.latitude, p.longitude
            FROM patient_profiles p
            JOIN users u ON u.id = p.user_id
            WHERE p.user_id <> ?
              AND p.blood_group = ?
              AND p.blood_network_enabled = TRUE
              AND p.blood_network_available = TRUE
              AND p.latitude BETWEEN ? AND ?
              AND p.longitude BETWEEN ? AND ?
              AND u.role = 'PATIENT'
              AND u.account_status = 'ACTIVE'
              AND u.email_verified_at IS NOT NULL
            """,
            (rs, rowNum) -> {
                double candidateLat = rs.getDouble("latitude");
                double candidateLon = rs.getDouble("longitude");
                return new PersonCandidate(
                    rs.getObject("user_id", UUID.class),
                    rs.getString("first_name"),
                    rs.getString("last_name"),
                    rs.getString("email"),
                    rs.getString("phone"),
                    BloodGroup.valueOf(rs.getString("blood_group")),
                    candidateLat,
                    candidateLon,
                    distanceMeters(latitude, longitude, candidateLat, candidateLon)
                );
            },
            excludeUserId,
            bloodGroup.name(),
            latitude - latitudeDelta,
            latitude + latitudeDelta,
            longitude - longitudeDelta,
            longitude + longitudeDelta
        );
        return candidates.stream()
            .filter(candidate -> candidate.distanceMeters() <= DEFAULT_RADIUS_METERS)
            .sorted(Comparator.comparingDouble(PersonCandidate::distanceMeters))
            .limit(MAX_NEARBY_RESULTS)
            .toList();
    }

    private List<NearbyPersonView> requestMatches(UUID requestId, UUID requesterUserId) {
        return jdbc.query(
            """
            SELECT u.id AS user_id, u.first_name, u.last_name, u.email, p.phone, p.blood_group,
                   p.latitude, p.longitude, bm.distance_meters, bm.status, bm.contact_shared_at
            FROM blood_request_matches bm
            JOIN users u ON u.id = bm.matched_user_id
            JOIN patient_profiles p ON p.user_id = u.id
            WHERE bm.request_id = ? AND bm.matched_user_id <> ?
            ORDER BY CASE bm.status WHEN 'ACCEPTED' THEN 0 WHEN 'PENDING' THEN 1 ELSE 2 END,
                     bm.distance_meters ASC
            """,
            (rs, rowNum) -> {
                String status = rs.getString("status");
                boolean contactShared = coordinationUnlocked(status, rs.getTimestamp("contact_shared_at"));
                PersonCandidate candidate = new PersonCandidate(
                    rs.getObject("user_id", UUID.class),
                    rs.getString("first_name"),
                    rs.getString("last_name"),
                    rs.getString("email"),
                    rs.getString("phone"),
                    BloodGroup.valueOf(rs.getString("blood_group")),
                    rs.getDouble("latitude"),
                    rs.getDouble("longitude"),
                    rs.getInt("distance_meters")
                );
                return toNearbyPerson(candidate, contactShared, status);
            },
            requestId,
            requesterUserId
        );
    }

    private NearbyPersonView toNearbyPerson(PersonCandidate candidate, boolean revealContact, String responseStatus) {
        String displayName = revealContact
            ? candidate.firstName() + " " + candidate.lastName()
            : candidate.firstName() + lastInitial(candidate.lastName());
        double latitude = revealContact ? candidate.latitude() : rounded(candidate.latitude(), 3);
        double longitude = revealContact ? candidate.longitude() : rounded(candidate.longitude(), 3);
        return new NearbyPersonView(
            candidate.userId(),
            displayName,
            candidate.bloodGroup(),
            candidate.distanceMeters(),
            latitude,
            longitude,
            revealContact ? candidate.phone() : null,
            responseStatus,
            candidate.email().toLowerCase(Locale.ROOT).endsWith("@clinora.test")
        );
    }

    private CurrentUserView toCurrentUser(ProfileRow profile) {
        return new CurrentUserView(
            profile.userId(),
            profile.firstName(),
            profile.lastName(),
            profile.bloodGroup(),
            profile.phone(),
            profile.address(),
            profile.latitude(),
            profile.longitude(),
            profile.geocodedAddress(),
            profile.bloodNetworkEnabled(),
            profile.bloodNetworkAvailable()
        );
    }

    private ProfileRow profileRow(UUID userId) {
        List<ProfileRow> rows = jdbc.query(
            """
            SELECT u.id AS user_id, u.first_name, u.last_name, u.email,
                   p.phone, p.address, p.blood_group, p.latitude, p.longitude,
                   p.geocoded_address, p.geocoded_source_address,
                   p.blood_network_enabled, p.blood_network_available
            FROM users u
            JOIN patient_profiles p ON p.user_id = u.id
            WHERE u.id = ?
            """,
            (rs, rowNum) -> new ProfileRow(
                rs.getObject("user_id", UUID.class),
                rs.getString("first_name"),
                rs.getString("last_name"),
                rs.getString("email"),
                rs.getString("phone"),
                rs.getString("address"),
                rs.getString("blood_group") == null ? null : BloodGroup.valueOf(rs.getString("blood_group")),
                nullableDouble(rs, "latitude"),
                nullableDouble(rs, "longitude"),
                rs.getString("geocoded_address"),
                rs.getString("geocoded_source_address"),
                rs.getBoolean("blood_network_enabled"),
                rs.getBoolean("blood_network_available")
            ),
            userId
        );
        if (rows.isEmpty()) {
            throw new PatientApiException(
                HttpStatus.PRECONDITION_REQUIRED,
                "PATIENT_PROFILE_REQUIRED",
                "Complete your Health Profile before using Blood Network."
            );
        }
        return rows.getFirst();
    }

    private void requireProfile(UUID userId) {
        profileRow(userId);
    }

    private RequestRow requestRow(UUID requestId) {
        List<RequestRow> rows = jdbc.query(
            "SELECT * FROM blood_requests WHERE id = ?",
            (rs, rowNum) -> requestRow(rs),
            requestId
        );
        if (rows.isEmpty()) {
            throw new PatientApiException(HttpStatus.NOT_FOUND, "BLOOD_REQUEST_NOT_FOUND", "That blood request could not be found.");
        }
        return rows.getFirst();
    }

    private RequestRow requestRow(ResultSet rs) throws SQLException {
        return new RequestRow(
            rs.getObject("id", UUID.class),
            rs.getObject("requester_user_id", UUID.class),
            BloodGroup.valueOf(rs.getString("blood_group")),
            rs.getInt("units_needed"),
            rs.getString("hospital_name"),
            rs.getString("hospital_address"),
            rs.getDouble("latitude"),
            rs.getDouble("longitude"),
            rs.getString("note"),
            toInstant(rs.getTimestamp("needed_by")),
            rs.getString("status"),
            rs.getTimestamp("created_at").toInstant()
        );
    }

    private MatchRow matchRow(UUID requestId, UUID userId) {
        List<MatchRow> rows = jdbc.query(
            "SELECT status, distance_meters, contact_shared_at FROM blood_request_matches WHERE request_id = ? AND matched_user_id = ?",
            (rs, rowNum) -> new MatchRow(
                rs.getString("status"),
                rs.getInt("distance_meters"),
                coordinationUnlocked(rs.getString("status"), rs.getTimestamp("contact_shared_at"))
            ),
            requestId,
            userId
        );
        return rows.isEmpty() ? null : rows.getFirst();
    }

    private ContactView contactForUser(UUID contactUserId) {
        ProfileRow profile = profileRow(contactUserId);
        return new ContactView(profile.firstName() + " " + profile.lastName(), profile.phone());
    }

    static UUID counterpartyUserId(UUID viewerUserId, UUID requesterUserId, UUID matchedUserId) {
        if (viewerUserId.equals(requesterUserId)) {
            if (matchedUserId.equals(viewerUserId)) {
                throw new IllegalArgumentException("The requester cannot be their own blood request match.");
            }
            return matchedUserId;
        }
        if (!viewerUserId.equals(matchedUserId)) {
            throw new IllegalArgumentException("The viewer is not a participant in this blood request match.");
        }
        return requesterUserId;
    }

    static boolean coordinationUnlocked(String responseStatus, Timestamp contactSharedAt) {
        return "ACCEPTED".equals(responseStatus) && contactSharedAt != null;
    }

    private void requireActivePatient(UUID userId) {
        Integer count = jdbc.queryForObject(
            "SELECT COUNT(*) FROM users WHERE id = ? AND role = 'PATIENT' AND account_status = 'ACTIVE' AND email_verified_at IS NOT NULL",
            Integer.class,
            userId
        );
        if (count == null || count != 1) {
            throw new PatientApiException(HttpStatus.FORBIDDEN, "ACTIVE_PATIENT_REQUIRED", "An active Patient account is required.");
        }
    }

    private void validateCoordinates(double latitude, double longitude) {
        if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
            throw new PatientApiException(HttpStatus.BAD_REQUEST, "INVALID_MAP_LOCATION", "Choose a valid location on the map.");
        }
    }

    static double distanceMeters(double lat1, double lon1, double lat2, double lon2) {
        double dLat = Math.toRadians(lat2 - lat1);
        double dLon = Math.toRadians(lon2 - lon1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
            + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
            * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(a));
    }

    static RouteEndpoints routeEndpoints(
        boolean requesterView,
        double requestLatitude,
        double requestLongitude,
        double donorLatitude,
        double donorLongitude
    ) {
        return requesterView
            ? new RouteEndpoints(requestLatitude, requestLongitude, donorLatitude, donorLongitude)
            : new RouteEndpoints(donorLatitude, donorLongitude, requestLatitude, requestLongitude);
    }

    private static double rounded(double value, int places) {
        double scale = Math.pow(10, places);
        return Math.round(value * scale) / scale;
    }

    private static Double nullableDouble(ResultSet rs, String column) throws SQLException {
        double value = rs.getDouble(column);
        return rs.wasNull() ? null : value;
    }

    private static String lastInitial(String lastName) {
        return lastName == null || lastName.isBlank() ? "" : " " + lastName.trim().substring(0, 1).toUpperCase(Locale.ROOT) + ".";
    }

    private static String cleanRequired(String value) {
        return value == null ? "" : value.trim().replaceAll("\\s+", " ");
    }

    private static String cleanOptional(String value) {
        String cleaned = cleanRequired(value);
        return cleaned.isBlank() ? null : cleaned;
    }

    private static String normalize(String value) {
        return value == null ? "" : value.trim().replaceAll("\\s+", " ").toLowerCase(Locale.ROOT);
    }

    private static boolean hasText(String value) {
        return value != null && !value.isBlank();
    }

    private static String formatDistance(double meters) {
        return meters < 1_000 ? Math.round(meters) + " m" : String.format(Locale.ROOT, "%.1f km", meters / 1_000.0);
    }

    private static Timestamp timestamp(Instant value) {
        return value == null ? null : Timestamp.from(value);
    }

    private static Instant toInstant(Timestamp value) {
        return value == null ? null : value.toInstant();
    }

    public enum ResponseAction { ACCEPT, DECLINE }
    public enum RequestStatusAction { FULFILL, CANCEL }

    public record CreateBloodRequestCommand(
        BloodGroup bloodGroup,
        int unitsNeeded,
        String hospitalName,
        String hospitalAddress,
        Double latitude,
        Double longitude,
        Instant neededBy,
        String note
    ) {}

    public record BloodNetworkOverview(
        CurrentUserView currentUser,
        BloodGroup selectedBloodGroup,
        int radiusMeters,
        boolean mapsConfigured,
        List<NearbyPersonView> nearbyPeople,
        List<BloodRequestSummaryView> nearbyRequests,
        List<BloodRequestSummaryView> myRequests
    ) {}

    public record CurrentUserView(
        UUID userId,
        String firstName,
        String lastName,
        BloodGroup bloodGroup,
        String phone,
        String address,
        Double latitude,
        Double longitude,
        String geocodedAddress,
        boolean bloodNetworkEnabled,
        boolean bloodNetworkAvailable
    ) {}

    public record NearbyPersonView(
        UUID userId,
        String displayName,
        BloodGroup bloodGroup,
        double distanceMeters,
        double latitude,
        double longitude,
        String phone,
        String responseStatus,
        boolean demo
    ) {}

    public record BloodRequestSummaryView(
        UUID id,
        BloodGroup bloodGroup,
        int unitsNeeded,
        String hospitalName,
        String hospitalAddress,
        double latitude,
        double longitude,
        double distanceMeters,
        Instant neededBy,
        String status,
        Instant createdAt
    ) {}

    public record BloodRequestDetailView(
        UUID id,
        boolean owner,
        BloodGroup bloodGroup,
        int unitsNeeded,
        String hospitalName,
        String hospitalAddress,
        double latitude,
        double longitude,
        String note,
        Instant neededBy,
        String status,
        Instant createdAt,
        String myResponseStatus,
        Double myDistanceMeters,
        List<NearbyPersonView> matches,
        ContactView requesterContact
    ) {}

    public record RouteView(
        UUID requestId,
        UUID matchedUserId,
        int distanceMeters,
        long durationSeconds,
        String encodedPolyline
    ) {}

    public record ContactView(String name, String phone) {}

    private record ProfileRow(
        UUID userId,
        String firstName,
        String lastName,
        String email,
        String phone,
        String address,
        BloodGroup bloodGroup,
        Double latitude,
        Double longitude,
        String geocodedAddress,
        String geocodedSourceAddress,
        boolean bloodNetworkEnabled,
        boolean bloodNetworkAvailable
    ) {}

    private record PersonCandidate(
        UUID userId,
        String firstName,
        String lastName,
        String email,
        String phone,
        BloodGroup bloodGroup,
        double latitude,
        double longitude,
        double distanceMeters
    ) {}

    private record RequestRow(
        UUID id,
        UUID requesterUserId,
        BloodGroup bloodGroup,
        int unitsNeeded,
        String hospitalName,
        String hospitalAddress,
        double latitude,
        double longitude,
        String note,
        Instant neededBy,
        String status,
        Instant createdAt
    ) {}

    private record MatchRow(String status, int distanceMeters, boolean contactShared) {}
    record RouteEndpoints(
        double originLatitude,
        double originLongitude,
        double destinationLatitude,
        double destinationLongitude
    ) {}
    private record GeoSelection(double latitude, double longitude) {}
}
