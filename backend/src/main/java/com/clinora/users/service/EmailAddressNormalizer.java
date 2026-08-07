package com.clinora.users.service;

import java.util.Locale;
import org.springframework.stereotype.Component;

@Component
public class EmailAddressNormalizer {

    public String normalize(String email) {
        if (email == null) {
            throw new IllegalArgumentException("Email must not be null");
        }
        return email.trim().toLowerCase(Locale.ROOT);
    }
}
