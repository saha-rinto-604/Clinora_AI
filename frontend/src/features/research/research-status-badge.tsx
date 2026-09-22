import { Badge } from '../../components/ui/badge';
import type { DatasetRequestStatus, ResearchProjectStatus } from './research-types';

interface Props {
  status: ResearchProjectStatus | DatasetRequestStatus;
  className?: string;
}

export function ResearchStatusBadge({ status, className }: Props) {
  switch (status) {
    case 'APPROVED':
    case 'ACTIVE':
    case 'COMPLETED':
      return (
        <Badge variant="success" className={className}>
          {status === 'ACTIVE' ? 'Active' : status === 'COMPLETED' ? 'Completed' : 'Approved'}
        </Badge>
      );
    case 'SUBMITTED':
    case 'UNDER_REVIEW':
      return (
        <Badge variant="info" className={className}>
          {status === 'SUBMITTED' ? 'Submitted' : 'Under Review'}
        </Badge>
      );
    case 'MORE_INFO_REQUIRED':
      return (
        <Badge variant="warning" className={className}>
          More Info Required
        </Badge>
      );
    case 'REJECTED':
      return (
        <Badge variant="danger" className={className}>
          Rejected
        </Badge>
      );
    case 'DRAFT':
      return (
        <Badge variant="neutral" className={className}>
          Draft
        </Badge>
      );
    case 'WITHDRAWN':
      return (
        <Badge variant="neutral" className={className}>
          Withdrawn
        </Badge>
      );
    case 'CANCELLED':
      return (
        <Badge variant="neutral" className={className}>
          Cancelled
        </Badge>
      );
    case 'ARCHIVED':
      return (
        <Badge variant="neutral" className={className}>
          Archived
        </Badge>
      );
    default:
      return (
        <Badge variant="neutral" className={className}>
          {status}
        </Badge>
      );
  }
}
