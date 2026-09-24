package com.clinora.doctors.service;

import com.clinora.appointments.service.PatientAppointmentService;
import com.clinora.doctors.api.DoctorApiException;
import java.sql.Timestamp;
import java.time.*;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class WeeklyAvailabilityService {
    public static final int HORIZON_WEEKS = 12;
    private final JdbcTemplate jdbc;
    private final DoctorClinicalAccessService access;
    private final PatientAppointmentService appointments;
    private final Clock clock;
    public WeeklyAvailabilityService(JdbcTemplate jdbc, DoctorClinicalAccessService access,
        PatientAppointmentService appointments, Clock clock) {
        this.jdbc = jdbc; this.access = access; this.appointments = appointments; this.clock = clock;
    }

    @Transactional
    public RoutineView get(UUID doctor) {
        access.requireActiveDoctor(doctor);
        appointments.prepareDoctorBookingProfile(doctor);
        return view(doctor);
    }

    @Transactional
    public RoutineView save(UUID doctor, RoutineRequest request) {
        validate(request);
        access.requireActiveDoctor(doctor);
        lockDoctor(doctor);
        appointments.prepareDoctorBookingProfile(doctor);
        RoutineView current = view(doctor);
        if (request.version() != current.version()) throw new DoctorApiException(HttpStatus.CONFLICT,
            "WEEKLY_ROUTINE_CHANGED", "Your weekly routine changed. Reload before saving.");
        if (request.blocks().stream().anyMatch(b -> b.enabled() && !"IN_PERSON".equals(b.consultationMode()))
            && (current.defaultMeetingUrl() == null || current.defaultMeetingUrl().isBlank())) {
            throw invalid("ONLINE_ROOM_REQUIRED", "Add your online consultation room before enabling Online availability.");
        }
        Instant now = clock.instant();
        long version = current.version() + 1;
        jdbc.update("UPDATE doctor_weekly_availability_rules SET enabled = FALSE, updated_at = ?, version = version + 1 WHERE doctor_user_id = ? AND enabled = TRUE",
            Timestamp.from(now), doctor);
        // A concurrent booking locks its slot: this conditional update waits and rechecks AVAILABLE.
        // Never delete slots because even cancelled historical appointments can reference them.
        jdbc.update("""
            UPDATE doctor_availability_slots SET status = 'BLOCKED', updated_at = ?, version = version + 1
             WHERE doctor_user_id = ? AND weekly_rule_id IS NOT NULL AND status = 'AVAILABLE' AND starts_at > ?
            """, Timestamp.from(now), doctor, Timestamp.from(now));
        jdbc.update("""
            UPDATE doctor_booking_profiles SET weekly_routine_version = ?, weekly_slot_minutes = ?,
                preferred_timezone = ?, updated_at = ? WHERE doctor_user_id = ?
            """, version, request.slotMinutes(), request.timezone(), Timestamp.from(now), doctor);
        for (Block block : request.blocks()) {
            jdbc.update("""
                INSERT INTO doctor_weekly_availability_rules
                (id, doctor_user_id, weekday, local_start_time, local_end_time, consultation_mode,
                 slot_minutes, timezone, enabled, created_at, updated_at, routine_version)
                VALUES (?, ?, ?, CAST(? AS time), CAST(? AS time), ?, ?, ?, ?, ?, ?, ?)
                """, UUID.randomUUID(), doctor, block.weekday(), block.start().toString(), block.end().toString(),
                block.consultationMode(), request.slotMinutes(), request.timezone(), block.enabled(),
                Timestamp.from(now), Timestamp.from(now), version);
        }
        materialize(doctor);
        return view(doctor);
    }

    @Transactional
    public void topUp(UUID doctor) {
        lockDoctor(doctor);
        materialize(doctor);
    }

    private void lockDoctor(UUID doctor) {
        jdbc.queryForObject("SELECT id FROM users WHERE id = ? FOR UPDATE", UUID.class, doctor);
    }

    private RoutineView view(UUID doctor) {
        return jdbc.queryForObject("""
            SELECT weekly_routine_version, weekly_slot_minutes, preferred_timezone, default_meeting_url
            FROM doctor_booking_profiles WHERE doctor_user_id = ?
            """, (rs, index) -> new RoutineView(rs.getLong(1), rs.getInt(2), rs.getString(3), rs.getString(4),
            jdbc.query("""
                SELECT weekday, local_start_time, local_end_time, consultation_mode, enabled
                FROM doctor_weekly_availability_rules WHERE doctor_user_id = ? AND routine_version = ?
                ORDER BY weekday, local_start_time
                """, (row, i) -> new Block(row.getInt(1), row.getObject(2, LocalTime.class), row.getObject(3, LocalTime.class),
                row.getString(4), row.getBoolean(5)), doctor, rs.getLong(1))), doctor);
    }

    private void materialize(UUID doctor) {
        List<Rule> rules = jdbc.query("""
            SELECT r.id, r.weekday, r.local_start_time, r.local_end_time, r.consultation_mode, r.slot_minutes, r.timezone
            FROM doctor_weekly_availability_rules r JOIN doctor_booking_profiles p ON p.doctor_user_id = r.doctor_user_id
            JOIN users u ON u.id = p.doctor_user_id
            WHERE r.doctor_user_id = ? AND r.enabled = TRUE AND r.routine_version = p.weekly_routine_version
              AND p.booking_enabled = TRUE AND u.account_status = 'ACTIVE'
              AND (r.consultation_mode = 'IN_PERSON' OR p.default_meeting_url IS NOT NULL)
            ORDER BY r.weekday, r.local_start_time
            """, (rs, i) -> new Rule(rs.getObject(1, UUID.class), rs.getInt(2), rs.getObject(3, LocalTime.class),
            rs.getObject(4, LocalTime.class), rs.getString(5), rs.getInt(6), rs.getString(7)), doctor);
        Instant now = clock.instant();
        for (Rule rule : rules) {
            for (Window window : windows(rule, now)) {
                Integer overlap = jdbc.queryForObject("""
                    SELECT COUNT(*) FROM doctor_availability_slots s
                    LEFT JOIN doctor_weekly_availability_rules r ON r.id = s.weekly_rule_id
                    WHERE s.doctor_user_id = ? AND s.starts_at < ? AND s.ends_at > ?
                      AND (s.status <> 'BLOCKED' OR s.weekly_rule_id IS NULL OR r.enabled = TRUE)
                    """, Integer.class, doctor, Timestamp.from(window.end()), Timestamp.from(window.start()));
                if (overlap != null && overlap > 0) continue;
                jdbc.update("""
                    INSERT INTO doctor_availability_slots
                        (id, doctor_user_id, starts_at, ends_at, timezone, status, consultation_mode, weekly_rule_id, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, 'AVAILABLE', ?, ?, ?, ?)
                    ON CONFLICT (doctor_user_id, starts_at, ends_at) DO UPDATE
                        SET status = 'AVAILABLE', consultation_mode = EXCLUDED.consultation_mode,
                            timezone = EXCLUDED.timezone, weekly_rule_id = EXCLUDED.weekly_rule_id,
                            updated_at = EXCLUDED.updated_at, version = doctor_availability_slots.version + 1
                        WHERE doctor_availability_slots.status = 'BLOCKED'
                          AND doctor_availability_slots.weekly_rule_id IS NOT NULL
                    """, UUID.randomUUID(), doctor, Timestamp.from(window.start()), Timestamp.from(window.end()),
                    rule.timezone(), rule.mode(), rule.id(), Timestamp.from(now), Timestamp.from(now));
            }
        }
    }

    static void validate(RoutineRequest request) {
        if (request == null || request.blocks() == null || request.blocks().size() > 35)
            throw invalid("WEEKLY_ROUTINE_INVALID", "Choose up to 35 weekly time blocks.");
        if (request.slotMinutes() < 15 || request.slotMinutes() > 120 || request.slotMinutes() % 5 != 0)
            throw invalid("AVAILABILITY_SLOT_INVALID", "Choose an appointment duration from 15 to 120 minutes in five-minute increments.");
        if (request.timezone() == null || !ZoneId.getAvailableZoneIds().contains(request.timezone()))
            throw invalid("TIMEZONE_INVALID", "Choose a valid IANA timezone.");
        for (Block b : request.blocks()) {
            if (b == null || b.weekday() < 1 || b.weekday() > 7 || b.start() == null || b.end() == null
                || !b.end().isAfter(b.start()) || b.start().getSecond() != 0 || b.end().getSecond() != 0
                || Duration.between(b.start(), b.end()).toMinutes() < request.slotMinutes()
                || b.consultationMode() == null || !List.of("ONLINE", "IN_PERSON", "BOTH").contains(b.consultationMode()))
                throw invalid("WEEKLY_BLOCK_INVALID", "Each block needs a weekday, valid mode and end time after its start.");
        }
        List<Block> enabled = request.blocks().stream().filter(Block::enabled)
            .sorted(Comparator.comparingInt(Block::weekday).thenComparing(Block::start)).toList();
        for (int i = 1; i < enabled.size(); i++) {
            Block a = enabled.get(i - 1), b = enabled.get(i);
            if (a.weekday() == b.weekday() && b.start().isBefore(a.end()))
                throw invalid("AVAILABILITY_OVERLAP", "Weekly time blocks must not overlap.");
        }
    }

    static List<Window> windows(Rule rule, Instant now) {
        ZoneId zone = ZoneId.of(rule.timezone());
        LocalDate first = now.atZone(zone).toLocalDate(), end = first.plusWeeks(HORIZON_WEEKS);
        List<Window> windows = new ArrayList<>();
        for (LocalDate date = first; date.isBefore(end); date = date.plusDays(1)) {
            if (date.getDayOfWeek().getValue() != rule.weekday()) continue;
            for (LocalDateTime start = date.atTime(rule.start()); !start.plusMinutes(rule.minutes()).isAfter(date.atTime(rule.end())); start = start.plusMinutes(rule.minutes())) {
                LocalDateTime finish = start.plusMinutes(rule.minutes());
                // Skip nonexistent spring-forward times; use the first offset once for ambiguous fall-back times.
                var starts = zone.getRules().getValidOffsets(start);
                var ends = zone.getRules().getValidOffsets(finish);
                if (starts.isEmpty() || ends.isEmpty()) continue;
                Instant from = start.toInstant(starts.getFirst()), to = finish.toInstant(ends.getFirst());
                if (from.isAfter(now) && Duration.between(from, to).toMinutes() == rule.minutes()) windows.add(new Window(from, to));
            }
        }
        return windows;
    }

    private static DoctorApiException invalid(String code, String message) { return new DoctorApiException(HttpStatus.BAD_REQUEST, code, message); }
    public record Block(int weekday, LocalTime start, LocalTime end, String consultationMode, boolean enabled) {}
    public record RoutineRequest(long version, int slotMinutes, String timezone, List<Block> blocks) {}
    public record RoutineView(long version, int slotMinutes, String timezone, String defaultMeetingUrl, List<Block> blocks) {}
    record Rule(UUID id, int weekday, LocalTime start, LocalTime end, String mode, int minutes, String timezone) {}
    record Window(Instant start, Instant end) {}
}
