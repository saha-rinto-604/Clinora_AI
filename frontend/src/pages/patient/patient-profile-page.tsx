import { zodResolver } from '@hookform/resolvers/zod';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Check, Pencil, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import {
  useEffect,
  useMemo,
  useState,
  type InputHTMLAttributes,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { useForm, type FieldErrors, type UseFormRegister, type UseFormSetValue } from 'react-hook-form';
import { Link, useSearchParams } from 'react-router';
import { z } from 'zod';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../../components/ui/dialog';
import { Skeleton } from '../../components/ui/feedback';
import { FormNotice } from '../../features/auth/auth-ui';
import { patientApi, patientErrorMessage } from '../../features/patient/patient-api';
import {
  profileSections,
  sectionCompletion,
  type ProfileSectionId,
} from '../../features/patient/patient-profile-state';
import { ProfileSignalRail } from '../../features/patient/patient-profile-ui';
import {
  bloodGroupLabels,
  genderLabels,
  type BloodGroup,
  type PatientGender,
  type PatientProfile,
  type UpdatePatientProfileInput,
} from '../../features/patient/patient-types';
import { cn } from '../../lib/cn';

const phonePattern = /^[+0-9() .-]{7,32}$/;
const optionalPhone = z
  .string()
  .max(32)
  .refine((value) => !value || phonePattern.test(value), 'Enter a valid phone number.');
const optionalNumber = (min: number, max: number, label: string) =>
  z
    .string()
    .refine((value) => !value || (!Number.isNaN(Number(value)) && Number(value) >= min && Number(value) <= max), {
      message: `${label} must be between ${min} and ${max}.`,
    });
const schema = z.object({
  dateOfBirth: z
    .string()
    .refine(
      (value) => !value || value <= new Date().toISOString().slice(0, 10),
      'Date of birth cannot be in the future.',
    ),
  gender: z.string(),
  bloodGroup: z.string(),
  phone: optionalPhone,
  address: z.string().max(500, 'Use 500 characters or fewer.'),
  heightCm: optionalNumber(30, 300, 'Height'),
  weightKg: optionalNumber(1, 700, 'Weight'),
  allergies: z.array(z.string()),
  chronicConditions: z.array(z.string()),
  currentMedications: z.array(z.string()),
  familyMedicalHistory: z.string().max(2000, 'Use 2000 characters or fewer.'),
  lifestyleInformation: z.string().max(2000, 'Use 2000 characters or fewer.'),
  emergencyContactName: z.string().max(160),
  emergencyContactPhone: optionalPhone,
  emergencyContactRelationship: z.string().max(100),
});
type FormValues = z.infer<typeof schema>;
type ProfileView = ProfileSectionId;

const emptyValues: FormValues = {
  dateOfBirth: '',
  gender: '',
  bloodGroup: '',
  phone: '',
  address: '',
  heightCm: '',
  weightKg: '',
  allergies: [],
  chronicConditions: [],
  currentMedications: [],
  familyMedicalHistory: '',
  lifestyleInformation: '',
  emergencyContactName: '',
  emergencyContactPhone: '',
  emergencyContactRelationship: '',
};

export function PatientProfilePage() {
  const [profile, setProfile] = useState<PatientProfile | null>(null);
  const [loadError, setLoadError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [saveMessage, setSaveMessage] = useState('');
  const [pendingView, setPendingView] = useState<ProfileView | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const requested = searchParams.get('section');
  const initialView: ProfileView = profileSections.some(({ id }) => id === requested)
    ? (requested as ProfileView)
    : 'personal';
  const [activeView, setActiveView] = useState<ProfileView>(initialView);
  const reducedMotion = useReducedMotion();
  const {
    register,
    reset,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: emptyValues });
  const values = watch();

  useEffect(() => {
    let active = true;
    patientApi
      .profile()
      .then((data) => {
        if (active) {
          setProfile(data);
          reset(toFormValues(data));
        }
      })
      .catch((error) => {
        if (active) setLoadError(patientErrorMessage(error, 'Unable to load your Patient profile.'));
      });
    return () => {
      active = false;
    };
  }, [reset]);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (isDirty) event.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [isDirty]);

  const bmi = useMemo(
    () => (values.heightCm && values.weightKg ? Number(values.weightKg) / (Number(values.heightCm) / 100) ** 2 : null),
    [values.heightCm, values.weightKg],
  );

  const applyView = (view: ProfileView) => {
    setActiveView(view);
    setSearchParams({ section: view }, { replace: true });
    setSaveMessage('');
    setSaveError('');
    window.scrollTo({ top: 0, behavior: reducedMotion ? 'auto' : 'smooth' });
  };

  const requestView = (view: ProfileView) => {
    if (view === activeView) return;
    if (isDirty) {
      setPendingView(view);
      return;
    }
    applyView(view);
  };

  const persist = async (formValues: FormValues) => {
    setSaveError('');
    setSaveMessage('');
    try {
      const nextHeight = numberOrNull(formValues.heightCm);
      const nextWeight = numberOrNull(formValues.weightKg);
      const measurementRecorded =
        (profile?.heightCm !== nextHeight || profile?.weightKg !== nextWeight) &&
        (nextHeight !== null || nextWeight !== null);
      const updated = await patientApi.updateProfile(toApiInput(formValues));
      setProfile(updated);
      reset(toFormValues(updated));
      setSaveMessage(
        measurementRecorded
          ? 'Health Profile updated. Your latest measurement was added to Health Trends.'
          : 'Health Profile updated.',
      );
    } catch (error) {
      setSaveError(patientErrorMessage(error, 'Unable to save your Patient profile. Your changes are still here.'));
    }
  };

  const saveCurrent = handleSubmit((formValues) => persist(formValues));
  if (!profile && !loadError)
    return (
      <div className="mx-auto w-full max-w-[1120px]" role="status" aria-label="Loading Patient profile">
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="mt-7 h-24 rounded-[24px]" />
        <div className="mt-6 grid gap-6 lg:grid-cols-12">
          <Skeleton className="h-[40rem] rounded-[28px] lg:col-span-8" />
          <Skeleton className="h-80 rounded-[26px] lg:col-span-4" />
        </div>
      </div>
    );
  if (loadError) return <FormNotice tone="error">{loadError}</FormNotice>;
  if (!profile) return null;

  const completion = sectionCompletion(profile);
  const currentStepIndex = profileSections.findIndex(({ id }) => id === activeView);

  return (
    <div className="mx-auto w-full max-w-[1120px]">
      <header>
        <h1 className="text-3xl font-semibold tracking-[-0.045em] sm:text-[2.4rem]">Health Profile</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400 sm:text-[15px]">
          Keep the information you manage in Clinora accurate and up to date.
        </p>
        <p className="mt-2 text-sm text-[var(--clinora-text-faint)]">
          Changes to your health information are reflected in your{' '}
          <Link to="/patient/history" className="font-semibold text-[var(--clinora-info-foreground)]">
            Health Record
          </Link>
          .
        </p>
      </header>

      <div className="mt-8 grid items-start gap-6 lg:grid-cols-12 lg:gap-8">
        <ProfileSignalRail profile={profile} active={activeView} onSelect={(section) => requestView(section)} />
        <section className="min-w-0 overflow-hidden rounded-[24px] border border-white/[0.08] bg-[#0b1424]/95 lg:col-span-9">
          {saveMessage ? (
            <div className="px-5 pt-5 sm:px-7 sm:pt-7" role="status" aria-live="polite">
              <FormNotice tone="success">{saveMessage}</FormNotice>
            </div>
          ) : null}
          {saveError ? (
            <div className="px-5 pt-5 sm:px-7 sm:pt-7" role="alert">
              <FormNotice tone="error">{saveError}</FormNotice>
            </div>
          ) : null}

          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={activeView}
              initial={{ opacity: 0, x: reducedMotion ? 0 : 6 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: reducedMotion ? 0 : -4 }}
              transition={{ duration: reducedMotion ? 0 : 0.2, ease: [0.22, 1, 0.36, 1] }}
            >
              <form onSubmit={saveCurrent}>
                <div className="p-5 sm:p-7">
                  <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/[0.07] pb-6">
                    <div>
                      <p className="text-xs font-medium text-cyan-200">Step {currentStepIndex + 1} of 4</p>
                      <h2 className="mt-2 text-2xl font-semibold tracking-[-0.025em]">{sectionTitle(activeView)}</h2>
                      <p className="mt-2 max-w-xl text-sm leading-6 text-slate-400">{sectionDescription(activeView)}</p>
                    </div>
                    {completion[activeView] ? (
                      <span className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-teal-300/16 bg-teal-300/[0.06] px-3 text-xs font-medium text-teal-100">
                        <Check size={13} aria-hidden="true" /> Saved section
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-7 grid gap-6">
                    {activeView === 'personal' ? (
                      <PersonalSection profile={profile} register={register} errors={errors} />
                    ) : null}
                    {activeView === 'basic' ? <BasicSection register={register} errors={errors} bmi={bmi} /> : null}
                    {activeView === 'medical' ? (
                      <MedicalSection values={values} register={register} errors={errors} setValue={setValue} />
                    ) : null}
                    {activeView === 'emergency' ? <EmergencySection register={register} errors={errors} /> : null}
                  </div>
                </div>

                <div className="sticky bottom-0 z-10 flex flex-col gap-3 border-t border-white/[0.09] bg-[#091321]/95 px-5 py-4 backdrop-blur sm:flex-row sm:items-center sm:justify-between sm:px-7">
                  <p className={cn('text-sm', isDirty ? 'font-medium text-amber-100' : 'text-slate-500')}>
                    {isDirty ? 'You have unsaved changes.' : 'All changes saved.'}
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={!isDirty || isSubmitting}
                      onClick={() => {
                        reset(toFormValues(profile));
                        setSaveError('');
                        setSaveMessage('');
                      }}
                      className="min-h-11 rounded-xl border border-white/10 px-4 text-sm font-semibold text-slate-300 transition hover:bg-white/[0.04] disabled:cursor-not-allowed disabled:opacity-35"
                    >
                      Discard
                    </button>
                    <button
                      type="submit"
                      disabled={!isDirty || isSubmitting}
                      className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-400 px-5 text-sm font-semibold text-slate-950 shadow-[0_10px_28px_rgba(14,165,233,.12)] transition hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transform-none sm:flex-none"
                    >
                      {isSubmitting ? 'Saving…' : 'Save changes'}
                    </button>
                  </div>
                </div>
              </form>
            </motion.div>
          </AnimatePresence>
        </section>
      </div>

      <Dialog open={pendingView !== null} onOpenChange={(open) => !open && setPendingView(null)}>
        <DialogContent>
          <DialogTitle>Leave without saving?</DialogTitle>
          <DialogDescription className="text-sm leading-6 text-slate-400">
            Your changes in this profile section have not been saved.
          </DialogDescription>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setPendingView(null)}
              className="min-h-11 rounded-xl border border-white/10 px-4 text-sm font-semibold"
            >
              Keep editing
            </button>
            <button
              type="button"
              onClick={() => {
                if (!pendingView) return;
                reset(toFormValues(profile));
                const target = pendingView;
                setPendingView(null);
                applyView(target);
              }}
              className="min-h-11 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-400 px-4 text-sm font-semibold text-slate-950"
            >
              Discard changes
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PersonalSection({ profile, register, errors }: SectionProps & { profile: PatientProfile }) {
  return (
    <>
      <div className="grid gap-5 border-b border-white/[0.07] pb-6 sm:grid-cols-2">
        <ReadOnlyIdentity label="Full name" value={`${profile.firstName} ${profile.lastName}`} />
        <ReadOnlyIdentity label="Email" value={profile.email} />
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <InputField
          label="Date of birth"
          type="date"
          error={errors.dateOfBirth?.message}
          {...register('dateOfBirth')}
        />
        <SelectField label="Gender" error={errors.gender?.message} {...register('gender')}>
          <option value="">Select gender</option>
          {(Object.keys(genderLabels) as PatientGender[]).map((value) => (
            <option key={value} value={value}>
              {genderLabels[value]}
            </option>
          ))}
        </SelectField>
      </div>
      <InputField
        label="Phone"
        type="tel"
        help="Include your country code when applicable."
        error={errors.phone?.message}
        {...register('phone')}
      />
      <TextAreaField
        label="Address"
        rows={3}
        help="Use the address you want associated with your healthcare correspondence."
        error={errors.address?.message}
        {...register('address')}
      />
    </>
  );
}

function BasicSection({ register, errors, bmi }: SectionProps & { bmi: number | null }) {
  return (
    <>
      <SelectField label="Blood group" error={errors.bloodGroup?.message} {...register('bloodGroup')}>
        <option value="">Select blood group</option>
        {(Object.keys(bloodGroupLabels) as BloodGroup[]).map((value) => (
          <option key={value} value={value}>
            {bloodGroupLabels[value]}
          </option>
        ))}
      </SelectField>
      <div className="grid gap-5 sm:grid-cols-2">
        <InputField
          label="Height"
          type="number"
          step="0.1"
          inputMode="decimal"
          suffix="cm"
          error={errors.heightCm?.message}
          {...register('heightCm')}
        />
        <InputField
          label="Weight"
          type="number"
          step="0.1"
          inputMode="decimal"
          suffix="kg"
          error={errors.weightKg?.message}
          {...register('weightKg')}
        />
      </div>
      <div className="flex flex-col gap-3 border-y border-white/[0.07] py-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-200">Calculated BMI</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            Calculated from height and weight. It is not a diagnosis or health score.
          </p>
        </div>
        <p className="text-2xl font-semibold tracking-[-0.03em] text-slate-100">
          {bmi && Number.isFinite(bmi) ? bmi.toFixed(1) : '—'}
        </p>
      </div>
    </>
  );
}

function MedicalSection({
  values,
  register,
  errors,
  setValue,
}: SectionProps & { values: FormValues; setValue: UseFormSetValue<FormValues> }) {
  return (
    <>
      <MedicalList
        label="Allergies"
        singular="allergy"
        addLabel="Add allergy"
        items={values.allergies}
        onChange={(items) => setValue('allergies', items, { shouldDirty: true })}
      />
      <MedicalList
        label="Health conditions"
        singular="condition"
        addLabel="Add condition"
        items={values.chronicConditions}
        onChange={(items) => setValue('chronicConditions', items, { shouldDirty: true })}
      />
      <MedicalList
        label="Current medications"
        singular="medication"
        addLabel="Add medication"
        items={values.currentMedications}
        onChange={(items) => setValue('currentMedications', items, { shouldDirty: true })}
      />
      <div className="grid gap-5 border-t border-white/[0.07] pt-6">
        <TextAreaField
          label="Family medical history"
          rows={4}
          help="Include relevant conditions that occur in close biological family members."
          error={errors.familyMedicalHistory?.message}
          {...register('familyMedicalHistory')}
        />
        <TextAreaField
          label="Lifestyle information"
          rows={4}
          help="You may include exercise, smoking, sleep, diet, or other information you consider relevant."
          error={errors.lifestyleInformation?.message}
          {...register('lifestyleInformation')}
        />
      </div>
    </>
  );
}

function EmergencySection({ register, errors }: SectionProps) {
  return (
    <>
      <InputField
        label="Contact name"
        error={errors.emergencyContactName?.message}
        {...register('emergencyContactName')}
      />
      <div className="grid gap-5 sm:grid-cols-2">
        <InputField
          label="Relationship"
          help="For example: parent, spouse, sibling, or friend."
          error={errors.emergencyContactRelationship?.message}
          {...register('emergencyContactRelationship')}
        />
        <InputField
          label="Phone number"
          type="tel"
          error={errors.emergencyContactPhone?.message}
          {...register('emergencyContactPhone')}
        />
      </div>
      <div className="flex gap-3 border-y border-white/[0.07] py-5 text-xs leading-5 text-slate-500">
        <ShieldCheck size={16} className="mt-0.5 shrink-0 text-cyan-200" aria-hidden="true" />
        <p>This contact is stored as part of your private Patient profile and is not displayed publicly.</p>
      </div>
    </>
  );
}

type SectionProps = {
  register: UseFormRegister<FormValues>;
  errors: FieldErrors<FormValues>;
};

function ReadOnlyIdentity({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1.5 break-words text-sm font-medium text-slate-100">{value}</p>
      <p className="mt-1 text-[11px] text-slate-600">Managed through your Clinora account.</p>
    </div>
  );
}

function MedicalList({
  label,
  singular,
  addLabel,
  items,
  onChange,
}: {
  label: string;
  singular: string;
  addLabel: string;
  items: string[];
  onChange: (items: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);
  const [draft, setDraft] = useState('');
  const reducedMotion = useReducedMotion();
  const begin = (index: number | null) => {
    setEditing(index);
    setDraft(index == null ? '' : items[index]);
    setOpen(true);
  };
  const submit = () => {
    const value = draft.trim().replace(/\s+/g, ' ');
    if (!value) return;
    const next = [...items];
    if (editing == null) next.push(value);
    else next[editing] = value;
    onChange([...new Map(next.map((item) => [item.toLowerCase(), item])).values()]);
    setOpen(false);
  };
  return (
    <fieldset className="border-b border-white/[0.07] pb-6 last:border-b-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <legend className="text-sm font-semibold text-slate-200">{label}</legend>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            Keep this list current. Leave it empty if you have none to record.
          </p>
        </div>
        <button
          type="button"
          onClick={() => begin(null)}
          className="inline-flex min-h-10 items-center gap-2 rounded-lg px-2.5 text-xs font-semibold text-cyan-200 hover:bg-cyan-300/[0.05]"
        >
          <Plus size={15} aria-hidden="true" /> {addLabel}
        </button>
      </div>
      <div className="mt-3 divide-y divide-white/[0.06] border-y border-white/[0.06]">
        <AnimatePresence initial={false}>
          {items.map((item, index) => (
            <motion.div
              key={`${item}-${index}`}
              initial={{ opacity: 0, height: reducedMotion ? 'auto' : 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: reducedMotion ? 'auto' : 0 }}
              transition={{ duration: reducedMotion ? 0 : 0.17 }}
              className="overflow-hidden"
            >
              <div className="flex min-h-12 items-center gap-2 py-2">
                <span className="min-w-0 flex-1 break-words text-sm text-slate-200">{item}</span>
                <button
                  type="button"
                  onClick={() => begin(index)}
                  className="grid h-10 w-10 place-items-center rounded-lg text-slate-500 hover:bg-white/[0.04] hover:text-cyan-200"
                  aria-label={`Edit ${item}`}
                >
                  <Pencil size={15} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => onChange(items.filter((_, itemIndex) => itemIndex !== index))}
                  className="grid h-10 w-10 place-items-center rounded-lg text-slate-500 hover:bg-rose-300/[0.06] hover:text-rose-200"
                  aria-label={`Remove ${item}`}
                >
                  <Trash2 size={15} aria-hidden="true" />
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {items.length === 0 ? (
          <p className="py-3 text-sm text-slate-600">
            {label === 'Allergies'
              ? 'No allergies recorded.'
              : label === 'Health conditions'
                ? 'No health conditions recorded.'
                : 'No current medications recorded.'}
          </p>
        ) : null}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bottom-0 top-auto translate-y-0 rounded-b-none sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2 sm:rounded-[24px]">
          <DialogTitle>{editing == null ? `Add ${singular}` : `Edit ${singular}`}</DialogTitle>
          <DialogDescription className="text-sm text-slate-400">
            Enter one clear item. You can edit it later.
          </DialogDescription>
          <label className="grid gap-2 text-sm font-medium">
            {singular.charAt(0).toUpperCase() + singular.slice(1)}
            <input
              autoFocus
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  submit();
                }
              }}
              className="min-h-11 rounded-xl border border-white/[0.12] bg-slate-900 px-3.5 outline-none focus:border-cyan-300/50"
            />
          </label>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="min-h-11 rounded-xl border border-white/10 px-4 text-sm font-semibold"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={submit}
              className="min-h-11 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-400 px-4 text-sm font-semibold text-slate-950"
            >
              {editing == null ? 'Add item' : 'Save item'}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </fieldset>
  );
}

function InputField({
  label,
  error,
  help,
  suffix,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string; help?: string; suffix?: string }) {
  const id = props.id ?? props.name;
  const descriptionId = error || help ? `${id}-description` : undefined;
  return (
    <div className="grid gap-1.5">
      <label className="text-[13px] font-medium text-slate-200" htmlFor={id}>
        {label}
      </label>
      <div className="relative">
        <input
          {...props}
          id={id}
          aria-describedby={descriptionId}
          className={cn(
            'min-h-11 w-full rounded-xl border border-white/[0.12] bg-slate-950/45 px-3.5 text-sm text-white outline-none transition placeholder:text-slate-600 hover:border-white/20 focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-400/10',
            suffix && 'pr-12',
          )}
          aria-invalid={Boolean(error)}
        />
        {suffix ? (
          <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-slate-500">
            {suffix}
          </span>
        ) : null}
      </div>
      {error || help ? (
        <span
          id={descriptionId}
          className={cn('text-xs leading-5', error ? 'font-medium text-rose-300' : 'text-slate-500')}
        >
          {error ?? help}
        </span>
      ) : null}
    </div>
  );
}

function SelectField({
  label,
  error,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { label: string; error?: string }) {
  const id = props.id ?? props.name;
  return (
    <div className="grid gap-1.5">
      <label className="text-[13px] font-medium text-slate-200" htmlFor={id}>
        {label}
      </label>
      <select
        {...props}
        id={id}
        className="min-h-11 rounded-xl border border-white/[0.12] bg-slate-950/60 px-3.5 text-sm text-white outline-none focus:border-cyan-300/50"
        aria-invalid={Boolean(error)}
      >
        {children}
      </select>
      {error ? <span className="text-xs font-medium text-rose-300">{error}</span> : null}
    </div>
  );
}

function TextAreaField({
  label,
  error,
  help,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; error?: string; help?: string }) {
  const id = props.id ?? props.name;
  const descriptionId = error || help ? `${id}-description` : undefined;
  return (
    <div className="grid gap-1.5">
      <label className="text-[13px] font-medium text-slate-200" htmlFor={id}>
        {label}
      </label>
      <textarea
        {...props}
        id={id}
        aria-describedby={descriptionId}
        className="w-full resize-y rounded-xl border border-white/[0.12] bg-slate-950/45 px-3.5 py-3 text-sm leading-6 text-white outline-none focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-400/10"
        aria-invalid={Boolean(error)}
      />
      {error || help ? (
        <span
          id={descriptionId}
          className={cn('text-xs leading-5', error ? 'font-medium text-rose-300' : 'text-slate-500')}
        >
          {error ?? help}
        </span>
      ) : null}
    </div>
  );
}

function sectionTitle(section: ProfileSectionId) {
  return profileSections.find(({ id }) => id === section)?.label ?? 'Health Profile';
}
function sectionDescription(section: ProfileSectionId) {
  return {
    personal: 'Your identity-linked details and preferred contact information.',
    basic: 'Essential physical information kept as neutral health context.',
    medical: 'Allergies, conditions, medications, and relevant background information.',
    emergency: 'A trusted contact stored with your private Patient record.',
  }[section];
}
function toFormValues(profile: PatientProfile): FormValues {
  return {
    dateOfBirth: profile.dateOfBirth ?? '',
    gender: profile.gender ?? '',
    bloodGroup: profile.bloodGroup ?? '',
    phone: profile.phone ?? '',
    address: profile.address ?? '',
    heightCm: profile.heightCm?.toString() ?? '',
    weightKg: profile.weightKg?.toString() ?? '',
    allergies: profile.allergies,
    chronicConditions: profile.chronicConditions,
    currentMedications: profile.currentMedications,
    familyMedicalHistory: profile.familyMedicalHistory ?? '',
    lifestyleInformation: profile.lifestyleInformation ?? '',
    emergencyContactName: profile.emergencyContact.name ?? '',
    emergencyContactPhone: profile.emergencyContact.phone ?? '',
    emergencyContactRelationship: profile.emergencyContact.relationship ?? '',
  };
}
function toApiInput(values: FormValues): UpdatePatientProfileInput {
  return {
    dateOfBirth: nullable(values.dateOfBirth),
    gender: nullable(values.gender) as PatientGender | null,
    bloodGroup: nullable(values.bloodGroup) as BloodGroup | null,
    phone: nullable(values.phone),
    address: nullable(values.address),
    heightCm: numberOrNull(values.heightCm),
    weightKg: numberOrNull(values.weightKg),
    allergies: values.allergies,
    chronicConditions: values.chronicConditions,
    currentMedications: values.currentMedications,
    familyMedicalHistory: nullable(values.familyMedicalHistory),
    lifestyleInformation: nullable(values.lifestyleInformation),
    emergencyContactName: nullable(values.emergencyContactName),
    emergencyContactPhone: nullable(values.emergencyContactPhone),
    emergencyContactRelationship: nullable(values.emergencyContactRelationship),
  };
}
function nullable(value: string) {
  const trimmed = value.trim();
  return trimmed || null;
}
function numberOrNull(value: string) {
  const trimmed = value.trim();
  return trimmed ? Number(trimmed) : null;
}
