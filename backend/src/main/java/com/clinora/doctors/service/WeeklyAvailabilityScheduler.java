package com.clinora.doctors.service;

import java.util.UUID;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class WeeklyAvailabilityScheduler {
    private final JdbcTemplate jdbc;
    private final WeeklyAvailabilityService availability;
    public WeeklyAvailabilityScheduler(JdbcTemplate jdbc, WeeklyAvailabilityService availability) {
        this.jdbc = jdbc; this.availability = availability;
    }
    @Scheduled(fixedDelayString = "${clinora.appointments.weekly-top-up-delay-ms:3600000}")
    public void topUp() {
        for (UUID doctor : jdbc.query("SELECT DISTINCT doctor_user_id FROM doctor_weekly_availability_rules WHERE enabled = TRUE", (rs, i) -> rs.getObject(1, UUID.class))) {
            try { availability.topUp(doctor); }
            catch (RuntimeException error) {
                LoggerFactory.getLogger(getClass()).warn("Weekly availability top-up failed for doctor {} ({})", doctor, error.getClass().getSimpleName());
            }
        }
    }
}
