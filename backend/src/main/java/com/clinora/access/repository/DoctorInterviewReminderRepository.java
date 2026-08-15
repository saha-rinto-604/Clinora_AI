package com.clinora.access.repository;

import com.clinora.access.domain.DoctorInterviewReminder;
import com.clinora.access.domain.DoctorInterviewReminderStatus;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DoctorInterviewReminderRepository extends JpaRepository<DoctorInterviewReminder, UUID> {
    List<DoctorInterviewReminder> findTop50ByStatusAndDueAtLessThanEqualOrderByDueAtAsc(
        DoctorInterviewReminderStatus status,
        Instant dueAt
    );

    void deleteAllByInterviewIdAndStatus(UUID interviewId, DoctorInterviewReminderStatus status);
}
