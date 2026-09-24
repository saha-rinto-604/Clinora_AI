package com.clinora.doctors.service;

import static org.junit.jupiter.api.Assertions.*;
import com.clinora.appointments.service.PatientAppointmentService;
import com.clinora.appointments.service.PatientConsultationJoinService;
import com.clinora.audit.AuthAuditService;
import com.clinora.consultations.service.*;
import com.clinora.consultations.service.ConsultationModels.*;
import com.clinora.notifications.service.*;
import com.clinora.notifications.email.*;
import com.clinora.config.*;
import com.clinora.patients.security.PatientReportMalwareScanner;
import com.clinora.patients.storage.PatientReportStoragePort;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.mockito.ArgumentCaptor;
import static org.mockito.Mockito.*;
import com.clinora.notifications.service.PatientNotificationService;
import com.clinora.patients.service.PatientTimelineService;
import java.time.*;
import java.sql.Timestamp;
import java.util.*;
import java.util.concurrent.*;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/** Real migrations and transactions in disposable PostgreSQL, never the application database. */
@Testcontainers
class WeeklyCareIntegrationTest {
    @Container static final PostgreSQLContainer<?> database = new PostgreSQLContainer<>("postgres:16-alpine");
    JdbcTemplate jdbc;
    TransactionTemplate tx;
    Clock clock;
    UUID doctor, patient;
    PatientAppointmentService appointments;
    WeeklyAvailabilityService weekly;
    PatientNotificationService notifications;
    DoctorMeetingRoomService rooms;
    AuthAuditService audit;
    @BeforeAll static void migrate() {
        Flyway.configure().dataSource(database.getJdbcUrl(), database.getUsername(), database.getPassword()).load().migrate();
    }
    @BeforeEach void setup() {
        var source = new DriverManagerDataSource(database.getJdbcUrl(),database.getUsername(),database.getPassword());
        jdbc = new JdbcTemplate(source); tx = new TransactionTemplate(new DataSourceTransactionManager(source));
        clock = Clock.fixed(Instant.now().truncatedTo(java.time.temporal.ChronoUnit.SECONDS), ZoneOffset.UTC);
        notifications = new PatientNotificationService(jdbc,clock);
        appointments = new PatientAppointmentService(jdbc,new PatientTimelineService(jdbc,clock),notifications,clock);
        weekly = new WeeklyAvailabilityService(jdbc,new DoctorClinicalAccessService(jdbc,clock),appointments,clock);
        audit = mock(AuthAuditService.class);
        rooms = new DoctorMeetingRoomService(jdbc,new DoctorClinicalAccessService(jdbc,clock),appointments,notifications,audit,clock);
        doctor = user("DOCTOR"); patient = user("PATIENT");
        UUID application = UUID.randomUUID(); String email = doctor+"@example.test";
        jdbc.update("INSERT INTO access_applications (id,application_type,first_name,last_name,email,normalized_email,status,processing_consent_at,created_at,updated_at) VALUES (?,'DOCTOR','Test','Doctor',?,?,'ACTIVATED',now(),now(),now())",application,email,email);
        jdbc.update("INSERT INTO doctor_application_details (application_id,specialization) VALUES (?,'General medicine')",application);
        tx.executeWithoutResult(s -> appointments.prepareDoctorBookingProfile(doctor));
        jdbc.update("UPDATE doctor_booking_profiles SET preferred_timezone='UTC',practice_location='Test clinic' WHERE doctor_user_id=?",doctor);
    }
    UUID user(String role) {
        UUID id = UUID.randomUUID(); String email = id+"@example.test";
        jdbc.update("INSERT INTO users (id,first_name,last_name,email,normalized_email,password_hash,role,account_status,email_verified_at,created_at,updated_at) VALUES (?,'Test','User',?,?,'not-a-login',?,'ACTIVE',now(),now(),now())",id,email,email,role); return id;
    }
    WeeklyAvailabilityService.RoutineView save(long version, int weekday, int from, int to, String mode) {
        return tx.execute(s -> weekly.save(doctor,new WeeklyAvailabilityService.RoutineRequest(version,30,"UTC",List.of(new WeeklyAvailabilityService.Block(weekday,LocalTime.of(from,0),LocalTime.of(to,0),mode,true)))));
    }
    UUID slotAt(LocalDate date, int hour) {
        return jdbc.queryForObject("SELECT id FROM doctor_availability_slots WHERE doctor_user_id=? AND starts_at=? AND status='AVAILABLE'",UUID.class,doctor,Timestamp.from(date.atTime(hour,0).toInstant(ZoneOffset.UTC)));
    }
    @Test void routinePersistsRepeatsAndTopUpDoesNotDuplicateConcreteSlots() {
        LocalDate day = LocalDate.now(clock).plusDays(1);
        var saved = save(0,day.getDayOfWeek().getValue(),9,12,"IN_PERSON");
        assertEquals(saved, tx.execute(s -> weekly.get(doctor)));
        assertNotNull(slotAt(day.plusWeeks(8),9));
        Integer before = jdbc.queryForObject("SELECT count(*) FROM doctor_availability_slots WHERE doctor_user_id=?",Integer.class,doctor);
        tx.executeWithoutResult(s -> weekly.topUp(doctor));
        assertEquals(before,jdbc.queryForObject("SELECT count(*) FROM doctor_availability_slots WHERE doctor_user_id=?",Integer.class,doctor));
        assertEquals(72,before);
    }
    @Test void tuesdayRoutineEditPreservesBookedSixPmAndRegeneratesOnlyFreeGeneratedSlots() {
        LocalDate tuesday = LocalDate.now(clock).with(java.time.temporal.TemporalAdjusters.next(DayOfWeek.TUESDAY));
        save(0,2,17,20,"IN_PERSON"); UUID slot = slotAt(tuesday,18);
        var booked = tx.execute(s -> appointments.book(patient,UUID.randomUUID().toString(),slot,null,"UTC","IN_PERSON",List.of()));
        UUID manual = UUID.randomUUID();
        jdbc.update("INSERT INTO doctor_availability_slots (id,doctor_user_id,starts_at,ends_at,timezone,status,created_at,updated_at) VALUES (?,?,?,?,'UTC','AVAILABLE',now(),now())",manual,doctor,Timestamp.from(tuesday.atTime(10,0).toInstant(ZoneOffset.UTC)),Timestamp.from(tuesday.atTime(10,30).toInstant(ZoneOffset.UTC)));
        save(1,2,16,19,"IN_PERSON");
        assertEquals("BOOKED",jdbc.queryForObject("SELECT status FROM doctor_availability_slots WHERE id=?",String.class,slot));
        assertEquals(booked.scheduledStart(),appointments.appointment(patient,booked.id()).scheduledStart());
        assertEquals("AVAILABLE",jdbc.queryForObject("SELECT status FROM doctor_availability_slots WHERE id=?",String.class,manual));
        assertNotNull(slotAt(tuesday,16));
        assertEquals(0,jdbc.queryForObject("SELECT count(*) FROM doctor_availability_slots WHERE doctor_user_id=? AND status='AVAILABLE' AND starts_at=?",Integer.class,doctor,Timestamp.from(tuesday.atTime(19,0).toInstant(ZoneOffset.UTC))));
    }
    @Test void onlyOneConcurrentPatientCanBookAGeneratedSlot() throws Exception {
        LocalDate day = LocalDate.now(clock).plusDays(1); save(0,day.getDayOfWeek().getValue(),9,10,"IN_PERSON"); UUID slot = slotAt(day,9), other = user("PATIENT");
        var gate = new CountDownLatch(1);
        try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
            var first = executor.submit(() -> bookAfterGate(gate,patient,slot));
            var second = executor.submit(() -> bookAfterGate(gate,other,slot)); gate.countDown();
            assertEquals(Set.of("BOOKED","APPOINTMENT_SLOT_UNAVAILABLE"),Set.of(first.get(15,TimeUnit.SECONDS),second.get(15,TimeUnit.SECONDS)));
        }
    }
    String bookAfterGate(CountDownLatch gate, UUID owner, UUID slot) throws Exception {
        gate.await();
        try { tx.execute(s -> appointments.book(owner,UUID.randomUUID().toString(),slot,null,"UTC","IN_PERSON",List.of())); return "BOOKED"; }
        catch (com.clinora.patients.api.PatientApiException error) { return error.getErrorCode(); }
    }
    @Test void onlineAndBothRulesRequireConfiguredRoom() {
        for (String mode : List.of("ONLINE","BOTH")) assertThrows(com.clinora.doctors.api.DoctorApiException.class, () -> save(0,1,9,12,mode));
        assertEquals(0,jdbc.queryForObject("SELECT count(*) FROM doctor_weekly_availability_rules WHERE doctor_user_id=?",Integer.class,doctor));
    }

    @Test void multipleDailyBlocksAndRollingHorizonRemainConcreteAndNonOverlapping() {
        LocalDate day = LocalDate.now(clock).plusDays(1); int weekday = day.getDayOfWeek().getValue();
        tx.execute(s -> weekly.save(doctor,new WeeklyAvailabilityService.RoutineRequest(0,30,"UTC",List.of(
            new WeeklyAvailabilityService.Block(weekday,LocalTime.of(9,0),LocalTime.of(12,0),"IN_PERSON",true),
            new WeeklyAvailabilityService.Block(weekday,LocalTime.of(17,0),LocalTime.of(20,0),"IN_PERSON",true)))));
        assertNotNull(slotAt(day,9)); assertNotNull(slotAt(day,17));
        Clock later = Clock.fixed(clock.instant().plus(Duration.ofDays(14)),ZoneOffset.UTC);
        var topUp = new WeeklyAvailabilityService(jdbc,new DoctorClinicalAccessService(jdbc,later),appointments,later);
        tx.executeWithoutResult(s -> topUp.topUp(doctor)); assertNotNull(slotAt(day.plusWeeks(13),17));
        assertEquals(0,jdbc.queryForObject("SELECT count(*) FROM doctor_availability_slots a JOIN doctor_availability_slots b ON a.doctor_user_id=b.doctor_user_id AND a.id<b.id AND a.starts_at<b.ends_at AND a.ends_at>b.starts_at WHERE a.doctor_user_id=? AND a.status='AVAILABLE' AND b.status='AVAILABLE'",Integer.class,doctor));
    }

    @Test void bothModesSnapshotRoomAndRoomChangesOnlyUpdateEligibleAppointmentsOnce() {
        tx.execute(s -> rooms.save(doctor,"https://meet.example.test/first",null,null));
        LocalDate day = LocalDate.now(clock).plusDays(1); save(0,day.getDayOfWeek().getValue(),9,13,"BOTH");
        var online = bookAt(day,9,"ONLINE"); var inPerson = bookAt(day,10,"IN_PERSON");
        var cancelled = bookAt(day,11,"ONLINE"); var completed = bookAt(day,12,"ONLINE");
        assertNull(online.meetingUrl(), "Patient APIs must not release reusable URLs");
        assertEquals("https://meet.example.test/first",storedRoom(online.id())); assertNull(storedRoom(inPerson.id()));
        tx.execute(s -> appointments.cancel(patient,cancelled.id(),null));
        jdbc.update("UPDATE appointments SET status='COMPLETED' WHERE id=?",completed.id());
        var result = tx.execute(s -> rooms.save(doctor,"https://meet.example.test/second",null,null));
        assertEquals(1,result.updatedAppointments());
        assertEquals("https://meet.example.test/second",storedRoom(online.id())); assertNull(storedRoom(inPerson.id()));
        assertEquals("https://meet.example.test/first",storedRoom(cancelled.id()));
        assertEquals("https://meet.example.test/first",storedRoom(completed.id()));
        assertEquals(0,tx.execute(s -> rooms.save(doctor,"https://meet.example.test/second",null,null)).updatedAppointments());
        assertEquals(1,jdbc.queryForObject("SELECT count(*) FROM notifications WHERE target_id=? AND type='APPOINTMENT_MEETING_LINK_UPDATED'",Integer.class,online.id()));
        verify(audit,times(2)).record(eq(doctor),eq(com.clinora.audit.AuthAuditAction.DOCTOR_DEFAULT_MEETING_ROOM_UPDATED),any(),isNull(),isNull(),eq(doctor.toString()),argThat(s -> !s.contains("https")));
        var lateClock = Clock.fixed(online.scheduledEnd().plusSeconds(1),ZoneOffset.UTC);
        var lateRoomService = new DoctorMeetingRoomService(jdbc,new DoctorClinicalAccessService(jdbc,lateClock),appointments,notifications,audit,lateClock);
        tx.execute(s -> lateRoomService.save(doctor,"https://meet.example.test/third",null,null));
        assertEquals("https://meet.example.test/second",storedRoom(online.id()),"Past booked visit is immutable to default room changes");
    }

    @Test void joinRequiresOwnerValidOnlineBookingAndServerTimeWindow() {
        tx.execute(s -> rooms.save(doctor,"https://meet.example.test/private",null,null));
        LocalDate day = LocalDate.now(clock).plusDays(1); save(0,day.getDayOfWeek().getValue(),9,11,"BOTH");
        var online = bookAt(day,9,"ONLINE"); var inPerson = bookAt(day,10,"IN_PERSON");
        var join = new PatientConsultationJoinService(jdbc,clock);
        assertEquals("TOO_EARLY",join.status(patient,online.id()).state());
        assertThrows(com.clinora.patients.api.PatientApiException.class,() -> join.join(patient,online.id()));
        assertThrows(com.clinora.patients.api.PatientApiException.class,() -> join.status(user("PATIENT"),online.id()));
        var ready = new PatientConsultationJoinService(jdbc,Clock.fixed(online.scheduledStart().minusSeconds(900),ZoneOffset.UTC));
        assertEquals("https://meet.example.test/private",ready.join(patient,online.id()).meetingUrl());
        assertFalse(ready.status(patient,inPerson.id()).canJoin());
        var ended = new PatientConsultationJoinService(jdbc,Clock.fixed(online.scheduledEnd().plusSeconds(1),ZoneOffset.UTC));
        assertFalse(ended.status(patient,online.id()).canJoin());
        jdbc.update("INSERT INTO doctor_consultations (id,appointment_id,doctor_user_id,patient_user_id,status,started_at,created_at,updated_at) VALUES (?,?,?,?,'IN_PROGRESS',now(),now(),now())",UUID.randomUUID(),online.id(),doctor,patient);
        assertTrue(ended.status(patient,online.id()).canJoin());
        jdbc.update("UPDATE appointments SET status='COMPLETED' WHERE id=?",online.id());
        assertFalse(ready.status(patient,online.id()).canJoin());
    }

    @Test void retiringRoutineThenCancellingDoesNotReopenRetiredTime() {
        LocalDate day = LocalDate.now(clock).plusDays(1); save(0,day.getDayOfWeek().getValue(),9,11,"IN_PERSON");
        var appointment = bookAt(day,9,"IN_PERSON");
        save(1,day.getDayOfWeek().getValue(),10,11,"IN_PERSON");
        tx.execute(s -> appointments.cancel(patient,appointment.id(),null));
        assertEquals("BLOCKED",jdbc.queryForObject("SELECT s.status FROM doctor_availability_slots s JOIN appointments a ON a.slot_id=s.id WHERE a.id=?",String.class,appointment.id()));
    }

    PatientAppointmentService.AppointmentView bookAt(LocalDate day, int hour, String mode) {
        return tx.execute(s -> appointments.book(patient,UUID.randomUUID().toString(),slotAt(day,hour),null,"UTC",mode,List.of()));
    }
    String storedRoom(UUID id) { return jdbc.queryForObject("SELECT meeting_url FROM appointments WHERE id=?",String.class,id); }

    @Test void appointmentLifecycleAndBothReminderWindowsUseOneOutboxEventPerNotification() {
        LocalDate day = LocalDate.now(clock).plusDays(2); save(0,day.getDayOfWeek().getValue(),9,12,"IN_PERSON");
        var appointment = bookAt(day,9,"IN_PERSON");
        var cancelled = bookAt(day,10,"IN_PERSON");
        tx.execute(s -> appointments.cancel(patient,cancelled.id(),null));
        for (int hours : List.of(24,1)) {
            Clock at = Clock.fixed(appointment.scheduledStart().minusSeconds(hours * 3600L),ZoneOffset.UTC);
            var scheduler = new AppointmentReminderScheduler(jdbc,notifications,at);
            tx.executeWithoutResult(s -> scheduler.createReminders()); tx.executeWithoutResult(s -> scheduler.createReminders());
        }
        var cancelledWindow = new AppointmentReminderScheduler(jdbc,notifications,Clock.fixed(cancelled.scheduledStart().minusSeconds(3600),ZoneOffset.UTC));
        tx.executeWithoutResult(s -> cancelledWindow.createReminders());
        assertEquals(2,countNotification(appointment.id(),"APPOINTMENT_REMINDER"));
        assertEquals(0,countNotification(cancelled.id(),"APPOINTMENT_REMINDER"));
        assertEquals(1,countNotification(appointment.id(),"APPOINTMENT_BOOKED"));
        assertEquals(1,countNotification(cancelled.id(),"APPOINTMENT_CANCELLED"));
        tx.execute(s -> appointments.reschedule(patient,appointment.id(),slotAt(day,11),"UTC","IN_PERSON"));
        assertEquals(1,countNotification(appointment.id(),"APPOINTMENT_RESCHEDULED"));
        assertEquals(jdbc.queryForObject("SELECT count(*) FROM notifications WHERE user_id=?",Integer.class,patient),
            jdbc.queryForObject("SELECT count(*) FROM outbox_events WHERE user_id=?",Integer.class,patient));
    }

    @Test void documentOnlyPrescriptionCompletesAndNotifiesFollowUpOnlyAfterCompletion() {
        LocalDate day = LocalDate.now(clock).plusDays(1); save(0,day.getDayOfWeek().getValue(),9,10,"IN_PERSON");
        var appointment = bookAt(day,9,"IN_PERSON");
        var access = new DoctorClinicalAccessService(jdbc,clock);
        var storage = mock(PatientReportStoragePort.class); var scanner = mock(PatientReportMalwareScanner.class);
        when(scanner.scan(any())).thenReturn(PatientReportMalwareScanner.ScanResult.CLEAN);
        var documents = new PrescriptionDocumentService(jdbc,access,storage,new PatientReportStorageProperties(),scanner,new PatientReportSecurityProperties(),audit,clock);
        var consultations = new ConsultationService(jdbc,access,notifications,new PatientTimelineService(jdbc,clock),documents,clock);
        var started = tx.execute(s -> consultations.start(doctor,appointment.id()));
        assertTrue(started.prescriptions().isEmpty());
        byte[] pdf = "%PDF-1.4\n1 0 obj <<>> endobj\n%%EOF".getBytes(java.nio.charset.StandardCharsets.US_ASCII);
        when(storage.get(any())).thenReturn(new PatientReportStoragePort.StoredObject(pdf,"application/pdf"));
        var file = new MockMultipartFile("file","prescription.pdf","application/pdf",pdf);
        var document = tx.execute(s -> documents.upload(doctor,started.id(),file,null,null));
        assertThrows(com.clinora.patients.api.PatientApiException.class,() -> documents.patientContent(patient,started.id(),document.id(),false,null,null));
        LocalDate followUp = LocalDate.now(clock).plusDays(12);
        var draft = tx.execute(s -> consultations.saveDraft(doctor,started.id(),new ConsultationDraftRequest(started.version(),null,null,"Doctor assessment",null,List.of(),List.of(),new FollowUpInput(followUp,null,null))));
        assertEquals(0,countNotification(appointment.id(),"FOLLOW_UP_RECOMMENDED"));
        var completed = tx.execute(s -> consultations.complete(doctor,started.id(),new ConsultationDraftRequest(draft.version(),null,null,"Doctor assessment",null,List.of(),List.of(),new FollowUpInput(followUp,null,null))));
        assertEquals("COMPLETED",completed.status()); assertTrue(completed.prescriptions().isEmpty());
        assertEquals(1,completed.prescriptionDocuments().size());
        assertArrayEquals(pdf,documents.patientContent(patient,started.id(),document.id(),false,null,null).bytes());
        assertThrows(com.clinora.doctors.api.DoctorApiException.class,() -> tx.execute(s -> documents.upload(doctor,started.id(),file,null,null)));
        assertEquals(1,countNotification(appointment.id(),"FOLLOW_UP_RECOMMENDED"));
        for (int days : List.of(7,1)) {
            Clock reminderTime = Clock.fixed(followUp.minusDays(days).atTime(12,0).toInstant(ZoneOffset.UTC),ZoneOffset.UTC);
            var scheduler = new FollowUpReminderScheduler(jdbc,notifications,reminderTime);
            tx.executeWithoutResult(s -> scheduler.createReminders()); tx.executeWithoutResult(s -> scheduler.createReminders());
        }
        assertEquals(2,countNotification(appointment.id(),"FOLLOW_UP_REMINDER"));
    }

    @Test void followUpReminderSuppressionIsSameDoctorNearDateAndCancellationRestoresEligibility() {
        LocalDate day = LocalDate.now(clock).plusDays(2); save(0,day.getDayOfWeek().getValue(),9,12,"IN_PERSON");
        var original = bookAt(day,9,"IN_PERSON"); var future = bookAt(day.plusWeeks(1),10,"IN_PERSON");
        UUID consultation = UUID.randomUUID(); LocalDate followUp = day.plusWeeks(1);
        jdbc.update("UPDATE appointments SET status='COMPLETED' WHERE id=?",original.id());
        jdbc.update("INSERT INTO doctor_consultations (id,appointment_id,doctor_user_id,patient_user_id,status,started_at,completed_at,created_at,updated_at) VALUES (?,?,?,?,'COMPLETED',?,?,?,?)",consultation,original.id(),doctor,patient,Timestamp.from(clock.instant().minusSeconds(3600)),Timestamp.from(clock.instant()),Timestamp.from(clock.instant()),Timestamp.from(clock.instant()));
        jdbc.update("INSERT INTO consultation_follow_ups (id,consultation_id,recommended_date,created_at,updated_at) VALUES (?,?,?,now(),now())",UUID.randomUUID(),consultation,java.sql.Date.valueOf(followUp));
        Clock time = Clock.fixed(followUp.minusDays(7).atTime(12,0).toInstant(ZoneOffset.UTC),ZoneOffset.UTC);
        var scheduler = new FollowUpReminderScheduler(jdbc,notifications,time);
        tx.executeWithoutResult(s -> scheduler.createReminders()); assertEquals(0,countNotification(original.id(),"FOLLOW_UP_REMINDER"));
        tx.execute(s -> appointments.cancel(patient,future.id(),null));
        tx.executeWithoutResult(s -> scheduler.createReminders()); tx.executeWithoutResult(s -> scheduler.createReminders());
        assertEquals(1,countNotification(original.id(),"FOLLOW_UP_REMINDER"));
        // A newly made recommendation on the seven-day window date must not send a retrospective reminder.
        jdbc.update("UPDATE doctor_consultations SET completed_at=? WHERE id=?",Timestamp.from(time.instant()),consultation);
        var newlyCompleted = new FollowUpReminderScheduler(jdbc,notifications,time);
        tx.executeWithoutResult(s -> newlyCompleted.createReminders()); assertEquals(1,countNotification(original.id(),"FOLLOW_UP_REMINDER"));
    }

    @Test void emailUsesConfiguredAuthenticatedAppLinkAndRespectsAppointmentPreference() {
        var notification = tx.execute(s -> notifications.create(patient,"FOLLOW_UP_RECOMMENDED",PatientNotificationService.NotificationCategory.APPOINTMENTS,"Private assessment", "secret diagnosis https://meet.example.test/private", "APPOINTMENT", UUID.randomUUID(),"email-test:"+UUID.randomUUID()));
        var delivery = mock(EmailDeliveryPort.class); var properties = new EmailProperties(); properties.setFrontendUrl("https://clinora.example.test");
        var consumer = new NotificationDeliveryConsumer(jdbc,notifications,mock(SimpMessagingTemplate.class),delivery,properties);
        consumer.deliver(new NotificationOutboxPublisher.NotificationReadyMessage(notification.id(),patient));
        var email = ArgumentCaptor.forClass(TransactionalEmail.class); verify(delivery).send(email.capture());
        assertTrue(email.getValue().textBody().contains("https://clinora.example.test/patient/appointments/"));
        assertFalse(email.getValue().textBody().contains("secret diagnosis")); assertFalse(email.getValue().htmlBody().contains("meet.example.test"));
        jdbc.update("INSERT INTO notification_preferences (user_id,appointments_email,updated_at) VALUES (?,false,now())",patient);
        var optedOut = tx.execute(s -> notifications.create(patient,"APPOINTMENT_REMINDER",PatientNotificationService.NotificationCategory.APPOINTMENTS,"Reminder","private", "APPOINTMENT",UUID.randomUUID(),"email-optout:"+UUID.randomUUID()));
        consumer.deliver(new NotificationOutboxPublisher.NotificationReadyMessage(optedOut.id(),patient)); verify(delivery,times(1)).send(any());
    }

    int countNotification(UUID appointment, String type) { return jdbc.queryForObject("SELECT count(*) FROM notifications WHERE target_id=? AND type=?",Integer.class,appointment,type); }
}
