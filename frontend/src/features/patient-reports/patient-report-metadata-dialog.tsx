import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '../../components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../../components/ui/dialog';
import { FormField, FormMessage, Input, Label, Select } from '../../components/ui/form';
import { patientReportApi, patientReportErrorMessage } from './patient-report-api';
import { todayForDateInput } from './patient-report-format';
import { patientReportTypeLabels, patientReportTypes, type PatientReport } from './patient-report-types';

const metadataSchema = z.object({
  reportName: z.string().trim().min(1, 'Enter a clear report name.').max(160, 'Use 160 characters or fewer.'),
  reportType: z.enum(patientReportTypes),
  reportDate: z
    .string()
    .refine((value) => !value || value <= todayForDateInput(), 'The date on the report cannot be in the future.'),
  providerLaboratory: z.string().trim().max(200, 'Use 200 characters or fewer.'),
});

type MetadataValues = z.infer<typeof metadataSchema>;

export function PatientReportMetadataDialog({
  report,
  open,
  onOpenChange,
  onUpdated,
}: {
  report: PatientReport;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: (report: PatientReport) => void;
}) {
  const [saveError, setSaveError] = useState('');
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<MetadataValues>({ resolver: zodResolver(metadataSchema), defaultValues: valuesFor(report) });

  useEffect(() => {
    if (open) {
      reset(valuesFor(report));
      setSaveError('');
    }
  }, [open, report, reset]);

  const submit = handleSubmit(async (values) => {
    setSaveError('');
    try {
      const updated = await patientReportApi.update(report.id, {
        reportName: values.reportName.trim(),
        reportType: values.reportType,
        reportDate: values.reportDate || null,
        providerLaboratory: values.providerLaboratory.trim() || null,
      });
      onUpdated(updated);
      onOpenChange(false);
    } catch (error) {
      setSaveError(patientReportErrorMessage(error, 'We could not update these report details.'));
    }
  });

  return (
    <Dialog open={open} onOpenChange={(next) => !isSubmitting && onOpenChange(next)}>
      <DialogContent className="max-w-xl gap-0 p-0">
        <div className="border-b border-[var(--clinora-border-subtle)] px-5 py-5 sm:px-7">
          <DialogTitle className="text-xl font-semibold text-white">Edit report details</DialogTitle>
          <DialogDescription className="mt-2 text-sm leading-6 text-[var(--clinora-text-muted)]">
            Update how this report is identified. The original file remains unchanged.
          </DialogDescription>
        </div>
        <form onSubmit={submit} className="grid gap-5 px-5 py-6 sm:px-7" noValidate>
          <FormField>
            <Label htmlFor="edit-report-name">Report name</Label>
            <Input
              id="edit-report-name"
              disabled={isSubmitting}
              aria-invalid={Boolean(errors.reportName)}
              {...register('reportName')}
            />
            {errors.reportName ? (
              <FormMessage role="alert" className="text-rose-300">
                {errors.reportName.message}
              </FormMessage>
            ) : null}
          </FormField>
          <div className="grid gap-5 sm:grid-cols-2">
            <FormField>
              <Label htmlFor="edit-report-type">Report type</Label>
              <Select id="edit-report-type" disabled={isSubmitting} {...register('reportType')}>
                {patientReportTypes.map((type) => (
                  <option key={type} value={type}>
                    {patientReportTypeLabels[type]}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField>
              <Label htmlFor="edit-report-date">
                Date on report <span className="text-[var(--clinora-text-faint)]">(optional)</span>
              </Label>
              <Input
                id="edit-report-date"
                type="date"
                max={todayForDateInput()}
                disabled={isSubmitting}
                {...register('reportDate')}
              />
              {errors.reportDate ? (
                <FormMessage role="alert" className="text-rose-300">
                  {errors.reportDate.message}
                </FormMessage>
              ) : null}
            </FormField>
          </div>
          <FormField>
            <Label htmlFor="edit-report-provider">
              Provider or laboratory <span className="text-[var(--clinora-text-faint)]">(optional)</span>
            </Label>
            <Input id="edit-report-provider" disabled={isSubmitting} {...register('providerLaboratory')} />
            {errors.providerLaboratory ? (
              <FormMessage role="alert" className="text-rose-300">
                {errors.providerLaboratory.message}
              </FormMessage>
            ) : null}
          </FormField>
          {saveError ? (
            <FormMessage role="alert" className="text-rose-300">
              {saveError}
            </FormMessage>
          ) : null}
          <div className="flex flex-col-reverse gap-3 border-t border-[var(--clinora-border-subtle)] pt-5 sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button variant="appPrimary" type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving…' : 'Save details'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function valuesFor(report: PatientReport): MetadataValues {
  return {
    reportName: report.reportName,
    reportType: report.reportType,
    reportDate: report.reportDate ?? '',
    providerLaboratory: report.providerLaboratory ?? '',
  };
}
