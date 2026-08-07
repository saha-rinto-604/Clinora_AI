package com.clinora.users.domain;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;

import org.junit.jupiter.api.Test;

class UserRoleTest {

    @Test
    void definesExactlyTheSixApprovedRoles() {
        assertArrayEquals(
            new UserRole[] {
                UserRole.PATIENT,
                UserRole.DOCTOR,
                UserRole.HOSPITAL_ADMIN,
                UserRole.RESEARCHER,
                UserRole.BLOOD_BANK_STAFF,
                UserRole.SYSTEM_ADMIN
            },
            UserRole.values()
        );
    }
}
