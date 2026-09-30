package com.clinora.research.service;

import java.time.Clock;
import java.util.UUID;
import java.util.regex.Pattern;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;

@Service
public class ResearchSocketAccess {
    private static final String ID = "([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})";
    private static final Pattern TOPIC = Pattern.compile("^/topic/research/projects/" + ID + "/documents/" + ID + "(?:/presence)?$");
    private static final Pattern PRESENCE = Pattern.compile("^/app/research/projects/" + ID + "/documents/" + ID + "/presence$");
    private final ResearchAccessGuard guard;
    private final JdbcTemplate jdbc;
    private final Clock clock;

    public ResearchSocketAccess(ResearchAccessGuard guard, JdbcTemplate jdbc, Clock clock) {
        this.guard = guard;
        this.jdbc = jdbc;
        this.clock = clock;
    }

    public void account(Jwt jwt) {
        if (jwt == null || jwt.getExpiresAt() == null || !jwt.getExpiresAt().isAfter(clock.instant())) denied();
        String role = jwt.getClaimAsString("role");
        if ("RESEARCHER".equals(role)) { guard.token(jwt); return; }
        if (!"PATIENT".equals(role) && !"DOCTOR".equals(role)) denied();
        Integer active = jdbc.queryForObject("SELECT count(*) FROM users WHERE id=? AND role=? "
            + "AND account_status='ACTIVE' AND email_verified_at IS NOT NULL", Integer.class, UUID.fromString(jwt.getSubject()), role);
        if (active == null || active != 1) denied();
    }

    public void destination(Jwt jwt, String destination, boolean send) {
        account(jwt);
        if (!send && "/user/queue/notifications".equals(destination)) return;
        if (!"RESEARCHER".equals(jwt.getClaimAsString("role")) || destination == null) denied();
        var match = (send ? PRESENCE : TOPIC).matcher(destination);
        if (!match.matches()) denied();
        guard.document(UUID.fromString(match.group(1)), UUID.fromString(match.group(2)), UUID.fromString(jwt.getSubject()), false);
    }

    private static void denied() { throw new org.springframework.security.access.AccessDeniedException("WebSocket access is not authorized."); }
}
