import { execFileSync } from "node:child_process";
import { createHmac, randomUUID } from "node:crypto";
import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname
  .replace(/^\/(.:\/)/, "$1")
  .replaceAll("/", "\\");
const API = "http://localhost:8080/api/v1";
const STATE = join(tmpdir(), "clinora-phase5c-5g-smoke-state.json");

function docker(args, options = {}) {
  return execFileSync("docker", ["compose", ...args], {
    cwd: ROOT,
    encoding: "utf8",
    stdio: options.capture === false ? "inherit" : ["ignore", "pipe", "pipe"],
  }).trim();
}

function sql(statement) {
  return docker([
    "exec",
    "-T",
    "postgres",
    "psql",
    "-U",
    "clinora",
    "-d",
    "clinora",
    "-At",
    "-v",
    "ON_ERROR_STOP=1",
    "-c",
    statement,
  ]);
}

function configureMinioClient() {
  const user = docker(["exec", "-T", "minio", "printenv", "MINIO_ROOT_USER"]);
  const password = docker([
    "exec",
    "-T",
    "minio",
    "printenv",
    "MINIO_ROOT_PASSWORD",
  ]);
  docker([
    "exec",
    "-T",
    "minio",
    "mc",
    "alias",
    "set",
    "smoke",
    "http://localhost:9000",
    user,
    password,
  ]);
}

function minioObject(command, objectKey) {
  configureMinioClient();
  return docker([
    "exec",
    "-T",
    "minio",
    "mc",
    command,
    `smoke/clinora-medical-reports/${objectKey}`,
  ]);
}

function bcryptHash(password) {
  const classpath = [
    join(
      homedir(),
      ".m2",
      "repository",
      "org",
      "springframework",
      "security",
      "spring-security-crypto",
      "6.5.2",
      "spring-security-crypto-6.5.2.jar",
    ),
    join(
      homedir(),
      ".m2",
      "repository",
      "commons-logging",
      "commons-logging",
      "1.1.1",
      "commons-logging-1.1.1.jar",
    ),
  ].join(";");
  const source = [
    "import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;",
    `System.out.println(new BCryptPasswordEncoder(12).encode(${JSON.stringify(password)}));`,
    "/exit",
  ].join("\n");
  const output = execFileSync("jshell", ["--class-path", classpath, "-s"], {
    input: source,
    encoding: "utf8",
  });
  const hash = output.match(/\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}/)?.[0];
  if (!hash)
    throw new Error("Unable to generate an isolated BCrypt smoke credential.");
  return hash;
}

async function request(
  path,
  { token, method = "GET", body, headers = {}, expected = [200] } = {},
) {
  const response = await fetch(API + path, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body && !(body instanceof FormData)
        ? { "Content-Type": "application/json" }
        : {}),
      ...headers,
    },
    body:
      body instanceof FormData
        ? body
        : body === undefined
          ? undefined
          : JSON.stringify(body),
  });
  const contentType = response.headers.get("content-type") ?? "";
  const payload = contentType.includes("json")
    ? await response.json()
    : new Uint8Array(await response.arrayBuffer());
  if (!expected.includes(response.status)) {
    throw new Error(
      `${method} ${path} returned ${response.status}: ${JSON.stringify(payload)}`,
    );
  }
  return { status: response.status, payload, headers: response.headers };
}

function quote(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function apiData(result) {
  return result.payload.data;
}

function createSmokeUser(email, passwordHash, firstName, lastName) {
  const id = randomUUID();
  sql(`INSERT INTO users
    (id, first_name, last_name, email, normalized_email, password_hash, role, account_status,
     email_verified_at, created_at, updated_at, version)
    VALUES (${quote(id)}, ${quote(firstName)}, ${quote(lastName)}, ${quote(email)}, ${quote(email.toLowerCase())},
      ${quote(passwordHash)}, 'PATIENT', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0)`);
  return id;
}

function accessToken(userId, role) {
  const secret = docker(["exec", "-T", "backend", "printenv", "JWT_SECRET"]);
  const issuer =
    docker(["exec", "-T", "backend", "printenv", "AUTH_JWT_ISSUER"]) ||
    "clinora-ai";
  const now = Math.floor(Date.now() / 1000);
  const encode = (value) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  const header = encode({ alg: "HS256", typ: "JWT" });
  const payload = encode({
    iss: issuer,
    sub: userId,
    jti: randomUUID(),
    iat: now,
    exp: now + 900,
    role,
  });
  const signature = createHmac("sha256", secret)
    .update(`${header}.${payload}`)
    .digest("base64url");
  return `${header}.${payload}.${signature}`;
}

async function health() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch("http://localhost:8080/actuator/health");
      if (response.ok && (await response.json()).status === "UP") return;
    } catch {
      // Backend is restarting.
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error("Backend did not become healthy after restart.");
}

