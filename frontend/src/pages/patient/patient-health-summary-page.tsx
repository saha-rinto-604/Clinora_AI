import { HealthRecordHeader, HealthRecordTabs } from '../../features/patient-record/health-record-shell';
import { PersonalHealthSummaryPanel } from '../../features/patient-record/personal-health-summary-panel';

export function PatientHealthSummaryPage() {
  return (
    <div className="mx-auto w-full max-w-[1120px] pb-8">
      <HealthRecordHeader />
      <HealthRecordTabs />
      <div className="mt-9">
        <PersonalHealthSummaryPanel />
      </div>
    </div>
  );
}
