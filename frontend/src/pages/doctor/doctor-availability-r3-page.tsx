import { DoctorMeetingRoom } from '../../features/appointments/doctor-meeting-room';
import { useState } from 'react';
import '../../styles/doctor-availability.css';
import { WeeklyScheduleEditor } from '../../features/appointments/weekly-schedule-editor';
import { AvailabilityCalendar } from '../../features/appointments/availability-calendar';
import { useWeeklyAvailability } from '../../features/appointments/use-weekly-availability';

export function DoctorAvailabilityWorkspacePage() {
  const workspace = useWeeklyAvailability();
  const [roomBusy, setRoomBusy] = useState(false);
  return (
    <div className="doctor-availability">
      <header className="availability-page-heading">
        <p className="clinora-r3-kicker">Practice schedule</p>
        <h1>Weekly availability</h1>
        <p>Set your regular weekly schedule. It repeats every week until you change it.</p>
      </header>
      {workspace.routine && workspace.persisted ? (
        <>
          <DoctorMeetingRoom
            currentUrl={workspace.routine.defaultMeetingUrl}
            onSaved={workspace.roomSaved}
            disabled={workspace.busy}
            onBusyChange={setRoomBusy}
          />
          <WeeklyScheduleEditor
            routine={workspace.routine}
            onChange={workspace.update}
            onSave={() => void workspace.save()}
            busy={workspace.busy}
            roomBusy={roomBusy}
            dirty={workspace.dirty}
            saved={workspace.saved}
            error={workspace.error}
          />
          <AvailabilityCalendar
            slots={workspace.slots}
            timezone={workspace.persisted.timezone}
            now={workspace.now}
            loading={workspace.loadingSlots}
            error={workspace.calendarError}
            onRetry={() => void workspace.refreshSlots()}
          />
        </>
      ) : workspace.error ? (
        <p role="alert" className="availability-error">
          {workspace.error}
        </p>
      ) : (
        <p role="status">Loading weekly routine...</p>
      )}
    </div>
  );
}
