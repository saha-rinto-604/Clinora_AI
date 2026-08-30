import { zodResolver } from '@hookform/resolvers/zod';
import { FileText, RefreshCw, UploadCloud, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '../../components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../../components/ui/dialog';
import { FormField, FormMessage, Input, Label, Select } from '../../components/ui/form';
import { cn } from '../../lib/cn';
import { patientReportApi, patientReportErrorMessage } from './patient-report-api';
import { formatFileSize, todayForDateInput } from './patient-report-format';
import { patientReportTypeLabels, patientReportTypes, type PatientReport } from './patient-report-types';

const MAX_FILE_BYTES = 20 * 1024 * 1024;
const ACCEPTED_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png'];
const ACCEPTED_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];

const uploadMetadataSchema = z.object({
  reportName: z.string().trim().min(1, 'Enter a clear report name.').max(160, 'Use 160 characters or fewer.'),
  reportType: z.enum(patientReportTypes),
  reportDate: z
    .string()
    .refine((value) => !value || value <= todayForDateInput(), 'The date on the report cannot be in the future.'),
  providerLaboratory: z.string().trim().max(200, 'Use 200 characters or fewer.'),
});

type UploadMetadataValues = z.infer<typeof uploadMetadataSchema>;

export interface PatientReportUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUploaded: (report: PatientReport) => void | Promise<void>;
}

