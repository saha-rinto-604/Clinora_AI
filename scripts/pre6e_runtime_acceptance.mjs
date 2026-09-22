import { readFileSync } from 'node:fs';

const baseUrl = process.env.CLINORA_RUNTIME_BASE_URL ?? 'http://localhost:8080/api/v1';
const env = Object.fromEntries(
  readFileSync(new URL('../.env', import.meta.url), 'utf8')
    .split(/\r?\n/)
    .filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => {
      const separator = line.indexOf('=');
      return [line.slice(0, separator), line.slice(separator + 1)];
    }),
);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function request(path, { token, method = 'GET', body, idempotencyKey, allowFailure = false } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok && !allowFailure) {
    throw new Error(`${method} ${path} failed (${response.status}): ${payload?.message ?? 'unknown error'}`);
  }
  return { status: response.status, payload };
}

async function login(email, password) {
  const { payload } = await request('/auth/login', { method: 'POST', body: { email, password } });
  return payload.data;
}

function auth(session) {
  return session.accessToken;
}

async function addSlot(token, startsAt, mode) {
  const endsAt = new Date(startsAt.getTime() + 30 * 60_000);
  const { payload } = await request('/doctor/availability', {
    token,
    method: 'POST',
    body: {
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
      slotMinutes: 30,
      timezone: 'Asia/Dhaka',
      consultationMode: mode,
    },
  });
  return payload.data[0];
}

async function book(session, slot, mode, reason, reportIds = [], key = crypto.randomUUID()) {
  return request('/patient/appointments', {
    token: auth(session),
    method: 'POST',
    idempotencyKey: key,
    body: {
      slotId: slot.id,
      reasonForVisit: reason,
      timezone: 'Asia/Dhaka',
      consultationMode: mode,
      reportIds,
    },
  });
}

function assertParity(patient, doctor) {
  assert(patient.status === doctor.status, 'Patient/Doctor status mismatch');
  assert(patient.consultationMode === doctor.consultationMode, 'Patient/Doctor mode mismatch');
  assert(patient.scheduledStart === doctor.scheduledStart, 'Patient/Doctor start mismatch');
  assert(patient.scheduledEnd === doctor.scheduledEnd, 'Patient/Doctor end mismatch');
  assert(patient.reasonForVisit === doctor.reason, 'Patient/Doctor reason mismatch');
  assert(patient.meetingUrl === doctor.meetingUrl, 'Patient/Doctor meeting mismatch');
  assert(patient.visitLocation === doctor.visitLocation, 'Patient/Doctor location mismatch');
  assert(Number(patient.sharedReportCount) === doctor.sharedReports.length, 'Patient/Doctor report count mismatch');
}

const doctor = await login('arafat.hossain.doctor@clinora.test', env.CLINORA_DEV_DOCTORS_PASSWORD);
const patientOne = await login('rumana.akter.patient@clinora.test', env.CLINORA_DEV_PATIENTS_PASSWORD);
const patientTwo = await login('fahim.rahman.patient@clinora.test', env.CLINORA_DEV_PATIENTS_PASSWORD);

const doctorToken = auth(doctor);
const profileResponse = await request('/doctor/profile', { token: doctorToken });
const profile = profileResponse.payload.data;
const location = 'Clinora Test Practice, Dhanmondi, Dhaka';
await request('/doctor/profile', {
  token: doctorToken,
  method: 'PUT',
  body: {
    version: profile.version,
    ...profile.editable,
    practiceLocation: location,
    preferredTimezone: profile.editable.preferredTimezone ?? 'Asia/Dhaka',
    defaultConsultationMinutes: profile.editable.defaultConsultationMinutes ?? 30,
  },
});

const modes = ['ONLINE', 'IN_PERSON', 'BOTH', 'BOTH', 'ONLINE', 'BOTH'];
let slots;
for (let dayOffset = 90; dayOffset < 100 && !slots; dayOffset += 1) {
  const first = new Date(Date.now() + dayOffset * 24 * 60 * 60_000);
  first.setUTCMinutes(0, 0, 0);
  try {
    slots = [];
    for (let index = 0; index < modes.length; index += 1) {
      slots.push(await addSlot(doctorToken, new Date(first.getTime() + index * 60 * 60_000), modes[index]));
    }
  } catch (error) {
    slots = undefined;
    if (!String(error).includes('overlaps')) throw error;
  }
}
assert(slots?.length === modes.length, 'Could not create isolated runtime acceptance slots');

