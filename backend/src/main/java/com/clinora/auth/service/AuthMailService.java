package com.clinora.auth.service;

import com.clinora.config.EmailProperties;
import com.clinora.notifications.email.EmailDeliveryPort;
import com.clinora.notifications.email.TransactionalEmail;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import org.springframework.stereotype.Service;

@Service
public class AuthMailService {

    private final EmailDeliveryPort emailDeliveryPort;
    private final EmailProperties emailProperties;

    public AuthMailService(EmailDeliveryPort emailDeliveryPort, EmailProperties emailProperties) {
        this.emailDeliveryPort = emailDeliveryPort;
        this.emailProperties = emailProperties;
    }

    public void sendPatientVerification(String to, String firstName, String rawToken) {
        String link = link("/verify-email", rawToken);
        emailDeliveryPort.send(new TransactionalEmail(
            to,
            "Verify your Clinora AI email",
            "Hi " + firstName + ", verify your Clinora AI email: " + link,
            "<p>Hi " + escape(firstName) + ",</p>"
                + "<p>Verify your Clinora AI email to activate your Patient account.</p>"
                + "<p><a href=\"" + link + "\">Verify email</a></p>"
                + "<p>This link is single-use and expires automatically.</p>"
        ));
    }

    public void sendPasswordReset(String to, String firstName, String rawToken) {
        String link = link("/reset-password", rawToken);
        emailDeliveryPort.send(new TransactionalEmail(
            to,
            "Reset your Clinora AI password",
            "Hi " + firstName + ", reset your Clinora AI password: " + link,
            "<p>Hi " + escape(firstName) + ",</p>"
                + "<p>Use the secure link below to reset your Clinora AI password.</p>"
                + "<p><a href=\"" + link + "\">Reset password</a></p>"
                + "<p>If you did not request this, you can ignore this email.</p>"
        ));
    }

    private String link(String path, String token) {
        String base = emailProperties.getFrontendUrl().replaceAll("/+$", "");
        return base + path + "?token=" + URLEncoder.encode(token, StandardCharsets.UTF_8);
    }

    private String escape(String value) {
        return value
            .replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;")
            .replace("\"", "&quot;")
            .replace("'", "&#39;");
    }
}
