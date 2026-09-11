import { useReducedMotion } from 'framer-motion';
import { useState } from 'react';
import { useAuthStore } from '../../features/auth/auth-store';
import { CinematicCoreMedia } from '../../features/patient/patient-core-experience';
import {
  DashboardActions,
  DashboardActivity,
  DashboardCare,
  DashboardHeader,
  DashboardHealthOverview,
  DashboardInsights,
  DashboardMetrics,
  DashboardPrivacy,
  DashboardQuickActions,
} from '../../features/patient/patient-dashboard';
import { usePatientDashboard } from '../../features/patient/use-patient-dashboard';
import { PatientReportUploadDialog } from '../../features/patient-reports/patient-report-upload-dialog';
import '../../styles/patient-dashboard.css';

export function PatientPortalPage() {
  const user = useAuthStore((state) => state.user);
  const reducedMotion = useReducedMotion();
  const dashboard = usePatientDashboard();
  const [uploadOpen, setUploadOpen] = useState(false);
  const onUpload = () => setUploadOpen(true);

  return (
    <div className="patient-home">
      <CinematicCoreMedia reducedMotion={Boolean(reducedMotion)} integrated />
      <DashboardHeader
        firstName={dashboard.reports.data?.firstName || dashboard.profile.data?.firstName || user?.firstName || 'there'}
        verified={Boolean(user?.emailVerified)}
        unread={dashboard.sharing.error ? null : (dashboard.sharing.data?.unreadNotifications ?? null)}
      />
      <div className="patient-home__workspace">
        <div className="patient-home__main">
          <DashboardActions onUpload={onUpload} />
          <DashboardMetrics
            reports={dashboard.reports}
            care={dashboard.care}
            activity={dashboard.events}
            profile={dashboard.profile}
          />
          <DashboardHealthOverview record={dashboard.record} trends={dashboard.trends} />
          <div className="patient-home__lower">
            <DashboardCare section={dashboard.care} />
            <DashboardActivity section={dashboard.events} />
          </div>
        </div>
        <aside className="patient-home__rail" aria-label="Patient dashboard actions">
          <DashboardCare section={dashboard.care} rail />
          <DashboardQuickActions onUpload={onUpload} />
          <DashboardInsights trends={dashboard.trends} record={dashboard.record} />
          <DashboardPrivacy section={dashboard.sharing} />
        </aside>
      </div>
      <PatientReportUploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        onUploaded={dashboard.refreshAfterUpload}
      />
    </div>
  );
}
