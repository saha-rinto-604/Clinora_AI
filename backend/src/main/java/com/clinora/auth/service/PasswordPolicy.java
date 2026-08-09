package com.clinora.auth.service;

import com.clinora.auth.api.AuthApiException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

@Component
public class PasswordPolicy {

    public void validate(String password) {
        boolean valid = password != null
            && password.length() >= 8
            && password.length() <= 128
            && password.chars().anyMatch(Character::isUpperCase)
            && password.chars().anyMatch(Character::isLowerCase)
            && password.chars().anyMatch(Character::isDigit)
            && password.chars().anyMatch(character -> !Character.isLetterOrDigit(character));

        if (!valid) {
            throw new AuthApiException(
                HttpStatus.BAD_REQUEST,
                "PASSWORD_POLICY_FAILED",
                "Password must contain uppercase, lowercase, number, and special characters."
            );
        }
    }
}