const doctorDetail = (await request(`/patient/doctors/${doctor.user.id}`, { token: auth(patientOne) })).payload.data;
assert(doctorDetail.doctor.practiceLocation === location, 'Patient Doctor profile does not expose practice location');
const acceptanceAvailability = (await request(
  `/patient/doctors/${doctor.user.id}/availability?after=${encodeURIComponent(new Date(new Date(slots[0].startsAt).getTime() - 1).toISOString())}&limit=100`,
  { token: auth(patientOne) },
)).payload.data;
for (const [index, mode] of modes.entries()) {
  assert(acceptanceAvailability.some((slot) => slot.id === slots[index].id && slot.consultationMode === mode), `Missing ${mode} runtime slot`);
}

const results = {};

const online = (await book(patientOne, slots[0], 'ONLINE', 'D1 online runtime acceptance')).payload.data;
assert(online.status === 'BOOKED' && online.consultationMode === 'ONLINE', 'D1 online booking was not immediately BOOKED');
assert(online.meetingUrl === null && online.visitLocation === null, 'D1 online logistics invariant failed');
const onlinePatient = (await request(`/patient/appointments/${online.id}`, { token: auth(patientOne) })).payload.data;
const onlineDoctor = (await request(`/doctor/appointments/${online.id}`, { token: doctorToken })).payload.data;
assertParity(onlinePatient, onlineDoctor);
const doctorSchedule = (await request('/doctor/appointments?scope=upcoming&limit=100&offset=0', { token: doctorToken })).payload.data;
assert(doctorSchedule.items.some((item) => item.id === online.id), 'D1 booking did not appear in Doctor schedule');
const zeroEvidence = (await request(`/doctor/appointments/${online.id}/clinical-support/route`, {
  token: doctorToken,
  method: 'POST',
  body: { message: 'Brief this patient', explicitTaskId: 'BRIEF_PATIENT', currentScreen: 'APPOINTMENT', selectedReportIds: [], selectedObservationIds: [], doctorAssessmentPresent: false, doctorNotesPresent: false },
})).payload.data;
assert(zeroEvidence.referencedContext.authorizedReportCount === 0, 'D4 Clinora received hidden report evidence');
results.D1 = 'PASS — ONLINE booked immediately; Patient/Doctor details and schedule agree';
results.D4 = 'PASS — zero-report booking succeeded; Doctor and Clinora report scope is empty';

const inPerson = (await book(patientOne, slots[1], 'IN_PERSON', 'D2 in-person runtime acceptance')).payload.data;
assert(inPerson.status === 'BOOKED' && inPerson.consultationMode === 'IN_PERSON', 'D2 in-person mode was not persisted');
assert(inPerson.visitLocation === location && inPerson.meetingUrl === null, 'D2 in-person logistics invariant failed');
const inPersonDoctor = (await request(`/doctor/appointments/${inPerson.id}`, { token: doctorToken })).payload.data;
assertParity(inPerson, inPersonDoctor);
results.D2 = 'PASS — IN_PERSON persisted with snapshotted visit location and no meeting URL';

const bothOnline = (await book(patientOne, slots[2], 'ONLINE', 'D3 BOTH as online')).payload.data;
const bothInPerson = (await book(patientOne, slots[3], 'IN_PERSON', 'D3 BOTH as in-person')).payload.data;
assert(bothOnline.consultationMode === 'ONLINE' && bothInPerson.consultationMode === 'IN_PERSON', 'D3 BOTH mode choice failed');
const consumedAttempt = await request('/patient/appointments', {
  token: auth(patientTwo),
  method: 'POST',
  idempotencyKey: crypto.randomUUID(),
  allowFailure: true,
  body: { slotId: slots[2].id, reasonForVisit: 'D3 consumed BOTH retry', timezone: 'Asia/Dhaka', consultationMode: 'IN_PERSON', reportIds: [] },
});
assert(consumedAttempt.status === 409 && consumedAttempt.payload?.errorCode === 'APPOINTMENT_SLOT_UNAVAILABLE', 'D3 consumed BOTH slot was bookable again');
results.D3 = 'PASS — BOTH accepted either explicit mode and each booking consumed one physical slot';