async function forbiddenSubscription(token, otherUserId) {
  return await new Promise((resolve, reject) => {
    const socket = new WebSocket("ws://localhost:8080/ws");
    const timeout = setTimeout(() => {
      socket.close();
      reject(
        new Error("Forbidden cross-user STOMP subscription was not rejected."),
      );
    }, 6000);
    socket.addEventListener("open", () => {
      socket.send(
        `CONNECT\naccept-version:1.2\nAuthorization:Bearer ${token}\nheart-beat:0,0\n\n\0`,
      );
    });
    socket.addEventListener("message", (event) => {
      const frame = String(event.data);
      if (frame.startsWith("CONNECTED")) {
        socket.send(
          `SUBSCRIBE\nid:cross-user\ndestination:/user/${otherUserId}/queue/notifications\nack:auto\n\n\0`,
        );
      } else if (frame.startsWith("ERROR")) {
        clearTimeout(timeout);
        socket.close();
        resolve();
      }
    });
    socket.addEventListener("close", () => {
      clearTimeout(timeout);
      resolve();
    });
    socket.addEventListener("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });
}

function cleanup(state) {
  if (!state) return;
  for (const objectKey of state.objectKeys ?? []) {
    try {
      minioObject("rm", objectKey);
    } catch {
      // The failed upload or object cleanup may already have removed it.
    }
  }
  const userIds = state.userIds.length
    ? state.userIds.map(quote).join(",")
    : quote("00000000-0000-0000-0000-000000000000");
  const applicationIds = state.applicationIds.length
    ? state.applicationIds.map(quote).join(",")
    : quote("00000000-0000-0000-0000-000000000000");
  sql(`BEGIN;
    DELETE FROM outbox_events WHERE user_id IN (${userIds});
    DELETE FROM notifications WHERE user_id IN (${userIds});
    DELETE FROM notification_preferences WHERE user_id IN (${userIds});
    DELETE FROM patient_timeline_events WHERE patient_user_id IN (${userIds});
    DELETE FROM patient_body_measurement_snapshots WHERE patient_user_id IN (${userIds});
    DELETE FROM appointment_report_shares WHERE patient_user_id IN (${userIds}) OR doctor_user_id IN (${userIds});
    DELETE FROM appointments WHERE patient_user_id IN (${userIds}) OR doctor_user_id IN (${userIds});
    DELETE FROM doctor_availability_slots WHERE doctor_user_id IN (${userIds});
    DELETE FROM doctor_booking_profiles WHERE doctor_user_id IN (${userIds});
    DELETE FROM patient_medical_reports WHERE patient_user_id IN (${userIds});
    DELETE FROM patient_allergies WHERE patient_profile_id IN (SELECT id FROM patient_profiles WHERE user_id IN (${userIds}));
    DELETE FROM patient_chronic_conditions WHERE patient_profile_id IN (SELECT id FROM patient_profiles WHERE user_id IN (${userIds}));
    DELETE FROM patient_current_medications WHERE patient_profile_id IN (SELECT id FROM patient_profiles WHERE user_id IN (${userIds}));
    DELETE FROM patient_profiles WHERE user_id IN (${userIds});
    DELETE FROM auth_audit_events WHERE actor_user_id IN (${userIds});
    DELETE FROM auth_sessions WHERE user_id IN (${userIds});
    DELETE FROM email_verification_tokens WHERE user_id IN (${userIds});
    DELETE FROM password_reset_tokens WHERE user_id IN (${userIds});
    DELETE FROM doctor_application_details WHERE application_id IN (${applicationIds});
    DELETE FROM access_applications WHERE id IN (${applicationIds});
    DELETE FROM users WHERE id IN (${userIds});
    COMMIT;`);
  if (existsSync(STATE)) unlinkSync(STATE);
}

if (process.argv.includes("--cleanup")) {
  cleanup(JSON.parse(readFileSync(STATE, "utf8")));
  console.log("Phase 5C–5G smoke fixtures removed.");
  process.exit(0);
}

const suffix = Date.now().toString(36);
const password = `Smoke#${suffix}Aa1`;
const identities = {
  patientA: {
    email: `phase5-${suffix}-a@example.test`,
    first: "Phase",
    last: "Patient A",
  },
  patientB: {
    email: `phase5-${suffix}-b@example.test`,
    first: "Phase",
    last: "Patient B",
  },
  doctorA: {
    email: `phase5-${suffix}-doctor-a@example.test`,
    first: "Phase",
    last: "Doctor A",
  },
  doctorB: {
    email: `phase5-${suffix}-doctor-b@example.test`,
    first: "Phase",
    last: "Doctor B",
  },
};
const state = {
  userIds: [],
  applicationIds: [],
  objectKeys: [],
  credentials: { password, identities },
};
let keep = process.env.KEEP_SMOKE_DATA === "true";

try {
  const passwordHash = bcryptHash(password);
  for (const identity of Object.values(identities)) {
    identity.id = createSmokeUser(
      identity.email,
      passwordHash,
      identity.first,
      identity.last,
    );
    state.userIds.push(identity.id);
  }

  const now = new Date().toISOString();
  for (const [index, doctor] of [
    identities.doctorA,
    identities.doctorB,
  ].entries()) {
    doctor.applicationId = randomUUID();
    state.applicationIds.push(doctor.applicationId);
    sql(`BEGIN;
      UPDATE users SET role='DOCTOR', updated_at=CURRENT_TIMESTAMP WHERE id=${quote(doctor.id)};
      INSERT INTO access_applications
        (id, application_type, first_name, last_name, email, normalized_email, status,
         processing_consent_at, email_verified_at, attested_at, submitted_at, created_at, updated_at, version)
      VALUES (${quote(doctor.applicationId)}, 'DOCTOR', ${quote(doctor.first)}, ${quote(doctor.last)},
        ${quote(doctor.email)}, ${quote(doctor.email.toLowerCase())}, 'ACTIVATED',
        ${quote(now)}, ${quote(now)}, ${quote(now)}, ${quote(now)}, ${quote(now)}, ${quote(now)}, 0);
      INSERT INTO doctor_application_details
        (application_id, professional_title, specialization, years_experience, registration_jurisdiction,
         registration_authority, registration_number, registration_type, registration_valid_until)
      VALUES (${quote(doctor.applicationId)}, 'Doctor', ${quote(index === 0 ? "Internal Medicine" : "Family Medicine")},
        8, 'Bangladesh', 'Smoke verification authority', ${quote(`SMOKE-${suffix}-${index}`)},
        'Temporary runtime verification', CURRENT_DATE + INTERVAL '1 day');
      COMMIT;`);
  }

  const tokens = {
    patientA: accessToken(identities.patientA.id, "PATIENT"),
    patientB: accessToken(identities.patientB.id, "PATIENT"),
    doctorA: accessToken(identities.doctorA.id, "DOCTOR"),
    doctorB: accessToken(identities.doctorB.id, "DOCTOR"),
  };

  const baselineProfile = {
    dateOfBirth: "1991-04-12",
    gender: "FEMALE",
    bloodGroup: "A_POSITIVE",
    phone: "+8801700000000",
    address: "Dhaka",
    heightCm: 165,
    weightKg: 63,
    familyMedicalHistory: "None reported",
    lifestyleInformation: "Active",
    emergencyContactName: "Smoke Contact",
    emergencyContactPhone: "+8801800000000",
    emergencyContactRelationship: "Sibling",
    allergies: ["Penicillin"],
    chronicConditions: ["Asthma"],
    currentMedications: ["Inhaler"],
  };
  const updatePatientAProfile = async (overrides = {}) =>
    apiData(
      await request("/patient/profile", {
        token: tokens.patientA,
        method: "PATCH",
        body: { ...baselineProfile, ...overrides },
      }),
    );
  const measurementCount = () =>
    Number(
      sql(
        `SELECT COUNT(*) FROM patient_body_measurement_snapshots WHERE patient_user_id=${quote(identities.patientA.id)}`,
      ),
    );
  const measurementEventCount = () =>
    Number(
      sql(
        `SELECT COUNT(*) FROM patient_timeline_events WHERE patient_user_id=${quote(identities.patientA.id)} AND event_type='BODY_MEASUREMENT_RECORDED'`,
      ),
    );

  await updatePatientAProfile();
  // This disposable fixture intentionally emulates a Patient whose current Profile predates V18.
  sql(`BEGIN;
    DELETE FROM patient_body_measurement_snapshots WHERE patient_user_id=${quote(identities.patientA.id)};
    DELETE FROM patient_timeline_events WHERE patient_user_id=${quote(identities.patientA.id)}
      AND event_type IN ('BODY_MEASUREMENT_RECORDED', 'BODY_MEASUREMENT_UPDATED');
    COMMIT;`);

  await updatePatientAProfile({
    lifestyleInformation: "Active lifestyle updated",
  });
  if (measurementCount() !== 0)
    throw new Error(
      "An unrelated Lifestyle update created a measurement point.",
    );
  let timeline = apiData(
    await request("/patient/timeline?limit=50", { token: tokens.patientA }),
  );
  if (!timeline.items.some((item) => item.eventType === "LIFESTYLE_UPDATED")) {
    throw new Error(
      "Lifestyle update was not represented in Patient health activity.",
    );
  }

  const weight64Profile = await updatePatientAProfile({
    weightKg: 64,
    lifestyleInformation: "Active lifestyle updated",
  });
  if (
    Number(weight64Profile.weightKg) !== 64 ||
    measurementCount() !== 1 ||
    measurementEventCount() !== 1
  ) {
    throw new Error(
      "The first real weight change did not create exactly one snapshot and timeline event.",
    );
  }
  let record = apiData(
    await request("/patient/history", { token: tokens.patientA }),
  );
  let trends = apiData(
    await request("/patient/health-trends", { token: tokens.patientA }),
  );
  if (
    Number(record.currentMeasurements.weightKg) !== 64 ||
    trends.points.length !== 1
  ) {
    throw new Error(
      "Health Record did not expose the first persisted measurement correctly.",
    );
  }

  const weight63Profile = await updatePatientAProfile({
    weightKg: 63,
    lifestyleInformation: "Active lifestyle updated",
  });
  record = apiData(
    await request("/patient/history", { token: tokens.patientA }),
  );
  trends = apiData(
    await request("/patient/health-trends", { token: tokens.patientA }),
  );
  const weights = trends.points.map((point) => Number(point.weightKg));
  if (
    Number(weight63Profile.weightKg) !== 63 ||
    measurementCount() !== 2 ||
    measurementEventCount() !== 2 ||
    weights.join(",") !== "64,63" ||
    Number(record.currentMeasurements.weightKg) !== 63 ||
    Number(record.currentMeasurements.bmi) !== 23.1 ||
    Number(trends.points[1].bmi) !== 23.1
  ) {
    throw new Error(
      "The second weight change did not produce a truthful chronological Weight/BMI trend.",
    );
  }

  await updatePatientAProfile({
    weightKg: 63,
    lifestyleInformation: "Active lifestyle updated",
  });
  if (measurementCount() !== 2 || measurementEventCount() !== 2) {
    throw new Error("Saving unchanged measurements created duplicate history.");
  }

  await updatePatientAProfile({
    weightKg: 63,
    lifestyleInformation: "Active lifestyle updated",
    allergies: ["Penicillin", "Tree pollen"],
  });
  record = apiData(
    await request("/patient/history", { token: tokens.patientA }),
  );
  const treePollen = record.clinicalEssentials.allergies.find(
    (item) => item.name === "Tree pollen",
  );
  if (!treePollen || treePollen.sourceType !== "PATIENT_PROFILE") {
    throw new Error(
      "The Patient-entered allergy was not exposed read-only with Profile provenance.",
    );
  }
  await updatePatientAProfile({
    weightKg: 63,
    lifestyleInformation: "Active lifestyle updated",
    allergies: ["Penicillin"],
  });
  record = apiData(
    await request("/patient/history", { token: tokens.patientA }),
  );
  timeline = apiData(
    await request("/patient/timeline?limit=50", { token: tokens.patientA }),
  );
  if (
    record.clinicalEssentials.allergies.some(
      (item) => item.name === "Tree pollen",
    ) ||
    !timeline.items.some(
      (item) =>
        item.eventType === "ALLERGY_ADDED" && item.detail === "Tree pollen",
    ) ||
    !timeline.items.some(
      (item) =>
        item.eventType === "ALLERGY_REMOVED" && item.detail === "Tree pollen",
    )
  ) {
    throw new Error(
      "Allergy current state and append-only addition/removal history diverged.",
    );
  }

  const pdf = new TextEncoder().encode(
    "%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF",
  );
  const form = new FormData();
  form.set("reportName", "Phase 5 runtime report");
  form.set("reportType", "LAB_RESULTS");
  form.set("reportDate", "2026-08-30");
  form.set("providerLaboratory", "Runtime verification");
  form.set(
    "file",
    new Blob([pdf], { type: "application/pdf" }),
    "phase5-runtime.pdf",
  );
  const report = apiData(
    await request("/patient/reports", {
      token: tokens.patientA,
      method: "POST",
      body: form,
    }),
  );
  state.reportId = report.id;
  const objectKey = sql(
    `SELECT object_key FROM patient_medical_reports WHERE id=${quote(report.id)}`,
  );
  state.objectKeys.push(objectKey);
  minioObject("stat", objectKey);
  const anonymousObject = await fetch(
    `http://localhost:9000/clinora-medical-reports/${objectKey}`,
  );
  if (![401, 403].includes(anonymousObject.status))
    throw new Error("MinIO report object is not private.");

  await request("/patient/reports?collection=ACTIVE&page=1&size=20", {
    token: tokens.patientA,
  });
  await request(`/patient/reports/${report.id}/content`, {
    token: tokens.patientA,
  });
  await request(`/patient/reports/${report.id}/download`, {
    token: tokens.patientA,
  });
  await request(`/patient/reports/${report.id}`, {
    token: tokens.patientA,
    method: "PATCH",
    body: {
      reportName: "Phase 5 edited report",
      reportType: "LAB_RESULTS",
      reportDate: "2026-08-29",
      providerLaboratory: "Runtime verified",
    },
  });
  await request(`/patient/reports/${report.id}/archive`, {
    token: tokens.patientA,
    method: "POST",
  });
  await request(`/patient/reports/${report.id}/restore`, {
    token: tokens.patientA,
    method: "POST",
  });
  await request(`/patient/reports/${report.id}`, {
    token: tokens.patientB,
    expected: [404],
  });
  await request(`/patient/reports/${report.id}/content`, { expected: [401] });

  const infected = new FormData();
  infected.set("reportName", "Malware rejection test");
  infected.set("reportType", "OTHER");
  const eicar = Buffer.from(
    "WDVPIVAlQEFQWzRcUFpYNTQoUF4pN0NDKTd9JEVJQ0FSLVNUQU5EQVJELUFOVElWSVJVUy1URVNULUZJTEUhJEgrSCo=",
    "base64",
  );
  const infectedPdf = Buffer.concat([
    Buffer.from("%PDF-1.4\n1 0 obj<</Length 68>>stream\n"),
    eicar,
    Buffer.from("\nendstream\nendobj\ntrailer<</Root 1 0 R>>\n%%EOF"),
  ]);
  infected.set(
    "file",
    new Blob([infectedPdf], { type: "application/pdf" }),
    "eicar.pdf",
  );
  await request("/patient/reports", {
    token: tokens.patientA,
    method: "POST",
    body: infected,
    expected: [400],
  });

  const start = new Date(Date.now() + 2 * 60 * 60 * 1000);
  start.setUTCSeconds(0, 0);
  const end = new Date(start.getTime() + 120 * 60 * 1000);
  const slots = apiData(
    await request("/doctor/availability", {
      token: tokens.doctorA,
      method: "POST",
      body: {
        startsAt: start.toISOString(),
        endsAt: end.toISOString(),
        slotMinutes: 30,
        timezone: "Asia/Dhaka",
      },
    }),
  );
  await request("/patient/doctors", { token: tokens.patientA });
  await request(`/patient/doctors/${identities.doctorA.id}`, {
    token: tokens.patientA,
  });

  const bookingBody = {
    slotId: slots[0].id,
    reasonForVisit: "Runtime concurrency verification",
    timezone: "Asia/Dhaka",
    reportIds: [],
  };
  const [raceA, raceB] = await Promise.all([
    request("/patient/appointments", {
      token: tokens.patientA,
      method: "POST",
      headers: { "Idempotency-Key": randomUUID() },
      body: bookingBody,
      expected: [200, 409],
    }),
    request("/patient/appointments", {
      token: tokens.patientB,
      method: "POST",
      headers: { "Idempotency-Key": randomUUID() },
      body: bookingBody,
      expected: [200, 409],
    }),
  ]);
  if ([raceA.status, raceB.status].sort().join(",") !== "200,409")
    throw new Error(
      "Same-slot concurrency did not produce exactly one booking.",
    );

  const appointment = apiData(
    await request("/patient/appointments", {
      token: tokens.patientA,
      method: "POST",
      headers: { "Idempotency-Key": randomUUID() },
      body: {
        slotId: slots[1].id,
        reasonForVisit: "Shared report verification",
        timezone: "Asia/Dhaka",
        reportIds: [report.id],
      },
    }),
  );
  state.appointmentId = appointment.id;
  await request(`/patient/appointments/${appointment.id}`, {
    token: tokens.patientB,
    expected: [404],
  });
  await request(`/patient/appointments/${appointment.id}/reschedule`, {
    token: tokens.patientA,
    method: "POST",
    body: { slotId: slots[2].id, timezone: "Asia/Dhaka" },
  });
  await request(`/doctor/appointments/${appointment.id}/reports`, {
    token: tokens.doctorA,
  });
  await request(
    `/doctor/appointments/${appointment.id}/reports/${report.id}/content`,
    { token: tokens.doctorA },
  );
  await request(
    `/doctor/appointments/${appointment.id}/reports/${report.id}/content`,
    { token: tokens.doctorB, expected: [404] },
  );
  await request(
    `/patient/appointments/${appointment.id}/report-shares/${report.id}`,
    { token: tokens.patientA, method: "DELETE" },
  );
  await request(
    `/doctor/appointments/${appointment.id}/reports/${report.id}/content`,
    { token: tokens.doctorA, expected: [404] },
  );
  await request(`/patient/appointments/${appointment.id}/report-shares`, {
    token: tokens.patientA,
    method: "POST",
    body: { reportId: report.id },
  });
  await request(`/patient/appointments/${appointment.id}/cancel`, {
    token: tokens.patientA,
    method: "POST",
    body: { reason: "Runtime lifecycle verification" },
  });
  await request(
    `/doctor/appointments/${appointment.id}/reports/${report.id}/content`,
    { token: tokens.doctorA, expected: [404] },
  );

  await new Promise((resolve) => setTimeout(resolve, 4500));
  const notifications = apiData(
    await request("/patient/notifications?limit=50", {
      token: tokens.patientA,
    }),
  );
  if (notifications.items.length < 2)
    throw new Error("Persistent appointment notifications were not created.");
  await request(`/patient/notifications/${notifications.items[0].id}/read`, {
    token: tokens.patientA,
    method: "POST",
  });
  await request("/patient/notifications/read-all", {
    token: tokens.patientA,
    method: "POST",
  });
  const preferences = apiData(
    await request("/patient/notifications/preferences", {
      token: tokens.patientA,
    }),
  );
  await request("/patient/notifications/preferences", {
    token: tokens.patientA,
    method: "PATCH",
    body: { ...preferences, reportsEmail: !preferences.reportsEmail },
  });
  const pendingOutbox = Number(
    sql(
      `SELECT COUNT(*) FROM outbox_events WHERE user_id=${quote(identities.patientA.id)} AND published_at IS NULL`,
    ),
  );
  if (pendingOutbox !== 0)
    throw new Error("Notification outbox was not published through RabbitMQ.");
  await forbiddenSubscription(tokens.patientA, identities.patientB.id);

  docker(["restart", "backend"]);
  await health();
  await request(`/patient/reports/${report.id}`, { token: tokens.patientA });
  await request("/patient/timeline?limit=50", { token: tokens.patientA });
  const persistedTrends = apiData(
    await request("/patient/health-trends", { token: tokens.patientA }),
  );
  if (
    persistedTrends.points.length !== 2 ||
    persistedTrends.points.map((point) => Number(point.weightKg)).join(",") !==
      "64,63"
  ) {
    throw new Error(
      "Measurement history did not persist across backend restart.",
    );
  }
  await request("/patient/appointments?collection=PAST", {
    token: tokens.patientA,
  });
  await request("/patient/notifications?limit=50", { token: tokens.patientA });
  minioObject("stat", objectKey);

  writeFileSync(STATE, JSON.stringify(state, null, 2));
  console.log(
    JSON.stringify(
      {
        result: "PASS",
        patientEmail: identities.patientA.email,
        password,
        reportId: report.id,
        appointmentId: appointment.id,
        timelineEvents: timeline.items.length,
        measurementSnapshots: persistedTrends.points.length,
        weights: persistedTrends.points.map((point) => Number(point.weightKg)),
        notifications: notifications.items.length,
        stateFile: STATE,
      },
      null,
      2,
    ),
  );
} catch (error) {
  keep = false;
  throw error;
} finally {
  if (!keep) cleanup(state);
}
