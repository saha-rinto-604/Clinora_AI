# Phase 6 Doctor development accounts

These accounts are created only when the backend runs with the Spring `dev` profile and `CLINORA_DEV_DOCTORS_ENABLED=true`.
All Doctor accounts are email-verified, active, backed by an activated professional application, and have a completed professional-access interview.
Use the common Doctor password configured locally in `CLINORA_DEV_DOCTORS_PASSWORD`. Supporting Patient fixtures use the separate `CLINORA_DEV_PATIENTS_PASSWORD` so Doctor credentials are never reused for Patient logins.

| Doctor | Login email | Specialty | Workspace setup |
| --- | --- | --- | ---: |
| Dr. Arafat Hossain | `arafat.hossain.doctor@clinora.test` | Internal Medicine | 60% |
| Dr. Nusrat Jahan | `nusrat.jahan.doctor@clinora.test` | Obstetrics & Gynaecology | 65% |
| Dr. Farzana Rahman | `farzana.rahman.doctor@clinora.test` | Endocrinology | 70% |
| Dr. Tanvir Ahmed | `tanvir.ahmed.doctor@clinora.test` | Cardiology | 75% |
| Dr. Samira Islam | `samira.islam.doctor@clinora.test` | Paediatrics | 80% |
| Dr. Mahmudul Hasan | `mahmudul.hasan.doctor@clinora.test` | Neurology | 80% |
| Dr. Sadia Karim | `sadia.karim.doctor@clinora.test` | Dermatology | 85% |
| Dr. Imran Hossain | `imran.hossain.doctor@clinora.test` | Nephrology | 85% |
| Dr. Tasnim Akter | `tasnim.akter.doctor@clinora.test` | Haematology | 90% |
| Dr. Farhan Kabir | `farhan.kabir.doctor@clinora.test` | Gastroenterology | 90% |
| Dr. Nabila Sultana | `nabila.sultana.doctor@clinora.test` | Respiratory Medicine | 95% |
| Dr. Rafiul Islam | `rafiul.islam.doctor@clinora.test` | General Medicine | 100% |

`@clinora.test` is deliberately reserved for development so fixture email can never be delivered to a real person. The Doctor workspace does not add a demo/dummy badge; these accounts exercise the same authentication, authorization and professional-data paths as an approved Doctor account.

The setup percentage is not the Doctor's approval status. Approval/onboarding is complete for every account. It represents optional professional profile metadata and future Patient-booking availability so the UI can be tested across realistic setup states.

The seeder preserves existing local account status, Patient profile edits, future availability, appointment actions, report-share revocations, and structured-review state on normal restarts. Care scenarios refresh only after the previous fixture care is no longer active and not already changed during the current Dhaka day.

## Supporting Patient accounts

These accounts exist only to exercise Doctor appointment/report-consent scenarios. They use the separate `CLINORA_DEV_PATIENTS_PASSWORD` value.

- `rumana.akter.patient@clinora.test`
- `fahim.rahman.patient@clinora.test`
- `maliha.sultana.patient@clinora.test`
- `tahmid.hasan.patient@clinora.test`
- `nafisa.jahan.patient@clinora.test`
- `sabbir.ahmed.patient@clinora.test`

They are normal authenticated Patient fixtures; report visibility is still granted only through the explicit appointment report-share records seeded for the relevant scenario.
