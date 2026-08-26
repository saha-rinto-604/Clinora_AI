package com.clinora.auth.api;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.exc.UnrecognizedPropertyException;
import org.junit.jupiter.api.Test;

class AuthControllerRequestBindingTest {

    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void registerRequestRejectsPublicRoleManipulation() {
        String payload = """
            {
              "firstName": "Pat",
              "lastName": "Escalate",
              "email": "patient@example.test",
              "password": "ValidPass1!",
              "role": "SYSTEM_ADMIN",
              "accountStatus": "ACTIVE"
            }
            """;

        assertThrows(
            UnrecognizedPropertyException.class,
            () -> mapper.readValue(payload, AuthController.RegisterRequest.class)
        );
        assertArrayEquals(
            new String[] {"firstName", "lastName", "email", "password"},
            java.util.Arrays.stream(AuthController.RegisterRequest.class.getRecordComponents())
                .map(java.lang.reflect.RecordComponent::getName)
                .toArray(String[]::new)
        );
    }
}