export function PatientReportUploadDialog({ open, onOpenChange, onUploaded }: PatientReportUploadDialogProps) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState('');
  const [uploadError, setUploadError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dragActive, setDragActive] = useState(false);
  const {
    register,
    handleSubmit,
    getValues,
    setValue,
    reset,
    formState: { errors },
  } = useForm<UploadMetadataValues>({
    resolver: zodResolver(uploadMetadataSchema),
    defaultValues: {
      reportName: '',
      reportType: 'LAB_RESULTS',
      reportDate: '',
      providerLaboratory: '',
    },
  });

  const resetDialog = () => {
    reset();
    setFile(null);
    setFileError('');
    setUploadError('');
    setProgress(0);
    setDragActive(false);
    if (fileInput.current) fileInput.current.value = '';
  };

  const changeOpen = (nextOpen: boolean) => {
    if (uploading) return;
    if (!nextOpen) resetDialog();
    onOpenChange(nextOpen);
  };

  const chooseFile = (selected: File | null) => {
    setUploadError('');
    const validationError = selected ? validateSelectedFile(selected) : 'Choose a medical report to upload.';
    if (!selected || validationError) {
      setFile(null);
      setFileError(validationError);
      return;
    }
    setFile(selected);
    setFileError('');
    if (!getValues('reportName').trim()) {
      setValue('reportName', reportNameFromFilename(selected.name), { shouldValidate: true });
    }
  };

  const clearFile = () => {
    setFile(null);
    setFileError('');
    setUploadError('');
    if (fileInput.current) fileInput.current.value = '';
  };

  const openFilePicker = () => {
    if (fileInput.current) {
      fileInput.current.value = '';
      fileInput.current.click();
    }
  };

  const submit = handleSubmit(async (values) => {
    if (!file) {
      setFileError('Choose a medical report to upload.');
      return;
    }
    const validationError = validateSelectedFile(file);
    if (validationError) {
      setFileError(validationError);
      return;
    }

    setUploading(true);
    setProgress(0);
    setUploadError('');
    try {
      const report = await patientReportApi.upload(
        {
          reportName: values.reportName.trim(),
          reportType: values.reportType,
          reportDate: values.reportDate || null,
          providerLaboratory: values.providerLaboratory.trim() || null,
          file,
        },
        setProgress,
      );
      setProgress(100);
      await onUploaded(report);
      resetDialog();
      onOpenChange(false);
    } catch (error) {
      setUploadError(patientReportErrorMessage(error, 'We could not upload this report. Please try again.'));
    } finally {
      setUploading(false);
    }
  });

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogContent className="max-w-2xl gap-0 p-0">
        <div className="border-b border-[var(--clinora-border-subtle)] px-5 py-5 sm:px-7">
          <DialogTitle className="text-xl font-semibold tracking-[-0.025em] text-white">
            Upload medical report
          </DialogTitle>
          <DialogDescription className="mt-2 max-w-xl text-sm leading-6 text-[var(--clinora-text-muted)]">
            Choose the original document first, then add the details you use to recognize it.
          </DialogDescription>
        </div>

        <form onSubmit={submit} className="grid gap-5 px-5 py-6 sm:px-7" noValidate>
          <div>
            <Label htmlFor="patient-report-file">Report file</Label>
            <div
              className={cn(
                'mt-2 rounded-[var(--clinora-radius-md)] border border-dashed p-5 transition-colors',
                dragActive
                  ? 'border-[var(--clinora-accent-cyan)] bg-[var(--clinora-info-soft)]'
                  : 'border-[var(--clinora-border-interactive)] bg-[var(--clinora-surface-nested)]',
                fileError ? 'border-[var(--clinora-danger)]' : '',
              )}
              onDragEnter={(event) => {
                event.preventDefault();
                setDragActive(true);
              }}
              onDragOver={(event) => event.preventDefault()}
              onDragLeave={(event) => {
                event.preventDefault();
                setDragActive(false);
              }}
              onDrop={(event) => {
                event.preventDefault();
                setDragActive(false);
                chooseFile(event.dataTransfer.files.item(0));
              }}
            >
              <input
                ref={fileInput}
                id="patient-report-file"
                type="file"
                className="sr-only"
                accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                onChange={(event) => chooseFile(event.target.files?.item(0) ?? null)}
                disabled={uploading}
              />
              {file ? (
                <div className="flex flex-wrap items-center gap-3">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[var(--clinora-info-soft)] text-[var(--clinora-info-foreground)]">
                    <FileText size={20} aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--clinora-text-faint)]">
                      Selected document
                    </p>
                    <p className="truncate text-sm font-semibold text-white">{file.name}</p>
                    <p className="mt-1 text-xs text-[var(--clinora-text-faint)]">{formatFileSize(file.size)}</p>
                  </div>
                  <Button variant="text" size="sm" onClick={openFilePicker} disabled={uploading}>
                    <RefreshCw size={15} aria-hidden="true" /> Replace
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label="Remove selected report"
                    className="min-w-10 px-0"
                    onClick={clearFile}
                    disabled={uploading}
                  >
                    <X size={16} aria-hidden="true" />
                  </Button>
                </div>
              ) : (
                <div className="text-center">
                  <UploadCloud className="mx-auto text-[var(--clinora-info-foreground)]" size={26} aria-hidden="true" />
                  <p className="mt-3 text-sm font-semibold text-white">Drop your report here</p>
                  <p className="mt-1 text-xs leading-5 text-[var(--clinora-text-muted)]">
                    PDF, JPG, JPEG or PNG · up to 20 MB
                  </p>
                  <Button variant="appPrimary" size="sm" className="mt-4" onClick={openFilePicker} disabled={uploading}>
                    Choose a file
                  </Button>
                </div>
              )}
            </div>
            {fileError ? (
              <FormMessage role="alert" className="mt-2 text-rose-300">
                {fileError}
              </FormMessage>
            ) : null}
          </div>

          {file ? (
            <section
              className="border-t border-[var(--clinora-border-subtle)] pt-5"
              aria-labelledby="organize-report-title"
            >
              <h3 id="organize-report-title" className="text-base font-semibold text-white">
                Organize this report
              </h3>
              <p className="mt-1 text-xs leading-5 text-[var(--clinora-text-muted)]">
                Report name and type are required. Add the document date and provider when available.
              </p>

              <div className="mt-5 grid gap-5 sm:grid-cols-2">
                <FormField className="sm:col-span-2">
                  <Label htmlFor="patient-report-name">Report name</Label>
                  <Input
                    id="patient-report-name"
                    placeholder="e.g. Annual blood panel"
                    autoComplete="off"
                    disabled={uploading}
                    required
                    aria-invalid={Boolean(errors.reportName)}
                    {...register('reportName')}
                  />
                  {errors.reportName ? (
                    <FormMessage role="alert" className="text-rose-300">
                      {errors.reportName.message}
                    </FormMessage>
                  ) : null}
                </FormField>

                <FormField>
                  <Label htmlFor="patient-report-type">Report type</Label>
                  <Select id="patient-report-type" disabled={uploading} required {...register('reportType')}>
                    {patientReportTypes.map((type) => (
                      <option key={type} value={type}>
                        {patientReportTypeLabels[type]}
                      </option>
                    ))}
                  </Select>
                </FormField>

                <FormField>
                  <Label htmlFor="patient-report-date">
                    Date on report <span className="text-[var(--clinora-text-faint)]">(optional)</span>
                  </Label>
                  <Input
                    id="patient-report-date"
                    type="date"
                    max={todayForDateInput()}
                    disabled={uploading}
                    aria-invalid={Boolean(errors.reportDate)}
                    {...register('reportDate')}
                  />
                  {errors.reportDate ? (
                    <FormMessage role="alert" className="text-rose-300">
                      {errors.reportDate.message}
                    </FormMessage>
                  ) : null}
                </FormField>

                <FormField className="sm:col-span-2">
                  <Label htmlFor="patient-report-provider">
                    Provider or laboratory <span className="text-[var(--clinora-text-faint)]">(optional)</span>
                  </Label>
                  <Input
                    id="patient-report-provider"
                    placeholder="e.g. City Diagnostic Centre"
                    autoComplete="organization"
                    disabled={uploading}
                    aria-invalid={Boolean(errors.providerLaboratory)}
                    {...register('providerLaboratory')}
                  />
                  {errors.providerLaboratory ? (
                    <FormMessage role="alert" className="text-rose-300">
                      {errors.providerLaboratory.message}
                    </FormMessage>
                  ) : null}
                </FormField>
              </div>
            </section>
          ) : null}

          {uploading ? (
            <div role="status" aria-live="polite">
              <div className="flex items-center justify-between text-xs text-[var(--clinora-text-muted)]">
                <span>Uploading securely</span>
                <span>{progress}%</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/[0.07]">
                <div
                  className="h-full rounded-full bg-[var(--clinora-primary-gradient)] transition-[width] duration-200"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          ) : null}

          {uploadError ? (
            <FormMessage role="alert" className="text-rose-300">
              {uploadError}
            </FormMessage>
          ) : null}

          <div className="flex flex-col-reverse gap-3 border-t border-[var(--clinora-border-subtle)] pt-5 sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={() => changeOpen(false)} disabled={uploading}>
              Cancel
            </Button>
            {file ? (
              <Button variant="appPrimary" type="submit" disabled={uploading}>
                <UploadCloud size={16} aria-hidden="true" /> {uploading ? 'Uploading…' : 'Upload report'}
              </Button>
            ) : null}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function validateSelectedFile(file: File) {
  const lowerName = file.name.toLowerCase();
  if (!ACCEPTED_EXTENSIONS.some((extension) => lowerName.endsWith(extension))) {
    return 'Choose a PDF, JPG, JPEG, or PNG file.';
  }
  if (file.type && !ACCEPTED_MIME_TYPES.includes(file.type)) {
    return 'The selected file type is not supported.';
  }
  if (file.size === 0) return 'The selected file is empty.';
  if (file.size > MAX_FILE_BYTES) return 'Medical reports must be 20 MB or smaller.';
  return '';
}

function reportNameFromFilename(filename: string) {
  return filename
    .replace(/\.(pdf|jpe?g|png)$/i, '')
    .replace(/[_-]+/g, ' ')
    .trim()
    .slice(0, 160);
}