const reportPage = (await request('/patient/reports?collection=ACTIVE&page=1&size=20', { token: auth(patientOne) })).payload.data;
assert(reportPage.items.length >= 2, 'D5 requires at least two synthetic reports');
const selectedReport = reportPage.items[0];
const unsharedReport = reportPage.items[1];
const sharedAppointment = (await book(patientOne, slots[4], 'ONLINE', 'D5 selected report and revocation', [selectedReport.id])).payload.data;
let doctorReports = (await request(`/doctor/appointments/${sharedAppointment.id}/reports`, { token: doctorToken })).payload.data;
assert(doctorReports.length === 1 && doctorReports[0].id === selectedReport.id, 'D5 Doctor did not receive only the selected report');
assert(!doctorReports.some((item) => item.id === unsharedReport.id), 'D5 Doctor received an unshared report');
let scopedEvidence = (await request(`/doctor/appointments/${sharedAppointment.id}/clinical-support/route`, {
  token: doctorToken,
  method: 'POST',
  body: { message: 'Summarize selected evidence', explicitTaskId: 'BRIEF_PATIENT', currentScreen: 'APPOINTMENT', currentReportId: selectedReport.id, selectedReportIds: [selectedReport.id], selectedObservationIds: [], doctorAssessmentPresent: false, doctorNotesPresent: false },
})).payload.data;
assert(scopedEvidence.referencedContext.authorizedReportCount === 1, 'D5 Clinora did not receive the selected report scope');
await request(`/patient/appointments/${sharedAppointment.id}/report-shares/${selectedReport.id}`, { token: auth(patientOne), method: 'DELETE' });
doctorReports = (await request(`/doctor/appointments/${sharedAppointment.id}/reports`, { token: doctorToken })).payload.data;
assert(doctorReports.length === 0, 'D5 revoked report remained visible to Doctor');
scopedEvidence = (await request(`/doctor/appointments/${sharedAppointment.id}/clinical-support/route`, {
  token: doctorToken,
  method: 'POST',
  body: { message: 'Brief this patient', explicitTaskId: 'BRIEF_PATIENT', currentScreen: 'APPOINTMENT', selectedReportIds: [], selectedObservationIds: [], doctorAssessmentPresent: false, doctorNotesPresent: false },
})).payload.data;
assert(scopedEvidence.referencedContext.authorizedReportCount === 0, 'D5 revoked evidence remained in Clinora scope');
const revokedContent = await request(`/doctor/appointments/${sharedAppointment.id}/reports/${selectedReport.id}/content`, { token: doctorToken, allowFailure: true });
assert(revokedContent.status === 404, 'D5 Doctor retained revoked report file access');
results.D5 = 'PASS — only selected report exposed; revocation immediately removed UI/file/Clinora access';

const concurrencyBody = (slot, mode) => ({ slotId: slot.id, reasonForVisit: 'D6 concurrent booking', timezone: 'Asia/Dhaka', consultationMode: mode, reportIds: [] });
const [attemptOne, attemptTwo] = await Promise.all([
  request('/patient/appointments', { token: auth(patientOne), method: 'POST', idempotencyKey: crypto.randomUUID(), body: concurrencyBody(slots[5], 'ONLINE'), allowFailure: true }),
  request('/patient/appointments', { token: auth(patientTwo), method: 'POST', idempotencyKey: crypto.randomUUID(), body: concurrencyBody(slots[5], 'IN_PERSON'), allowFailure: true }),
]);
const statuses = [attemptOne.status, attemptTwo.status].sort();
assert(statuses[0] === 200 && statuses[1] === 409, `D6 expected one 200 and one 409, received ${statuses.join('/')}`);
const loser = attemptOne.status === 409 ? attemptOne : attemptTwo;
assert(loser.payload?.errorCode === 'APPOINTMENT_SLOT_UNAVAILABLE', 'D6 loser did not receive controlled slot-unavailable response');
results.D6 = 'PASS — simultaneous attempts produced exactly one booking and one controlled 409';

console.log(JSON.stringify({
  branchAcceptance: 'PRE-6E D1-D6',
  slotModes: slots.map(({ consultationMode }) => consultationMode),
  practiceLocationSource: 'doctor_booking_profiles.practice_location',
  ...results,
}, null, 2));
